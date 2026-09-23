/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */
/* eslint-disable max-lines-per-function -- Test suites naturally have many cases */

import { describe, expect, it, vi } from "vitest";
import {
  estimateTotalDurationMs,
  generateVroidVideo,
  type VroidPipelineProgressEvent,
} from "../src/generateVroidVideo.js";
import type { VrmScenePage } from "../src/render/createVrmPageFrameRenderer.js";
import type { VideoEncoder } from "../src/render/renderVrmVideo.js";
import type { FluxTtsClient } from "../src/tts/requestFluxTtsAudio.js";
import type { WordTiming } from "../src/types/viseme.js";

/**
 * Builds a fake VrmScenePage that resolves immediately for every
 * frame, so createVrmPageFrameRenderer/renderVrmVideo can drive a real
 * render loop against it without a real browser.
 * @returns A fake VrmScenePage.
 */
const createFakeVrmScenePage = (): VrmScenePage => {
  return {
    applyFrame:   vi.fn().mockResolvedValue(undefined),
    captureFrame: vi.fn().mockResolvedValue(Buffer.from("png")),
  };
};

/**
 * Reads the array of frames a fake VideoEncoder's encode() was called
 * with, without needing an unchecked cast at every call site.
 * @param encode - The fake encode() mock to read the call from.
 * @returns The frames array passed to the first call.
 */
const getEncodedFrames = (
  encode: VideoEncoder["encode"],
): ReadonlyArray<unknown> => {
  const mockedEncode = vi.mocked(encode);
  const [ [ frames ] ] = mockedEncode.mock.calls;

  return frames ?? [];
};

