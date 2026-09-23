/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */
/* eslint-disable max-nested-callbacks -- Vitest structure requires nesting */
/* eslint-disable @typescript-eslint/naming-convention -- DEEPGRAM_API_KEY is a real environment variable name */

import { describe, expect, it, vi } from "vitest";
import { parseCliOptions } from "../src/cli.js";

describe("parseCliOptions", () => {
  it("should parse complete argv and environment into options", () => {
    expect.assertions(1);

    const argv = [
      "node",
      "cli.js",
      "Hello there.",
      "/tmp/model.vrm",
      "/tmp/out.mp4",
    ];
    const environment = { DEEPGRAM_API_KEY: "test-key" };

    expect(parseCliOptions(argv, environment)).toStrictEqual({
      deepgramApiKey: "test-key",
      dialogueText:   "Hello there.",
      outputPath:     "/tmp/out.mp4",
      vrmFilePath:    "/tmp/model.vrm",
    });
  });

  it("should print usage and return null when argv is incomplete", () => {
    expect.assertions(2);

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {
      return undefined;
    });

    const result = parseCliOptions(
      [ "node", "cli.js", "Hello there." ],
      { DEEPGRAM_API_KEY: "test-key" },
    );

    expect(result).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("Usage:"),
    );

    consoleError.mockRestore();
  });

  it("should report a missing API key and return null", () => {
    expect.assertions(2);

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {
      return undefined;
    });

    const result = parseCliOptions(
      [ "node", "cli.js", "Hello there.", "/tmp/model.vrm", "/tmp/out.mp4" ],
      {},
    );

    expect(result).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("DEEPGRAM_API_KEY"),
    );

    consoleError.mockRestore();
  });
});
