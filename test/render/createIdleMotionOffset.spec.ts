/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */

import { describe, expect, it } from "vitest";
import { createIdleMotionOffset } from
  "../../src/render/createIdleMotionOffset.js";

describe("createIdleMotionOffset", () => {
  it("should return the resting pose at time zero", () => {
    expect.assertions(1);
    expect(createIdleMotionOffset(0)).toStrictEqual({
      chestScale:      1,
      headTiltRadians: 0,
    });
  });

  it("should peak the breath amplitude at a quarter of its period", () => {
    expect.assertions(1);
    const { chestScale } = createIdleMotionOffset(1000);

    expect(chestScale).toBeCloseTo(1.02, 5);
  });

  it("should peak the sway amplitude at a quarter of its period", () => {
    expect.assertions(1);
    const { headTiltRadians } = createIdleMotionOffset(1500);

    expect(headTiltRadians).toBeCloseTo(0.03, 5);
  });
});
