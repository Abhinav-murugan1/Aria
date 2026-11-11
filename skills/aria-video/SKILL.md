---
name: aria-video
description: aria's video generation. Write scenes as React/TypeScript compositions (2D motion graphics, karaoke captions, 3D with lights, materials, Text3D and bloom), cue them on narration words from captions.json, score original music with Tone, mix to -14 LUFS, render on the GPU, check the export (clipped text, safe areas, contrast, loudness, blotching) and encode share copies. Use for making or fixing any aria video, shorts/reels/TikTok 9:16, 16:9 films, explainers, promos, story videos, motion graphics or 3D scenes rendered from code.
---

# aria video

A composition is a React function of the frame number: give it frame N, it draws frame N. aria renders it on the
GPU (2D UI and a 3D world in the same frame), mixes its audio and checks the export.

Read [sdk.md](sdk.md) for the imports, [3d.md](3d.md) before any 3D, [music.md](music.md) before scoring.

## Project layout (from `aria new`)

```
edit.tsx        the film: scenes, captions, score, mix, the <Composition>
script.json     narration lines (aria-voice)
aria/           SDK bridge: import from "./aria", "./aria/3d", "./aria/tone" ...  (don't edit)
media/          everything staticFile() loads: media/vo/narration.wav -> staticFile("vo/narration.wav")
out/            renders, share copies, check reports
stills/         PNGs to look at
```

## The skeleton

```tsx
import { AbsoluteFill, Audio, Composition, Mix, Sequence, interpolate, registerRoot, staticFile, useCurrentFrame } from "./aria";
import CAPTIONS from "./media/vo/captions.json";

const FPS = 30, fr = (s: number) => Math.round(s * FPS);
const LINES = CAPTIONS.lines;
const L = (i: number) => fr(LINES[i].start);                       // frame a line starts
const WORD = (i: number, w: string) => fr(LINES[i].words.find((x) => x.w.toLowerCase().startsWith(w))!.s);
const DURATION = fr(CAPTIONS.seconds) + 45;                        // tail for the end card
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function Hook() {
  const f = useCurrentFrame() + L(0);   // inside a <Sequence>, frames restart at 0: add the scene's start back
  return <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
    <div style={{ fontSize: 120, opacity: interpolate(f, [WORD(0, "nobody"), WORD(0, "nobody") + 8], [0, 1], clamp) }}>Nobody</div>
  </AbsoluteFill>;
}

function Film() {
  return <AbsoluteFill style={{ backgroundColor: "#07060d" }}>
    <Sequence from={0} durationInFrames={L(2)} name="hook"><Hook /></Sequence>
    <Audio src={staticFile("vo/narration.wav")} bus="voice" />
    <Mix lufs={-14} ceiling={-1.5} />
  </AbsoluteFill>;
}
registerRoot(() => <Composition id="film" component={Film} width={1080} height={1920} fps={FPS} durationInFrames={DURATION} />);
```

## Rules (every file)

1. **Frame-pure.** Motion reads `useCurrentFrame()` only. `useState`/`useEffect`/timers do nothing in a render.
2. **Clamp every `interpolate`** unless you want it to run past its ends.
3. **Cue on words, cut on lines.** Scene boundaries = line starts; reveals = `WORD(i, "…")`. Never hard-code frames
   that depend on speech: re-voicing a line would desync the film.
4. **Seed randomness** from an index (`hash(i)`), never `Math.random()` for things that should hold still.
5. Inside `<Sequence from={a}>` the frame restarts at 0: add `a` back if your cues are absolute.
6. **Captions:** karaoke from `captions.json` words, high contrast, inside safe areas (9:16: keep text out of the
   bottom ~20% and right ~12% where platform UI sits; 16:9: bottom ~10%). Max ~8 words a phrase on 9:16.
7. **Hook in two seconds.** Motion on frame 0, the promise said and shown by ~2 s.
8. One idea per scene; something changes on screen every 2–4 s; reveal on the word that names it.
9. Fonts: system fonts by family name work (`Bahnschrift`, `Segoe UI`, `Consolas`, `Ink Free` on Windows).
10. Styling: inline `style` with flexbox, absolute positioning, borders, radius, transforms, opacity, gradients.

## Look, render, check

```powershell
aria still edit.tsx 0,150,600,900          # PNGs in stills/: look at every one
aria make edit.tsx promo                   # out/promo-raw.mp4 -> out/promo.mp4 (share) -> out/promo.check.json
aria make edit.tsx promo-v2 --dark         # dark films: deblocked, crf 17
aria check out/promo.mp4 --platform shorts # re-check against a platform's UI zones
```
- Render each version to a new name (`-v2`, `-v3`); never overwrite a version someone watched.
- The check grades P0–P3. P0/P1 fail `aria make`. Read every finding; fix the cause, not the symptom.
- Read stills of the busiest frames (most text, most 3D) before a full render. A 60 s 2D film renders in about
  a minute; a detailed 3D scene can take 140–430 ms a frame (minutes): check stills first.

## Hard-won lessons

- **Dark scenes block up** in the raw GPU encode (H.264 Baseline). `--dark` on make/share applies
  `deblock=filter=strong:block=8,gradfun` + x264 crf 17. Adding grain bloats files (500 MB+): don't.
  Highest quality: render PNG frames (`aria render edit.tsx -o frames/`) and encode with x264 crf 14 aq-mode=3,
  muxing the raw render's audio.
- The raw render is H.264 Baseline + Opus: some players and uploaders choke. Always hand over the share copy
  (`aria share`, H.264 High + AAC + faststart).
- Loudness: measure with `ffmpeg -af ebur128` on the share copy; Opus sources can trip other meters.
- A `PointLight` made inside one shot can leak its colour into the first light of the next shot: give shot-only
  lights the same colour or remove them between shots.
- An old render manifest makes the check report old texts: re-render with `--manifest` or check stills by eye.
- Text3D is centred on its transform (x = 0 centres it); verify with a still.

## Delivery

- Shapes: 9:16 1080×1920 (Shorts/Reels/TikTok, ≤ 60 s for Shorts), 16:9 1920×1080, 1:1 1080×1080. One composition
  per shape; re-lay out, don't crop.
- File names: lowercase, digits, hyphens (`launch-teaser-9x16.mp4`).
- Publishing (YouTube etc.) is the user's call: confirm every upload, upload private first, mark AI narration as
  synthetic media, and keep hashtags under 15 (`#shorts` first on Shorts).
