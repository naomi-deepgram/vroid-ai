/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/**
 * This is a scaffold, and every integration point it needs is now
 * implemented. The pure pipeline logic (lip sync timing, expression
 * weights, idle motion) is fully implemented and tested. The
 * FluxTtsClient integration point is implemented via
 * createDeepgramFluxTtsClient in src/tts/createDeepgramFluxTtsClient.ts:
 * Flux TTS's /v2/speak endpoint reports only total audio duration, not
 * per-word timing, so that client synthesises the dialogue and then
 * immediately transcribes the result with Deepgram Listen to recover
 * real word-level timestamps. The FrameRenderer integration point is
 * implemented, split across two files in src/render/: a real
 * headless-Playwright-backed VrmScenePage
 * (createPlaywrightVrmScenePage.ts) that loads a .vrm file and renders
 * it, and a FrameRenderer (createVrmPageFrameRenderer.ts) that drives
 * that page frame-by-frame from a viseme cue timeline. The VideoEncoder
 * integration point is implemented, also split across two files: a
 * pure encode() orchestration (createFfmpegVideoEncoder.ts) that writes
 * frames and audio to a temp directory and builds a concat-demuxer list
 * ffmpeg can read, and a real process runner
 * (createSystemFfmpegRunner.ts) that shells out to an actual ffmpeg
 * binary.
 *
 * Real rendering and encoding are proven, not just mocked, in
 * test/render/createPlaywrightVrmScenePage.spec.ts (against an actual
 * VRM 0.0 model) and test/render/createSystemFfmpegRunner.spec.ts
 * (against a real ffmpeg binary). Both tests, and this project's
 * coverage of the two files they exercise, only run when their real
 * dependency is available locally (a .vrm fixture, and an "ffmpeg" on
 * PATH, respectively); see AGENTS.md.
 */

export {
  createDeepgramFluxTtsClient,
  type CreateDeepgramFluxTtsClientOptions,
  type DeepgramSpeakAndListenClient,
} from "./tts/createDeepgramFluxTtsClient.js";
export { buildVisemeTimeline } from "./lipsync/buildVisemeTimeline.js";
export { mapPhonemeToViseme } from "./lipsync/mapPhonemeToViseme.js";
export { mapWordToPhonemes } from "./lipsync/mapWordToPhonemes.js";
export {
  applyVisemeToExpressionWeights,
  type VisemeExpressionWeights,
} from "./render/applyVisemeToExpressionWeights.js";
export {
  createFfmpegVideoEncoder,
  type FfmpegRunner,
} from "./render/createFfmpegVideoEncoder.js";
export {
  createIdleMotionOffset,
  type IdleMotionOffset,
} from "./render/createIdleMotionOffset.js";
export {
  createPlaywrightVrmScenePage,
  type CreatePlaywrightVrmScenePageOptions,
  type PlaywrightVrmScenePage,
  type ViewportSize,
} from "./render/createPlaywrightVrmScenePage.js";
export { createSystemFfmpegRunner } from "./render/createSystemFfmpegRunner.js";
export {
  createVrmPageFrameRenderer,
  type VrmScenePage,
} from "./render/createVrmPageFrameRenderer.js";
export { findActiveViseme } from "./render/findActiveViseme.js";
export {
  renderVrmVideo,
  type FrameRenderer,
  type RenderedFrame,
  type RenderVrmVideoOptions,
  type VideoEncoder,
} from "./render/renderVrmVideo.js";
export {
  requestFluxTtsAudio,
  type FluxTtsClient,
  type FluxTtsWordSpoken,
} from "./tts/requestFluxTtsAudio.js";
export type {
  FluxTtsSpeakResult,
  Viseme,
  VisemeCue,
  WordTiming,
} from "./types/viseme.js";
