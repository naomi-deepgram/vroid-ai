/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/**
 * The size, in pixels, of the canvas a PlaywrightVrmScenePage renders
 * and captures frames from.
 */
interface ViewportSize {
  readonly height: number;
  readonly width:  number;
}

/**
 * Builds the HTML page the browser loads. It sets up an import map so
 * the bare "three" and "@pixiv/three-vrm" specifiers those packages'
 * own ESM builds use resolve to the vendor files this server serves,
 * and a canvas sized to match viewportSize for the scene script to
 * render into.
 * @param viewportSize - The pixel size of the canvas to create.
 * @returns The HTML document to serve at "/".
 */
const buildSceneHtml = (viewportSize: ViewportSize): string => {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<script type="importmap">
{
  "imports": {
    "three": "/vendor/three/build/three.module.js",
    "three/": "/vendor/three/",
    "@pixiv/three-vrm": "/vendor/three-vrm/lib/three-vrm.module.js"
  }
}
</script>
</head>
<body>
<canvas
  id="vroid-canvas"
  width="${String(viewportSize.width)}"
  height="${String(viewportSize.height)}"
></canvas>
<script type="module" src="/scene.js"></script>
</body>
</html>
`;
};

/**
 * Builds the browser-side scene script: it loads the VRM served at
 * "/model.vrm", relaxes it out of its default T-pose, lets its spring
 * bones (hair, breast physics, and similar jiggle bones) settle for
 * physicsSettleSeconds before anything gets recorded, frames a camera
 * on it, and exposes two globals for the Node side to drive rendering
 * through page.evaluate. __vroidReady resolves once all of that is
 * done; __vroidApplyFrame applies a single frame's expression weights
 * and idle motion offset and renders it to the canvas.
 * @param physicsSettleSeconds - How much simulated time to let spring
 * bones settle for before __vroidReady resolves.
 * @returns The scene script to serve at "/scene.js".
 */
// eslint-disable-next-line max-lines-per-function -- one big template literal, not real branching complexity
const buildSceneScript = (physicsSettleSeconds: number): string => {
  return `
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

const canvas = document.querySelector("#vroid-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(canvas.width, canvas.height, false);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x808080);

const camera = new THREE.PerspectiveCamera(
  30,
  canvas.width / canvas.height,
  0.1,
  20,
);

scene.add(new THREE.AmbientLight(0xffffff, 1.5));
const directional = new THREE.DirectionalLight(0xffffff, 1.5);
directional.position.set(1, 1, 1);
scene.add(directional);

const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));

let vrm = null;

/*
 * VRM humanoid rigs come out of the loader in their bind pose, which
 * for this rig (and most humanoid rigs) is a T-pose: both arms held
 * straight out to the sides. Rotating each upper arm down and each
 * lower arm in very slightly brings the model into a relaxed standing
 * pose instead, rotating around each arm's local Z axis (the
 * normalized humanoid rig guarantees this axis is consistent across
 * VRM models regardless of the raw skeleton's own bind pose). Applying
 * this before framing the camera or settling spring bones matters:
 * both the model's silhouette and how its hair drapes depend on the
 * arms already being down, not out.
 */
const relaxFromTPose = (targetVrm) => {
  const setUpperArmZ = (boneName, z) => {
    const bone = targetVrm.humanoid?.getNormalizedBoneNode(boneName);
    if (bone) {
      bone.rotation.z = z;
    }
  };

  setUpperArmZ("leftUpperArm", 1.2);
  setUpperArmZ("rightUpperArm", -1.2);
  setUpperArmZ("leftLowerArm", 0.15);
  setUpperArmZ("rightLowerArm", -0.15);
};

const frameCameraOn = (targetVrm) => {
  const box = new THREE.Box3().setFromObject(targetVrm.scene);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const headHeight = box.max.y - size.y * 0.08;

  camera.position.set(center.x, headHeight, size.z + size.y * 0.6);
  camera.lookAt(center.x, headHeight, center.z);
};

/*
 * Spring bones (hair, breast physics, and similar jiggle bones) are
 * simulated with a technique that references each bone's position on
 * the previous update() call. Right after a model loads, there is no
 * meaningful previous position yet, so the first handful of real
 * frames tend to show a visible snap or overshoot while that settles.
 * Running many small, simulated-time update() steps up front (rather
 * than waiting on the wall clock) lets that transient play out before
 * anything is actually recorded, at effectively no added real time.
 */
const settleSpringBones = (targetVrm, settleSeconds) => {
  const stepSeconds = 1 / 60;
  for (let elapsed = 0; elapsed < settleSeconds; elapsed += stepSeconds) {
    targetVrm.update(stepSeconds);
  }
};

globalThis.__vroidReady = loader.loadAsync("/model.vrm").then((gltf) => {
  vrm = gltf.userData.vrm;
  VRMUtils.rotateVRM0(vrm);
  scene.add(vrm.scene);

  relaxFromTPose(vrm);
  frameCameraOn(vrm);
  settleSpringBones(vrm, ${JSON.stringify(physicsSettleSeconds)});
});

globalThis.__vroidApplyFrame = (expressionWeights, idleMotionOffset) => {
  for (const [ name, value ] of Object.entries(expressionWeights)) {
    vrm.expressionManager?.setValue(name, value);
  }

  const chest = vrm.humanoid?.getNormalizedBoneNode("chest");
  if (chest) {
    chest.scale.setScalar(idleMotionOffset.chestScale);
  }

  const head = vrm.humanoid?.getNormalizedBoneNode("head");
  if (head) {
    head.rotation.x = idleMotionOffset.headTiltRadians;
  }

  vrm.update(1 / 30);
  renderer.render(scene, camera);
};
`;
};

export { buildSceneHtml, buildSceneScript, type ViewportSize };
