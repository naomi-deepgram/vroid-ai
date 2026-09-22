/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */
/* eslint-disable max-lines-per-function -- Test suites naturally have many cases */

import { describe, expect, it, vi } from "vitest";
import {
  createDeepgramFluxTtsClient,
  type DeepgramSpeakAndListenClient,
} from "../../src/tts/createDeepgramFluxTtsClient.js";

type FakeGenerate
  = DeepgramSpeakAndListenClient["speak"]["v2"]["audio"]["generate"];
type FakeTranscribeFile
  = DeepgramSpeakAndListenClient["listen"]["v1"]["media"]["transcribeFile"];

/**
 * Builds a fake DeepgramSpeakAndListenClient whose generate/transcribeFile
 * calls can be individually overridden per test.
 * @param overrides - Partial mock implementations to layer over the
 * defaults.
 * @param overrides.generate - Overrides the default Flux TTS synthesis
 * call.
 * @param overrides.transcribeFile - Overrides the default Listen
 * transcription call.
 * @returns A fake client structurally compatible with the real SDK.
 */
const createFakeDeepgramClient = (
  overrides: {
    readonly generate?:       FakeGenerate;
    readonly transcribeFile?: FakeTranscribeFile;
  } = {},
): DeepgramSpeakAndListenClient => {
  const generate = overrides.generate ?? vi.fn().mockResolvedValue({
    arrayBuffer: async() => {
      return new ArrayBuffer(0);
    },
  });
  const transcribeFile
    = overrides.transcribeFile ?? vi.fn().mockResolvedValue({
      results: {
        channels: [ { alternatives: [ { words: [] } ] } ],
      },
    });

  return {
    listen: { v1: { media: { transcribeFile } } },
    speak:  { v2: { audio: { generate } } },
  };
};

describe("createDeepgramFluxTtsClient", () => {
  it("should return the synthesised audio on the result", async() => {
    expect.assertions(1);

    const fakeAudio = new ArrayBuffer(4);
    const generate = vi.fn().mockResolvedValue({
      arrayBuffer: async() => {
        return fakeAudio;
      },
    });
    const client = createDeepgramFluxTtsClient(
      createFakeDeepgramClient({ generate }),
    );

    const result = await client.requestSpeech("Sure, I can help.");

    expect(result.audio).toStrictEqual(Buffer.from(fakeAudio));
  });

  it("should synthesise with the default Flux TTS model", async() => {
    expect.assertions(1);

    const generate = vi.fn().mockResolvedValue({
      arrayBuffer: async() => {
        return new ArrayBuffer(0);
      },
    });
    const client = createDeepgramFluxTtsClient(
      createFakeDeepgramClient({ generate }),
    );

    await client.requestSpeech("Sure, I can help.");

    expect(generate).toHaveBeenCalledWith({
      model: "flux-alexis-en",
      text:  "Sure, I can help.",
    });
  });

  it("should synthesise with a custom Flux TTS model when set", async() => {
    expect.assertions(1);

    const generate = vi.fn().mockResolvedValue({
      arrayBuffer: async() => {
        return new ArrayBuffer(0);
      },
    });
    const client = createDeepgramFluxTtsClient(
      createFakeDeepgramClient({ generate }),
      { speechModel: "flux-celeste-en" },
    );

    await client.requestSpeech("Sure, I can help.");

    expect(generate).toHaveBeenCalledWith({
      model: "flux-celeste-en",
      text:  "Sure, I can help.",
    });
  });

  it("should transcribe the synthesised audio, not the input text", async() => {
    expect.assertions(1);

    const fakeAudio = new ArrayBuffer(4);
    const generate = vi.fn().mockResolvedValue({
      arrayBuffer: async() => {
        return fakeAudio;
      },
    });
    const transcribeFile = vi.fn().mockResolvedValue({
      results: {
        channels: [ { alternatives: [ { words: [] } ] } ],
      },
    });
    const client = createDeepgramFluxTtsClient(
      createFakeDeepgramClient({ generate, transcribeFile }),
    );

    await client.requestSpeech("Sure, I can help.");

    expect(transcribeFile).toHaveBeenCalledWith(
      Buffer.from(fakeAudio),
      { model: "nova-3" },
    );
  });

  it("should transcribe with a custom Listen model when provided", async() => {
    expect.assertions(1);

    const transcribeFile = vi.fn().mockResolvedValue({
      results: {
        channels: [ { alternatives: [ { words: [] } ] } ],
      },
    });
    const client = createDeepgramFluxTtsClient(
      createFakeDeepgramClient({ transcribeFile }),
      { transcriptionModel: "nova-2" },
    );

    await client.requestSpeech("Sure, I can help.");

    expect(transcribeFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      { model: "nova-2" },
    );
  });

  it("should normalise timed words to ms and drop untimed ones", async() => {
    expect.assertions(1);

    const transcribeFile = vi.fn().mockResolvedValue({
      results: {
        channels: [
          {
            alternatives: [
              {
                words: [
                  { end: 0.28, start: 0, word: "Sure," },
                  { end: 0.34, start: 0.29, word: "I" },
                  { end: 0.5, word: "missing-start" },
                  { start: 0.5, word: "missing-end" },
                  { end: 0.6, start: 0.55 },
                ],
              },
            ],
          },
        ],
      },
    });
    const client = createDeepgramFluxTtsClient(
      createFakeDeepgramClient({ transcribeFile }),
    );

    const result = await client.requestSpeech("Sure, I can help.");

    expect(result.wordsSpoken).toStrictEqual([
      { endMs: 280, startMs: 0, word: "Sure," },
      { endMs: 340, startMs: 290, word: "I" },
    ]);
  });

  it("should return no words when the transcription lacks results", async() => {
    expect.assertions(1);

    const transcribeFile = vi.fn().mockResolvedValue({});
    const client = createDeepgramFluxTtsClient(
      createFakeDeepgramClient({ transcribeFile }),
    );

    const result = await client.requestSpeech("Sure, I can help.");

    expect(result.wordsSpoken).toStrictEqual([]);
  });

  it("should return no words when a channel has no alternatives", async() => {
    expect.assertions(1);

    const transcribeFile = vi.fn().mockResolvedValue({
      results: { channels: [ {} ] },
    });
    const client = createDeepgramFluxTtsClient(
      createFakeDeepgramClient({ transcribeFile }),
    );

    const result = await client.requestSpeech("Sure, I can help.");

    expect(result.wordsSpoken).toStrictEqual([]);
  });
});
