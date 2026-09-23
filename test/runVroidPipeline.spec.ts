/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runVroidPipeline } from "../src/runVroidPipeline.js";

/*
 * This is the one test in the suite that needs every real dependency
 * the pipeline needs at once: a real Deepgram API key, a real .vrm
 * fixture, and a real ffmpeg binary. Unlike the other two real
 * dependencies, a missing DEEPGRAM_API_KEY isn't something this
 * repository can install or fix in CI; a real key has to be supplied
 * by whoever runs this test. It skips gracefully when any of the
 * three is absent, and runVroidPipeline.ts stays excluded from the
 * coverage threshold in vitest.config.ts for the same reason as the
 * other two real integration files.
 */
const fixturePath = fileURLToPath(
  new URL("fixtures/naomi.vrm", import.meta.url),
);

/**
 * Checks whether a real "ffmpeg" binary is reachable on the PATH.
 * @returns Whether "ffmpeg -version" ran successfully.
 */
const isFfmpegAvailable = (): boolean => {
  try {
    execFileSync("ffmpeg", [ "-version" ], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
const canRunRealPipeline
  = deepgramApiKey !== undefined
    && existsSync(fixturePath)
    && isFfmpegAvailable();

describe.skipIf(!canRunRealPipeline)("runVroidPipeline", () => {
  it("should produce a real playable video from real dialogue", async() => {
    expect.assertions(2);

    const temporaryDirectory = await mkdtemp(
      join(tmpdir(), "vroid-pipeline-test-"),
    );
    const outputPath = join(temporaryDirectory, "output.mp4");

    try {
      await runVroidPipeline({
        deepgramApiKey: deepgramApiKey ?? "",
        dialogueText:   "Hi there!",
        outputPath:     outputPath,
        vrmFilePath:    fixturePath,
      });

      const outputBytes = await readFile(outputPath);
      expect(outputBytes.length).toBeGreaterThan(0);
      expect(outputBytes.subarray(4, 8).toString("ascii")).toBe("ftyp");
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  }, 60_000);
});
