/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/**
 * This is a scaffold. The pure pipeline logic below (lip sync timing,
 * expression weights, idle motion) is implemented and tested. The
 * FluxTtsClient integration point is also implemented now, via
 * createDeepgramFluxTtsClient in src/tts/createDeepgramFluxTtsClient.ts:
 * Flux TTS's /v2/speak endpoint reports only total audio duration, not
 * per-word timing, so that client synthesises the dialogue and then
 * immediately transcribes the result with Deepgram Listen to recover
 * real word-level timestamps. Two genuine integration points still need
 * concrete implementations before this pipeline can render a real
 * video. First, a FrameRenderer in src/render/renderVrmVideo.ts that
 * drives a headless Playwright page running the "three-vrm" library
 * against a real .vrm file and captures its canvas. Second, a
 * VideoEncoder in the same file that shells out to ffmpeg to mux the
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
} from "./render/applyVisemeToExpressionWeights.js";
export { createIdleMotionOffset } from "./render/createIdleMotionOffset.js";
export { renderVrmVideo } from "./render/renderVrmVideo.js";
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
