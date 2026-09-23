/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

import { buildVisemeTimeline } from "./lipsync/buildVisemeTimeline.js";
import {
  createVrmPageFrameRenderer,
  type VrmScenePage,
} from "./render/createVrmPageFrameRenderer.js";
import {
  renderVrmVideo,
  type VideoEncoder,
} from "./render/renderVrmVideo.js";
import {
  requestFluxTtsAudio,
  type FluxTtsClient,
} from "./tts/requestFluxTtsAudio.js";
import type { WordTiming } from "./types/viseme.js";

/*
 * How long to hold the final frame after the last word finishes, so
 * the video doesn't cut off the instant speech ends.
 */
const trailingSilenceMs = 300;

/*
 * ~30fps. renderVrmVideo captures a real timestamp on every frame and
 * createFfmpegVideoEncoder builds its concat list from those actual
 * timestamps, so this only controls render smoothness and render time,
 * not audio/video sync.
 */
const defaultFrameIntervalMs = 33;

/**
 * The real dependencies generateVroidVideo drives: a Flux TTS client,
 * an already-loaded VRM scene page ready to render frames into, and a
 * video encoder. The caller owns constructing and eventually closing
 * vrmScenePage; generateVroidVideo only renders through it.
 */
interface GenerateVroidVideoDependencies {
  readonly fluxTtsClient: FluxTtsClient;
  readonly videoEncoder:  VideoEncoder;
  readonly vrmScenePage:  VrmScenePage;
}

/**
 * A single point of progress through a generateVroidVideo run, in the
 * order a caller can expect to receive them. How (or whether) to
 * display these is entirely up to the caller; this pipeline only
 * reports what happened and, where relevant, how much work is left.
 */
type VroidPipelineProgressEvent =
  | { readonly type: "synthesising" }
  | { readonly type: "synthesised"; readonly wordCount: number }
  | { readonly totalFrameCount: number; readonly type: "rendering" }
  | {
    readonly frameIndex:      number;
    readonly totalFrameCount: number;
    readonly type:            "frameRendered";
  }
  | { readonly type: "encoding" }
  | { readonly outputPath: string; readonly type: "done" };

/**
 * Options for a single generateVroidVideo run.
 */
interface GenerateVroidVideoOptions {
  readonly dialogueText:     string;
  readonly frameIntervalMs?: number;
  readonly onProgress?:      (event: VroidPipelineProgressEvent)=> void;
  readonly outputPath:       string;
}

/**
 * Estimates how long the rendered video should run for from the
 * dialogue's word timings, since Flux TTS itself never reports a
 * duration. Flux TTS's audio.generate() call also, notably, never
 * returns one either (only the still-unused streaming socket variant's
 * SpeechMetadata event does), so the last word's own end timestamp,
 * plus a little trailing silence, is the only signal available.
 * @param wordTimings - The dialogue's word-level timings.
 * @returns How long the rendered video should run for, in
 * milliseconds.
 */
const estimateTotalDurationMs = (
  wordTimings: ReadonlyArray<WordTiming>,
): number => {
  let lastWordEndMs = 0;

  for (const wordTiming of wordTimings) {
    lastWordEndMs = Math.max(lastWordEndMs, wordTiming.endMs);
  }

  return lastWordEndMs + trailingSilenceMs;
};

/**
 * Runs the full script-to-video pipeline for a single line of
 * dialogue: synthesises it with Flux TTS, builds a lip sync timeline
 * from the recovered word timings, renders that timeline against an
 * already-loaded VRM scene frame-by-frame, and encodes the result to
 * outputPath. Every step this function drives is itself independently
 * unit tested; this function only proves the wiring between them, so
 * every dependency is injected and fully fakeable here too.
 * @param dependencies - The Flux TTS client, VRM scene page, and video
 * encoder to drive.
 * @param options - The dialogue to speak and where to write the
 * result.
 */
const generateVroidVideo = async(
  dependencies: GenerateVroidVideoDependencies,
  options: GenerateVroidVideoOptions,
): Promise<void> => {
  const frameIntervalMs = options.frameIntervalMs ?? defaultFrameIntervalMs;
  const onProgress = options.onProgress ?? ((): void => {
    return undefined;
  });

  onProgress({ type: "synthesising" });
  const { audio, wordTimings } = await requestFluxTtsAudio(
    dependencies.fluxTtsClient,
    options.dialogueText,
  );
  onProgress({ type: "synthesised", wordCount: wordTimings.length });

  const visemeCues = buildVisemeTimeline(wordTimings);
  const frameRenderer = createVrmPageFrameRenderer(
    dependencies.vrmScenePage,
    visemeCues,
  );
  const totalDurationMs = estimateTotalDurationMs(wordTimings);
  const totalFrameCount = Math.ceil(totalDurationMs / frameIntervalMs);

  onProgress({ totalFrameCount: totalFrameCount, type: "rendering" });

  await renderVrmVideo(frameRenderer, dependencies.videoEncoder, {
    audio:           audio,
    frameIntervalMs: frameIntervalMs,
    onEncodingStart: () => {
      onProgress({ type: "encoding" });
    },
    onFrameRendered: (frameIndex, renderedTotalFrameCount) => {
      onProgress({
        frameIndex:      frameIndex,
        totalFrameCount: renderedTotalFrameCount,
        type:            "frameRendered",
      });
    },
    outputPath:      options.outputPath,
    totalDurationMs: totalDurationMs,
  });

  onProgress({ outputPath: options.outputPath, type: "done" });
};

export {
  estimateTotalDurationMs,
  generateVroidVideo,
  type GenerateVroidVideoDependencies,
  type GenerateVroidVideoOptions,
  type VroidPipelineProgressEvent,
};
