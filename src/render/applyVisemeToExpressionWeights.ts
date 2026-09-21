/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

import type { Viseme } from "../types/viseme.js";

/**
 * The VRM 1.0 standard mouth blend shape weights this pipeline drives.
 * Each value should be in the 0-1 range.
 */
interface VisemeExpressionWeights {
  readonly aa: number;
  readonly ee: number;
  readonly ih: number;
  readonly oh: number;
  readonly ou: number;
}

const zeroWeights: VisemeExpressionWeights = {
  aa: 0,
  ee: 0,
  ih: 0,
  oh: 0,
  ou: 0,
};

/**
 * Converts a single coarse viseme into VRM 1.0 standard mouth blend
 * shape weights. "silence" and "consonant" both resolve to all-zero
 * weights, since VRM's default expression set has no dedicated
 * closed-mouth consonant shape distinct from a relaxed mouth.
 * @param viseme - The viseme to convert into expression weights.
 * @returns The blend shape weights to apply to the VRM expression
 * manager for this viseme.
 */
const applyVisemeToExpressionWeights = (
  viseme: Viseme,
): VisemeExpressionWeights => {
  if (viseme === "silence" || viseme === "consonant") {
    return { ...zeroWeights };
  }

  return { ...zeroWeights, [viseme]: 1 };
};

export { applyVisemeToExpressionWeights, type VisemeExpressionWeights };
