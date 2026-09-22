/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

/* eslint-disable vitest/valid-expect -- Test expectations don't need messages */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createPlaywrightVrmScenePage,
} from "../../src/render/createPlaywrightVrmScenePage.js";

/*
 * This fixture is a real, personal .vrm file that is deliberately not
 * committed to the repository (see .gitignore); it has to be supplied
 * locally at this path to run this test. Everything else in this
 * project's test suite is mockable, but rendering a VRM is the one
 * thing a mock cannot actually prove works, so this test is skipped
 * rather than faked when the fixture isn't present, and
 * createPlaywrightVrmScenePage.ts is carved out of the coverage
 * threshold in vitest.config.ts for the same reason.
 */
const fixturePath = fileURLToPath(
  new URL("../fixtures/naomi.vrm", import.meta.url),
);
const hasFixture = existsSync(fixturePath);

describe.skipIf(!hasFixture)("createPlaywrightVrmScenePage", () => {
  it("should render visibly different frames per viseme", async() => {
    expect.assertions(2);

    const scenePage = await createPlaywrightVrmScenePage(fixturePath);

    try {
      await scenePage.applyFrame(
        { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 },
        { chestScale: 1, headTiltRadians: 0 },
      );
      const neutralFrame = await scenePage.captureFrame();

      await scenePage.applyFrame(
        { aa: 1, ee: 0, ih: 0, oh: 0, ou: 0 },
        { chestScale: 1, headTiltRadians: 0 },
      );
      const aaFrame = await scenePage.captureFrame();

      expect(neutralFrame.subarray(0, 8)).toStrictEqual(
        Buffer.from([ 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A ]),
      );
      expect(neutralFrame.equals(aaFrame)).toBeFalsy();
    } finally {
      await scenePage.close();
    }
  }, 60_000);
});
