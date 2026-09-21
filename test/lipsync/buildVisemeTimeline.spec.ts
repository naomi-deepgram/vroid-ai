/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */
/* eslint-disable max-lines-per-function -- Test suites naturally have many cases */
/* eslint-disable max-nested-callbacks -- Vitest structure requires nesting */

import { describe, expect, it } from "vitest";
import { buildVisemeTimeline } from "../../src/lipsync/buildVisemeTimeline.js";

describe("buildVisemeTimeline", () => {
  it("should return an empty timeline for no word timings", () => {
    expect.assertions(1);
    expect(buildVisemeTimeline([])).toStrictEqual([]);
  });

  it("should spread a word's clusters evenly across its window", () => {
    expect.assertions(1);
    const cues = buildVisemeTimeline([
      { endMs: 200, startMs: 0, word: "hi" },
    ]);

    expect(cues).toStrictEqual([
      { endMs: 100, startMs: 0, viseme: "consonant" },
      { endMs: 200, startMs: 100, viseme: "ih" },
    ]);
  });

  it("should not insert a silence cue when a word starts at time zero", () => {
    expect.assertions(1);
    const cues = buildVisemeTimeline([
      { endMs: 100, startMs: 0, word: "ah" },
    ]);

    expect(cues.some((cue) => {
      return cue.viseme === "silence";
    })).toBeFalsy();
  });

  it("should insert a silence cue for gaps above the threshold", () => {
    expect.assertions(1);
    const cues = buildVisemeTimeline([
      { endMs: 100, startMs: 0, word: "ah" },
      { endMs: 300, startMs: 200, word: "oh" },
    ]);

    expect(cues.find((cue) => {
      return cue.viseme === "silence";
    })).toStrictEqual({
      endMs:   200,
      startMs: 100,
      viseme:  "silence",
    });
  });

  it("should not insert a silence cue for small gaps", () => {
    expect.assertions(1);
    const cues = buildVisemeTimeline([
      { endMs: 100, startMs: 0, word: "ah" },
      { endMs: 220, startMs: 120, word: "oh" },
    ]);

    expect(cues.some((cue) => {
      return cue.viseme === "silence";
    })).toBeFalsy();
  });

  it("should skip words that produce no phoneme clusters", () => {
    expect.assertions(1);
    const cues = buildVisemeTimeline([
      { endMs: 100, startMs: 0, word: "123" },
    ]);

    expect(cues).toStrictEqual([]);
  });

  it("should continue tracking time after a skipped word", () => {
    expect.assertions(1);
    const cues = buildVisemeTimeline([
      { endMs: 100, startMs: 0, word: "123" },
      { endMs: 300, startMs: 200, word: "oh" },
    ]);

    expect(cues[0]).toStrictEqual({
      endMs:   200,
      startMs: 100,
      viseme:  "silence",
    });
  });
});
