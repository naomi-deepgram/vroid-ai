/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable no-console -- this is a CLI entry point; console output is the whole point */

import { fileURLToPath } from "node:url";
import {
  runVroidPipeline,
  type RunVroidPipelineOptions,
} from "./runVroidPipeline.js";

const usage
  = "Usage: node cli.js <dialogueText> <vrmFilePath> <outputPath>";

/**
 * Parses this process's CLI arguments and environment into
 * runVroidPipeline options, or returns null with a usage message
 * already printed to stderr if either is incomplete.
 * @param argv - The process's argv, including the node binary and
 * script path.
 * @param environment - The process's environment variables.
 * @returns Complete pipeline options, or null if argv or environment
 * didn't provide everything needed.
 */
const parseCliOptions = (
  argv: ReadonlyArray<string>,
  environment: Readonly<Record<string, string | undefined>>,
): RunVroidPipelineOptions | null => {
  const [ dialogueText, vrmFilePath, outputPath ] = argv.slice(2);
  const deepgramApiKey = environment.DEEPGRAM_API_KEY;

  if (
    dialogueText === undefined
    || vrmFilePath === undefined
    || outputPath === undefined
  ) {
    console.error(usage);
    return null;
  }

  if (deepgramApiKey === undefined) {
    console.error("Missing DEEPGRAM_API_KEY environment variable.");
    return null;
  }

  return { deepgramApiKey, dialogueText, outputPath, vrmFilePath };
};

/**
 * The CLI entry point: parses argv and env, runs the full pipeline,
 * and reports failures with a non-zero exit code rather than an
 * unhandled rejection.
 */
const main = async(): Promise<void> => {
  const cliOptions = parseCliOptions(process.argv, process.env);
  if (cliOptions === null) {
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
