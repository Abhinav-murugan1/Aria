// aria showcase: a 16:9 film made end to end with the aria skill.
// Narration: aria voice (Chatterbox Turbo, aria-heart preset, emotion tags), checked by speech recognition, word-timed.
// Picture: 3D (Text3D, emissive blocks, bloom), motion graphics and karaoke captions, all cued on the narration's words.
// Sound: an original Tone score ducked under the voice, mixed to -14 LUFS.
import { AbsoluteFill, Audio, Composition, Mix, Sequence, interpolate, registerRoot, staticFile, useCurrentFrame } from "./aria";
import * as Tone from "./aria/tone";
import { Bloom, Text3D } from "./aria/3d";
import { Camera3d } from "./aria/camera";
import { StandardMaterial } from "./aria/pbr";
import { Cuboid, Mesh3d } from "./aria/mesh";
import { Quat, Transform } from "./aria/transform";
import { AmbientLight, DirectionalLight, PointLight } from "./aria/light";
import { LinearRgba, Srgba } from "./aria/color";
import CAPTIONS from "./media/vo/captions.json";
import METER from "./media/meter.json";

const W = 1920, H = 1080, FPS = 30;
const REPO = "github.com/abhinavmurugan/aria";
type Word = { w: string; s: number; e: number };
type Line = { start: number; end: number; text: string; words: Word[] };
const LINES = (CAPTIONS as unknown as { seconds: number; lines: Line[] }).lines;
const fr = (sec: number) => Math.round(sec * FPS);
const L = (i: number) => fr(LINES[i].start);
const LE = (i: number) => fr(LINES[i].end);
const WORD = (i: number, w: string) => {
  const hit = LINES[i].words.find((x) => x.w.toLowerCase().replace(/[^a-z0-9]/g, "").startsWith(w.toLowerCase()));
  return fr((hit ?? LINES[i].words[0]).s);
};
const DURATION = fr((CAPTIONS as any).seconds) + 75;

// scenes, cut on the lines
const S = {
  open: 0, title: L(1), voice: L(3), check: L(8), code: L(10), pipe: L(11), end: L(12), done: DURATION,
};

// ---- look
const BG = "#07060d", INK = "#f5f3ff", DIM = "#8b86a3", VIOLET = "#8b5cf6", CYAN = "#22d3ee", PINK = "#f472b6", AMBER = "#fbbf24";
const HEAD = "Bahnschrift", BODY = "Segoe UI", MONO = "Consolas";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ramp = (f: number, a: number, b: number, x = 0, y = 1) => interpolate(f, [a, b], [x, y], clamp);
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const back = (t: number) => { const c = 1.70158, x = Math.min(1, Math.max(0, t)) - 1; return 1 + (c + 1) * x * x * x + c * x * x; };
const pop = (f: number, at: number, len = 10) => back((f - at) / len);
const glow = (hex: string, k: number) => LinearRgba.from(Srgba.hex(hex)).mul(k);
const hash = (n: number) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
const T = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => Transform.fromXyz(x, y, z).withRotation(Quat.fromEuler("XYZ", rx, ry, rz));

// ---- 3D: a field of glowing blocks and the word itself
function Blocks({ f, rise, n = 70 }: { f: number; rise: number; n?: number }) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = (hash(i) - 0.5) * 22, z = -2 - hash(i + 9) * 16, sp = 0.25 + hash(i + 3) * 0.6;
    const y = -4 + (((f / FPS) * sp * 0.6 + hash(i + 5) * 10) % 10) * rise;
    const s = 0.08 + hash(i + 7) * 0.22, c = [VIOLET, CYAN, PINK][i % 3];
    out.push(
      <Mesh3d key={i} transform={T(x, y, z, f * 0.01 * sp, f * 0.013 * sp, 0)}>
        <Cuboid half_size={[s, s, s]} />
        <StandardMaterial base_color={c} emissive={glow(c, 2 + 3 * hash(i + 11))} />
      </Mesh3d>,
    );
  }
  return <>{out}</>;
}

