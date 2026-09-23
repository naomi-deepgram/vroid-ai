# Vroid AI - Project Instructions

## Project Context

Vroid AI turns a script and a `.vrm` avatar model into a lip-synced,
gently-animated video, for producing VTuber-style work content. The
pipeline: Deepgram Flux TTS synthesises the dialogue, that audio is
immediately re-transcribed with Deepgram Listen to recover word-level
timing (Flux TTS's `/v2/speak` endpoint itself only reports total audio
duration, not per-word timestamps), that timing gets split into naive
phoneme clusters and mapped to VRM viseme blend shapes, a headless
renderer drives a `@pixiv/three-vrm` scene frame-by-frame, and ffmpeg
muxes the captured frames with the TTS audio into a final video.

## Current Status

The pure pipeline logic (lip sync timing, expression weights, idle
motion, the Flux TTS response adapter) is fully implemented and tested.
The `FluxTtsClient` integration point is implemented in
`src/tts/createDeepgramFluxTtsClient.ts`. The `FrameRenderer`
integration point is also implemented now, split across two files in
`src/render/`:

- `createPlaywrightVrmScenePage.ts` is the real integration: it starts
  a tiny local HTTP server (serving the `three` and `@pixiv/three-vrm`
  ESM builds plus a given `.vrm` file), launches headless Chromium with
  software-rendering flags (this sandbox has no GPU), loads the model
  with `@pixiv/three-vrm`'s `VRMLoaderPlugin`, and exposes an
  `applyFrame`/`captureFrame` page. It handles VRM 0.0 models
  transparently (`VRMUtils.rotateVRM0`, legacy `blendShapeMaster`
  presets) as well as VRM 1.0. The browser-side scene HTML/script it
  serves are built by the pure, independently unit-tested
  `buildVrmSceneAssets.ts`, which is also where the model gets relaxed
  out of its default T-pose (VRM humanoid rigs load bind-posed, arms
  straight out to the sides, via rotating each normalized upper/lower
  arm bone) and where spring bones (hair, breast physics, and similar
  jiggle bones) get a `physicsSettleSeconds` (default 3) head start of
  simulated-time `vrm.update()` steps before `__vroidReady` resolves,
  so the visible snap/overshoot those bones show right after a model
  loads has already settled out before any real frame is captured.
- `createVrmPageFrameRenderer.ts` is the pure orchestration layer: it
  looks up the active viseme for a timestamp (`findActiveViseme.ts`),
  converts it to expression weights, computes the idle motion offset,
  and hands both to a `VrmScenePage` to apply and capture. This is
  the piece that's actually unit tested with 100% coverage, same DI
  pattern as `createDeepgramFluxTtsClient.ts`.

The `VideoEncoder` integration point is implemented too, also split
across two files in `src/render/`:

- `createFfmpegVideoEncoder.ts` is the pure orchestration layer: given
  the rendered frames and audio, it writes each frame's PNG bytes and
  the audio track to a temp directory, builds an `ffconcat` list with
  the correct per-frame duration (working around ffmpeg's concat-demuxer
  quirk where a listed file's `duration` line actually applies to the
  *next* file, so the last frame has to be listed twice), hands the
  built argument list to an injected `FfmpegRunner`, and always cleans
  the temp directory back up afterwards. Unit tested with 100% coverage
  using a fake `FfmpegRunner`, same DI pattern as the other two
  integration points.
- `createSystemFfmpegRunner.ts` is the real integration: it shells out
  to an actual `ffmpeg` binary on `PATH` via `node:child_process`.

Every integration point this scaffold originally needed is now
implemented. Do not assume "implemented" already means "proven",
though: a mocked orchestration test only proves the wiring is correct,
not that ffmpeg actually accepts the arguments built for it or that a
real video comes out playable. That gap is closed the same way it was
for `createPlaywrightVrmScenePage.ts`: real encoding against a real
`ffmpeg` binary is proven in
`test/render/createSystemFfmpegRunner.spec.ts`, which mux-tests a tiny
synthetic PNG sequence and a synthetic silent WAV into a real `.mp4` and
checks its output bytes.

