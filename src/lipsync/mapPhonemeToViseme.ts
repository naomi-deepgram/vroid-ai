/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

import type { Viseme } from "../types/viseme.js";

const vowelToViseme: Record<string, Viseme> = {
  a: "aa",
  e: "ee",
  i: "ih",
  o: "oh",
  u: "ou",
  y: "ih",
};

/**
 * Maps a single naive phoneme cluster (see mapWordToPhonemes) to a coarse
 * viseme category. Vowel clusters map to their matching mouth shape;
 * everything else collapses to a generic "consonant" shape, which is a
 * reasonable simplification for the handful of visemes most VRM models
 * expose as blend shapes.
 * @param phonemeCluster - A single cluster produced by mapWordToPhonemes.
 * @returns The coarse viseme category for that cluster.
 */
const mapPhonemeToViseme = (phonemeCluster: string): Viseme => {
  const firstCharacter = phonemeCluster[0]?.toLowerCase();

  if (firstCharacter === undefined) {
    return "silence";
  }

  return vowelToViseme[firstCharacter] ?? "consonant";
};

export { mapPhonemeToViseme };