function Floor({ f }: { f: number }) {
  const out = [];
  for (let i = -9; i <= 9; i++) {
    for (let j = 0; j < 8; j++) {
      const k = (i + 9) * 8 + j, wave = 0.5 + 0.5 * Math.sin(f * 0.06 - j * 0.7 + i * 0.3);
      out.push(
        <Mesh3d key={k} transform={T(i * 1.1, -2.2 + wave * 0.18, -j * 1.1 - 1)}>
          <Cuboid half_size={[0.5, 0.06, 0.5]} />
          <StandardMaterial base_color="#120f22" perceptual_roughness={0.4} emissive={glow(j % 2 ? VIOLET : CYAN, 0.05 + 0.45 * wave * wave)} />
        </Mesh3d>,
      );
    }
  }
  return <>{out}</>;
}

function Word3D({ f, at }: { f: number; at: number }) {
  const t = ease((f - at) / 24);
  if (t <= 0) return null;
  const s = 2.1 * back((f - at) / 20);
  return (
    <Mesh3d transform={T(0, 0.9 + (1 - t) * -1.5, 0, 0, Math.sin(f * 0.02) * 0.12, 0).withScale([s, s, s])}>
      <Text3D size={1} depth={0.25}>aria</Text3D>
      <StandardMaterial base_color="#ffffff" metallic={0.2} perceptual_roughness={0.25} emissive={glow(VIOLET, 1.2 + 1.2 * (0.5 + 0.5 * Math.sin(f * 0.08)))} />
    </Mesh3d>
  );
}

function Spinner({ f, x }: { f: number; x: number }) {
  return (
    <>
      <Mesh3d transform={T(x, 0.2, -1, f * 0.021, f * 0.033, f * 0.012)}>
        <Cuboid half_size={[0.9, 0.9, 0.9]} />
        <StandardMaterial base_color="#1b1530" metallic={0.6} perceptual_roughness={0.2} emissive={glow(CYAN, 0.6)} />
      </Mesh3d>
      {[0, 1, 2, 3, 4, 5].map((k) => {
        const a = f * 0.03 + (k * Math.PI) / 3;
        return (
          <Mesh3d key={k} transform={T(x + Math.cos(a) * 1.9, 0.2 + Math.sin(a * 2) * 0.4, -1 + Math.sin(a) * 1.9, a, a, 0)}>
            <Cuboid half_size={[0.16, 0.16, 0.16]} />
            <StandardMaterial base_color={[PINK, AMBER, VIOLET][k % 3]} emissive={glow([PINK, AMBER, VIOLET][k % 3], 4)} />
          </Mesh3d>
        );
      })}
    </>
  );
}

function Stage({ f, children, eye, look = [0, 0, 0], bloom = 0.5 }: { f: number; children: any; eye: [number, number, number]; look?: [number, number, number]; bloom?: number }) {
  return (
    <>
      <Camera3d transform={Transform.fromXyz(eye[0], eye[1], eye[2]).lookingAt(look)} projection={{ Perspective: { fov: (48 * Math.PI) / 180 } }} />
      <Bloom intensity={bloom} threshold={0.9} />
      <AmbientLight brightness={260} color="#8f86ff" />
      <DirectionalLight transform={Transform.fromXyz(4, 8, 10).lookingAt([0, 0, 0])} illuminance={2400} color="#ffffff" />
      <PointLight transform={Transform.fromXyz(0, 2.5, 3)} intensity={60000} color={VIOLET} range={12} />
      {children}
    </>
  );
}

// ---- 2D pieces
function Chip({ text, color, f, at, size = 34 }: { text: string; color: string; f: number; at: number; size?: number }) {
  const k = pop(f, at);
  return (
    <div style={{ padding: "10px 26px", borderRadius: 999, border: `3px solid ${color}`, color, fontFamily: MONO, fontSize: size,
      opacity: ramp(f, at, at + 6), transform: `scale(${Math.max(0, k)})`, backgroundColor: "#0d0b1acc" }}>{text}</div>
  );
}

function Captions({ f, hide }: { f: number; hide?: (i: number) => boolean }) {
  const i = LINES.findIndex((ln, n) => f >= fr(ln.start) - 2 && f < (n + 1 < LINES.length ? fr(LINES[n + 1].start) - 2 : fr(ln.end) + 20));
  if (i < 0 || (hide && hide(i))) return null;
  const words = LINES[i].words;
  const cur = words.reduce((n, w, k) => (f >= fr(w.s) ? k : n), -1);
  return (
    <div style={{ position: "absolute", left: 160, top: 930, width: 1600, display: "flex", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 14 }}>
      {words.map((w, k) => (
        <span key={k} style={{ fontFamily: BODY, fontWeight: 700, fontSize: 46, color: k === cur ? AMBER : k < cur ? INK : "#6e6888",
          transform: `scale(${k === cur ? 1 + 0.08 * (1 - ramp(f, fr(w.s), fr(w.s) + 6)) : 1})` }}>{w.w}</span>
      ))}
    </div>
  );
}

