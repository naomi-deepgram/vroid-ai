/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable no-console -- the real progress reporter below exists specifically to print to the console */

import { DeepgramClient } from "@deepgram/sdk";
import {
  generateVroidVideo,
  type GenerateVroidVideoOptions,
  type VroidPipelineProgressEvent,
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
 * Builds a progress reporter that prints each pipeline stage to the
 * console. When stdout is a real terminal, frame-rendering progress
 * updates in place on a single line; otherwise (piped output, a log
 * file, or this project's own non-interactive tooling) there is no
 * line to overwrite, so it logs one line per 10% milestone instead of
 * one line per frame, which would otherwise be an unreadable wall of
 * text for a long render.
 * @returns A progress reporter ready to pass as generateVroidVideo's
 * onProgress option.
 */
// eslint-disable-next-line max-lines-per-function -- the inner reportFrameProgress needs to share this closure's mutable milestone state, so it can't be split out further
const createConsoleProgressReporter = (): (
(event: VroidPipelineProgressEvent)=> void
) => {
  const isInteractive = process.stdout.isTTY;
  let lastLoggedPercentComplete = -1;

  const reportFrameProgress = (
    frameIndex: number,
    totalFrameCount: number,
  ): void => {
    const fractionComplete = frameIndex / totalFrameCount;
    const percentComplete = Math.round(fractionComplete * 100);
    const line = `Rendering frame ${String(frameIndex)}/`
      + `${String(totalFrameCount)} (${String(percentComplete)}%)`;

    if (isInteractive) {
      process.stdout.write(`\r${line}`);
      if (frameIndex === totalFrameCount) {
        process.stdout.write("\n");
      }
      return;
    }

    const isNewMilestone
      = percentComplete >= lastLoggedPercentComplete + 10
        || frameIndex === totalFrameCount;
    if (isNewMilestone) {
      lastLoggedPercentComplete = percentComplete;
      console.log(line);
    }
  };

  return (event: VroidPipelineProgressEvent): void => {
    switch (event.type) {
      case "synthesising": {
        console.log("Synthesising dialogue with Flux TTS...");
        break;
      }

      case "synthesised": {
        console.log(`Recovered timing for ${String(event.wordCount)} words.`);
        break;
      }

      case "rendering": {
        console.log(`Rendering ${String(event.totalFrameCount)} frames...`);
        break;
      }

      case "frameRendered": {
        reportFrameProgress(event.frameIndex, event.totalFrameCount);
        break;
      }

      case "encoding": {
        console.log("Encoding video with ffmpeg...");
        break;
      }

      case "done": {
        console.log(`Done! Wrote ${event.outputPath}`);
        break;
      }

      // eslint-disable-next-line capitalized-comments -- v8 ignore directive must stay lowercase
      /* v8 ignore next 2 -- @preserve */
      default: {
        break;
      }
    }
  };
};

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
    onProgress:   options.onProgress ?? createConsoleProgressReporter(),
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
