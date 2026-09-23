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

Every part of the pipeline is implemented, tested, and wired into a
runnable script: the pure lip sync/rendering logic, a Deepgram-backed
`FluxTtsClient`, a headless-Playwright-backed `FrameRenderer`, and an
ffmpeg-backed `VideoEncoder`. Real rendering and real encoding are
each proven against an actual `.vrm` model and a real `ffmpeg` binary,
not just mocked; see `AGENTS.md` for the details and for what those
tests need to run locally.

## Setup

```bash
source ~/.nvm/nvm.sh   # if node/pnpm aren't already on PATH
pnpm install
npx playwright install # downloads the headless Chromium the renderer needs
```

You'll also need a system `ffmpeg` on `PATH`.

`prod.env` (safe to commit; it only holds 1Password references) sets
`DEEPGRAM_API_KEY` from `op://Hikari/OpenCode Credentials/Deepgram
Token`. Running `pnpm run start` needs an `op` session with access to
that vault.

## Usage

With no arguments, `pnpm start` reads dialogue from `./data/script.md`,
the avatar from `./data/model.vrm`, and writes the result to
`./data/output.mp4`:

```bash
pnpm run build
pnpm run start
```

`data/` is gitignored (aside from `data/.gitkeep`): the script and
model are personal content, not code, so add your own before running
this. `./data/script.md`'s contents are used verbatim as the dialogue
text; its `.md` extension is just a convenience for editing it, not a
signal that Markdown syntax gets stripped out of it.

You can also pass an explicit dialogue, model, and output path instead
of using `./data/`:

```bash
pnpm run start -- "Your dialogue here." /path/to/model.vrm /path/to/output.mp4
```

## Commands

```bash
pnpm install       # install dependencies
pnpm run build     # tsc build to ./prod
pnpm run lint      # eslint src test --max-warnings 0
pnpm run test      # vitest run --coverage
pnpm run start     # op run --env-file=prod.env -- node prod/cli.js
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
