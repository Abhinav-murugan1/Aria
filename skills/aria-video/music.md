# aria music and sound

Original scores are written in code with Tone, rendered with the picture, so every hit can land on a word.

```tsx
import * as Tone from "./aria/tone";

const BPM = 100, BEAT = 60 / BPM, BAR = BEAT * 4;
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
Tone.getTransport().bpm.value = BPM;
Tone.buses.music.volume.value = -15;
Tone.buses.music.duck(Tone.buses.voice, { amount: -9 });   // music dips under narration

const room = new Tone.Reverb({ decay: 4, wet: 0.35 }).connect(Tone.buses.music);
const pad = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "fatsawtooth" },
  envelope: { attack: 1.2, decay: 0.5, sustain: 0.8, release: 2.5 }, volume: -24 }).connect(room);
const kick = new Tone.MembraneSynth({ octaves: 4, pitchDecay: 0.04, volume: -12 }).connect(Tone.buses.music);

const PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];       // Am F C G
const padEv = [], kickEv = [];
for (let t = 0, b = 0; t < SECONDS; t += BAR, b++) {
  padEv.push([t, PROG[b % 4].map(hz)]);
  for (let i = 0; i < 4; i++) kickEv.push([t + i * BEAT, i % 2 ? 0.5 : 0.8]);
}
new Tone.Part((tt, n) => pad.triggerAttackRelease(n, BAR * 0.98, tt), padEv).start(0);
new Tone.Part((tt, v) => kick.triggerAttackRelease(hz(33), 0.25, tt, v), kickEv).start(0);
Tone.buses.music.volume.rampTo(-40, 2, SECONDS - 2.5);                       // fade out
Tone.getTransport().start();
```
Then in the film: `<Audio src={staticFile("vo/narration.wav")} bus="voice" />` and `<Mix lufs={-14} ceiling={-1.5} />`.

## Craft
- Build in layers with the story: pad alone under the hook, bass + pulse when the title lands, full groove in the
  middle, strip back for the emotional line, resolve under the end card.
- Hits on words: schedule `Tone.Part` events at `WORD(i, "…") / FPS` seconds: pops for chips, whooshes
  (pink `NoiseSynth` through a bandpass, attack ~0.25 s) ~0.3 s before scene cuts.
- Keep melodies out of the voice's range while it speaks; the duck handles the rest.
- Seed variety (key, tempo, instrument choice) from a project seed for series, so episodes don't sound identical.
- Plain synths (`Synth`, `FMSynth`, `MembraneSynth`, `NoiseSynth`, `PolySynth`) render everywhere. Sampled /
  generated instruments depend on platform extras: prefer synths for portable projects.
- Delivery loudness: -14 LUFS integrated, -1.5 dBTP ceiling (YouTube/Shorts/Reels/TikTok all normalise near it).
