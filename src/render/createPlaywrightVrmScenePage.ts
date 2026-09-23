/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { createRequire } from "node:module";
import { dirname, extname, join } from "node:path";
import { chromium } from "playwright";
import {
  buildSceneHtml,
  buildSceneScript,
  type ViewportSize,
} from "./buildVrmSceneAssets.js";
import type {
  VisemeExpressionWeights,
} from "./applyVisemeToExpressionWeights.js";
import type { IdleMotionOffset } from "./createIdleMotionOffset.js";
import type { VrmScenePage } from "./createVrmPageFrameRenderer.js";

const nodeRequire = createRequire(import.meta.url);

/**
 * Finds the root directory of an installed package by resolving one of
 * its files with require.resolve and walking up until a package.json
 * is found. Resolving "&lt;pkg&gt;/package.json" directly would be
 * simpler, but not every package's "exports" map actually exposes that
 * subpath (for example, "three" doesn't), so this only relies on
 * resolving the package's normal entry point.
 * @param moduleSpecifier - The package to find the root directory of.
 * @returns The absolute path of the package's root directory.
 * @throws {Error} If no package.json can be found above the resolved
 * entry point.
 */
const findPackageRoot = (moduleSpecifier: string): string => {
  let currentDirectory = dirname(nodeRequire.resolve(moduleSpecifier));

  while (!existsSync(join(currentDirectory, "package.json"))) {
    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      throw new Error(
        `createPlaywrightVrmScenePage: could not find the package root for "${moduleSpecifier}"`,
      );
    }

    currentDirectory = parentDirectory;
  }

  return currentDirectory;
};

/*
 * Both packages ship as ESM importing "three" (and, for three-vrm, its
 * own submodules) via bare specifiers, which only resolve in a browser
 * via an import map. The "import" paths used to build that map further
 * down are hardcoded to their real ESM entry points, since those are
 * what the browser actually needs to load, rather than derived from
 * these roots.
 */
const threeRoot = findPackageRoot("three");
const threeVrmRoot = findPackageRoot("@pixiv/three-vrm");

/**
 * Options controlling how createPlaywrightVrmScenePage renders a VRM.
 */
interface CreatePlaywrightVrmScenePageOptions {
  readonly physicsSettleSeconds?: number;
  readonly viewportSize?:         ViewportSize;
}

/**
 * A VrmScenePage backed by a real headless Playwright browser, plus a
 * way to tear down the browser and its local asset server once
 * rendering is finished.
 */
interface PlaywrightVrmScenePage extends VrmScenePage {
  readonly close: ()=> Promise<void>;
}

/**
 * The functions the browser-side scene script (see buildSceneScript)
 * exposes on the global object for the Node side to call into via
 * page.evaluate. This project has no "dom" lib configured, so these
 * globals are accessed through a cast rather than through "window".
 */
interface VroidSceneGlobals {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- must match the browser-side global name exactly
  readonly __vroidApplyFrame: (
    expressionWeights: VisemeExpressionWeights,
    idleMotionOffset: IdleMotionOffset,
  )=> void;
  // eslint-disable-next-line @typescript-eslint/naming-convention -- must match the browser-side global name exactly
  readonly __vroidReady: Promise<void>;
}

/**
 * The three static assets a VrmSceneServer serves at fixed paths: the
 * page itself, its scene script, and the VRM model being rendered.
 */
interface VrmSceneAssets {
  readonly sceneHtml:   string;
  readonly sceneScript: string;
  readonly vrmFilePath: string;
}

const defaultViewportSize: ViewportSize = { height: 512, width: 512 };
const defaultPhysicsSettleSeconds = 3;

/*
 * This sandboxed environment has no GPU, so headless Chromium needs a
 * software WebGL implementation to render anything at all. These flags
 * are harmless on a machine with a real GPU too.
 */
const chromiumSoftwareRenderingArguments = [
  "--use-gl=swiftshader",
  "--enable-webgl",
  "--ignore-gpu-blocklist",
  "--enable-unsafe-swiftshader",
];

