# Vroid AI

Deepgram Flux TTS + VRM avatar pipeline for generating VTuber-style
work content videos.

## What it does

Given a script and a `.vrm` avatar model, the pipeline:

1. Sends the dialogue to Deepgram's Flux TTS `/v2/speak` endpoint and
   gets back synthesised audio plus word-level timing.
2. Splits that timing into naive phoneme clusters and maps each one to
   a VRM viseme blend shape.
3. Drives a headless renderer running a `@pixiv/three-vrm` scene
   frame-by-frame, applying the viseme weights and a gentle idle
   motion offset.
4. Muxes the captured frames with the Flux TTS audio into a final
   video using ffmpeg.

## Current status

The pure pipeline logic (lip sync timing, expression weights, idle
motion, the Flux TTS response adapter) is fully implemented and
tested, with 100% coverage.

Three integration points remain unimplemented. They exist only as
injectable interfaces so the surrounding logic could be unit tested
without them:

- A concrete `FluxTtsClient` (see `src/tts/requestFluxTtsAudio.ts`)
  backed by `@deepgram/sdk`'s `/v2/speak` call.
- A concrete `FrameRenderer` (see `src/render/renderVrmVideo.ts`) that
  drives a headless Playwright page running `@pixiv/three-vrm` against
  a real `.vrm` file and captures its canvas.
- A concrete `VideoEncoder` (same file) that shells out to `ffmpeg` to
  mux the captured frames with the Flux TTS audio.

`prod.env` also references
`op://Environment Variables - Naomi/Vroid AI/deepgram_api_key`, which
does not yet exist in 1Password.

## Commands

Source nvm first if Node tools are not on `PATH`: `source ~/.nvm/nvm.sh`

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

## Not yet present

This scaffold intentionally does not yet include the other usual
community-health files (`LICENSE.md`, `CONTRIBUTING.md`,
`CODE_OF_CONDUCT.md`, `PRIVACY.md`, `SECURITY.md`, `TERMS.md`) that
Naomi's other repos carry. Those will be added once the project is
ready to be public-facing.
