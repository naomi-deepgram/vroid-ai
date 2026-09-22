/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

import {
  applyVisemeToExpressionWeights,
  type VisemeExpressionWeights,
} from "./applyVisemeToExpressionWeights.js";
import {
  createIdleMotionOffset,
  type IdleMotionOffset,
} from "./createIdleMotionOffset.js";
import { findActiveViseme } from "./findActiveViseme.js";
import type { FrameRenderer, RenderedFrame } from "./renderVrmVideo.js";
import type { VisemeCue } from "../types/viseme.js";

/**
 * Applies a single frame's expression weights and idle motion offset to
 * an already-loaded VRM scene, and captures the result as a PNG. The
 * concrete implementation (see createPlaywrightVrmScenePage) owns the
 * actual browser page, VRM model, and renderer; this interface only
 * describes what createVrmPageFrameRenderer needs from it.
 */
interface VrmScenePage {
  readonly applyFrame: (
    expressionWeights: VisemeExpressionWeights,
    idleMotionOffset: IdleMotionOffset,
  )=> Promise<void>;
  readonly captureFrame: ()=> Promise<Buffer>;
}

/**
 * Builds a FrameRenderer for a single dialogue line's viseme timeline.
 * VrmScenePage owns the scene, VRM model, and rendering entirely; this
 * function only decides what to render for a given timestamp (which
 * viseme's expression weights, and what idle motion offset) and hands
 * that decision off to vrmScenePage to apply and capture.
 * @param vrmScenePage - Applies a frame's state to the loaded VRM scene
 * and captures its canvas.
 * @param visemeCues - The viseme cue timeline to drive lip sync from.
 * @returns A FrameRenderer ready to pass to renderVrmVideo.
 */
const createVrmPageFrameRenderer = (
  vrmScenePage: VrmScenePage,
  visemeCues: ReadonlyArray<VisemeCue>,
): FrameRenderer => {
  return {
    renderFrame: async(timestampMs: number): Promise<RenderedFrame> => {
      const viseme = findActiveViseme(visemeCues, timestampMs);
      const expressionWeights = applyVisemeToExpressionWeights(viseme);
      const idleMotionOffset = createIdleMotionOffset(timestampMs);

      await vrmScenePage.applyFrame(expressionWeights, idleMotionOffset);
      const pngBuffer = await vrmScenePage.captureFrame();

      return { pngBuffer, timestampMs };
    },
  };
};

export { createVrmPageFrameRenderer, type VrmScenePage };