// ---- scenes
function Open() {
  const f = useCurrentFrame();
  const z = 9 - ramp(f, 0, S.title, 0, 2.5);
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <Stage f={f} eye={[Math.sin(f * 0.004) * 1.5, 1.2, z]} look={[0, 0.3, -4]} bloom={0.6}>
        <Floor f={f} />
        <Blocks f={f} rise={1} />
      </Stage>
      <div style={{ position: "absolute", left: 0, top: 380, width: W, textAlign: "center", fontFamily: HEAD, fontSize: 92, color: INK,
        opacity: ramp(f, WORD(0, "whole") - 4, WORD(0, "whole") + 8) * (1 - ramp(f, S.title - 10, S.title)) }}>
        the <span style={{ color: CYAN }}>whole</span> video?
      </div>
    </AbsoluteFill>
  );
}

function Title() {
  const f = useCurrentFrame() + S.title;
  const parts: [string, string, string][] = [["script", "writes", VIOLET], ["voice", "voice", PINK], ["music", "music", AMBER], ["GPU render", "renders", CYAN]];
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <Stage f={f} eye={[Math.sin(f * 0.01) * 2.2, 1.0, 7.5]} look={[0, 0.4, 0]} bloom={0.55}>
        <Floor f={f} />
        <Blocks f={f} rise={1} />
        <Word3D f={f} at={WORD(1, "aria") - 6} />
      </Stage>
      <div style={{ position: "absolute", left: 0, top: 120, width: W, textAlign: "center", fontFamily: BODY, fontSize: 34, letterSpacing: 8, color: DIM,
        opacity: ramp(f, WORD(1, "aria"), WORD(1, "aria") + 12) }}>A CLAUDE CODE SKILL FOR VIDEO + VOICE</div>
      <div style={{ position: "absolute", left: 0, top: 740, width: W, display: "flex", flexDirection: "row", justifyContent: "center", gap: 28 }}>
        {parts.map(([label, cue, c]) => <Chip key={label} text={label} color={c} f={f} at={WORD(2, cue)} size={38} />)}
      </div>
    </AbsoluteFill>
  );
}

const EMO: { tag: string; name: string; color: string; line: number; key: string }[] = [
  { tag: "[whispering]", name: "whisper", color: "#7dd3fc", line: 4, key: "line05" },
  { tag: "[happy]", name: "excited", color: AMBER, line: 5, key: "line06" },
  { tag: "[dramatic]", name: "dramatic", color: "#fb7185", line: 6, key: "line07" },
  { tag: "[chuckle]", name: "laughs", color: "#c4b5fd", line: 7, key: "line08" },
];

function Wave({ f, line, color }: { f: number; line: number; color: string }) {
  const ln = LINES[line];
  const talking = ln.words.some((w) => f >= fr(w.s) - 1 && f <= fr(w.e) + 1);
  const live = f >= L(line) && f <= LE(line) + 3;
  return (
    <div style={{ position: "relative", width: 700, height: 110 }}>
      {Array.from({ length: 44 }, (_, k) => {
        const env = Math.sin((Math.PI * (k + 1)) / 45);
        const h = live ? (talking ? 10 + 96 * env * (0.35 + 0.65 * Math.abs(Math.sin(f * 0.45 + k * 0.9)) * hash(k + Math.floor(f / 2) * 3.1)) : 10) : 6;
        return <div key={k} style={{ position: "absolute", left: k * 16, top: (110 - h) / 2, width: 9, height: h, borderRadius: 5, backgroundColor: color, opacity: live ? 1 : 0.35 }} />;
      })}
    </div>
  );
}

