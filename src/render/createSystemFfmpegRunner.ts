/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { FfmpegRunner } from "./createFfmpegVideoEncoder.js";

const execFileAsync = promisify(execFile);

/**
 * Builds an FfmpegRunner backed by a real "ffmpeg" binary on the
 * system PATH.
 * @returns An FfmpegRunner ready to pass to createFfmpegVideoEncoder.
 */
const createSystemFfmpegRunner = (): FfmpegRunner => {
  return {
    run: async(ffmpegArguments: ReadonlyArray<string>): Promise<void> => {
      await execFileAsync("ffmpeg", [ ...ffmpegArguments ]);
    },
  };
};

export { createSystemFfmpegRunner };
