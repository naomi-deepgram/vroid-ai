/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

import { mapPhonemeToViseme } from "./mapPhonemeToViseme.js";
import { mapWordToPhonemes } from "./mapWordToPhonemes.js";
import type { VisemeCue, WordTiming } from "../types/viseme.js";

const silenceGapThresholdMs = 40;

/**
 * Converts Flux TTS word-level timings into a per-viseme cue timeline by
 * splitting each word into naive phoneme clusters (see
 * mapWordToPhonemes) and spreading them evenly across that word's known
 * start/end window. Gaps between words larger than
 * silenceGapThresholdMs are filled with an explicit "silence" cue so
 * the mouth closes between words rather than holding the last shape.
 * @param wordTimings - Word-level timings from a Flux TTS speak result.
 * @returns The viseme cues to play back against the synthesised audio.
 */
const buildVisemeTimeline = (
  wordTimings: ReadonlyArray<WordTiming>,
): Array<VisemeCue> => {
  const cues: Array<VisemeCue> = [];
  let previousEndMs = 0;

  for (const wordTiming of wordTimings) {
    const gapMs = wordTiming.startMs - previousEndMs;

    if (gapMs > silenceGapThresholdMs) {
      cues.push({
        endMs:   wordTiming.startMs,
        startMs: previousEndMs,
        viseme:  "silence",
      });
    }

    const phonemeClusters = mapWordToPhonemes(wordTiming.word);
    const clusterCount = phonemeClusters.length;

    if (clusterCount === 0) {
      previousEndMs = wordTiming.endMs;
      continue;
    }

    const wordDurationMs = wordTiming.endMs - wordTiming.startMs;
    const clusterDurationMs = wordDurationMs / clusterCount;

    for (const [ clusterIndex, phonemeCluster ] of phonemeClusters.entries()) {
      const clusterOffsetMs = clusterIndex * clusterDurationMs;
      const cueStartMs = wordTiming.startMs + clusterOffsetMs;

      cues.push({
        endMs:   cueStartMs + clusterDurationMs,
        startMs: cueStartMs,
        viseme:  mapPhonemeToViseme(phonemeCluster),
      });
    }

    previousEndMs = wordTiming.endMs;
  }

  return cues;
};

export { buildVisemeTimeline };