function Voice() {
  const f = useCurrentFrame() + S.voice;
  const head = ramp(f, S.voice, S.voice + 10);
  const meter = METER as unknown as Record<string, { median_hz: number; range: number }>;
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <Stage f={f} eye={[0, 1.4, 10]} look={[0, 0, -4]} bloom={0.4}><Blocks f={f} rise={0.6} /></Stage>
      <div style={{ position: "absolute", left: 0, top: 70, width: W, textAlign: "center", fontFamily: HEAD, fontSize: 76, color: INK, opacity: head,
        transform: `translateY(${(1 - ease((f - S.voice) / 14)) * 30}px)` }}>
        aria <span style={{ color: PINK }}>voice</span> <span style={{ color: DIM, fontSize: 44 }}>· emotion you can type</span>
      </div>
      <div style={{ position: "absolute", left: 130, top: 210, width: 1660, display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 40 }}>
        {EMO.map((e) => {
          const at = L(e.line) - 8;
          const on = f >= L(e.line) && f <= LE(e.line) + 6;
          const m = meter[e.key];
          return (
            <div key={e.tag} style={{ width: 700, height: 250, borderRadius: 28, padding: 34, backgroundColor: on ? "#171230" : "#0f0c1f",
              border: `3px solid ${on ? e.color : "#2a2445"}`, opacity: ramp(f, at, at + 8, 0, 1) * (f < at ? 0 : 1), transform: `scale(${0.6 + 0.4 * Math.max(0, pop(f, at, 12))})`,
              display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: MONO, fontSize: 40, color: e.color }}>{e.tag}</span>
                <span style={{ fontFamily: BODY, fontSize: 28, color: DIM }}>{m ? `${Math.round(m.median_hz)} Hz · range ${m.range.toFixed(1)} st` : ""}</span>
              </div>
              <Wave f={f} line={e.line} color={e.color} />
              <span style={{ fontFamily: BODY, fontSize: 32, color: on ? INK : DIM }}>{LINES[e.line].text}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function Check() {
  const f = useCurrentFrame() + S.check;
  const want = "a single word slips".split(" ");
  const bad = ["a", "single", "world", "slips"];
  const retry = WORD(8, "aria");
  const k1 = L(9);
  const big = LINES[9].words;
  const cur = big.reduce((n, w, k) => (f >= fr(w.s) ? k : n), -1);
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <div style={{ position: "absolute", left: 0, top: 70, width: W, textAlign: "center", fontFamily: HEAD, fontSize: 70, color: INK, opacity: ramp(f, S.check, S.check + 10) }}>
        heard back, <span style={{ color: CYAN }}>word by word</span>
      </div>
      <div style={{ position: "absolute", left: 260, top: 230, width: 1400, height: 400, borderRadius: 24, backgroundColor: "#0f0c1f", border: "2px solid #2a2445",
        padding: 40, fontFamily: MONO, fontSize: 40, color: INK, display: "flex", flexDirection: "column", gap: 22, opacity: 1 - ramp(f, k1 - 8, k1) }}>
        <div><span style={{ color: DIM }}>want   </span>{want.join(" ")}</div>
        <div style={{ opacity: ramp(f, WORD(8, "word") - 4, WORD(8, "word") + 2) }}>
          <span style={{ color: DIM }}>try 1  </span>
          {bad.map((w, i) => <span key={i} style={{ color: w === "world" ? "#fb7185" : INK, textDecoration: w === "world" ? "line-through" : "none" }}>{w} </span>)}
          <span style={{ color: "#fb7185" }}>  × retry</span>
        </div>
        <div style={{ opacity: ramp(f, retry - 2, retry + 6) }}>
          <span style={{ color: DIM }}>try 2  </span>{want.join(" ")}<span style={{ color: "#4ade80" }}>  ✓ heard</span>
        </div>
        <div style={{ fontFamily: BODY, fontSize: 28, color: DIM, opacity: ramp(f, retry + 10, retry + 20) }}>speech recognition: faster-whisper · up to 8 takes per line</div>
      </div>
      <div style={{ position: "absolute", left: 160, top: 360, width: 1600, display: "flex", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 22,
        opacity: ramp(f, k1 - 4, k1 + 4) }}>
        {big.map((w, k) => (
          <span key={k} style={{ fontFamily: HEAD, fontSize: 96, color: k === cur ? AMBER : k < cur ? INK : "#3a3456",
            transform: `translateY(${k === cur ? -10 * (1 - ramp(f, fr(w.s), fr(w.s) + 6)) : 0}px)` }}>{w.w}</span>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, top: 640, width: W, textAlign: "center", fontFamily: MONO, fontSize: 30, color: DIM, opacity: ramp(f, k1 + 10, k1 + 20) }}>
        {cur >= 0 ? `"${big[cur].w}"  ${big[cur].s.toFixed(2)}s → ${big[cur].e.toFixed(2)}s` : ""}
      </div>
    </AbsoluteFill>
  );
}

const CODE = [
  `import { Composition, registerRoot } from "./aria";`,
  `import CAPTIONS from "./media/vo/captions.json";`,
  ``,
  `function Scene() {`,
  `  const f = useCurrentFrame();`,
  `  return <Stage><Mesh3d><Cuboid /></Mesh3d>`,
  `    <Captions at={word("exact")} /></Stage>;`,
  `}`,
  ``,
  `registerRoot(() => <Composition id="film"`,
  `  width={1920} height={1080} fps={30} />);`,
];

function Code() {
  const f = useCurrentFrame() + S.code;
  const chars = Math.floor((f - S.code) * 4.2);
  let left = chars;
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <Stage f={f} eye={[0, 0.6, 7]} look={[0, 0.2, 0]} bloom={0.6}>
        <Spinner f={f} x={2.6} />
        <Blocks f={f} rise={0.5} />
      </Stage>
      <div style={{ position: "absolute", left: 90, top: 150, width: 980, height: 640, borderRadius: 22, backgroundColor: "#0d0b1a", border: "2px solid #2a2445",
        padding: 34, display: "flex", flexDirection: "column", gap: 6, transform: `translateX(${(1 - ease((f - S.code) / 14)) * -80}px)`, opacity: ramp(f, S.code, S.code + 8) }}>
        <div style={{ fontFamily: MONO, fontSize: 24, color: DIM, marginBottom: 14 }}>edit.tsx</div>
        {CODE.map((ln, i) => {
          const shown = ln.slice(0, Math.max(0, left)).replace(/^ +/, (sp) => " ".repeat(sp.length));
          left -= ln.length + 1;
          return <div key={i} style={{ fontFamily: MONO, fontSize: 28, color: ln.startsWith("import") ? "#c4b5fd" : ln.includes("<") ? CYAN : INK, height: 38 }}>{shown}</div>;
        })}
      </div>
      <div style={{ position: "absolute", left: 1180, top: 760, width: 640, display: "flex", flexDirection: "row", gap: 20, justifyContent: "center" }}>
        <Chip text="3D" color={CYAN} f={f} at={WORD(10, "three")} />
        <Chip text="motion" color={PINK} f={f} at={WORD(10, "motion")} />
        <Chip text="music" color={AMBER} f={f} at={WORD(10, "music")} />
      </div>
    </AbsoluteFill>
  );
}

function Pipe() {
  const f = useCurrentFrame() + S.pipe;
  const nodes: [string, string][] = [["script", "script"], ["voice", "voice"], ["captions", "voice"], ["render", "render"], ["check", "checked"], ["share", "share"]];
  const cmd = "aria make edit.tsx showcase";
  const typed = cmd.slice(0, Math.max(0, Math.floor((f - S.pipe) * 1.6)));
  const out = [
    ["voice   14 lines, every one heard back", WORD(11, "voice")],
    [`render  ${DURATION} frames · 1920×1080 · GPU`, WORD(11, "render")],
    ["check   no P0 / P1 findings", WORD(11, "checked")],
    ["share   out/showcase.mp4 ✓", WORD(11, "share")],
  ] as [string, number][];
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <Stage f={f} eye={[0, 1.4, 10]} look={[0, 0, -4]} bloom={0.4}><Blocks f={f} rise={0.6} /></Stage>
      <div style={{ position: "absolute", left: 120, top: 120, width: 1680, display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        {nodes.map(([n, cue], i) => {
          const lit = f >= WORD(11, cue);
          return (
            <div key={n} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 14 }}>
              <div style={{ padding: "18px 30px", borderRadius: 18, fontFamily: HEAD, fontSize: 36, color: lit ? BG : DIM, backgroundColor: lit ? [VIOLET, PINK, PINK, CYAN, "#4ade80", AMBER][i] : "#151129",
                transform: `scale(${lit ? 1 + 0.12 * (1 - ramp(f, WORD(11, cue), WORD(11, cue) + 8)) : 1})` }}>{n}</div>
              {i < nodes.length - 1 ? <div style={{ width: 60, height: 4, backgroundColor: lit ? INK : "#2a2445" }} /> : null}
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 300, top: 320, width: 1320, height: 440, borderRadius: 22, backgroundColor: "#0b0916", border: "2px solid #2a2445", padding: 40,
        display: "flex", flexDirection: "column", gap: 18, fontFamily: MONO, fontSize: 34, color: INK }}>
        <div><span style={{ color: "#4ade80" }}>&gt; </span>{typed}<span style={{ opacity: Math.floor(f / 8) % 2 }}>▍</span></div>
        {out.map(([t, at]) => <div key={t} style={{ color: t.includes("✓") ? "#4ade80" : DIM, opacity: ramp(f, at, at + 5) }}>{t}</div>)}
      </div>
    </AbsoluteFill>
  );
}

function End() {
  const f = useCurrentFrame() + S.end;
  const shot = WORD(13, "github") - 10;
  const zoom = 0.9 + 0.1 * ease((f - shot) / 30);
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <Stage f={f} eye={[Math.sin(f * 0.01) * 1.5, 1.0, 9]} look={[0, 0.4, 0]} bloom={0.55}>
        <Floor f={f} />
        <Blocks f={f} rise={1} n={26} />
      </Stage>
      <div style={{ position: "absolute", left: 0, top: 300, width: W, textAlign: "center", opacity: ramp(f, S.end, S.end + 10) * (1 - ramp(f, shot - 6, shot + 4)),
        transform: `scale(${0.9 + 0.1 * ease((f - S.end) / 16)})` }}>
        <div style={{ fontFamily: BODY, fontSize: 44, color: DIM, letterSpacing: 6 }}>EVERYTHING YOU SAW AND HEARD WAS</div>
        <div style={{ fontFamily: HEAD, fontSize: 150, color: INK, marginTop: 10 }}>made with <span style={{ color: VIOLET }}>aria</span></div>
        <div style={{ fontFamily: MONO, fontSize: 36, color: CYAN, marginTop: 24 }}>voice · captions · 3D · music · render · check</div>
      </div>
      <div style={{ position: "absolute", left: 260, top: 70, width: 1400, height: 820, borderRadius: 20, backgroundColor: "#ffffff", opacity: ramp(f, shot, shot + 10),
        transform: `scale(${zoom}) translateY(${(1 - ease((f - shot) / 20)) * 60}px)`, display: "flex", flexDirection: "column", overflow: "hidden", border: "2px solid #3a3456" }}>
        <div style={{ height: 60, backgroundColor: "#1f1b2e", display: "flex", flexDirection: "row", alignItems: "center", paddingLeft: 24, gap: 12 }}>
          <div style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: "#fb7185" }} />
          <div style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: AMBER }} />
          <div style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: "#4ade80" }} />
          <div style={{ marginLeft: 24, padding: "6px 22px", borderRadius: 10, backgroundColor: "#0d0b1a", fontFamily: MONO, fontSize: 24, color: INK }}>{`https://${REPO}`}</div>
        </div>
        <img src={staticFile("github.png")} style={{ width: 1400, height: 760, objectFit: "cover", objectPosition: "top" }} />
      </div>
      <div style={{ position: "absolute", left: 0, top: 905, width: W, textAlign: "center", fontFamily: HEAD, fontSize: 52, color: INK, opacity: ramp(f, shot + 30, shot + 42) }}>
        <span style={{ color: VIOLET }}>{REPO}</span>
      </div>
    </AbsoluteFill>
  );
}

