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
 * Options for a single generateVroidVideo run.
 */
interface GenerateVroidVideoOptions {
  readonly dialogueText:     string;
  readonly frameIntervalMs?: number;
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

  const { audio, wordTimings } = await requestFluxTtsAudio(
    dependencies.fluxTtsClient,
    options.dialogueText,
  );
  const visemeCues = buildVisemeTimeline(wordTimings);
  const frameRenderer = createVrmPageFrameRenderer(
    dependencies.vrmScenePage,
    visemeCues,
  );

  await renderVrmVideo(frameRenderer, dependencies.videoEncoder, {
    audio:           audio,
    frameIntervalMs: frameIntervalMs,
    outputPath:      options.outputPath,
    totalDurationMs: estimateTotalDurationMs(wordTimings),
  });
};

export {
  estimateTotalDurationMs,
  generateVroidVideo,
  type GenerateVroidVideoDependencies,
  type GenerateVroidVideoOptions,
};