describe("generateVroidVideo", () => {
  it("should synthesise the given dialogue text", async() => {
    expect.assertions(1);

    const requestSpeech = vi.fn().mockResolvedValue({
      audio:       Buffer.from(""),
      wordsSpoken: [],
    });
    const fluxTtsClient: FluxTtsClient = { requestSpeech };
    const videoEncoder: VideoEncoder = {
      encode: vi.fn().mockResolvedValue(undefined),
    };
    const vrmScenePage = createFakeVrmScenePage();

    await generateVroidVideo(
      { fluxTtsClient, videoEncoder, vrmScenePage },
      { dialogueText: "Hello there.", outputPath: "/tmp/out.mp4" },
    );

    expect(requestSpeech).toHaveBeenCalledWith("Hello there.");
  });

  it("should encode the synthesised audio to the output path", async() => {
    expect.assertions(1);

    const audio = Buffer.from("synthesised-audio-bytes");
    const fluxTtsClient: FluxTtsClient = {
      requestSpeech: vi.fn().mockResolvedValue({
        audio:       audio,
        wordsSpoken: [],
      }),
    };
    const encode = vi.fn().mockResolvedValue(undefined);
    const videoEncoder: VideoEncoder = { encode };
    const vrmScenePage = createFakeVrmScenePage();

    await generateVroidVideo(
      { fluxTtsClient, videoEncoder, vrmScenePage },
      { dialogueText: "Hello there.", outputPath: "/tmp/out.mp4" },
    );

    expect(encode).toHaveBeenCalledWith(
      expect.any(Array),
      audio,
      "/tmp/out.mp4",
    );
  });

  it("should render one frame per interval for the estimate", async() => {
    expect.assertions(1);

    const wordTimings: ReadonlyArray<WordTiming> = [
      { endMs: 500, startMs: 0, word: "Hi" },
    ];
    const fluxTtsClient: FluxTtsClient = {
      requestSpeech: vi.fn().mockResolvedValue({
        audio:       Buffer.from(""),
        wordsSpoken: wordTimings,
      }),
    };
    const encode = vi.fn().mockResolvedValue(undefined);
    const videoEncoder: VideoEncoder = { encode };
    const vrmScenePage = createFakeVrmScenePage();

    await generateVroidVideo(
      { fluxTtsClient, videoEncoder, vrmScenePage },
      {
        dialogueText:    "Hi",
        frameIntervalMs: 100,
        outputPath:      "/tmp/out.mp4",
      },
    );

    /*
     * EstimateTotalDurationMs gives 500 + 300 (trailing silence) = 800,
     * so renderVrmVideo's loop captures timestamps 0, 100, ..., 700.
     */
    expect(getEncodedFrames(encode)).toHaveLength(8);
  });

  it("should default the frame interval to ~30fps when unset", async() => {
    expect.assertions(1);

    const wordTimings: ReadonlyArray<WordTiming> = [
      { endMs: 100, startMs: 0, word: "Hi" },
    ];
    const fluxTtsClient: FluxTtsClient = {
      requestSpeech: vi.fn().mockResolvedValue({
        audio:       Buffer.from(""),
        wordsSpoken: wordTimings,
      }),
    };
    const encode = vi.fn().mockResolvedValue(undefined);
    const videoEncoder: VideoEncoder = { encode };
    const vrmScenePage = createFakeVrmScenePage();

    await generateVroidVideo(
      { fluxTtsClient, videoEncoder, vrmScenePage },
      { dialogueText: "Hi", outputPath: "/tmp/out.mp4" },
    );

    /*
     * Total duration is 100 + 300 = 400ms; at the default ~33ms
     * interval that's ceil(400 / 33) = 13 frames.
     */
    expect(getEncodedFrames(encode)).toHaveLength(13);
  });

  it("should report every stage of progress in order", async() => {
    expect.assertions(1);

    const wordTimings: ReadonlyArray<WordTiming> = [
      { endMs: 500, startMs: 0, word: "Hi" },
    ];
    const fluxTtsClient: FluxTtsClient = {
      requestSpeech: vi.fn().mockResolvedValue({
        audio:       Buffer.from(""),
        wordsSpoken: wordTimings,
      }),
    };
    const videoEncoder: VideoEncoder = {
      encode: vi.fn().mockResolvedValue(undefined),
    };
    const vrmScenePage = createFakeVrmScenePage();
    const events: Array<VroidPipelineProgressEvent> = [];

    await generateVroidVideo(
      { fluxTtsClient, videoEncoder, vrmScenePage },
      {
        dialogueText:    "Hi",
        frameIntervalMs: 200,
        onProgress:      (event) => {
          events.push(event);
        },
        outputPath: "/tmp/out.mp4",
      },
    );

    /*
     * Total duration is 500 + 300 = 800ms; at a 200ms interval that's
     * ceil(800 / 200) = 4 frames.
     */
    expect(events).toStrictEqual([
      { type: "synthesising" },
      { type: "synthesised", wordCount: 1 },
      { totalFrameCount: 4, type: "rendering" },
      { frameIndex: 1, totalFrameCount: 4, type: "frameRendered" },
      { frameIndex: 2, totalFrameCount: 4, type: "frameRendered" },
      { frameIndex: 3, totalFrameCount: 4, type: "frameRendered" },
      { frameIndex: 4, totalFrameCount: 4, type: "frameRendered" },
      { type: "encoding" },
      { outputPath: "/tmp/out.mp4", type: "done" },
    ]);
  });

  it("should work with no progress callback provided at all", async() => {
    expect.assertions(1);

    const fluxTtsClient: FluxTtsClient = {
      requestSpeech: vi.fn().mockResolvedValue({
        audio:       Buffer.from(""),
        wordsSpoken: [],
      }),
    };
    const encode = vi.fn().mockResolvedValue(undefined);
    const videoEncoder: VideoEncoder = { encode };
    const vrmScenePage = createFakeVrmScenePage();

    await generateVroidVideo(
      { fluxTtsClient, videoEncoder, vrmScenePage },
      { dialogueText: "Hi", outputPath: "/tmp/out.mp4" },
    );

    expect(encode).toHaveBeenCalledTimes(1);
  });
});

describe("estimateTotalDurationMs", () => {
  it("should add trailing silence after the last word's end", () => {
    expect.assertions(1);

    const wordTimings: ReadonlyArray<WordTiming> = [
      { endMs: 280, startMs: 0, word: "Sure," },
      { endMs: 500, startMs: 290, word: "thing." },
    ];

    expect(estimateTotalDurationMs(wordTimings)).toBe(800);
  });

  it("should return just the trailing silence when there are no words", () => {
    expect.assertions(1);
    expect(estimateTotalDurationMs([])).toBe(300);
  });
});
