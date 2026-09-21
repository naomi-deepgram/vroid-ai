/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */

import { describe, expect, it } from "vitest";
import { mapWordToPhonemes } from "../../src/lipsync/mapWordToPhonemes.js";

describe("mapWordToPhonemes", () => {
  it("should split a word into alternating vowel/consonant clusters", () => {
    expect.assertions(1);
    expect(mapWordToPhonemes("hello")).toStrictEqual([ "h", "e", "ll", "o" ]);
  });

  it("should lower-case the word before splitting", () => {
    expect.assertions(1);
    expect(mapWordToPhonemes("Hello")).toStrictEqual([ "h", "e", "ll", "o" ]);
  });

  it("should strip punctuation before splitting", () => {
    expect.assertions(1);
    expect(mapWordToPhonemes("hello!")).toStrictEqual([ "h", "e", "ll", "o" ]);
  });

  it("should return an empty array for a word with no letters", () => {
    expect.assertions(1);
    expect(mapWordToPhonemes("123")).toStrictEqual([]);
  });

  it("should return an empty array for an empty string", () => {
    expect.assertions(1);
    expect(mapWordToPhonemes("")).toStrictEqual([]);
  });

  it("should return a single cluster for an all-consonant word", () => {
    expect.assertions(1);
    expect(mapWordToPhonemes("shh")).toStrictEqual([ "shh" ]);
  });
});