### Real dependencies this suite conditionally needs

Two tests need something real that this repository doesn't (and, in the
`.vrm` file's case, can't) guarantee is present, so both skip gracefully
via `describe.skipIf` when their dependency is missing, and
`vitest.config.ts`'s coverage `exclude` list carves the one file each
test exercises out of the 100% threshold for the same reason: on a
clone or CI runner without that dependency, that one file gets no
coverage at all rather than a false one.

- `test/render/createPlaywrightVrmScenePage.spec.ts` needs an actual
  `.vrm` file, which is a personal asset, not code, so it is
  deliberately **not** committed: supply your own locally at
  `test/fixtures/naomi.vrm` (gitignored) to run it.
- `test/render/createSystemFfmpegRunner.spec.ts` needs a real `ffmpeg`
  binary on `PATH`. Unlike the `.vrm` file, this is a normal system
  dependency that could be installed in CI (this repo's Gitea workflow
  doesn't currently do that), rather than something that can never
  exist in a fresh clone; tighten this back to an unconditional test if
  the CI runner is confirmed to have `ffmpeg` installed.

Locally, with both dependencies present, both tests genuinely exercise
their file end to end: screenshot pixel comparison for the VRM scene
page, and real `ffmpeg` muxing (verified via the output file's `ftyp`
box) for the encoder.

### The script is wired in

All three integration points are now wired into an actual runnable
script, split across three more files at the top of `src/`:

- `generateVroidVideo.ts` is the pure orchestration layer: given a
  Flux TTS client, an already-loaded VRM scene page, and a video
  encoder, it synthesises the dialogue, builds the lip sync timeline
  from the recovered word timings via `buildVisemeTimeline`, wraps the
  scene page in a `FrameRenderer` via `createVrmPageFrameRenderer`, and
  drives `renderVrmVideo` to produce the file. It also estimates the
  video's total duration from the last word's end timestamp plus a
  little trailing silence, since neither Flux TTS's REST endpoint nor
  Listen ever report one directly. Every dependency here is injected,
  so like the three integration points above, this is unit tested with
  100% coverage using fakes. It also reports progress through an
  optional `onProgress` callback (`VroidPipelineProgressEvent`: dialogue
  synthesised, rendering started with a total frame count, each frame
  rendered, encoding started, done) so a caller can show feedback
  without this pure layer needing to know anything about how; `renderVrmVideo.ts`
  itself only exposes the two lower-level `onFrameRendered`/
  `onEncodingStart` callbacks this is built from.
- `runVroidPipeline.ts` is the real composition root: it constructs a
  real `DeepgramClient`, a real `PlaywrightVrmScenePage`, and a real
  ffmpeg-backed `VideoEncoder`, and calls `generateVroidVideo` with
  them, closing the scene page in a `finally` block regardless of
  success or failure. When a caller doesn't supply its own
  `onProgress`, it defaults to a real console reporter: plain log lines
  for each stage, and frame-rendering progress that updates in place on
  one line when stdout is a real terminal (`process.stdout.isTTY`), or
  logs one line per 10% milestone otherwise (piped output, a log file,
  or this project's own non-interactive tooling), rather than either
  staying silent or printing a wall of one-line-per-frame noise. It
  also contains the one piece of real `@deepgram/sdk` friction found
  so far: the SDK's Listen response types weren't authored with this
  project's `exactOptionalPropertyTypes`
  TypeScript option in mind, so a real `DeepgramClient` instance can't
  be passed to `createDeepgramFluxTtsClient` through a plain structural
  cast. `adaptDeepgramClient` in that file contains the one necessary
  type assertion, with the reasoning recorded in its comment, rather
  than loosening `createDeepgramFluxTtsClient.ts`'s own (already
  tested) types to work around it.
- `cli.ts` is the actual entry point `pnpm start` runs: it reads
  `<dialogueText> <vrmFilePath> <outputPath>` from argv and
  `DEEPGRAM_API_KEY` from the environment, and calls
  `runVroidPipeline`. With no positional arguments at all, `pnpm start`
  just works instead of printing a usage error: it falls back to
  reading dialogue from `./data/script.md` (verbatim, trimmed; its
  `.md` extension is only a convenience for editing it, not a signal
  to strip Markdown out of it), the model from `./data/model.vrm`, and
  writing to `./data/output.mp4`. `data/` is gitignored except
  `data/.gitkeep`, since the script and model are personal content, not
  code (same reasoning as the `.vrm` test fixture). Its argv/env/file
  parsing (`parseCliOptions`) has its file-system access
  (`fileExists`/`readScriptFile`) injected exactly like the real
  integration points above, so its `./data/` fallback is unit tested
  without touching this project's own real `./data/` files; running
  the pipeline itself is guarded behind an
  `import.meta.url === process.argv[1]` check so importing this file
  in a test (to reach `parseCliOptions`) never also kicks off a real
  pipeline run.

The whole pipeline has been proven end to end for real, not just
per-integration-point: `test/runVroidPipeline.spec.ts` calls
`runVroidPipeline` with a real Deepgram API key, the real `.vrm`
fixture, and a real `ffmpeg` binary, and asserts the result is a
genuine playable `.mp4`. Like the other two real tests, it skips via
`describe.skipIf` when any of its three real dependencies (a
`DEEPGRAM_API_KEY` environment variable, the fixture, `ffmpeg`) is
missing, and `runVroidPipeline.ts` (though not `cli.ts`; see above) is
carved out of the coverage threshold in `vitest.config.ts` for the
same reason: a fresh clone or CI runner still won't have a `.vrm`
fixture or `ffmpeg` by default, even now that a real key is wired in
(see below).

`prod.env` sets `DEEPGRAM_API_KEY` from
`op://Hikari/OpenCode Credentials/Deepgram Token`, at Naomi's explicit
direction: this is Hikari's own personal Deepgram token, used directly
as this project's real, ongoing credential rather than Naomi
provisioning a separate key of her own for it. `pnpm run start` and
`test/runVroidPipeline.spec.ts` both resolve it the same way, via
`op run`/an `op` session with access to Hikari's vault. Confirmed
working end to end via the real `pnpm run start --` invocation, not
just in isolation.

## Commands

Source nvm first if Node tools are not on PATH: `source ~/.nvm/nvm.sh`

```bash
pnpm install       # install dependencies
pnpm run build     # tsc build to ./prod
pnpm run lint      # eslint src test --max-warnings 0
pnpm run test      # vitest run --coverage
pnpm run start     # op run --env-file=prod.env -- node prod/index.js
```

Run `pnpm run lint && pnpm run build && pnpm run test` before
considering any change finished. This is exactly what
`.gitea/workflows/ci.yml` runs, and `--max-warnings 0` means a single
stray warning fails CI.

## Testing Requirements

Every new module must ship with tests that keep coverage at 100%
(statements, branches, functions, lines). `vitest.config.ts` enforces
this as a hard threshold, not a goal. `src/types/**` and `src/index.ts`
are excluded from coverage since they carry no logic.

- Prefer dependency injection over mocking frameworks where
  possible: see `FluxTtsClient`, `FrameRenderer`, and `VideoEncoder` for
  the pattern. Pass the real integration (Deepgram SDK client,
  Playwright page, ffmpeg wrapper) in as a parameter so tests can pass a
  fake implementation instead.
- If a branch is genuinely unreachable (for example, a defensive
  `?? fallback` against a type that cannot actually be null at runtime),
  do not contort a test to hit it. Mark it instead:

  ```typescript
  /* v8 ignore next -- @preserve */
  ```

  The exact lowercase string and the `@preserve` are both load-bearing.
  TypeScript strips comments without `@preserve`, and the v8 coverage
  provider only recognises the lowercase `v8 ignore` phrase. ESLint's
  `capitalized-comments` rule will try to capitalise it to `V8 ignore`
  under `--fix`. If that happens, the coverage tool silently stops
  recognising it. Always `grep -n "v8 ignore"` after running `--fix` on
  a file that has one, and disable that rule for the line instead of
  letting it "fix" the directive:

  ```typescript
  // eslint-disable-next-line capitalized-comments -- v8 ignore directive must stay lowercase
  /* v8 ignore next -- @preserve */
  ```

- Every `*.spec.ts` file needs this exact disable block after the file
  header, before the imports (copy it verbatim rather than discovering
  each rule's warning one at a time):

  ```typescript
  /* eslint-disable vitest/valid-expect -- Test expectations don't need messages */
  /* eslint-disable max-lines-per-function -- Test suites naturally have many cases */
  /* eslint-disable max-nested-callbacks -- Vitest structure requires nesting */
  /* eslint-disable vitest/prefer-to-be-truthy -- toBe(true) is clearer for boolean functions */
  /* eslint-disable vitest/prefer-to-be-falsy -- toBe(false) is clearer for boolean functions */
  ```

  Only keep the `prefer-to-be-truthy`/`prefer-to-be-falsy` lines if the
  file actually uses `.toBe(true)`/`.toBe(false)`. ESLint flags unused
  `eslint-disable` directives too.
- Every `it()` should start with `expect.assertions(<n>)`.

## Code Style Gotchas (from `@nhcarrigan/eslint-config`)

These are non-obvious enough that they are worth listing rather than
re-discovering via lint errors:

- Module-level constants use camelCase, not `SCREAMING_SNAKE_CASE`.
  `@typescript-eslint/naming-convention` rejects the all-caps
  convention common elsewhere.
- Exports are consolidated into one statement at the bottom of the
  file. Do not write `export interface Foo` or `export const bar` inline.
  Declare without `export`, then finish the file with a single
  statement, mixing type-only exports with the `type` keyword per
  specifier: `export { bar, type Foo };`.
- Array types use the generic form: `Array<T>` /
  `ReadonlyArray<T>`, not `T[]` / `readonly T[]`.
- Arrow function type positions want no space before `=>`
  (`(x: number)=> Promise<T>`), which is the opposite of normal arrow
  function expressions, which do want the space
  (`(x) => { ... }`). ESLint will tell you which one it means per site.
- `no-mixed-operators` and `no-extra-parens` can fight each other
  on expressions mixing `+`/`*` or `/`/`*`. If wrapping the
  multiplication in parentheses gets flagged as unnecessary, do not
  keep adding parens. Pull the sub-expression into its own named
  variable instead.
- `object-shorthand` checks consistency across the whole object
  literal. If any property in an object cannot be shorthand (its value
  is not a bare identifier matching the key), ESLint wants the other
  properties longhand too, even ones that could be shorthand. When in
  doubt, make every property longhand (`key: key`) rather than mixing.
- Every source file starts with this exact header:

  ```typescript
  /**
   * @copyright NHCarrigan
   * @license Naomi's Public License
   * @author Naomi Carrigan
   */
  ```

## Git Commits

This is a project under `/home/naomi/code/naomi/`, so per Hikari's
global instructions:

- Always commit as Hikari: `--author="Hikari <hikari@nhcarrigan.com>" --gpg-sign=5380E4EE7307C808`.
- Never add `Co-Authored-By` lines.
- Always ask for confirmation before committing or pushing.
- Push with: `git push https://hikari:TOKEN@git.nhcarrigan.com/nhcarrigan/vroid-ai.git <branch>`
  (substitute the real Gitea token; never hardcode it in a commit).

## Not Yet Present

This scaffold intentionally does not include the usual community-health
files (`LICENSE.md`, `README.md`, `CONTRIBUTING.md`,
`CODE_OF_CONDUCT.md`, `PRIVACY.md`, `SECURITY.md`, `TERMS.md`) that
Naomi's other repos carry. Add them via her usual process once this
project is ready to be public-facing.
