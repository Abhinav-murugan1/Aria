---
name: aria-voice
description: Aria's voice generation. Expressive narration with a cloned voice (Chatterbox Turbo) driven by emotion and sound tags ([happy], [whispering], [dramatic], [fear], [chuckle], [sigh], [gasp]...), every take verified by speech recognition (faster-whisper) and re-spoken until it is heard right, word-level caption timing, voice presets, an emotion meter, and fast Kokoro drafts. Use for narration, voiceover, TTS, "more emotion", "sounds robotic/flat", voice cloning, captions timing, or when an Aria video needs a voice.
---

# Aria voice

The voice is half the video. Aria's narrator is **Chatterbox Turbo** cloning an *expressive* voice preset, steered
line by line with inline tags, and policed by **faster-whisper**. Output is a narration track plus `captions.json`
with every word's start and end, which the picture cues on.

## Quick start

```powershell
aria voice script.json media/vo                 # all lines
aria voice script.json media/vo --only 3,7      # re-speak lines 3 and 7, keep the rest
aria voice script.json media/vo --voice voices/aria-adam.wav
```

`script.json`:
```json
{
  "voice": "aria-heart",
  "lead": 0.4,
  "lines": [
    {"say": "[dramatic] Nobody noticed the lamp go out.", "caption": "Nobody noticed the lamp go out.", "pause": 0.6},
    {"say": "[whispering] Except me.", "pause": 0.9, "gain": -1},
    {"say": "It was twenty twenty-four.", "caption": "It was 2024.", "seed": 4}
  ]
}
```
- `say`: spoken text with tags; `caption`: shown text (defaults to `say` minus tags). `pause`: silence after, s.
- `gain` (dB) trims one line; `seed` picks a different read when a line sounds wrong but is heard right.
- Output: `lineNN.wav`, `narration.wav` (24 kHz mono, lead + lines + pauses) and `captions.json`:
  `{"seconds", "lines": [{"file", "start", "end", "text", "ok", "heard", "words": [{"w", "s", "e"}]}]}`
  with times on the narration track. Exit code 1 means some line never passed the hearing check: listen to it,
  change its wording or seed, `--only` it.

## Writing for the voice (this is where emotion comes from)

- **One sentence per take.** Whole sentences keep intonation flowing; fragments reset the melody at every comma.
- **Tags go at the start of a sentence.** A tag mid-sentence ("ground, [whispering] asleep") produces garbage words.
  Emotions: `[happy] [dramatic] [whispering] [fear] [surprised] [sarcastic] [angry] [crying]`.
  Sounds: `[chuckle] [laugh] [sigh] [gasp] [sniff] [cough]`. Use sounds where a person would make one, sparingly.
- Turbo ignores exaggeration/cfg knobs: tags, punctuation (`!` `?` `...`), sentence length and pauses are the controls.
- Spell out numbers, years, symbols and acronyms in `say` ("three D", "twenty twenty-six", "fifty percent"); keep
  digits in `caption`.
- Vary the moods across a script: hype → curious → low → warm. A whole script in one tag sounds like a parody.
- Hook line short and punchy; the call to action warm, not shouted.

## Voice presets (cloning)

Turbo clones the **delivery** of its sample, not just its timbre. A flat sample → a flat narrator, whatever the tags.
So presets are expressive reads, made in two steps:

```powershell
aria voice-preset voices/my-narrator.wav --kokoro am_adam     # from a Kokoro voice, no recording needed
aria voice-preset voices/my-narrator.wav --sample my-read.wav # from a recording the user owns
```
The base voice reads lively lines through original Chatterbox with high exaggeration; that read is the preset.
Shipped presets: `voices/aria-heart.wav` (warm female, explainers, facts) and `voices/aria-adam.wav` (male,
stories, horror). **Only clone a voice the user owns or has explicit permission to use.** Never clone a real
person from a video found online.

## Checking

1. **Hearing check (automatic).** Every take is transcribed; a dropped, extra or garbled word or a stalled take is
   re-spoken with a new seed (up to `--tries`, default 8). Filler sounds ("haha", "heh") from sound tags are allowed.
2. **Emotion meter.** `aria meter media/vo/narration.wav` prints pitch spread/range. On a whole narration: flat TTS
   ~2–2.5 st spread, lively 4–6 st. Below ~3 st: rewrite with more varied tags and shorter sentences, or
   rebuild the preset from a livelier read. On single short lines compare median pitch and range across emotions.
3. **Listen** to the lines with the strongest tags and to the hook. The check can't hear bad acting.

## Fast drafts: Kokoro

`aria say af_heart 1.0 draft.wav "text"` (CPU, instant, not cloned, less emotion). Use for timing a cut before the
real voice, or when no GPU is around. Never stretch vowels in phonemes for stress: it bends words. Stress with
pace, pauses and punctuation. Good voices: `af_heart`, `am_adam`, `af_bella`, `am_michael`, `bf_emma`, `bm_george`.

## Troubleshooting

- `pkg_resources` missing → `setuptools<81` in the voice venv (the watermark package imports it).
- numpy conflicts → Chatterbox needs numpy 1.x, Kokoro numpy 2.x: they live in `.venv` and `.venv-kokoro`.
- Out of VRAM → close other GPU apps; whisper `small.en` + Turbo fit in ~6 GB. `--cpu` works, slowly.
- Old system TTS voices (SAPI and friends) sound flat: don't fall back to them without asking.
- A line keeps failing → reword it (rare words, names), give the name phonetically in `say` and the real spelling
  in `caption`.
