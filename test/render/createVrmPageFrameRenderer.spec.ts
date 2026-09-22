/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */
/* eslint-disable max-lines-per-function -- Test suites naturally have many cases */
/* eslint-disable max-nested-callbacks -- Vitest structure requires nesting */

import { describe, expect, it, vi } from "vitest";
import {
  createIdleMotionOffset,
} from "../../src/render/createIdleMotionOffset.js";
import {
  createVrmPageFrameRenderer,
  type VrmScenePage,
} from "../../src/render/createVrmPageFrameRenderer.js";
import type { VisemeCue } from "../../src/types/viseme.js";

describe("createVrmPageFrameRenderer", () => {
  it("should apply the expression weights for the active viseme", async() => {
    expect.assertions(1);

    const visemeCues: ReadonlyArray<VisemeCue> = [
      { endMs: 200, startMs: 0, viseme: "aa" },
    ];
    const applyFrame = vi.fn().mockResolvedValue(undefined);
    const captureFrame = vi.fn().mockResolvedValue(Buffer.from("png"));
    const vrmScenePage: VrmScenePage = { applyFrame, captureFrame };

    const frameRenderer = createVrmPageFrameRenderer(vrmScenePage, visemeCues);
    await frameRenderer.renderFrame(100);

    expect(applyFrame).toHaveBeenCalledWith(
      { aa: 1, ee: 0, ih: 0, oh: 0, ou: 0 },
      createIdleMotionOffset(100),
    );
  });

  it("should apply all-zero weights outside of any cue", async() => {
    expect.assertions(1);

    const applyFrame = vi.fn().mockResolvedValue(undefined);
    const captureFrame = vi.fn().mockResolvedValue(Buffer.from("png"));
    const vrmScenePage: VrmScenePage = { applyFrame, captureFrame };

    const frameRenderer = createVrmPageFrameRenderer(vrmScenePage, []);
    await frameRenderer.renderFrame(500);

    expect(applyFrame).toHaveBeenCalledWith(
      { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 },
      createIdleMotionOffset(500),
    );
  });

  it("should return the captured PNG alongside the timestamp", async() => {
    expect.assertions(1);

    const applyFrame = vi.fn().mockResolvedValue(undefined);
    const pngBuffer = Buffer.from("fake-png-bytes");
    const captureFrame = vi.fn().mockResolvedValue(pngBuffer);
    const vrmScenePage: VrmScenePage = { applyFrame, captureFrame };

    const frameRenderer = createVrmPageFrameRenderer(vrmScenePage, []);
    const result = await frameRenderer.renderFrame(250);

    expect(result).toStrictEqual({ pngBuffer: pngBuffer, timestampMs: 250 });
  });

  it("should apply the frame before capturing it", async() => {
    expect.assertions(1);

    const callOrder: Array<string> = [];
    const applyFrame = vi.fn().mockImplementation(async() => {
      callOrder.push("applyFrame");
    });
    const captureFrame = vi.fn().mockImplementation(async() => {
      callOrder.push("captureFrame");
      return Buffer.from("png");
    });
    const vrmScenePage: VrmScenePage = { applyFrame, captureFrame };

    const frameRenderer = createVrmPageFrameRenderer(vrmScenePage, []);
    await frameRenderer.renderFrame(0);

    expect(callOrder).toStrictEqual([ "applyFrame", "captureFrame" ]);
  });
});
