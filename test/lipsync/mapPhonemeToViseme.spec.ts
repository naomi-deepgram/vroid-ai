/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */

import { describe, expect, it } from "vitest";
import { mapPhonemeToViseme } from "../../src/lipsync/mapPhonemeToViseme.js";

describe("mapPhonemeToViseme", () => {
  it.each([
    [ "a", "aa" ],
    [ "e", "ee" ],
    [ "i", "ih" ],
    [ "o", "oh" ],
    [ "u", "ou" ],
    [ "y", "ih" ],
  ] as const)("should map %s clusters to the %s viseme", (
    phonemeCluster,
    expectedViseme,
  ) => {
    expect.assertions(1);
    expect(mapPhonemeToViseme(phonemeCluster)).toBe(expectedViseme);
  });

  it("should map a consonant cluster to the consonant viseme", () => {
    expect.assertions(1);
    expect(mapPhonemeToViseme("ll")).toBe("consonant");
  });

  it("should map an empty cluster to the silence viseme", () => {
    expect.assertions(1);
    expect(mapPhonemeToViseme("")).toBe("silence");
  });

  it("should be case-insensitive", () => {
    expect.assertions(1);
    expect(mapPhonemeToViseme("A")).toBe("aa");
  });
});
