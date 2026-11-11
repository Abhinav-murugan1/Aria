# CLI reference

`aria` is one command for the whole pipeline. After `install.ps1` it is on your PATH (`bin/aria.cmd`, `bin/aria`);
anywhere else, `python <repo>/tools/aria.py <verb> ...` does the same. `aria`, `aria help` and `aria --help` print
the verb list. An unknown verb exits with code 1.

| verb | does |
|---|---|
| [`new`](#new) | start a project from the template |
| [`voice`](#voice) | expressive narration + word-timed captions |
| [`voice-preset`](#voice-preset) | make a new expressive voice preset |
| [`say`](#say) | quick Kokoro draft line |
| [`meter`](#meter) | emotion meter |
| [`still`](#still) | PNG stills to look at |
| [`render`](#render) | GPU render to video or frames |
| [`check`](#check) | export check, P0-P3 |
| [`make`](#make) | render -> share copy -> check |
| [`share`](#share) | H.264/AAC share copy |
| [`doctor`](#doctor) | environment check |
| [`engine`](#engine) | pass arguments straight to the render engine |

## new

```
aria new NAME [--shape 9:16|16:9|1:1]
```
Copies `templates/short` to `NAME/` (`edit.tsx`, `script.json`, `aria/` SDK bridge) and creates `media/`, `out/`,
`stills/`. `--shape` sets the composition size: 9:16 = 1080x1920 (default), 16:9 = 1920x1080, 1:1 = 1080x1080.
Fails if `NAME` already exists.

## voice

```
aria voice SCRIPT.json OUT_DIR [--voice WAV] [--only 3,5] [--tries 8] [--cpu] [--asr-cpu]
```
Runs `tools/voice/narrate.py` in the voice environment. Writes `OUT_DIR/lineNN.wav`, `OUT_DIR/narration.wav`
(24 kHz mono) and `OUT_DIR/captions.json`.

| flag | meaning |
|---|---|
| `--voice WAV` | voice sample to clone; overrides the script's `voice` |
| `--only 3,5` | re-speak only these lines (1-based); the others are reused from the last run |
| `--tries N` | takes per line before giving up on the hearing check (default 8) |
| `--cpu` | run without CUDA (slow) |
| `--asr-cpu` | speech recognition on CPU (frees ~1 GB VRAM on small GPUs) |

Exit code 1: at least one line never passed the hearing check. See [voice-guide.md](voice-guide.md).

## voice-preset

```
aria voice-preset OUT.wav --kokoro VOICE      # from a Kokoro voice (af_heart, am_adam, ...)
aria voice-preset OUT.wav --sample REC.wav    # from a 5-20 s recording you own or have permission to use
                          [--exaggeration 0.6]
```
Reads a few lively lines in the base voice and saves that expressive read as the preset to clone from.

## say

```
aria say VOICE SPEED OUT.wav "text"
aria say --list
```
Kokoro, CPU, not cloned: for drafts and timing passes. `--list` prints the voice names.

## meter

```
aria meter FILE.wav [FILE.wav ...] [--json OUT.json]
```
Median pitch, pitch spread and range (semitones) and loudness range. On whole narrations (15 s+) it adds a verdict:
flat (< 2.8 st spread), ok, lively (>= 4 st).

## still

```
aria still EDIT.tsx FRAMES [DIR]
```
Renders the frames listed in `FRAMES` (comma separated, e.g. `0,90,300`) as PNGs into `DIR` (default `stills/`).

## render

```
aria render EDIT.tsx -o OUT.mp4|OUT.png|DIR/ [flags]
```

| flag | meaning |
|---|---|
| `-o OUT` | an `.mp4`, a single `.png`, or a folder for PNG frames |
| `--frame N` / `--at A,B` | one frame / a list of frames |
| `--composition ID` | which `<Composition>` to render |
| `--w W --h H --fps FPS --frames N` | override size, frame rate, length |
| `--manifest render.json` | write the render manifest the check reads |
| `--quality draft\|high\|master\|0..1` or `--kbps N` | encode quality |
| `--10bit` | 10-bit output |

## check

```
aria check VIDEO.mp4 [--manifest render.json] [--words W.json] [--shape 16:9|9:16|4:5|1:1]
                     [--platform tiktok|reels|shorts] [-o check.json]
```
Checks an export for clipped text, contrast, safe areas, freezes, cue timing, loudness and blotching, graded P0-P3.
Exit code is non-zero when there are P0/P1 findings. `--platform` adds that platform's UI zones.

## make

```
aria make EDIT.tsx NAME [--dark]
```
Into `out/` beside `EDIT.tsx`: renders `NAME-raw.mp4` at master quality with `NAME.render.json`, encodes the share
copy `NAME.mp4`, then checks it into `NAME.check.json`. Exits non-zero on a failed render, encode or check.
`--dark` deblocks dark scenes in the share copy (x264 crf 17).

## share

```
aria share IN.mp4 OUT.mp4 [--dark]
```
H.264 High + AAC 192k + faststart copy that any player and platform accepts (crf 20; `--dark`: deblock + gradfun,
crf 17). Needs `ffmpeg` on PATH.

## doctor

```
aria doctor
```
Prints `engine`, `ffmpeg`, `gpu`, `voice`, `kokoro` with `ok` or the fix. Exits 1 when the engine or ffmpeg is
missing (voice is optional).

## engine

```
aria engine ARGS...
```
Runs the render engine with `ARGS` unchanged, for anything the verbs above do not cover.

## Environment variables

| variable | meaning |
|---|---|
| `ARIA_ENGINE` | path of the render engine binary (set by `install.ps1`) |
| `ARIA_VOICE_PYTHON` | a Python with the voice packages, instead of `tools/voice/.venv` |
