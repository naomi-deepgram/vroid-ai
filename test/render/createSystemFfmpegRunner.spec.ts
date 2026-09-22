/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */

import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createFfmpegVideoEncoder,
} from "../../src/render/createFfmpegVideoEncoder.js";
import {
  createSystemFfmpegRunner,
} from "../../src/render/createSystemFfmpegRunner.js";
import type { RenderedFrame } from "../../src/render/renderVrmVideo.js";

/*
 * This test shells out to a real "ffmpeg" binary, which (unlike the
 * personal .vrm fixture used elsewhere in this suite) is a normal
 * system dependency rather than an asset that can never exist in a
 * fresh clone. Still, this repository doesn't control whether any
 * given machine or CI runner has it installed, so this test skips
 * rather than fails when it's missing, and
 * createSystemFfmpegRunner.ts is carved out of the coverage threshold
 * in vitest.config.ts for the same reason.
 */

/**
 * Checks whether a real "ffmpeg" binary is reachable on the PATH.
 * @returns Whether "ffmpeg -version" ran successfully.
 */
const isFfmpegAvailable = (): boolean => {
  try {
    execFileSync("ffmpeg", [ "-version" ], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

const hasFfmpeg = isFfmpegAvailable();

/*
 * A minimal, valid 2x2 white PNG. libx264 rejects odd dimensions
 * ("width not divisible by 2"), which real VRM-rendered frames never
 * hit (they're always rendered at an even configured canvas size), but
 * this fixture still needs even dimensions to exercise the real
 * encoder honestly.
 */
const tinyPngBuffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAABAAAA"
  + "AQBPJcTWAAAADklEQVR4nGP4DwYMEAoAU7oL9ZisIGcAAAAASUVORK5CYII=",
  "base64",
);

/**
 * Builds a minimal, valid silent WAV file: a standard 44-byte header
 * followed by zeroed (silent) 16-bit PCM samples.
 * @param durationSeconds - How long the silent clip should be.
 * @returns The WAV file bytes.
 */
// eslint-disable-next-line max-statements -- a WAV header is inherently a flat sequence of field writes
const buildSilentWavBuffer = (durationSeconds: number): Buffer => {
  const sampleRate = 8000;
  const numberOfChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const sampleCount = Math.round(sampleRate * durationSeconds);
  const dataSize = sampleCount * numberOfChannels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numberOfChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numberOfChannels * bytesPerSample, 28);
  buffer.writeUInt16LE(numberOfChannels * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
};

describe.skipIf(!hasFfmpeg)("createSystemFfmpegRunner", () => {
  it("should mux real frames and audio into a real video file", async() => {
    expect.assertions(2);

    const temporaryDirectory = await mkdtemp(
      join(tmpdir(), "vroid-ffmpeg-test-"),
    );
    const outputPath = join(temporaryDirectory, "output.mp4");

    try {
      const encoder = createFfmpegVideoEncoder(createSystemFfmpegRunner());
      const frames: ReadonlyArray<RenderedFrame> = [
        { pngBuffer: tinyPngBuffer, timestampMs: 0 },
        { pngBuffer: tinyPngBuffer, timestampMs: 100 },
        { pngBuffer: tinyPngBuffer, timestampMs: 200 },
      ];

      await encoder.encode(frames, buildSilentWavBuffer(0.3), outputPath);

      const outputBytes = await readFile(outputPath);
      expect(outputBytes.length).toBeGreaterThan(0);
      expect(outputBytes.subarray(4, 8).toString("ascii")).toBe("ftyp");
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  }, 30_000);
});
