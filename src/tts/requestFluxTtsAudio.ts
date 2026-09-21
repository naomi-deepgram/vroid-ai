/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

import type { FluxTtsSpeakResult, WordTiming } from "../types/viseme.js";

/**
 * A single word as reported by the Flux TTS /v2/speak API, before it has
 * been normalised into this project's WordTiming shape.
 */
interface FluxTtsWordSpoken {
  readonly endMs:   number;
  readonly startMs: number;
  readonly word:    string;
}

/**
 * The minimal surface of a Flux TTS client this pipeline depends on. The
 * concrete implementation should wrap the Deepgram SDK's /v2/speak call;
 * keeping it injectable here means requestFluxTtsAudio is fully testable
 * without a live network call.
 */
interface FluxTtsClient {
  readonly requestSpeech: (dialogueText: string)=> Promise<{
    readonly audio:       Buffer;
    readonly wordsSpoken: ReadonlyArray<FluxTtsWordSpoken>;
  }>;
}

/**
 * Synthesises dialogue with a Flux TTS client and normalises its word
 * timings into this project's WordTiming shape.
 * @param client - The Flux TTS client to synthesise speech with.
 * @param dialogueText - The line of dialogue to speak.
 * @returns The synthesised audio and its word-level timing.
 */
const requestFluxTtsAudio = async(
  client: FluxTtsClient,
  dialogueText: string,
): Promise<FluxTtsSpeakResult> => {
  const speechResult = await client.requestSpeech(dialogueText);

  const wordTimings: Array<WordTiming> = speechResult.wordsSpoken.map(
    (wordSpoken) => {
      return {
        endMs:   wordSpoken.endMs,
        startMs: wordSpoken.startMs,
        word:    wordSpoken.word,
      };
    },
  );

  return {
    audio:       speechResult.audio,
    wordTimings: wordTimings,
  };
};

export {
  requestFluxTtsAudio,
  type FluxTtsClient,
  type FluxTtsWordSpoken,
};
