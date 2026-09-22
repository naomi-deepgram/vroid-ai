/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */

import { describe, expect, it } from "vitest";
import { findActiveViseme } from "../../src/render/findActiveViseme.js";
import type { VisemeCue } from "../../src/types/viseme.js";

const cues: ReadonlyArray<VisemeCue> = [
  { endMs: 100, startMs: 0, viseme: "silence" },
  { endMs: 180, startMs: 100, viseme: "aa" },
  { endMs: 260, startMs: 180, viseme: "oh" },
];

describe("findActiveViseme", () => {
  it("should return the viseme of the cue containing the timestamp", () => {
    expect.assertions(1);
    expect(findActiveViseme(cues, 150)).toBe("aa");
  });

  it("should treat a cue's startMs as inclusive", () => {
    expect.assertions(1);
    expect(findActiveViseme(cues, 100)).toBe("aa");
  });

  it("should treat a cue's endMs as exclusive", () => {
    expect.assertions(1);
    expect(findActiveViseme(cues, 180)).toBe("oh");
  });

  it("should return silence for a timestamp before every cue", () => {
    expect.assertions(1);
    const laterCues: ReadonlyArray<VisemeCue> = [
      { endMs: 260, startMs: 100, viseme: "aa" },
    ];
    expect(findActiveViseme(laterCues, 50)).toBe("silence");
  });

  it("should return silence for a timestamp after every cue", () => {
    expect.assertions(1);
    expect(findActiveViseme(cues, 1000)).toBe("silence");
  });

  it("should return silence when there are no cues at all", () => {
    expect.assertions(1);
    expect(findActiveViseme([], 0)).toBe("silence");
  });
});
