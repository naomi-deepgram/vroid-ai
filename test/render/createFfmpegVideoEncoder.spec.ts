/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */
/* eslint-disable max-lines-per-function -- Test suites naturally have many cases */
/* eslint-disable max-nested-callbacks -- Vitest structure requires nesting */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createFfmpegVideoEncoder,
  type FfmpegRunner,
} from "../../src/render/createFfmpegVideoEncoder.js";
import type { RenderedFrame } from "../../src/render/renderVrmVideo.js";

describe("createFfmpegVideoEncoder", () => {
  it("should write frames, audio, a concat list, then clean up", async() => {
    expect.assertions(4);

    let capturedArguments: ReadonlyArray<string> = [];
    let concatListContents = "";
    let audioFileContents = Buffer.alloc(0);

    const run = vi.fn().mockImplementation(
      async(ffmpegArguments: ReadonlyArray<string>) => {
        capturedArguments = ffmpegArguments;
        concatListContents = await readFile(ffmpegArguments[6] ?? "", "utf8");
        audioFileContents = await readFile(ffmpegArguments[8] ?? "");
      },
    );
    const ffmpegRunner: FfmpegRunner = { run };

    const frames: ReadonlyArray<RenderedFrame> = [
      { pngBuffer: Buffer.from("frame-0"), timestampMs: 0 },
      { pngBuffer: Buffer.from("frame-1"), timestampMs: 100 },
      { pngBuffer: Buffer.from("frame-2"), timestampMs: 250 },
    ];
    const audio = Buffer.from("fake-audio-bytes");

    await createFfmpegVideoEncoder(ffmpegRunner).encode(
      frames,
      audio,
      "/tmp/vroid-output.mp4",
    );

    const temporaryDirectory = join(capturedArguments[6] ?? "", "..");

    expect(concatListContents).toBe(
      [
        "ffconcat version 1.0",
        `file '${join(temporaryDirectory, "frame-00000.png")}'`,
        "duration 0.100000",
        `file '${join(temporaryDirectory, "frame-00001.png")}'`,
        "duration 0.150000",
        `file '${join(temporaryDirectory, "frame-00002.png")}'`,
        "duration 0.150000",
        `file '${join(temporaryDirectory, "frame-00002.png")}'`,
        "",
      ].join("\n"),
    );
    expect(audioFileContents).toStrictEqual(audio);
    expect(capturedArguments).toStrictEqual([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      capturedArguments[6],
      "-i",
      capturedArguments[8],
      "-vf",
      "format=yuv420p",
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-shortest",
      "/tmp/vroid-output.mp4",
    ]);
    expect(existsSync(temporaryDirectory)).toBeFalsy();
  });

  it("should read a frame's own bytes back out unchanged", async() => {
    expect.assertions(1);

    let firstFrameContents = Buffer.alloc(0);
    const run = vi.fn().mockImplementation(
      async(ffmpegArguments: ReadonlyArray<string>) => {
        const temporaryDirectory = join(ffmpegArguments[6] ?? "", "..");
        firstFrameContents = await readFile(
          join(temporaryDirectory, "frame-00000.png"),
        );
      },
    );
    const ffmpegRunner: FfmpegRunner = { run };

    const frames: ReadonlyArray<RenderedFrame> = [
      { pngBuffer: Buffer.from("real-frame-bytes"), timestampMs: 0 },
    ];

    await createFfmpegVideoEncoder(ffmpegRunner).encode(
      frames,
      Buffer.from(""),
      "/tmp/vroid-output.mp4",
    );

    expect(firstFrameContents).toStrictEqual(Buffer.from("real-frame-bytes"));
  });

  it("should default a single frame's duration to one second", async() => {
    expect.assertions(1);

    let concatListContents = "";
    const run = vi.fn().mockImplementation(
      async(ffmpegArguments: ReadonlyArray<string>) => {
        concatListContents = await readFile(ffmpegArguments[6] ?? "", "utf8");
      },
    );
    const ffmpegRunner: FfmpegRunner = { run };

    const frames: ReadonlyArray<RenderedFrame> = [
      { pngBuffer: Buffer.from("only-frame"), timestampMs: 0 },
    ];

    await createFfmpegVideoEncoder(ffmpegRunner).encode(
      frames,
      Buffer.from(""),
      "/tmp/vroid-output.mp4",
    );

    expect(concatListContents).toContain("duration 1.000000");
  });

  it("should reject without calling ffmpeg for zero frames", async() => {
    expect.assertions(2);

    const run = vi.fn().mockResolvedValue(undefined);
    const ffmpegRunner: FfmpegRunner = { run };

    await expect(
      createFfmpegVideoEncoder(ffmpegRunner).encode(
        [],
        Buffer.from(""),
        "/tmp/vroid-output.mp4",
      ),
    ).rejects.toThrow("cannot encode a video with no frames");
    expect(run).not.toHaveBeenCalled();
  });

  it("should clean up its temp directory even when ffmpeg fails", async() => {
    expect.assertions(2);

    let temporaryDirectory = "";
    const run = vi.fn().mockImplementation(
      async(ffmpegArguments: ReadonlyArray<string>) => {
        temporaryDirectory = join(ffmpegArguments[6] ?? "", "..");
        throw new Error("ffmpeg exploded");
      },
    );
    const ffmpegRunner: FfmpegRunner = { run };

    const frames: ReadonlyArray<RenderedFrame> = [
      { pngBuffer: Buffer.from("frame"), timestampMs: 0 },
    ];

    await expect(
      createFfmpegVideoEncoder(ffmpegRunner).encode(
        frames,
        Buffer.from(""),
        "/tmp/vroid-output.mp4",
      ),
    ).rejects.toThrow("ffmpeg exploded");
    expect(existsSync(temporaryDirectory)).toBeFalsy();
  });
});
