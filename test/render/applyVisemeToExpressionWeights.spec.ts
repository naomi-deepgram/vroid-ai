/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */

import { describe, expect, it } from "vitest";
import { applyVisemeToExpressionWeights } from
  "../../src/render/applyVisemeToExpressionWeights.js";

describe("applyVisemeToExpressionWeights", () => {
  it("should zero every weight for silence", () => {
    expect.assertions(1);
    expect(applyVisemeToExpressionWeights("silence")).toStrictEqual({
      aa: 0,
      ee: 0,
      ih: 0,
      oh: 0,
      ou: 0,
    });
  });

  it("should zero every weight for consonant", () => {
    expect.assertions(1);
    expect(applyVisemeToExpressionWeights("consonant")).toStrictEqual({
      aa: 0,
      ee: 0,
      ih: 0,
      oh: 0,
      ou: 0,
    });
  });

  it.each([ "aa", "ee", "ih", "oh", "ou" ] as const)(
    "should set only the %s weight to 1 for the %s viseme",
    (viseme) => {
      expect.assertions(1);
      expect(applyVisemeToExpressionWeights(viseme)).toStrictEqual({
        aa: viseme === "aa"
          ? 1
          : 0,
        ee: viseme === "ee"
          ? 1
          : 0,
        ih: viseme === "ih"
          ? 1
          : 0,
        oh: viseme === "oh"
          ? 1
          : 0,
        ou: viseme === "ou"
          ? 1
          : 0,
      });
    },
  );
});
