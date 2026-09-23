/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable no-console -- this is a CLI entry point; console output is the whole point */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  runVroidPipeline,
  type RunVroidPipelineOptions,
} from "./runVroidPipeline.js";

const usage = [
  "Usage: node cli.js [<dialogueText> <vrmFilePath> <outputPath>]",
  "With no arguments, reads ./data/script.md and ./data/model.vrm and",
  "writes ./data/output.mp4.",
].join("\n");

const defaultScriptPath = "./data/script.md";
const defaultVrmFilePath = "./data/model.vrm";
const defaultOutputPath = "./data/output.mp4";

/**
 * Reads a UTF-8 text file's contents. Injected so the ./data/script.md
 * fallback below can be tested with a fake reader, rather than a test
 * needing to create or read this project's own real, personal script
 * file.
 */
type ReadTextFile = (path: string)=> Promise<string>;

/**
 * Checks whether a file exists. Injected for the same reason as
 * ReadTextFile: so the ./data/model.vrm existence check below can be
 * tested without depending on whether this project's own real,
 * personal ./data/model.vrm happens to exist on whatever machine the
 * tests run on.
 */
type FileExists = (path: string)=> boolean;

const readTextFile: ReadTextFile = async(path) => {
  return await readFile(path, "utf8");
};

/**
 * The file-system dependencies resolveCliInputs and parseCliOptions
 * need for the ./data/ fallback, with the real implementations as
 * defaults.
 */
interface CliFileDependencies {
  readonly fileExists?:     FileExists;
  readonly readScriptFile?: ReadTextFile;
}

/**
 * Drops a single leading "--" from a process's positional CLI
 * arguments. `pnpm run start -- <args>` (at least on pnpm 11.5.2)
 * inserts a literal "--" as the first user-supplied argument rather
 * than stripping it, unlike a plain `node cli.js <args>` invocation.
 * @param rawPositionalArguments - Argv with the node binary and script
 * path already removed.
 * @returns The same arguments with a leading "--" removed, if present.
 */
const dropLeadingDoubleDash = (
  rawPositionalArguments: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  return rawPositionalArguments[0] === "--"
    ? rawPositionalArguments.slice(1)
    : rawPositionalArguments;
};

/**
 * Resolves the dialogue, VRM file, and output path to render from a
 * process's positional CLI arguments. With no positional arguments at
 * all, falls back to reading ./data/script.md and ./data/model.vrm and
 * writing ./data/output.mp4, so `pnpm start` works with no arguments
 * once those files exist. The script file's contents are used as the
 * dialogue text verbatim (trimmed of leading/trailing whitespace); its
 * ".md" extension is only a convenience for editing it, not a signal
 * to strip Markdown syntax out of it.
 * @param argv - The process's argv, including the node binary and
 * script path.
 * @param fileDependencies - How to check for and read the default
 * ./data/ files.
 * @returns The dialogue text, VRM file path, and output path to
 * render, or null with an explanatory message already printed to
 * stderr if that couldn't be resolved.
 */
const resolveCliInputs = async(
  argv: ReadonlyArray<string>,
  fileDependencies: CliFileDependencies,
): Promise<{
  dialogueText: string;
  outputPath:   string;
  vrmFilePath:  string;
} | null> => {
  const positionalArguments = dropLeadingDoubleDash(argv.slice(2));

  if (positionalArguments.length > 0) {
    const [ dialogueText, vrmFilePath, outputPath ] = positionalArguments;
    if (
      dialogueText === undefined
      || vrmFilePath === undefined
      || outputPath === undefined
    ) {
      console.error(usage);
      return null;
    }

    return { dialogueText, outputPath, vrmFilePath };
  }

  const fileExists = fileDependencies.fileExists ?? existsSync;
  if (!fileExists(defaultVrmFilePath)) {
    console.error(
      `Could not find ${defaultVrmFilePath}. Add your .vrm model there, `
      + "or pass <dialogueText> <vrmFilePath> <outputPath> explicitly.",
    );
    return null;
  }

  try {
    const readScriptFile = fileDependencies.readScriptFile ?? readTextFile;
    const scriptFileContents = await readScriptFile(defaultScriptPath);
    return {
      dialogueText: scriptFileContents.trim(),
      outputPath:   defaultOutputPath,
      vrmFilePath:  defaultVrmFilePath,
    };
  } catch {
    console.error(
      `Could not read ${defaultScriptPath}. Create it with the dialogue `
      + "to speak, or pass <dialogueText> <vrmFilePath> <outputPath> "
      + "explicitly.",
    );
    return null;
  }
};

/**
 * Parses this process's CLI arguments and environment into
 * runVroidPipeline options, or returns null with an explanatory
 * message already printed to stderr if either is incomplete.
 * @param argv - The process's argv, including the node binary and
 * script path.
 * @param environment - The process's environment variables.
 * @param fileDependencies - How to check for and read the default
 * ./data/ files when argv has no positional arguments.
 * @returns Complete pipeline options, or null if argv or environment
 * didn't provide everything needed.
 */
const parseCliOptions = async(
  argv: ReadonlyArray<string>,
  environment: Readonly<Record<string, string | undefined>>,
  fileDependencies: CliFileDependencies = {},
): Promise<RunVroidPipelineOptions | null> => {
  const deepgramApiKey = environment.DEEPGRAM_API_KEY;
  if (deepgramApiKey === undefined) {
    console.error("Missing DEEPGRAM_API_KEY environment variable.");
    return null;
  }

  const cliInputs = await resolveCliInputs(argv, fileDependencies);
  if (cliInputs === null) {
    return null;
  }

  return { deepgramApiKey, ...cliInputs };
};

/**
 * The CLI entry point: parses argv and env, runs the full pipeline,
 * and reports failures with a non-zero exit code rather than an
 * unhandled rejection.
 */
const main = async(): Promise<void> => {
  const cliOptions = await parseCliOptions(process.argv, process.env);
  if (cliOptions === null) {
    // eslint-disable-next-line require-atomic-updates -- process.exitCode is the last thing this branch does before returning; there is nothing left to race with
    process.exitCode = 1;
    return;
  }

  try {
    await runVroidPipeline(cliOptions);
  } catch (error) {
    console.error(error);
    // eslint-disable-next-line require-atomic-updates -- process.exitCode is the last thing this catch block does before the process exits; there is nothing left to race with
    process.exitCode = 1;
  }
};

/*
 * Only run the pipeline when this file is executed directly (`node
 * cli.js ...`), not when it's imported, so parseCliOptions can be unit
 * tested in isolation without also kicking off a real pipeline run
 * against whatever argv/env the test process happens to have.
 */
if (
  process.argv[1] !== undefined
  && fileURLToPath(import.meta.url) === process.argv[1]
) {
  await main();
}

export { parseCliOptions };
