/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/**
 * A single rendered frame of the VRM scene, captured at a point in time.
 */
interface RenderedFrame {
  readonly pngBuffer:   Buffer;
  readonly timestampMs: number;
}

/**
 * Renders one frame of the VRM scene at a given timestamp. The concrete
 * implementation should drive a headless Playwright page running the
 * "three-vrm" library and capture its canvas.
 */
interface FrameRenderer {
  readonly renderFrame: (timestampMs: number)=> Promise<RenderedFrame>;
}

/**
 * Encodes a sequence of rendered frames and an audio track into a video
 * file. The concrete implementation should shell out to ffmpeg.
 */
interface VideoEncoder {
  readonly encode: (
    frames: ReadonlyArray<RenderedFrame>,
    audio: Buffer,
    outputPath: string,
  )=> Promise<void>;
}

/**
 * Options controlling a single renderVrmVideo run.
 */
interface RenderVrmVideoOptions {
  readonly audio:            Buffer;
  readonly frameIntervalMs:  number;
  readonly onEncodingStart?: ()=> void;
  readonly onFrameRendered?: (
    frameIndex: number,
    totalFrameCount: number,
  )=> void;
  readonly outputPath:      string;
  readonly totalDurationMs: number;
}

/**
 * Drives a FrameRenderer across the full dialogue duration and hands the
 * resulting frames to a VideoEncoder alongside the Flux TTS audio. Both
 * dependencies are injected so this orchestration can be unit tested
 * without a real browser or ffmpeg process; the concrete
 * implementations (Playwright canvas capture + ffmpeg muxing) are wired
 * up separately. OnFrameRendered/onEncodingStart are optional so a
 * caller can report progress without this orchestration needing to
 * know anything about how that progress gets displayed.
 * @param frameRenderer - Renders a single frame at a given timestamp.
 * @param videoEncoder - Encodes the rendered frames and audio to disk.
 * @param options - Duration, frame rate, audio, output path, and
 * optional progress callbacks.
 */
const renderVrmVideo = async(
  frameRenderer: FrameRenderer,
  videoEncoder: VideoEncoder,
  options: RenderVrmVideoOptions,
): Promise<void> => {
  const frames: Array<RenderedFrame> = [];
  const totalFrameCount = Math.ceil(
    options.totalDurationMs / options.frameIntervalMs,
  );

  for (
    let timestampMs = 0;
    timestampMs < options.totalDurationMs;
    timestampMs = timestampMs + options.frameIntervalMs
  ) {
    // eslint-disable-next-line no-await-in-loop -- frames must be captured in order
    const frame = await frameRenderer.renderFrame(timestampMs);
    frames.push(frame);
    options.onFrameRendered?.(frames.length, totalFrameCount);
  }

  options.onEncodingStart?.();
  await videoEncoder.encode(frames, options.audio, options.outputPath);
};

export {
  renderVrmVideo,
  type FrameRenderer,
  type RenderedFrame,
  type RenderVrmVideoOptions,
  type VideoEncoder,
};
