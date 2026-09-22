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
  presets) as well as VRM 1.0.
- `createVrmPageFrameRenderer.ts` is the pure orchestration layer: it
  looks up the active viseme for a timestamp (`findActiveViseme.ts`),
  converts it to expression weights, computes the idle motion offset,
  and hands both to a `VrmScenePage` to apply and capture. This is
  the piece that's actually unit tested with 100% coverage, same DI
  pattern as `createDeepgramFluxTtsClient.ts`.

One genuine integration point is still unimplemented and only exists as
an injectable interface so the surrounding logic could be unit tested
without it:

1. A concrete `VideoEncoder` (see `src/render/renderVrmVideo.ts`) that
   shells out to `ffmpeg` to mux the captured frames with the Flux TTS
   audio.

Do not treat the `VideoEncoder` interface in `renderVrmVideo.ts` as
done just because it is typed and tested. The mocked tests only prove
the orchestration logic is correct, not that a real video comes out.
`createPlaywrightVrmScenePage.ts` used to be in that same
typed-but-unproven state; it no longer is, because real rendering
against an actual VRM 0.0 model is proven in
`test/render/createPlaywrightVrmScenePage.spec.ts`.

### The `.vrm` fixture

That real-rendering test needs an actual `.vrm` file, which is a
personal asset, not code, so it is deliberately **not** committed:
supply your own locally at `test/fixtures/naomi.vrm` (gitignored) to
run it. The test uses `describe.skipIf` and skips gracefully if that
file is absent, and `vitest.config.ts`'s coverage `exclude` list carves
`createPlaywrightVrmScenePage.ts` itself out of the 100% threshold for
the same reason: on a clone or CI runner without the fixture, that file
gets no coverage at all rather than a false one. Locally, with the
fixture present, it genuinely is exercised end to end, screenshot pixel
comparison included.

Also outstanding: `prod.env` references
`op://Environment Variables - Naomi/Vroid AI/deepgram_api_key`, which
does not exist in 1Password yet. Create that item and field before
`pnpm start` can do anything real.

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
