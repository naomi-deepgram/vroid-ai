/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/**
 * A coarse mouth-shape category used to drive VRM viseme blend shapes.
 * "silence" and "consonant" both resolve to a relaxed/closed mouth; the
 * remaining five map directly to the VRM 1.0 standard viseme expressions.
 */
type Viseme =
  | "aa"
  | "consonant"
  | "ee"
  | "ih"
  | "oh"
  | "ou"
  | "silence";

/**
 * A single word and the millisecond window in which Flux TTS spoke it,
 * relative to the start of the synthesised audio.
 */
interface WordTiming {
  readonly endMs:   number;
  readonly startMs: number;
  readonly word:    string;
}

/**
 * A single viseme and the millisecond window during which the avatar's
 * mouth should hold that shape.
 */
interface VisemeCue {
  readonly endMs:   number;
  readonly startMs: number;
  readonly viseme:  Viseme;
}

/**
 * The result of synthesising dialogue with Flux TTS: the raw audio plus
 * the word-level timing needed to drive lip sync.
 */
interface FluxTtsSpeakResult {
  readonly audio:       Buffer;
  readonly wordTimings: ReadonlyArray<WordTiming>;
}

export {
  type FluxTtsSpeakResult,
  type Viseme,
  type VisemeCue,
  type WordTiming,
};
