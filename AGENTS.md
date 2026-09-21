# Vroid AI - Project Instructions

## Project Context

Vroid AI turns a script and a `.vrm` avatar model into a lip-synced,
gently-animated video, for producing VTuber-style work content. The
pipeline: Deepgram Flux TTS synthesises the dialogue and returns
word-level timing, that timing gets split into naive phoneme clusters
and mapped to VRM viseme blend shapes, a headless renderer drives a
`@pixiv/three-vrm` scene frame-by-frame, and ffmpeg muxes the captured
frames with the TTS audio into a final video.

## Current Status

The pure pipeline logic (lip sync timing, expression weights, idle
motion, the Flux TTS response adapter) is fully implemented and tested.
Three integration points are still unimplemented and only exist as
injectable interfaces so the surrounding logic could be unit tested
without them:

1. A concrete `FluxTtsClient` (see `src/tts/requestFluxTtsAudio.ts`)
   backed by `@deepgram/sdk`'s `/v2/speak` call.
2. A concrete `FrameRenderer` (see `src/render/renderVrmVideo.ts`) that
   drives a headless Playwright page running `@pixiv/three-vrm` against
   a real `.vrm` file and captures its canvas.
3. A concrete `VideoEncoder` (same file) that shells out to `ffmpeg` to
   mux the captured frames with the Flux TTS audio.

Do not treat the interfaces in `renderVrmVideo.ts` as done just because
they are typed and tested. The mocked tests only prove the
orchestration logic is correct, not that a real video comes out.

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
