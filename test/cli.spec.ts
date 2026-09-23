/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */
/* eslint-disable max-lines-per-function -- Test suites naturally have many cases */
/* eslint-disable max-nested-callbacks -- Vitest structure requires nesting */
/* eslint-disable @typescript-eslint/naming-convention -- DEEPGRAM_API_KEY is a real environment variable name */

import { describe, expect, it, vi } from "vitest";
import { parseCliOptions } from "../src/cli.js";

describe("parseCliOptions", () => {
  it("should parse complete argv and environment into options", async() => {
    expect.assertions(1);

    const argv = [
      "node",
      "cli.js",
      "Hello there.",
      "/tmp/model.vrm",
      "/tmp/out.mp4",
    ];
    const environment = { DEEPGRAM_API_KEY: "test-key" };

    await expect(parseCliOptions(argv, environment)).resolves.toStrictEqual({
      deepgramApiKey: "test-key",
      dialogueText:   "Hello there.",
      outputPath:     "/tmp/out.mp4",
      vrmFilePath:    "/tmp/model.vrm",
    });
  });

  it("should drop a leading -- inserted by \"pnpm run start --\"", async() => {
    expect.assertions(1);

    const argv = [
      "node",
      "cli.js",
      "--",
      "Hello there.",
      "/tmp/model.vrm",
      "/tmp/out.mp4",
    ];
    const environment = { DEEPGRAM_API_KEY: "test-key" };

    await expect(parseCliOptions(argv, environment)).resolves.toStrictEqual({
      deepgramApiKey: "test-key",
      dialogueText:   "Hello there.",
      outputPath:     "/tmp/out.mp4",
      vrmFilePath:    "/tmp/model.vrm",
    });
  });

  it("should print usage and return null when argv is incomplete", async() => {
    expect.assertions(2);

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {
      return undefined;
    });

    const result = await parseCliOptions(
      [ "node", "cli.js", "Hello there." ],
      { DEEPGRAM_API_KEY: "test-key" },
    );

    expect(result).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("Usage:"),
    );

    consoleError.mockRestore();
  });

  it("should report a missing API key and return null", async() => {
    expect.assertions(2);

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {
      return undefined;
    });

    const result = await parseCliOptions(
      [ "node", "cli.js", "Hello there.", "/tmp/model.vrm", "/tmp/out.mp4" ],
      {},
    );

    expect(result).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("DEEPGRAM_API_KEY"),
    );

    consoleError.mockRestore();
  });

  it("should fall back to ./data/ with no positional arguments", async() => {
    expect.assertions(2);

    const fileExists = vi.fn().mockReturnValue(true);
    const readScriptFile = vi.fn().mockResolvedValue("  Hi there!  \n");

    const result = await parseCliOptions(
      [ "node", "cli.js" ],
      { DEEPGRAM_API_KEY: "test-key" },
      { fileExists, readScriptFile },
    );

    expect(result).toStrictEqual({
      deepgramApiKey: "test-key",
      dialogueText:   "Hi there!",
      outputPath:     "./data/output.mp4",
      vrmFilePath:    "./data/model.vrm",
    });
    expect(fileExists).toHaveBeenCalledWith("./data/model.vrm");
  });

  it("should treat a lone -- as no arguments at all", async() => {
    expect.assertions(1);

    const fileExists = vi.fn().mockReturnValue(true);
    const readScriptFile = vi.fn().mockResolvedValue("Hi there!");

    const result = await parseCliOptions(
      [ "node", "cli.js", "--" ],
      { DEEPGRAM_API_KEY: "test-key" },
      { fileExists, readScriptFile },
    );

    expect(result).toStrictEqual({
      deepgramApiKey: "test-key",
      dialogueText:   "Hi there!",
      outputPath:     "./data/output.mp4",
      vrmFilePath:    "./data/model.vrm",
    });
  });

  it("should report a missing ./data/model.vrm and return null", async() => {
    expect.assertions(2);

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {
      return undefined;
    });
    const fileExists = vi.fn().mockReturnValue(false);
    const readScriptFile = vi.fn();

    const result = await parseCliOptions(
      [ "node", "cli.js" ],
      { DEEPGRAM_API_KEY: "test-key" },
      { fileExists, readScriptFile },
    );

    expect(result).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("./data/model.vrm"),
    );

    consoleError.mockRestore();
  });

  it("should report an unreadable ./data/script.md as null", async() => {
    expect.assertions(2);

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {
      return undefined;
    });
    const fileExists = vi.fn().mockReturnValue(true);
    const readScriptFile = vi.fn().mockRejectedValue(new Error("ENOENT"));

    const result = await parseCliOptions(
      [ "node", "cli.js" ],
      { DEEPGRAM_API_KEY: "test-key" },
      { fileExists, readScriptFile },
    );

    expect(result).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("./data/script.md"),
    );

    consoleError.mockRestore();
  });
});
