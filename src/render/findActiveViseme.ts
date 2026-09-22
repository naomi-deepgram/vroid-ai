/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

import type { Viseme, VisemeCue } from "../types/viseme.js";

/**
 * Finds which viseme should be showing on the avatar's face at a given
 * point in time, based on a viseme cue timeline built by
 * buildVisemeTimeline. Falls back to "silence" for any timestamp not
 * covered by a cue (before the first cue, after the last, or inside a
 * gap too small for buildVisemeTimeline to bother filling), since both
 * "silence" and "consonant" resolve to the same relaxed mouth shape via
 * applyVisemeToExpressionWeights.
 * @param visemeCues - The viseme cue timeline to search.
 * @param timestampMs - The point in time to look up, in milliseconds.
 * @returns The viseme active at that timestamp.
 */
const findActiveViseme = (
  visemeCues: ReadonlyArray<VisemeCue>,
  timestampMs: number,
): Viseme => {
  const activeCue = visemeCues.find((cue) => {
    return timestampMs >= cue.startMs && timestampMs < cue.endMs;
  });

  return activeCue?.viseme ?? "silence";
};

export { findActiveViseme };
