/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */

import { describe, expect, it, vi } from "vitest";
import {
  requestFluxTtsAudio,
  type FluxTtsClient,
} from "../../src/tts/requestFluxTtsAudio.js";

describe("requestFluxTtsAudio", () => {
  it("should normalise the client's word timings", async() => {
    expect.assertions(1);

    const fakeAudio = Buffer.from("fake-audio");
    const client: FluxTtsClient = {
      requestSpeech: vi.fn().mockResolvedValue({
        audio:       fakeAudio,
        wordsSpoken: [
          { endMs: 280, startMs: 0, word: "Sure," },
          { endMs: 340, startMs: 290, word: "I" },
        ],
      }),
    };

    const result = await requestFluxTtsAudio(client, "Sure, I can help.");

    expect(result).toStrictEqual({
      audio:       fakeAudio,
      wordTimings: [
        { endMs: 280, startMs: 0, word: "Sure," },
        { endMs: 340, startMs: 290, word: "I" },
      ],
    });
  });

  it("should pass the dialogue text through to the client", async() => {
    expect.assertions(1);

    const requestSpeech = vi.fn().mockResolvedValue({
      audio:       Buffer.from(""),
      wordsSpoken: [],
    });
    const client: FluxTtsClient = { requestSpeech };

    await requestFluxTtsAudio(client, "Hello there.");

    expect(requestSpeech).toHaveBeenCalledWith("Hello there.");
  });
});
