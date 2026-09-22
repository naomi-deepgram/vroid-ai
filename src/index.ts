/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/**
 * This is a scaffold. The pure pipeline logic below (lip sync timing,
 * expression weights, idle motion) is implemented and tested. The
 * FluxTtsClient integration point is also implemented, via
 * createDeepgramFluxTtsClient in src/tts/createDeepgramFluxTtsClient.ts:
 * Flux TTS's /v2/speak endpoint reports only total audio duration, not
 * per-word timing, so that client synthesises the dialogue and then
 * immediately transcribes the result with Deepgram Listen to recover
 * real word-level timestamps. The FrameRenderer integration point is
 * also implemented, split across two files in src/render/: a real
 * headless-Playwright-backed VrmScenePage
 * (createPlaywrightVrmScenePage.ts) that loads a .vrm file and renders
 * it, and a FrameRenderer (createVrmPageFrameRenderer.ts) that drives
 * that page frame-by-frame from a viseme cue timeline. Real rendering
 * is proven against an actual VRM 0.0 model in
 * test/render/createPlaywrightVrmScenePage.spec.ts, though that test
 * (and this project's coverage of createPlaywrightVrmScenePage.ts)
 * only run when a .vrm fixture is supplied locally; see AGENTS.md. One
 * genuine integration point still needs a concrete implementation
 * before this pipeline can render a real video: a VideoEncoder in
 * src/render/renderVrmVideo.ts that shells out to ffmpeg to mux the
 * captured frames with the Flux TTS audio.
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
  createIdleMotionOffset,
  type IdleMotionOffset,
} from "./render/createIdleMotionOffset.js";
export {
  createPlaywrightVrmScenePage,
  type CreatePlaywrightVrmScenePageOptions,
  type PlaywrightVrmScenePage,
  type ViewportSize,
} from "./render/createPlaywrightVrmScenePage.js";
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
