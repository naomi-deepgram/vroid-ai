/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

import { DeepgramClient } from "@deepgram/sdk";
import {
  generateVroidVideo,
  type GenerateVroidVideoOptions,
} from "./generateVroidVideo.js";
import {
  createFfmpegVideoEncoder,
} from "./render/createFfmpegVideoEncoder.js";
import {
  createPlaywrightVrmScenePage,
} from "./render/createPlaywrightVrmScenePage.js";
import { createSystemFfmpegRunner } from "./render/createSystemFfmpegRunner.js";
import {
  createDeepgramFluxTtsClient,
  type DeepgramSpeakAndListenClient,
} from "./tts/createDeepgramFluxTtsClient.js";

/**
 * Adapts a real DeepgramClient instance to the narrow
 * DeepgramSpeakAndListenClient shape createDeepgramFluxTtsClient
 * expects. A plain structural cast doesn't work here: the real SDK's
 * Listen response type is a union whose members TypeScript's
 * exactOptionalPropertyTypes and "weak type" checks each reject for
 * different reasons against that narrow shape, even though the actual
 * successful-response data genuinely does match it at runtime. Rather
 * than loosen that shape (and the tests written against it) to work
 * around a real SDK type authored without exactOptionalPropertyTypes
 * in mind, the mismatch is contained to this one real integration
 * boundary instead.
 * @param deepgramClient - A real DeepgramClient instance.
 * @returns An adapter satisfying DeepgramSpeakAndListenClient.
 */
type TranscribeFile
  = DeepgramSpeakAndListenClient["listen"]["v1"]["media"]["transcribeFile"];
type Generate
  = DeepgramSpeakAndListenClient["speak"]["v2"]["audio"]["generate"];

const adaptDeepgramClient = (
  deepgramClient: DeepgramClient,
): DeepgramSpeakAndListenClient => {
  const transcribeFile: TranscribeFile = async(audio, request) => {
    const mediaClient = deepgramClient.listen.v1.media;
    const response = await mediaClient.transcribeFile(audio, request);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the real response only fails structural checks over exactOptionalPropertyTypes and union "weak type" rules TypeScript applies here, not over its actual shape
    return response as unknown as Awaited<ReturnType<TranscribeFile>>;
  };

  const generate: Generate = async(request) => {
    return await deepgramClient.speak.v2.audio.generate(request);
  };

  return {
    listen: { v1: { media: { transcribeFile } } },
    speak:  { v2: { audio: { generate } } },
  };
};

/**
 * Options for a real, end-to-end runVroidPipeline call: everything
 * generateVroidVideo needs, plus the real inputs (an API key and a VRM
 * file) needed to build its dependencies for real.
 */
interface RunVroidPipelineOptions extends GenerateVroidVideoOptions {
  readonly deepgramApiKey: string;
  readonly vrmFilePath:    string;
}

/**
 * Runs the full script-to-video pipeline against real infrastructure:
 * a real Deepgram client, a real headless-Playwright-rendered VRM
 * scene, and a real ffmpeg process. This is the composition root that
 * wires the individually-tested, individually-injectable pieces
 * (createDeepgramFluxTtsClient, createPlaywrightVrmScenePage,
 * createFfmpegVideoEncoder, generateVroidVideo) together for a real
 * run; there is nothing meaningful left to fake here, so unlike those
 * pieces this function isn't unit tested.
 * @param options - The API key, VRM file, dialogue, and output path
 * for this run.
 */
const runVroidPipeline = async(
  options: RunVroidPipelineOptions,
): Promise<void> => {
  const deepgramClient = new DeepgramClient({ apiKey: options.deepgramApiKey });
  const fluxTtsClient = createDeepgramFluxTtsClient(
    adaptDeepgramClient(deepgramClient),
  );
  const videoEncoder = createFfmpegVideoEncoder(createSystemFfmpegRunner());
  const vrmScenePage = await createPlaywrightVrmScenePage(options.vrmFilePath);

  const generateVideoOptions: GenerateVroidVideoOptions = {
    dialogueText: options.dialogueText,
    outputPath:   options.outputPath,
    ...options.frameIntervalMs === undefined
      ? {}
      : { frameIntervalMs: options.frameIntervalMs },
  };

  try {
    await generateVroidVideo(
      { fluxTtsClient, videoEncoder, vrmScenePage },
      generateVideoOptions,
    );
  } finally {
    await vrmScenePage.close();
  }
};

export { runVroidPipeline, type RunVroidPipelineOptions };