const contentTypesByExtension = new Map<string, string>([
  [ ".html", "text/html" ],
  [ ".js", "text/javascript" ],
]);

/**
 * Resolves a request path under "/vendor/..." to the real file it
 * should be served from, or null if the path isn't a vendor path.
 * @param pathname - The requested URL path.
 * @returns The local file path to serve, or null.
 */
const resolveVendorFilePath = (pathname: string): string | null => {
  const threeVrmPrefix = "/vendor/three-vrm/";
  const threePrefix = "/vendor/three/";

  if (pathname.startsWith(threeVrmPrefix)) {
    return join(threeVrmRoot, pathname.slice(threeVrmPrefix.length));
  }

  if (pathname.startsWith(threePrefix)) {
    return join(threeRoot, pathname.slice(threePrefix.length));
  }

  return null;
};

/**
 * Writes a complete response: a status code, a single Content-Type
 * header, and a body. Centralising this is what keeps the
 * non-camelCase "Content-Type" header name to a single disable.
 * @param response - The HTTP response to write to.
 * @param contentType - The MIME type to send as the Content-Type
 * header.
 * @param body - The response body to send.
 */
const respondWithContent = (
  response: ServerResponse,
  contentType: string,
  body: Buffer | string,
): void => {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- "Content-Type" is the real HTTP header name
  response.writeHead(200, { "Content-Type": contentType });
  response.end(body);
};

/**
 * The content type and body to serve for a resolved request path.
 */
interface ResolvedSceneAsset {
  readonly body:        Buffer | string;
  readonly contentType: string;
}

/**
 * Figures out what to serve for a request path: the scene HTML, the
 * scene script, the VRM model being rendered, or a vendored
 * "three"/"@pixiv/three-vrm" file. Returns null for any other path.
 * @param pathname - The requested URL path.
 * @param assets - The scene HTML, scene script, and VRM file path this
 * server serves.
 * @returns The content type and body to serve, or null if the path
 * doesn't match anything this server serves.
 */
const resolveSceneAsset = async(
  pathname: string,
  assets: VrmSceneAssets,
): Promise<ResolvedSceneAsset | null> => {
  if (pathname === "/") {
    return { body: assets.sceneHtml, contentType: "text/html" };
  }

  if (pathname === "/scene.js") {
    return { body: assets.sceneScript, contentType: "text/javascript" };
  }

  if (pathname === "/model.vrm") {
    const modelBytes = await readFile(assets.vrmFilePath);
    return { body: modelBytes, contentType: "application/octet-stream" };
  }

  const vendorFilePath = resolveVendorFilePath(pathname);
  if (vendorFilePath !== null) {
    const fileBytes = await readFile(vendorFilePath);
    const contentType
      = contentTypesByExtension.get(extname(vendorFilePath))
        ?? "application/octet-stream";
    return { body: fileBytes, contentType: contentType };
  }

  return null;
};

/**
 * Serves a single request, resolving it via resolveSceneAsset and
 * writing a 404 for anything unresolved or any read failure.
 * @param request - The incoming HTTP request.
 * @param response - The HTTP response to write to.
 * @param assets - The scene HTML, scene script, and VRM file path this
 * server serves.
 */
const handleSceneServerRequest = async(
  request: IncomingMessage,
  response: ServerResponse,
  assets: VrmSceneAssets,
): Promise<void> => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");

  try {
    const resolvedAsset = await resolveSceneAsset(url.pathname, assets);
    if (resolvedAsset === null) {
      response.writeHead(404);
      response.end();
      return;
    }

    respondWithContent(
      response,
      resolvedAsset.contentType,
      resolvedAsset.body,
    );
  } catch {
    response.writeHead(404);
    response.end();
  }
};

