---
name: aria
description: Make finished videos with voices from code using Aria. Aria writes the script, narrates it with an expressive cloned voice (emotion tags, laughs, whispers), checks every line by speech recognition, times captions to the exact word, scores original music, and renders React/TypeScript scenes (2D motion graphics and 3D) on the GPU into a checked, share-ready MP4. Use when the user says Aria (any case), or asks for a video, a short, an explainer, a story video, a promo, a narrated slideshow, voiceover, narration, TTS with emotion, captions, or motion graphics from code. Routes to aria-video (picture) and aria-voice (narration).
---

# Aria

Aria is one pipeline for a finished video: **script → voice → captions → scenes → render → check → share**.
Every step is code or a command, so every step can be re-run, diffed and fixed.

Two focused skills do the work. Read the one you need before touching its files:
- **aria-voice**: narration with emotion, cloned voice presets, the speech-recognition check, word-timed captions.
- **aria-video**: compositions (React/TypeScript), 2D motion graphics, 3D scenes, music, render, check, delivery.

## Setup (once)

```powershell
git clone https://github.com/Abhinav-murugan1/Aria; cd Aria
./install.ps1            # render engine + skills into ~/.claude/skills + `aria` on PATH
./install.ps1 -Voice     # + the voice environment (Python 3.11, CUDA torch, Chatterbox Turbo, faster-whisper, Kokoro)
aria doctor              # engine, ffmpeg, GPU, voice: all should say ok
```

Needs Windows 10/11 (or Linux/macOS), a GPU with Vulkan/DX12, ffmpeg on PATH. Voice wants an NVIDIA GPU (~6 GB VRAM);
it runs on CPU, slowly.

## The pipeline

1. **Shape it.** Who watches, the one thing they should feel or believe, the shape (9:16 short, 16:9 film, 1:1),
   the length. Write it at the top of the project's `edit.tsx` as a comment. Ask when it's genuinely unclear;
   otherwise make a best guess and say so.
2. **Start the project.** `aria new NAME --shape 9:16` copies the template: `edit.tsx`, `script.json`, `aria/`
   (the SDK bridge every composition imports from), `media/`, `out/`, `stills/`.
3. **Write the script** as `script.json` lines (aria-voice says how: one sentence a take, tags at sentence starts,
   numbers spelled out). Read it aloud in your head: short sentences, one idea each, a hook in the first two seconds.
4. **Voice it.** `aria voice script.json media/vo` → `line01.wav…`, `narration.wav`, `captions.json` (every word's
   start and end in seconds). Lines that fail the hearing check are listed: re-run with `--only N`.
5. **Build the scenes** in `edit.tsx` (aria-video). Cut scenes on lines, cue every reveal on a word from
   `captions.json`: never on guessed frame numbers. Score with Tone, duck under the voice, mix to -14 LUFS.
6. **Look before you render.** `aria still edit.tsx 0,120,400` and open the PNGs. Text fits, nothing overlaps,
   nothing sits in a platform's UI zone, 3D is lit and in frame.
7. **Make it.** `aria make edit.tsx NAME` renders on the GPU, writes a share copy and checks it (clipped text,
   safe areas, contrast, loudness, freezes, blotching). P0/P1 findings fail: fix and make again as `NAME-v2`. At most three versions per request: then stop and report what is left.
8. **Deliver** `out/NAME.mp4` (the share copy). Keep every version; never render over an old one.

## Rules that keep quality high

- Frame-pure scenes: everything that moves reads `useCurrentFrame()`. No state, effects or timers.
- Clamp every interpolation. Seed anything random from an index, not `Math.random()`.
- Cue on words from `captions.json`; when a line is re-voiced, the picture follows by itself.
- Never ship a voice line nobody listened to: the hearing check catches dropped words, not bad acting.
  Spot-listen the lines with the biggest emotion tags.
- Emotion is measured, not guessed: `aria meter media/vo/line*.wav`. Flat TTS sits ~2–2.5 st pitch spread;
  lively narration 4–6 st.
- Only clone voices the user owns or has permission to use. Mark AI narration as synthetic when publishing.
- Before an upload or any publish step, confirm with the user. Uploads default to private.

## Commands

| command | does |
|---|---|
| `aria new NAME [--shape 9:16\|16:9\|1:1]` | new project from the template |
| `aria voice SCRIPT.json OUT_DIR [--voice WAV] [--only 3,5]` | narration + captions.json |
| `aria voice-preset OUT.wav --kokoro af_heart` / `--sample REC.wav` | a new expressive voice to clone |
| `aria say VOICE SPEED OUT.wav "text"` | fast Kokoro draft line |
| `aria meter FILE.wav…` | emotion meter |
| `aria still EDIT.tsx 0,90,300 [DIR]` | PNG stills to look at |
| `aria render EDIT.tsx -o OUT.mp4\|DIR/ [--at …] [--quality master]` | render |
| `aria check VIDEO.mp4 [--manifest R.json] [--platform shorts]` | check an export |
| `aria make EDIT.tsx NAME [--dark]` | render → share copy → check |
| `aria share IN.mp4 OUT.mp4 [--dark]` | H.264/AAC share copy (`--dark` deblocks dark scenes) |
| `aria doctor` | environment check |
