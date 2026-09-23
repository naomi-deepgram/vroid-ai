/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */

import { describe, expect, it } from "vitest";
import {
  buildSceneHtml,
  buildSceneScript,
} from "../../src/render/buildVrmSceneAssets.js";

describe("buildSceneHtml", () => {
  it("should size the canvas to the given viewport", () => {
    expect.assertions(2);

    const html = buildSceneHtml({ height: 480, width: 640 });

    expect(html).toContain("width=\"640\"");
    expect(html).toContain("height=\"480\"");
  });

  it("should map the bare specifiers the scene script imports", () => {
    expect.assertions(3);

    const html = buildSceneHtml({ height: 512, width: 512 });

    expect(html).toContain(
      "\"three\": \"/vendor/three/build/three.module.js\"",
    );
    expect(html).toContain("\"three/\": \"/vendor/three/\"");
    expect(html).toContain(
      "\"@pixiv/three-vrm\": \"/vendor/three-vrm/lib/three-vrm.module.js\"",
    );
  });
});

describe("buildSceneScript", () => {
  it("should embed the given physics settle duration", () => {
    expect.assertions(1);

    const script = buildSceneScript(5);

    expect(script).toContain("settleSpringBones(vrm, 5);");
  });

  it("should relax the model's arms out of its T-pose bind pose", () => {
    expect.assertions(4);

    const script = buildSceneScript(3);

    expect(script).toContain("setUpperArmZ(\"leftUpperArm\", 1.2)");
    expect(script).toContain("setUpperArmZ(\"rightUpperArm\", -1.2)");
    expect(script).toContain("setUpperArmZ(\"leftLowerArm\", 0.15)");
    expect(script).toContain("setUpperArmZ(\"rightLowerArm\", -0.15)");
  });

  it("should call the pose, framing, and settling steps once loaded", () => {
    expect.assertions(3);

    const script = buildSceneScript(3);

    expect(script).toContain("relaxFromTPose(vrm);");
    expect(script).toContain("frameCameraOn(vrm);");
    expect(script).toContain("VRMUtils.rotateVRM0(vrm);");
  });

  it("should expose the two globals rendering is driven through", () => {
    expect.assertions(2);

    const script = buildSceneScript(3);

    expect(script).toContain("globalThis.__vroidReady");
    expect(script).toContain("globalThis.__vroidApplyFrame");
  });
});
