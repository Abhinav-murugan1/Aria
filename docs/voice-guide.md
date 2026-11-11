# Voice guide

Aria's narrator is Chatterbox Turbo cloning an *expressive* voice preset, steered line by line with inline tags and
checked by faster-whisper. Delivery comes from what you write, so this guide is mostly about writing.

## script.json

```json
{
  "voice": "aria-heart",
  "lead": 0.4,
  "lines": [
    {"say": "[dramatic] Nobody noticed the lamp go out.", "caption": "Nobody noticed the lamp go out.", "pause": 0.6},
    {"say": "[whispering] Except me.", "pause": 0.9, "gain": -1},
    {"say": "It was twenty twenty-four.", "caption": "It was 2024.", "seed": 4},
    {"say": "[chuckle] Okay, that sounded spooky.", "voice": "aria-adam"}
  ]
}
```

| key | meaning |
|---|---|
| `voice` | top level: preset name (`voices/NAME.wav`) or a WAV path; per line: a different voice for that line |
| `lead` | silence before the first line, seconds |
| `say` | what is spoken, with tags |
| `caption` | what is shown; defaults to `say` without its tags |
| `pause` | silence after the line, seconds |
| `gain` | dB trim for one line |
| `seed` | a different read for a line that is heard right but sounds wrong |

## Tags

- Emotions: `[happy] [dramatic] [whispering] [fear] [surprised] [sarcastic] [angry] [crying]`
- Sounds: `[chuckle] [laugh] [sigh] [gasp] [sniff] [cough]`

Put tags **at the start of a sentence**. A tag mid-sentence produces garbled words. Use sounds where a person would
make one, and sparingly. Vary the mood across a script (hype -> curious -> low -> warm): one tag on every line sounds
like a parody.

## Writing for the ear

- One sentence per line. Whole sentences keep the melody; fragments reset it at every comma.
- Short sentences, one idea each. A hook in the first two seconds; a warm, not shouted, call to action.
- Spell out numbers, years, symbols and acronyms in `say` ("three D", "twenty twenty-six", "fifty percent") and keep
  digits in `caption`.
- Tags, punctuation (`!` `?` `...`), sentence length and pauses are the controls. Turbo ignores exaggeration knobs.
- Names and rare words: write them phonetically in `say`, spelled properly in `caption`.

## The hearing check

Every take is transcribed and compared with `say`. A dropped, extra or garbled word, or a stalled take, is spoken
again with a new seed, up to `--tries` (default 8). Numbers are compared loosely ("twenty" may be heard as "20"),
long lines may lose one word, and filler that a sound tag produced ("haha") is allowed unless the script itself says
it. A line that never passes is listed and `aria voice` exits 1: reword it or change its `seed`, then
`aria voice script.json media/vo --only N`.

The check hears words, not acting. Listen to the hook and the lines with the strongest tags yourself.

## The emotion meter

```powershell
aria meter media/vo/narration.wav
```
Pitch spread on a whole narration: flat TTS ~2-2.5 st, lively narration 4-6 st. Below ~3 st, vary the tags, shorten
sentences, or build a livelier preset. On single short lines compare median pitch and range between emotions.

## Voice presets

Turbo clones the *delivery* of its sample as well as the timbre: a flat sample gives a flat narrator, whatever the
tags. Presets are therefore expressive reads, made in two steps by `aria voice-preset`:

```powershell
aria voice-preset voices/my-narrator.wav --kokoro am_adam      # from a Kokoro voice: no recording needed
aria voice-preset voices/my-narrator.wav --sample my-read.wav  # from a 5-20 s recording
```

| preset | sounds like | good for |
|---|---|---|
| `aria-heart` | warm, bright female | explainers, facts, product |
| `aria-adam` | grounded male | stories, horror, trailers |

**Consent.** Only clone a voice you own or have explicit permission to use. Agents are told to ask for that
confirmation before building a preset from a recording, and to refuse without it. Never clone a real person from
media found online. Mark AI narration as synthetic when you publish.

## Fast drafts

`aria say af_heart 1.0 draft.wav "text"` speaks with Kokoro on the CPU, instantly, not cloned and with less emotion.
Use it to time a cut before the real voice. Good voices: `af_heart`, `am_adam`, `af_bella`, `am_michael`, `bf_emma`,
`bm_george`.

## Troubleshooting

- `pkg_resources` missing: `setuptools<81` in the voice environment.
- numpy conflicts: Chatterbox needs numpy 1.x and Kokoro numpy 2.x; they live in `.venv` and `.venv-kokoro`.
- Out of VRAM: close other GPU apps; add `--asr-cpu`, or `--cpu` (slow). Turbo + whisper `small.en` fit in ~6 GB.
