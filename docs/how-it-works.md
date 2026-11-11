# How Aria works

Aria turns a request into a finished MP4 through steps that are each a file or a command, so any step can be re-run,
diffed and fixed without redoing the others. Everything runs on your machine: the voice models, the speech
recognition, the renderer and the encoder. Nothing is uploaded unless you publish it yourself.

```
request -> script.json -> voice + hearing check -> captions.json -> scenes (edit.tsx) -> GPU render -> export check -> share MP4
```

## 1. Request -> script

Your agent shapes the request (audience, the one idea, shape 9:16 / 16:9 / 1:1, length), runs `aria new`, and writes
`script.json`: one sentence per line, each with what is **said** (with emotion and sound tags such as `[dramatic]`,
`[whispering]`, `[chuckle]` at the start of a sentence) and what is **shown** as the caption.

## 2. Voice + hearing check

`aria voice` speaks every line with Chatterbox Turbo, cloning an expressive voice preset (`voices/aria-heart.wav`,
`voices/aria-adam.wav`, or your own). Every take is transcribed by faster-whisper and compared with the script: a
dropped, extra or garbled word, or a stalled take, is spoken again with a new seed, up to 8 times. Filler sounds that a
sound tag asked for ("haha") are allowed. Lines that never pass are reported and the command exits 1.

## 3. captions.json: word times

The recognised word stamps are aligned to the caption words; words recognition missed share the gap in proportion
to their syllables. The lines are joined with their pauses into `narration.wav`, and `captions.json` stores each
line's start and end and each word's start and end, in seconds on that track.

## 4. Scenes as frame functions, cued on words

`edit.tsx` is a React/TypeScript composition: a pure function from frame number to picture (2D layout, motion
graphics, karaoke captions, and a 3D world with lights, materials, 3D text and bloom). Scenes are cut on line starts
and every reveal is cued on a word from `captions.json`. When a line is re-voiced, its words move and the picture
follows by itself. The score is written in code with Tone, ducked under the voice and mixed to -14 LUFS.

## 5. Look, then render on the GPU

`aria still` renders chosen frames to PNG so the agent (and you) can look before a full render. `aria make` renders
every frame on the local GPU (Vulkan or DX12) with its audio mix into `out/NAME-raw.mp4` plus a render manifest.

## 6. Export check

The render is encoded into a share copy and checked against the manifest: clipped or off-screen text, safe areas
for platform UI, contrast, freezes, cue timing, loudness and compression blotching, graded P0 (broken) to P3
(polish). P0/P1 findings fail the make; the agent fixes the cause and makes the next version (`-v2`, `-v3`), at
most three per request.

## 7. Share MP4

`out/NAME.mp4` is H.264 High + AAC with faststart, which any player and platform accepts. Publishing is always your
call: agents are told to confirm before any upload, upload as private first and mark AI narration as synthetic.

## What lives where

| path | role |
|---|---|
| `skills/aria`, `skills/aria-video`, `skills/aria-voice`, `skills/aria-brag` | the agent guides (Claude Code skills) |
| `AGENTS.md` | the same guidance for every other agent |
| `commands/` | slash commands |
| `tools/aria.py` | the `aria` CLI |
| `tools/voice/` | narration, voice presets, emotion meter, Kokoro drafts |
| `templates/short/` | what `aria new` copies |
| `voices/` | shipped voice presets |
