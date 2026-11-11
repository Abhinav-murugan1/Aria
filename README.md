# Aria

**Finished videos with real-sounding voices, made from code, by Claude Code.**

Aria is a set of Claude Code skills plus a small CLI. Ask Claude for a video and Aria takes it the whole way:

```
script  →  voice  →  captions  →  scenes  →  render  →  check  →  share
```

- **aria-voice**: expressive narration that *whispers, laughs, gets excited, gets dramatic*. Inline emotion tags
  (`[happy]`, `[whispering]`, `[dramatic]`, `[chuckle]`...), cloned voice presets, and every take heard back by
  speech recognition and re-spoken until every word is right. Word-level timings come out as `captions.json`.
- **aria-video**: scenes written as React + TypeScript: karaoke captions, motion graphics, real 3D (lights,
  materials, 3D text, bloom), an original score in code, all cued to the exact spoken word, rendered on your GPU,
  checked for clipped text, safe areas, contrast, loudness and compression artefacts, and encoded into a share copy.
- **Aria**: the umbrella skill that runs the pipeline and routes to the two above.

The showcase film in [`examples/showcase`](examples/showcase) was made entirely with Aria: its narration, its
captions, its 3D, its music and its render. Watch it in the
[latest release](../../releases/latest).

## Install

Windows 10/11 (PowerShell), a GPU with Vulkan or DX12 and `ffmpeg` on PATH. Voice wants an NVIDIA GPU (~6 GB VRAM).

```powershell
git clone https://github.com/Abhinav-murugan1/Aria; cd Aria
./install.ps1            # render engine + skills (~/.claude/skills) + the aria command
./install.ps1 -Voice     # + voice environment: Python 3.11, CUDA torch, Chatterbox Turbo, faster-whisper, Kokoro
aria doctor
```

## Use it from Claude Code

Just ask:

> make a 30 second vertical short explaining why we procrastinate, warm narrator, with captions

> make a 16:9 launch video for my app, dramatic voice, 3D logo reveal, upbeat music

> re-voice line 3 with more excitement and make the title land on the word "now"

Claude loads the Aria skills, writes `script.json` and `edit.tsx`, voices, renders, looks at stills, checks the
export and hands you `out/NAME.mp4`.

### Slash commands

`install.ps1` also installs these into `~/.claude/commands/` (only `aria-*.md` files; nothing else there is touched):

| command | does |
|---|---|
| `/aria`, `/aria-video`, `/aria-voice` | load the skills themselves |
| `/aria-help` | list every Aria command, read from what is installed |
| `/aria-short TOPIC [9:16\|16:9\|1:1] [voice] [length]` | a finished video end to end (9:16 by default) |
| `/aria-new NAME [shape]` | an empty project from the template |
| `/aria-narrate SCRIPT.json [OUT_DIR]` | voice a script: emotion tags, hearing check, word-timed captions |
| `/aria-retake LINES [direction]` | re-speak lines, e.g. `/aria-retake 3,7 more excited` |
| `/aria-preset NAME KOKORO_VOICE\|REC.wav` | a new expressive voice preset (recordings need your consent) |
| `/aria-emotion WAV...` | the emotion meter, explained |
| `/aria-preview [EDIT.tsx]` | stills of every scene on one contact sheet, reviewed |
| `/aria-make [EDIT.tsx] [NAME]` | render, share copy, export check, fix (at most 3 versions) |
| `/aria-check VIDEO.mp4` | the export check on any video, with a fit-to-publish verdict |
| `/aria-doctor` | check the environment and say how to fix it |

The command-line tool is lowercase `aria` by design (commands are typed); the product is Aria.

### Uninstall

Delete `~/.claude/skills/aria`, `~/.claude/skills/aria-video`, `~/.claude/skills/aria-voice` and
`~/.claude/commands/aria-*.md`, remove the repo's `bin` folder from your user PATH, and delete the clone.

## Use it by hand

```powershell
aria new my-short --shape 9:16          # edit.tsx, script.json, aria/ SDK bridge, media/, out/
cd my-short
# write script.json (see below), then:
aria voice script.json media/vo         # narration.wav + captions.json (word timings)
aria still edit.tsx 0,90,300            # look at stills
aria make edit.tsx my-short             # render -> share copy -> check  =>  out/my-short.mp4
```

`script.json`:
```json
{
  "voice": "aria-heart",
  "lines": [
    {"say": "[dramatic] Nobody noticed the lamp go out.", "caption": "Nobody noticed the lamp go out.", "pause": 0.6},
    {"say": "[whispering] Except me.", "pause": 0.9},
    {"say": "[chuckle] Okay, that sounded spooky.", "caption": "Okay, that sounded spooky."}
  ]
}
```

| command | does |
|---|---|
| `aria new NAME [--shape 9:16\|16:9\|1:1]` | new project from the template |
| `aria voice SCRIPT.json OUT_DIR [--voice WAV] [--only 3,5] [--asr-cpu]` | expressive narration + word-timed captions |
| `aria voice-preset OUT.wav --kokoro am_adam` | build a new expressive voice preset (or `--sample REC.wav`) |
| `aria say VOICE SPEED OUT.wav "text"` | quick Kokoro draft line |
| `aria meter FILE.wav…` | emotion meter: pitch, spread, range, loudness range |
| `aria still EDIT.tsx 0,90,300` | PNG stills |
| `aria render EDIT.tsx -o OUT.mp4` | GPU render |
| `aria check VIDEO.mp4 [--platform shorts]` | quality check, P0–P3 |
| `aria make EDIT.tsx NAME [--dark]` | render → share copy → check |
| `aria share IN.mp4 OUT.mp4 [--dark]` | H.264/AAC share copy (deblocks dark scenes) |
| `aria doctor` | environment check |

## Voices

| preset | sounds like | good for |
|---|---|---|
| `aria-heart` | warm, bright female | explainers, facts, product |
| `aria-adam` | grounded male | stories, horror, trailers |

Make your own with `aria voice-preset`. Presets are expressive reads on purpose: the narrator copies the *delivery*
of its sample, so a flat sample gives a flat narrator. **Only clone voices you own or have permission to use.**

Emotion tags (put them at the start of a sentence): `[happy] [dramatic] [whispering] [fear] [surprised]
[sarcastic] [angry] [crying]` and sounds `[chuckle] [laugh] [sigh] [gasp] [sniff] [cough]`.

## Repository

```
skills/aria/         umbrella skill: the pipeline
skills/aria-video/   compositions, 3D, music, render, check, delivery (+ sdk.md, 3d.md, music.md)
skills/aria-voice/   narration, tags, presets, hearing check, captions
tools/aria.py        the aria CLI (bin/aria.cmd, bin/aria)
tools/voice/         narrate.py, make_voice.py, meter.py, kokoro_say.py
templates/short/     what `aria new` copies
voices/              aria-heart.wav, aria-adam.wav
examples/showcase/   the showcase film: script.json, edit.tsx, narration
```

## Credits

Voice models: [Chatterbox / Chatterbox Turbo](https://github.com/resemble-ai/chatterbox) (Resemble AI, MIT),
[faster-whisper](https://github.com/SYSTRAN/faster-whisper) (MIT),
[Kokoro](https://github.com/thewh1teagle/kokoro-onnx) (Apache-2.0). Music in code: [Tone.js](https://tonejs.github.io/).
Aria's own code and skills: MIT.
