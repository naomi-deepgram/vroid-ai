/**
 * @copyright NHCarrigan
 * @license Naomi's Public License
 * @author Naomi Carrigan
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "node_modules/**",
        "prod/**",
        "test/**",
        "*.config.*",
        "src/types/**",
        "src/index.ts",
        "src/render/createPlaywrightVrmScenePage.ts",
        "src/render/createSystemFfmpegRunner.ts",
      ],
      include:  [ "src/**/*.ts" ],
      provider: "v8",
      reporter: [ "text", "html", "lcov" ],
    },
    environment: "node",
    globals:     true,
    include:     [ "test/**/*.spec.ts" ],
  },
});
