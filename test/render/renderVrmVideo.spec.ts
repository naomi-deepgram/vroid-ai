/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */
/* eslint-disable max-lines-per-function -- Test suites naturally have many cases */
/* eslint-disable max-nested-callbacks -- Vitest structure requires nesting */

import { describe, expect, it, vi } from "vitest";
import {
  renderVrmVideo,
  type FrameRenderer,
  type VideoEncoder,
} from "../../src/render/renderVrmVideo.js";

describe("renderVrmVideo", () => {
  it("should render one frame per interval across full duration", async() => {
    expect.assertions(1);

    const renderFrame = vi.fn(async(timestampMs: number) => {
      return { pngBuffer: Buffer.from(""), timestampMs: timestampMs };
    });
    const frameRenderer: FrameRenderer = { renderFrame };
    const encode = vi.fn().mockResolvedValue(undefined);
    const videoEncoder: VideoEncoder = { encode };

    await renderVrmVideo(frameRenderer, videoEncoder, {
      audio:           Buffer.from(""),
      frameIntervalMs: 100,
      outputPath:      "/tmp/output.mp4",
      totalDurationMs: 300,
    });

    expect(renderFrame.mock.calls.map((call) => {
      return call[0];
    })).toStrictEqual([
      0,
      100,
      200,
    ]);
  });

  it("should hand every frame and the audio to the encoder", async() => {
    expect.assertions(1);

    const frameRenderer: FrameRenderer = {
      renderFrame: async(timestampMs: number) => {
        return { pngBuffer: Buffer.from(""), timestampMs: timestampMs };
      },
    };
    const encode = vi.fn().mockResolvedValue(undefined);
    const videoEncoder: VideoEncoder = { encode };
    const audio = Buffer.from("audio-bytes");

    await renderVrmVideo(frameRenderer, videoEncoder, {
      audio:           audio,
      frameIntervalMs: 50,
      outputPath:      "/tmp/output.mp4",
      totalDurationMs: 100,
    });

    expect(encode).toHaveBeenCalledWith(
      [
        { pngBuffer: Buffer.from(""), timestampMs: 0 },
        { pngBuffer: Buffer.from(""), timestampMs: 50 },
      ],
      audio,
      "/tmp/output.mp4",
    );
  });

  it("should report progress after each frame is rendered", async() => {
    expect.assertions(1);

    const frameRenderer: FrameRenderer = {
      renderFrame: async(timestampMs: number) => {
        return { pngBuffer: Buffer.from(""), timestampMs: timestampMs };
      },
    };
    const videoEncoder: VideoEncoder = {
      encode: vi.fn().mockResolvedValue(undefined),
    };
    const onFrameRendered = vi.fn();

    await renderVrmVideo(frameRenderer, videoEncoder, {
      audio:           Buffer.from(""),
      frameIntervalMs: 100,
      onFrameRendered: onFrameRendered,
      outputPath:      "/tmp/output.mp4",
      totalDurationMs: 300,
    });

    expect(onFrameRendered.mock.calls).toStrictEqual([
      [ 1, 3 ],
      [ 2, 3 ],
      [ 3, 3 ],
    ]);
  });

  it("should report encoding start before the encoder is called", async() => {
    expect.assertions(1);

    const callOrder: Array<string> = [];
    const frameRenderer: FrameRenderer = {
      renderFrame: async(timestampMs: number) => {
        return { pngBuffer: Buffer.from(""), timestampMs: timestampMs };
      },
    };
    const videoEncoder: VideoEncoder = {
      encode: vi.fn().mockImplementation(async() => {
        callOrder.push("encode");
      }),
    };

    await renderVrmVideo(frameRenderer, videoEncoder, {
      audio:           Buffer.from(""),
      frameIntervalMs: 50,
      onEncodingStart: () => {
        callOrder.push("onEncodingStart");
      },
      outputPath:      "/tmp/output.mp4",
      totalDurationMs: 50,
    });

    expect(callOrder).toStrictEqual([ "onEncodingStart", "encode" ]);
  });

  it("should work with no progress callbacks provided at all", async() => {
    expect.assertions(1);

    const frameRenderer: FrameRenderer = {
      renderFrame: async(timestampMs: number) => {
        return { pngBuffer: Buffer.from(""), timestampMs: timestampMs };
      },
    };
    const encode = vi.fn().mockResolvedValue(undefined);
    const videoEncoder: VideoEncoder = { encode };

    await renderVrmVideo(frameRenderer, videoEncoder, {
      audio:           Buffer.from(""),
      frameIntervalMs: 50,
      outputPath:      "/tmp/output.mp4",
      totalDurationMs: 50,
    });

    expect(encode).toHaveBeenCalledTimes(1);
  });
});