/**
 * Starts a local HTTP server serving the scene HTML, scene script, the
 * given VRM model, and the vendored "three"/"@pixiv/three-vrm" files
 * those need. Chromium's import map can only resolve to real HTTP(S)
 * URLs, so the scene page has to be served rather than opened as a
 * local file.
 * @param vrmFilePath - Local path of the .vrm file to serve.
 * @param viewportSize - The pixel size of the canvas to create.
 * @param physicsSettleSeconds - How much simulated time to let spring
 * bones settle for before the scene page is considered ready.
 * @returns The running server and the local port it bound to.
 */
const startVrmSceneServer = async(
  vrmFilePath: string,
  viewportSize: ViewportSize,
  physicsSettleSeconds: number,
): Promise<{ port: number; server: Server }> => {
  const assets: VrmSceneAssets = {
    sceneHtml:   buildSceneHtml(viewportSize),
    sceneScript: buildSceneScript(physicsSettleSeconds),
    vrmFilePath: vrmFilePath,
  };

  const server = createServer((request, response) => {
    void handleSceneServerRequest(request, response, assets);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error(
      "createPlaywrightVrmScenePage: failed to bind a scene server port",
    );
  }

  return { port: address.port, server: server };
};

/**
 * Closes a Playwright browser and its backing scene server together.
 * @param browser - The browser to close.
 * @param browser.close - Closes the browser and its pages.
 * @param server - The scene server to stop.
 */
const closeBrowserAndServer = async(
  browser: { close: ()=> Promise<void> },
  server: Server,
): Promise<void> => {
  await browser.close();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
};

/**
 * Builds a VrmScenePage backed by a real headless Playwright browser.
 * It starts a local server to serve the given VRM file alongside the
 * "three" and "@pixiv/three-vrm" vendor files the scene script needs,
 * loads the model, and returns a page ready for
 * createVrmPageFrameRenderer to drive frame-by-frame. Call close() once
 * rendering is finished to release the browser and stop the server.
 * @param vrmFilePath - Local path of the .vrm file to render.
 * @param options - Which canvas size to render at.
 * @returns A PlaywrightVrmScenePage ready to pass to
 * createVrmPageFrameRenderer.
 */
const createPlaywrightVrmScenePage = async(
  vrmFilePath: string,
  options: CreatePlaywrightVrmScenePageOptions = {},
): Promise<PlaywrightVrmScenePage> => {
  const viewportSize = options.viewportSize ?? defaultViewportSize;
  const physicsSettleSeconds
    = options.physicsSettleSeconds ?? defaultPhysicsSettleSeconds;
  const { port, server } = await startVrmSceneServer(
    vrmFilePath,
    viewportSize,
    physicsSettleSeconds,
  );
  const browser = await chromium.launch({
    args: chromiumSoftwareRenderingArguments,
  });
  const page = await browser.newPage({ viewport: viewportSize });

  await page.goto(`http://127.0.0.1:${String(port)}/`);
  await page.evaluate(async() => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, no-underscore-dangle -- globalThis has no static type for this browser-injected global; the name must match the scene script exactly
    await (globalThis as unknown as VroidSceneGlobals).__vroidReady;
  });

  const canvas = page.locator("#vroid-canvas");

  return {
    applyFrame: async(
      expressionWeights: VisemeExpressionWeights,
      idleMotionOffset: IdleMotionOffset,
    ): Promise<void> => {
      await page.evaluate(
        ({ frameExpressionWeights, frameIdleMotionOffset }) => {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, no-underscore-dangle -- globalThis has no static type for this browser-injected global; the name must match the scene script exactly
          (globalThis as unknown as VroidSceneGlobals).__vroidApplyFrame(
            frameExpressionWeights,
            frameIdleMotionOffset,
          );
        },
        {
          frameExpressionWeights: expressionWeights,
          frameIdleMotionOffset:  idleMotionOffset,
        },
      );
    },
    captureFrame: async(): Promise<Buffer> => {
      return await canvas.screenshot();
    },
    close: async(): Promise<void> => {
      await closeBrowserAndServer(browser, server);
    },
  };
};

export {
  createPlaywrightVrmScenePage,
  type CreatePlaywrightVrmScenePageOptions,
  type PlaywrightVrmScenePage,
  type ViewportSize,
};