// ---- the score: an original Tone piece in A minor, building as the film opens up, ducked under the voice
const BPM = 100, BEAT = 60 / BPM, BAR = BEAT * 4;
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
const sec = (frame: number) => frame / FPS;
Tone.getTransport().bpm.value = BPM;
Tone.buses.music.volume.value = -15;
Tone.buses.music.duck(Tone.buses.voice, { amount: -9 });
const room = new Tone.Reverb({ decay: 4, wet: 0.35 }).connect(Tone.buses.music);
const soft = new Tone.Filter({ type: "lowpass", frequency: 2400, rolloff: -24 }).connect(room);
const pad = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "fatsawtooth" }, envelope: { attack: 1.2, decay: 0.5, sustain: 0.8, release: 2.5 }, volume: -24 }).connect(soft);
const pluck = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.003, decay: 0.25, sustain: 0, release: 0.3 }, volume: -18 }).connect(room);
const bass = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.02, decay: 0.3, sustain: 0.7, release: 0.4 }, volume: -12 }).connect(Tone.buses.music);
const kick = new Tone.MembraneSynth({ octaves: 4, pitchDecay: 0.04, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 }, volume: -12 }).connect(Tone.buses.music);
const hatF = new Tone.Filter({ type: "highpass", frequency: 8000 }).connect(Tone.buses.music);
const hat = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.04, sustain: 0 }, volume: -30 }).connect(hatF);
const swF = new Tone.Filter({ type: "bandpass", frequency: 1200, Q: 0.8 }).connect(Tone.buses.sfx);
const whoosh = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.25, decay: 0.35, sustain: 0 }, volume: -20 }).connect(swF);
const ping = new Tone.MembraneSynth({ octaves: 2, pitchDecay: 0.02, envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 }, volume: -20 }).connect(Tone.buses.sfx);

