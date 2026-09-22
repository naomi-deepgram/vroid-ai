/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

import type {
  FluxTtsClient,
  FluxTtsWordSpoken,
} from "./requestFluxTtsAudio.js";

const defaultSpeechModel = "flux-alexis-en";
const defaultTranscriptionModel = "nova-3";

/**
 * The minimal binary response surface this module needs from the Flux
 * TTS generate call. The Deepgram SDK's real BinaryResponse also exposes
 * bodyUsed, stream(), blob(), and an optional bytes(); only arrayBuffer()
 * is used here.
 */
interface SynthesisedAudioResponse {
  readonly arrayBuffer: ()=> Promise<ArrayBuffer>;
}

/**
 * A single word as reported by Deepgram's Listen (speech-to-text) API,
 * before it has been checked for the fields lip sync actually needs.
 */
interface TranscribedWord {
  readonly end?:   number;
  readonly start?: number;
  readonly word?:  string;
}

/**
 * The shape of a successful Deepgram Listen transcription response. The
 * real SDK's response type is a union that also allows an accepted-only
 * shape for asynchronous callback requests; this client never sets a
 * callback, so it always gets this shape back in practice.
 */
interface TranscriptionResponse {
  readonly results?: {
    readonly channels?: ReadonlyArray<{
      readonly alternatives?: ReadonlyArray<{
        readonly words?: ReadonlyArray<TranscribedWord>;
      }>;
    }>;
  };
}

/**
 * The minimal surface of the Deepgram SDK client this module depends on:
 * a Flux TTS synthesis call and a Listen transcription call. A real
 * DeepgramClient instance from "@deepgram/sdk" satisfies this
 * structurally, so it can be passed straight in; tests can substitute a
 * plain fake instead.
 */
interface DeepgramSpeakAndListenClient {
  readonly listen: {
    readonly v1: {
      readonly media: {
        readonly transcribeFile: (
          audio: Buffer,
          request: { readonly model: string },
        )=> Promise<TranscriptionResponse>;
      };
    };
  };
  readonly speak: {
    readonly v2: {
      readonly audio: {
        readonly generate: (
          request: { readonly model: string; readonly text: string },
        )=> Promise<SynthesisedAudioResponse>;
      };
    };
  };
}

/**
 * Options controlling which Deepgram models createDeepgramFluxTtsClient
 * uses to synthesise and then transcribe dialogue.
 */
interface CreateDeepgramFluxTtsClientOptions {
  readonly speechModel?:        string;
  readonly transcriptionModel?: string;
}

/**
 * Synthesises dialogue audio with Deepgram's Flux TTS batch endpoint.
 * @param client - The Deepgram client to synthesise speech with.
 * @param dialogueText - The line of dialogue to speak.
 * @param speechModel - The Flux TTS model to synthesise with.
 * @returns The synthesised audio as a Buffer.
 */
const synthesiseDialogueAudio = async(
  client: DeepgramSpeakAndListenClient,
  dialogueText: string,
  speechModel: string,
): Promise<Buffer> => {
  const response = await client.speak.v2.audio.generate({
    model: speechModel,
    text:  dialogueText,
  });
  const arrayBuffer = await response.arrayBuffer();

  return Buffer.from(arrayBuffer);
};

/**
 * Narrows a transcribed word down to one with every field this pipeline
 * needs for lip sync, discarding any word the Listen API reported
 * without a timestamp.
 * @param word - A word reported by the Listen API.
 * @returns Whether the word has a word string and both timestamps.
 */
const isTimedWord = (
  word: TranscribedWord,
): word is { end: number; start: number; word: string } => {
  return (
    typeof word.word === "string"
    && typeof word.start === "number"
    && typeof word.end === "number"
  );
};

/**
 * Transcribes previously-synthesised audio with Deepgram Listen to
 * recover the word-level timing that Flux TTS itself does not report;
 * Flux TTS's speak endpoint only ever reports total audio duration, not
 * per-word timestamps.
 * @param client - The Deepgram client to transcribe audio with.
 * @param audio - The synthesised audio to transcribe.
 * @param transcriptionModel - The Listen model to transcribe with.
 * @returns The audio's word-level timing, in milliseconds.
 */
const transcribeSynthesisedAudio = async(
  client: DeepgramSpeakAndListenClient,
  audio: Buffer,
  transcriptionModel: string,
): Promise<ReadonlyArray<FluxTtsWordSpoken>> => {
  const response = await client.listen.v1.media.transcribeFile(audio, {
    model: transcriptionModel,
  });
  const words
    = response.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];

  return words.filter((word) => {
    return isTimedWord(word);
  }).map((word) => {
    return {
      endMs:   word.end * 1000,
      startMs: word.start * 1000,
      word:    word.word,
    };
  });
};

/**
 * Builds a concrete FluxTtsClient backed by the Deepgram SDK. Flux TTS's
 * /v2/speak endpoint reports only total audio duration, not per-word
 * timing, so this client synthesises the dialogue and then immediately
 * transcribes the result with Listen to recover real word-level
 * timestamps aligned to the actual rendered audio.
 * @param client - A Deepgram SDK client (an instance of DeepgramClient
 * from "@deepgram/sdk", constructed with an apiKey) to synthesise and
 * transcribe with.
 * @param options - Which Flux TTS and Listen models to use.
 * @returns A FluxTtsClient ready to pass to requestFluxTtsAudio.
 */
const createDeepgramFluxTtsClient = (
  client: DeepgramSpeakAndListenClient,
  options: CreateDeepgramFluxTtsClientOptions = {},
): FluxTtsClient => {
  const speechModel = options.speechModel ?? defaultSpeechModel;
  const transcriptionModel
    = options.transcriptionModel ?? defaultTranscriptionModel;

  return {
    requestSpeech: async(
      dialogueText: string,
    ): Promise<{
      audio:       Buffer;
      wordsSpoken: ReadonlyArray<FluxTtsWordSpoken>;
    }> => {
      const audio = await synthesiseDialogueAudio(
        client,
        dialogueText,
        speechModel,
      );
      const wordsSpoken = await transcribeSynthesisedAudio(
        client,
        audio,
        transcriptionModel,
      );

      return { audio, wordsSpoken };
    },
  };
};

export {
  createDeepgramFluxTtsClient,
  type CreateDeepgramFluxTtsClientOptions,
  type DeepgramSpeakAndListenClient,
};
