// aria short. Brief: WHO watches, the ONE thing they should feel/believe, SHAPE, LENGTH.
// 1) write script.json  2) aria voice script.json media/vo  3) edit scenes below  4) aria still / aria make
import { AbsoluteFill, Audio, Composition, Mix, Sequence, interpolate, registerRoot, staticFile, useCurrentFrame } from "./aria";
import * as Tone from "./aria/tone";
import CAPTIONS from "./media/vo/captions.json";

const W = 1080, H = 1920;
const FPS = 30;
type Word = { w: string; s: number; e: number };
type Line = { start: number; end: number; text: string; words: Word[] };
const LINES = (CAPTIONS as unknown as { seconds: number; lines: Line[] }).lines;
const fr = (s: number) => Math.round(s * FPS);
const L = (i: number) => fr(LINES[Math.min(i, LINES.length - 1)].start);
const WORD = (i: number, w: string) => fr((LINES[i].words.find((x) => x.w.toLowerCase().replace(/[^a-z0-9]/g, "").startsWith(w.toLowerCase())) ?? LINES[i].words[0]).s);
const DURATION = fr((CAPTIONS as any).seconds) + 45;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ramp = (f: number, a: number, b: number, x = 0, y = 1) => interpolate(f, [a, b], [x, y], clamp);
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const hash = (n: number) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

const BG = "#0a0812", INK = "#f5f3ff", DIM = "#6e6888", ACCENT = "#fbbf24", A2 = "#8b5cf6";
const HEAD = "Bahnschrift", BODY = "Segoe UI";

/** Drifting light dots: cheap motion so no frame is ever static. */
function Backdrop({ f }: { f: number }) {
  return (
    <>
      {Array.from({ length: 40 }, (_, i) => {
        const x = hash(i) * W, y = ((hash(i + 3) * H - f * (0.4 + hash(i + 5))) % H + H) % H, s = 4 + hash(i + 7) * 10;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: s, height: s, borderRadius: s, backgroundColor: i % 2 ? A2 : ACCENT, opacity: 0.25 }} />;
      })}
    </>
  );
}

/** One scene per narration line: its key word big, revealed on the word. Replace with real scenes. */
function LineCard({ i }: { i: number }) {
  const f = useCurrentFrame() + L(i);
  const ln = LINES[i];
  const key = ln.words.reduce((a, b) => (b.w.length > a.w.length ? b : a), ln.words[0]);
  const at = fr(key.s);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ fontFamily: HEAD, fontSize: W * 0.13, color: INK, textAlign: "center", width: W * 0.86, opacity: ramp(f, at - 4, at + 4),
        transform: `scale(${0.85 + 0.15 * ease((f - at + 4) / 10)})` }}>{key.w.replace(/[.,!?]/g, "")}</div>
    </AbsoluteFill>
  );
}

function Captions({ f }: { f: number }) {
  const i = LINES.findIndex((ln, n) => f >= fr(ln.start) - 2 && f < (n + 1 < LINES.length ? fr(LINES[n + 1].start) - 2 : fr(ln.end) + 20));
  if (i < 0) return null;
  const words = LINES[i].words;
  const cur = words.reduce((n, w, k) => (f >= fr(w.s) ? k : n), -1);
  const tall = H > W;
  return (
    <div style={{ position: "absolute", left: W * 0.08, top: tall ? H * 0.62 : H * 0.8, width: W * 0.84, display: "flex", flexDirection: "row",
      flexWrap: "wrap", justifyContent: "center", gap: 14 }}>
      {words.map((w, k) => (
        <span key={k} style={{ fontFamily: BODY, fontWeight: 700, fontSize: tall ? 64 : 46, color: k === cur ? ACCENT : k < cur ? INK : DIM }}>{w.w}</span>
      ))}
    </div>
  );
}

// ---- score: pad + pulse, ducked under the voice
const BEAT = 60 / 96, BAR = BEAT * 4, SECONDS = DURATION / FPS;
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
Tone.getTransport().bpm.value = 96;
Tone.buses.music.volume.value = -16;
Tone.buses.music.duck(Tone.buses.voice, { amount: -8 });
const room = new Tone.Reverb({ decay: 3, wet: 0.3 }).connect(Tone.buses.music);
const pad = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "fattriangle" }, envelope: { attack: 0.9, decay: 0.4, sustain: 0.8, release: 2 }, volume: -22 }).connect(room);
const kick = new Tone.MembraneSynth({ octaves: 3, pitchDecay: 0.03, envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.1 }, volume: -16 }).connect(Tone.buses.music);
const PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const padEv: [number, number[]][] = [], kickEv: [number, number][] = [];
for (let t = 0, b = 0; t < SECONDS; t += BAR, b++) {
  padEv.push([t, PROG[b % 4].map(hz)]);
  if (b > 0) for (let k = 0; k < 4; k++) kickEv.push([t + k * BEAT, k % 2 ? 0.45 : 0.7]);
}
new Tone.Part((tt, n: number[]) => pad.triggerAttackRelease(n, BAR * 0.98, tt), padEv).start(0);
new Tone.Part((tt, v: number) => kick.triggerAttackRelease(hz(33), 0.2, tt, v), kickEv).start(0);
Tone.buses.music.volume.rampTo(-40, 2, SECONDS - 2.2);
Tone.getTransport().start();

function Film() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <Backdrop f={f} />
      {LINES.map((_, i) => {
        const a = L(i), b = i + 1 < LINES.length ? L(i + 1) : DURATION;
        return <Sequence key={i} from={a} durationInFrames={b - a} name={`line ${i + 1}`}><LineCard i={i} /></Sequence>;
      })}
      <Captions f={f} />
      <Audio name="narration" src={staticFile("vo/narration.wav")} bus="voice" />
      <Mix lufs={-14} ceiling={-1.5} />
    </AbsoluteFill>
  );
}

registerRoot(() => <Composition id="short" component={Film} width={W} height={H} fps={FPS} durationInFrames={DURATION} />);