const end = sec(DURATION);
const groove = sec(S.title) - 0.25;
const padEv: [number, number[]][] = [], bassEv: [number, number][] = [], arpEv: [number, number][] = [], kickEv: [number, number][] = [], hatEv: [number, number][] = [];
for (let t = 0, b = 0; t < end - 1; t += BAR, b++) {
  const ch = PROG[b % 4];
  padEv.push([t, ch.map(hz)]);
  if (t >= groove) {
    bassEv.push([t, hz(ch[0] - 24)], [t + BEAT * 2.5, hz(ch[0] - 24)]);
    for (let i = 0; i < 8; i++) arpEv.push([t + i * BEAT / 2, hz(ch[i % 3] + 12 + (i >= 4 ? 12 : 0))]);
    for (let i = 0; i < 4; i++) kickEv.push([t + i * BEAT, i % 2 ? 0.5 : 0.8]);
    for (let i = 0; i < 8; i++) hatEv.push([t + i * BEAT / 2, i % 2 ? 0.5 : 0.25]);
  }
}
new Tone.Part((tt, n: number[]) => pad.triggerAttackRelease(n, BAR * 0.98, tt), padEv).start(0);
new Tone.Part((tt, n: number) => bass.triggerAttackRelease(n, BEAT * 1.4, tt), bassEv).start(0);
new Tone.Part((tt, n: number) => pluck.triggerAttackRelease(n, 0.2, tt, 0.5), arpEv).start(0);
new Tone.Part((tt, v: number) => kick.triggerAttackRelease(hz(33), 0.25, tt, v), kickEv).start(0);
new Tone.Part((tt, v: number) => hat.triggerAttackRelease(0.03, tt, v), hatEv).start(0);
new Tone.Part((tt) => whoosh.triggerAttackRelease(0.5, tt), [S.title, S.voice, S.check, S.code, S.pipe, S.end].map((x) => [sec(x) - 0.3, 0] as [number, number])).start(0);
new Tone.Part((tt) => ping.triggerAttackRelease(hz(72), 0.1, tt, 0.6), [WORD(2, "writes"), WORD(2, "voice"), WORD(2, "music"), WORD(2, "renders"), L(4) - 8, L(5) - 8, L(6) - 8, L(7) - 8].map((x) => [sec(x), 0] as [number, number])).start(0);
Tone.buses.music.volume.rampTo(-40, 2.2, end - 2.4);
Tone.getTransport().start();

function Film() {
  const f = useCurrentFrame();
  const span = (a: number, b: number, el: any, name: string) => <Sequence from={a} durationInFrames={b - a} name={name}>{el}</Sequence>;
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {span(S.open, S.title, <Open />, "open")}
      {span(S.title, S.voice, <Title />, "title")}
      {span(S.voice, S.check, <Voice />, "voice")}
      {span(S.check, S.code, <Check />, "check")}
      {span(S.code, S.pipe, <Code />, "code")}
      {span(S.pipe, S.end, <Pipe />, "pipeline")}
      {span(S.end, S.done, <End />, "end")}
      <Captions f={f} hide={(i) => (i >= 4 && i <= 7) || i === 9 || i >= 12} />
      <Audio name="narration" src={staticFile("vo/narration.wav")} bus="voice" gainDb={0} />
      <Mix lufs={-14} ceiling={-1.5} />
    </AbsoluteFill>
  );
}

registerRoot(() => <Composition id="aria-showcase" component={Film} width={W} height={H} fps={FPS} durationInFrames={DURATION} />);
