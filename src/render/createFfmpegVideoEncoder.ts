/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RenderedFrame, VideoEncoder } from "./renderVrmVideo.js";

/**
 * Runs the ffmpeg CLI with a given set of arguments. The concrete
 * implementation (see createSystemFfmpegRunner) should shell out to a
 * real ffmpeg binary; this interface only describes what
 * createFfmpegVideoEncoder needs from it, so the temp-file and
 * argument-building orchestration below can be unit tested without a
 * real ffmpeg process.
 */
interface FfmpegRunner {
  readonly run: (ffmpegArguments: ReadonlyArray<string>)=> Promise<void>;
}

/*
 * Used only as a frame's ffconcat "duration" when there is no
 * neighbouring frame to infer a real interval from, i.e. when encode()
 * is called with exactly one frame.
 */
const defaultSingleFrameDurationMs = 1000;

/**
 * Writes each frame's PNG bytes to disk in order, named so a sorted
 * directory listing (and the concat list built from framePaths)
 * matches capture order.
 * @param temporaryDirectory - The directory to write frame files into.
 * @param frames - The rendered frames captured by a FrameRenderer.
 * @returns The path each frame was written to, in the same order.
 */
const writeFramesToDisk = async(
  temporaryDirectory: string,
  frames: ReadonlyArray<RenderedFrame>,
): Promise<ReadonlyArray<string>> => {
  const framePaths: Array<string> = [];

  for (const [ index, frame ] of frames.entries()) {
    const framePath = join(
      temporaryDirectory,
      `frame-${String(index).padStart(5, "0")}.png`,
    );
    // eslint-disable-next-line no-await-in-loop -- frames must be written in the same order renderVrmVideo captured them
    await writeFile(framePath, frame.pngBuffer);
    framePaths.push(framePath);
  }

  return framePaths;
};

/**
 * Computes how long each frame should be held for, in milliseconds,
 * from the gaps between its neighbours' timestamps. The last frame has
 * no "next" timestamp to measure against, so it reuses the previous
 * frame's duration, matching the constant frameIntervalMs stepping
 * renderVrmVideo itself uses to capture frames.
 * @param frames - The frames to compute durations for.
 * @returns Each frame's duration, in the same order as frames.
 */
const computeFrameDurationsMs = (
  frames: ReadonlyArray<RenderedFrame>,
): ReadonlyArray<number> => {
  return frames.map((frame, index) => {
    const nextFrame = frames[index + 1];
    if (nextFrame) {
      return nextFrame.timestampMs - frame.timestampMs;
    }

    const previousFrame = frames[index - 1];
    if (previousFrame) {
      return frame.timestampMs - previousFrame.timestampMs;
    }

    return defaultSingleFrameDurationMs;
  });
};

/**
 * Builds an ffconcat input list ffmpeg can read frame-by-frame with
 * per-frame durations. Ffmpeg's concat demuxer has a well-known quirk:
 * a "duration" line applies to the transition into the *next* listed
 * file, so the final frame has to be listed a second time with no
 * duration for its own duration line to actually take effect.
 * @param framePaths - Where each frame was written, in capture order.
 * @param durationsMs - Each frame's duration, in the same order.
 * @returns The ffconcat file contents to write to disk.
 */
const buildConcatList = (
  framePaths: ReadonlyArray<string>,
  durationsMs: ReadonlyArray<number>,
): string => {
  const lines: Array<string> = [ "ffconcat version 1.0" ];

  /*
   * DurationsMs is always computed from the same frame list as
   * framePaths, so an index from framePaths.entries() can never
   * actually be out of bounds in durationsMs; the fallback below only
   * exists to satisfy noUncheckedIndexedAccess.
   */
  for (const [ index, framePath ] of framePaths.entries()) {
    // eslint-disable-next-line capitalized-comments -- v8 ignore directive must stay lowercase
    /* v8 ignore next -- @preserve */
    const durationMs = durationsMs[index] ?? defaultSingleFrameDurationMs;
    lines.push(`file '${framePath}'`, `duration ${(durationMs / 1000).toFixed(6)}`);
  }

  /*
   * Encode() already rejects an empty frame list before this function
   * is ever called, so framePaths is always non-empty here; the check
   * only exists to satisfy TypeScript's Array#at() return type.
   */
  const lastFramePath = framePaths.at(-1);
  // eslint-disable-next-line capitalized-comments -- v8 ignore directive must stay lowercase
  /* v8 ignore next 3 -- @preserve */
  if (lastFramePath !== undefined) {
    lines.push(`file '${lastFramePath}'`);
  }

  return `${lines.join("\n")}\n`;
};

/**
 * Builds the ffmpeg CLI arguments to mux a concat-demuxer frame list
 * with an audio track into a single output video. The audio input is
 * read without an explicit format flag, so ffmpeg auto-detects its
 * container from the file's own bytes; this only works for
 * self-describing containers (WAV, MP3, FLAC, Ogg/Opus, and similar),
 * not headerless raw PCM.
 * @param concatListPath - Path of the ffconcat frame list.
 * @param audioPath - Path of the audio track to mux in.
 * @param outputPath - Where to write the encoded video.
 * @returns The argument list to invoke ffmpeg with.
 */
const buildFfmpegArguments = (
  concatListPath: string,
  audioPath: string,
  outputPath: string,
): ReadonlyArray<string> => {
  return [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatListPath,
    "-i",
    audioPath,
    "-vf",
    "format=yuv420p",
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-shortest",
    outputPath,
  ];
};

/**
 * Builds a concrete VideoEncoder backed by ffmpeg. It writes each
 * frame and the audio track to a temporary directory, builds a concat
 * list ffmpeg can read frame-by-frame with the right per-frame timing,
 * hands the whole thing to ffmpegRunner, and always cleans the
 * temporary directory back up afterwards, whether encoding succeeded
 * or not.
 * @param ffmpegRunner - Runs the real ffmpeg CLI with built arguments.
 * @returns A VideoEncoder ready to pass to renderVrmVideo.
 */
const createFfmpegVideoEncoder = (ffmpegRunner: FfmpegRunner): VideoEncoder => {
  return {
    encode: async(
      frames: ReadonlyArray<RenderedFrame>,
      audio: Buffer,
      outputPath: string,
    ): Promise<void> => {
      if (frames.length === 0) {
        throw new Error(
          "createFfmpegVideoEncoder: cannot encode a video with no frames",
        );
      }

      const temporaryDirectory = await mkdtemp(join(tmpdir(), "vroid-encode-"));

      try {
        const framePaths = await writeFramesToDisk(temporaryDirectory, frames);
        const durationsMs = computeFrameDurationsMs(frames);
        const concatListPath = join(temporaryDirectory, "concat.txt");
        await writeFile(
          concatListPath,
          buildConcatList(framePaths, durationsMs),
        );

        const audioPath = join(temporaryDirectory, "audio.input");
        await writeFile(audioPath, audio);

        await ffmpegRunner.run(
          buildFfmpegArguments(concatListPath, audioPath, outputPath),
        );
      } finally {
        await rm(temporaryDirectory, { force: true, recursive: true });
      }
    },
  };
};

export { createFfmpegVideoEncoder, type FfmpegRunner };
