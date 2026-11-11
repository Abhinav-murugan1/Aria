// Aria teaser: "The Night Studio". One photoreal studio, a station per capability, every claim shown as it is spoken.
// Narration: aria voice (aria-heart preset), every take heard back; captions and cues from captions.json.
// Picture: one camera moving through the stations, whip-pans between them, real glass, fire, fog and sunlight.
// Sound: an original Tone score in D minor (120 BPM), ducked under the voice, mixed to -14 LUFS.
import { AbsoluteFill, Audio, Composition, Mix, Sequence, interpolate, registerRoot, staticFile, useCurrentFrame } from "./aria";
import * as Tone from "./aria/tone";
import { Text3D } from "./aria/3d";
import { Camera3d } from "./aria/camera";
import { AmbientLight, Atmosphere, DirectionalLight, PointLight, RectLight, Shadows, SpotLight } from "./aria/light";
import { AmbientOcclusion, Fire, FogVolume, StandardMaterial, VolumetricFog } from "./aria/pbr";
import { Capsule3d, Cuboid, Cylinder, Mesh3d, Sphere, Torus } from "./aria/mesh";
import { Bloom, DepthOfField, Grade, MotionBlur, ToneMapping } from "./aria/post_process";
import { ImagePlane } from "./aria/image";
import { Quat, Transform } from "./aria/transform";
import { LinearRgba, Srgba } from "./aria/color";
import CAPTIONS from "./media/vo/captions.json";
import METER from "./media/meter.json";
import ENV from "./media/env.json";
import SCRIPT from "./script.json";

// ---- constants to update
const REPO = "github.com/Abhinav-murugan1/Aria";
const SCREENSHOT = "github-shot.png"; // media/github-shot.png, shown on the S12 monitor
// S10: the export check's items, ticked on the words; confirm against out/teaser.check.json
const CHECKS: { item: string; ok: boolean }[] = [
  { item: "clipped text", ok: true },
  { item: "safe areas", ok: true },
  { item: "contrast", ok: true },
  { item: "loudness", ok: true },
  { item: "blotching", ok: true },
];
// S11: the plain-words request typed into the terminal, and this machine's GPU (read with nvidia-smi)
const REQUEST = "/aria-short why we procrastinate";
const GPU = "NVIDIA GeForce RTX 4070 Laptop GPU";

const W = 1920, H = 1080, FPS = 30;
type Word = { w: string; s: number; e: number };
type Try = { heard: string; ok: boolean };
type Line = { file: string; start: number; end: number; text: string; ok: boolean; heard: string; tries: Try[]; words: Word[] };
const CAP = CAPTIONS as unknown as { seconds: number; lines: Line[] };
const LINES = CAP.lines;
const fr = (sec: number) => Math.round(sec * FPS);
const L = (i: number) => fr(LINES[i].start);
const LE = (i: number) => fr(LINES[i].end);
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const WORDT = (i: number, w: string) => (LINES[i].words.find((x) => key(x.w).startsWith(key(w))) ?? LINES[i].words[0]).s;
const WORD = (i: number, w: string) => fr(WORDT(i, w));
const DURATION = fr(CAP.seconds) + 30;
const ENVD = ENV as unknown as { rms: number[]; db: number[]; peak: number };
const METERD = METER as unknown as Record<string, { median_hz: number; range: number; loudness_range: number }>;

// ---- look
const CHAR = "#0B0D10", TUNG = "#FFB070", TEAL = "#4FD8E8", CORAL = "#FF4D6D", INK = "#F2F4F7", DIM = "#9AA3AD", GREEN = "#5BE49B";
const HEAD = "Bahnschrift", BODY = "Segoe UI", MONO = "Consolas";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ramp = (f: number, a: number, b: number, x = 0, y = 1) => interpolate(f, [a, b], [x, y], clamp);
const sat = (t: number) => Math.min(1, Math.max(0, t));
const ease = (t: number) => { const x = sat(t); return x * x * (3 - 2 * x); };
const out3 = (t: number) => 1 - Math.pow(1 - sat(t), 3);
const glow = (hex: string, k: number) => LinearRgba.from(Srgba.hex(hex)).mul(k);
const hash = (n: number) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
const T = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => Transform.fromXyz(x, y, z).withRotation(Quat.fromEuler("XYZ", rx, ry, rz));
const deg = (d: number) => (d * Math.PI) / 180;

// ---- vectors and the camera
type V3 = [number, number, number];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const lerp3 = (a: V3, b: V3, t: number): V3 => add(a, mul(sub(b, a), t));
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.sqrt(dot(a, a));
const unit = (a: V3) => mul(a, 1 / len(a));
const dist = (a: V3, b: V3) => len(sub(a, b));
type Cam = { eye: V3; look: V3; fov: number; focus: number; blur?: boolean };
const cam = (eye: V3, look: V3, fovDeg: number, focus?: number): Cam => ({ eye, look, fov: deg(fovDeg), focus: focus ?? dist(eye, look) });

/** a world point on screen: [x px, y px, depth m] */
function proj(c: Cam, p: V3): V3 {
  const fwd = unit(sub(c.look, c.eye));
  const right = unit(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  const d = sub(p, c.eye);
  const z = dot(d, fwd), k = H / 2 / Math.tan(c.fov / 2);
  return [W / 2 + (dot(d, right) / z) * k, H / 2 - (dot(d, up) / z) * k, z];
}
type Rect = { x: number; y: number; w: number; h: number };
function projRect(c: Cam, a: V3, b: V3): Rect {
  const p = proj(c, a), q = proj(c, b);
  const x = Math.min(p[0], q[0]), y = Math.min(p[1], q[1]);
  return { x, y, w: Math.abs(q[0] - p[0]), h: Math.abs(q[1] - p[1]) };
}
const SAFE = { l: 60, r: W - 60, t: 120, b: H - 120 };
const inSafe = (r: Rect) => r.x >= SAFE.l && r.y >= SAFE.t && r.x + r.w <= SAFE.r && r.y + 120 <= 800;
const fitBox = (r: Rect): Rect => ({ ...r, h: Math.min(r.h, 790 - r.y) });

// ---- shots, cut at line starts (whip-pans straddle each cut)
type Enter = "yaw" | "yawL" | "pitch" | "cut";
type Shot = { name: string; from: number; enter: Enter; cam: (lf: number, f: number) => Cam };
const C = (i: number) => L(i) - 6;
const S = { open: 0, title: C(1), voice: C(2), hear: C(7), words: C(8), code: C(9), mont: C(10), music: C(11), check: C(12), how: C(13), end: C(16), done: DURATION };
const WH = 7, WA = 0.9;

// ===== S1 ember open
function Embers({ f, n, at, spread, rise, name, k = 14 }: { f: number; n: number; at: V3; spread: number; rise: number; name: string; k?: number }) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const per = 2.2 + 1.6 * hash(i + 3);
    const t = ((f / FPS) / per + hash(i)) % 1;
    const sw = Math.sin(t * 7 + i * 1.7) * spread * (0.4 + t);
    const p: V3 = add(at, [sw + (hash(i + 5) - 0.5) * spread, 0.04 + t * rise, Math.cos(t * 5 + i) * spread * 0.6 + (hash(i + 9) - 0.5) * spread]);
    const r = (0.005 + 0.007 * hash(i + 7)) * (1 - 0.6 * t);
    out.push(
      <Mesh3d key={i} name={`${name}-${i}`} shadow={false} transform={T(p[0], p[1], p[2])}>
        <Sphere radius={r} />
        <StandardMaterial base_color="#000000" emissive={glow(i % 3 ? "#FF7A2E" : "#FFB070", k * (1 - t) * (t < 0.08 ? t / 0.08 : 1))} />
      </Mesh3d>,
    );
  }
  return <>{out}</>;
}

function Fuel({ at, name, s = 1 }: { at: V3; name: string; s?: number }) {
  return (
    <>
      {[-0.55, 0.6, 1.9].map((a, i) => (
        <Mesh3d key={i} name={`${name}-log${i}`} transform={T(at[0], at[1] + (0.033 + 0.066 * i) * s, at[2], 0, a, Math.PI / 2)}>
          <Cylinder radius={0.032 * s} half_height={0.15 * s} />
          <StandardMaterial base_color="#120e0b" perceptual_roughness={0.9} emissive={glow("#FF4A12", 0.06 + 0.05 * i)} />
        </Mesh3d>
      ))}
    </>
  );
}

const openCam = (lf: number): Cam => {
  const t = ease(lf / (S.title - S.open));
  const eye: V3 = [0.06, 0.2, 2.7 - 1.5 * t];
  return cam(eye, [0, 0.19, 0], 36, dist(eye, [0, 0.16, 0]));
};
function Open() {
  const f = useCurrentFrame();
  return (
    <>
      <Fire name="s1-fire" position={[0, 0.03, 0]} scale={0.42} intensity={9} opacity={1.4} light={0.45} seed={3} />
      <Fuel at={[0, 0, 0]} name="s1" />
      <Embers f={f} n={12} at={[0, 0.2, 0]} spread={0.09} rise={1.0} name="s1-ember" />
      <RectLight transform={Transform.fromXyz(0, 1.1, -6).lookingAt([0, 0, 0])} intensity={60000} width={5} height={0.25} color={TEAL} />
    </>
  );
}

// ===== S2 title
const titleCam = (lf: number, f: number): Cam => {
  const t = lf / (S.voice - S.title);
  const a = deg(-7.5 + 15 * ease(t));
  const eye: V3 = [3.4 * Math.sin(a), 0.62, 3.4 * Math.cos(a)];
  const wa = WORD(1, "aria");
  const focus = interpolate(f, [wa - 14, wa + 2], [dist(eye, [0.2, 0.3, -1.9]), dist(eye, [0, 0.33, 0])], clamp);
  return cam(eye, [0, 0.42, 0], 34, focus);
};
function Title() {
  const f = useCurrentFrame() + S.title;
  const wa = WORD(1, "aria");
  const k = 1.5 * ease((f - wa + 2) / 9);
  return (
    <>
      <Mesh3d name="s2-aria" transform={T(0, 0.33, 0)}>
        <Text3D size={0.78} depth={0.16}>Aria</Text3D>
        <StandardMaterial base_color="#24090e" metallic={0.3} perceptual_roughness={0.22} emissive={glow(CORAL, k)} />
      </Mesh3d>
      <Fire name="s2-fire" position={[0.2, 0.02, -1.9]} scale={0.5} intensity={8} light={0.35} seed={7} />
      <Fuel at={[0.2, 0, -1.9]} name="s2" s={1.1} />
      <SpotLight name="s2-key" transform={Transform.fromXyz(-2.4, 4.4, -3.6).lookingAt([0, 0.2, 0.6])} intensity={1800000} outer_angle={0.3} inner_angle={0.12}
        color={TUNG} shadow_maps_enabled volumetric soft_shadows_enabled radius={0.15} />
      <FogVolume name="s2-haze" position={[-0.6, 1.6, -1.2]} scale={[4, 3.2, 3.5]} density={0.016} scattering={0.5} anisotropy={0.75} />
      <RectLight transform={Transform.fromXyz(2.6, 0.8, 0.1).lookingAt([0, 0.4, 0])} intensity={90000} width={0.5} height={1.6} color={TEAL} />
    </>
  );
}

// ===== S3/S4 voice station: six glass slabs in a receding row
const SLAB: { line: number; tag: string; color: string; label?: string }[] = [
  { line: 2, tag: "[happy]", color: TUNG, label: "cloned voice · aria-heart" },
  { line: 3, tag: "[whispering]", color: TEAL },
  { line: 4, tag: "[surprised]", color: "#F4FBFF" },
  { line: 5, tag: "[sarcastic]", color: "#FFA21F" },
  { line: 6, tag: "[chuckle]", color: CORAL },
];
const slabAt = (k: number): V3 => [k * 1.5, 0, -k * 1.0];
const SLAB_Y = 0.72, SLAB_HW = 0.42, SLAB_HH = 0.56;
const arrive = (k: number) => L(SLAB[k].line) - 4;
const slabPos = (f: number) => { let s = 0; for (let k = 1; k < SLAB.length; k++) s += ease((f - (arrive(k) - 14)) / 14); return s; };
const voiceCam = (_lf: number, f: number): Cam => {
  const s = slabPos(f);
  const p = slabAt(s);
  const drift = Math.sin(f * 0.02) * 0.06;
  const eye = add(p, [0.55 + drift, 0.98, 3.1]);
  return cam(eye, add(p, [0.06, 0.74, 0]), 34, dist(eye, add(p, [0, SLAB_Y, 0.03])));
};
function Slab({ k, f }: { k: number; f: number }) {
  const s = SLAB[k], p = slabAt(k);
  const on = f >= L(s.line) - 4 && f <= LE(s.line) + 10;
  const done = f > LE(s.line) + 10;
  const e = on ? 6 * (0.85 + 0.15 * Math.sin(f * 0.3)) : done ? 0.8 : 0.25;
  const n = `s3-slab${k}`;
  const bar = (key: string, x: number, y: number, hx: number, hy: number) => (
    <Mesh3d name={`${n}-${key}`} transform={T(p[0] + x, y, p[2])}>
      <Cuboid half_size={[hx, hy, 0.034]} />
      <StandardMaterial base_color="#101215" emissive={glow(s.color, e)} />
    </Mesh3d>
  );
  return (
    <>
      <Mesh3d name={`${n}-glass`} transform={T(p[0], SLAB_Y, p[2])}>
        <Cuboid half_size={[SLAB_HW, SLAB_HH, 0.03]} />
        <StandardMaterial base_color="#ffffff" specular_transmission={1} ior={1.5} thickness={0.05} perceptual_roughness={0.04} />
      </Mesh3d>
      {bar("top", 0, SLAB_Y + SLAB_HH, SLAB_HW + 0.006, 0.006)}
      {bar("bot", 0, SLAB_Y - SLAB_HH, SLAB_HW + 0.006, 0.006)}
      {bar("l", -SLAB_HW, SLAB_Y, 0.006, SLAB_HH)}
      {bar("r", SLAB_HW, SLAB_Y, 0.006, SLAB_HH)}
      <Mesh3d name={`${n}-base`} transform={T(p[0], 0.07, p[2])}>
        <Cuboid half_size={[0.5, 0.07, 0.16]} />
        <StandardMaterial base_color="#a7adb5" metallic={0.6} perceptual_roughness={0.15} />
      </Mesh3d>
      <Mesh3d name={`${n}-tube`} transform={T(p[0] - 0.5, 0.012, p[2] - 0.55)}>
        <Cuboid half_size={[0.006, 0.006, 0.4]} />
        <StandardMaterial base_color="#000000" emissive={glow(s.color, on ? 5 : 1)} />
      </Mesh3d>
      <RectLight transform={Transform.fromXyz(p[0], 2.5, p[2] + 0.9).lookingAt([p[0], 0.6, p[2]])} intensity={on ? 130000 : 30000} width={1.0} height={0.5} color="#FFE6CC" />
    </>
  );
}
function Waveform({ line, f, color, w, h }: { line: number; f: number; color: string; w: number; h: number }) {
  const a = L(line), b = LE(line), n = 34;
  const bars = [];
  for (let i = 0; i < n; i++) {
    const fa = Math.floor(a + ((b - a) * i) / n), fb = Math.max(fa + 1, Math.floor(a + ((b - a) * (i + 1)) / n));
    let m = 0;
    for (let x = fa; x < fb; x++) m = Math.max(m, ENVD.rms[x] ?? 0);
    const v = Math.sqrt(m / ENVD.peak);
    const played = f >= fa;
    const bh = Math.max(4, v * h);
    bars.push(<div key={i} style={{ position: "absolute", left: (i * w) / n, top: (h - bh) / 2, width: Math.max(3, w / n - 5), height: bh, borderRadius: 3, backgroundColor: played ? color : "#3A414B" }} />);
  }
  return <div style={{ position: "relative", width: w, height: h }}>{bars}</div>;
}
function SlabCard({ k, f, c }: { k: number; f: number; c: Cam }) {
  const s = SLAB[k], p = slabAt(k);
  const r = projRect(c, [p[0] - SLAB_HW, SLAB_Y + SLAB_HH, p[2] + 0.04], [p[0] + SLAB_HW, SLAB_Y - SLAB_HH, p[2] + 0.04]);
  const vis = ramp(f, L(s.line) - 8, L(s.line) - 2) * (1 - ramp(f, arrive(k + 1 < SLAB.length ? k + 1 : k) - 14, arrive(k + 1 < SLAB.length ? k + 1 : k) - 8));
  const last = k === SLAB.length - 1;
  if (vis <= 0.02 && !(last && f >= L(s.line) - 8)) return null;
  const box = fitBox({ x: r.x + 26, y: r.y + 30, w: r.w - 52, h: r.h - 60 });
  if (!inSafe(box)) return null;
  const m = METERD[`line${String(s.line + 1).padStart(2, "0")}`];
  return (
    <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, opacity: last ? ramp(f, L(s.line) - 8, L(s.line) - 2) : vis,
      display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 36, color: s.color }}>{s.tag}</span>
        {s.label ? <span style={{ fontFamily: BODY, fontSize: 24, color: INK }}>{s.label}</span> : null}
      </div>
      <Waveform line={s.line} f={f} color={s.color} w={box.w} h={110} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontFamily: HEAD, fontSize: 54, color: INK }}>{Math.round(m.median_hz)} Hz</span>
        <span style={{ fontFamily: BODY, fontSize: 24, color: DIM }}>median pitch · {m.loudness_range.toFixed(1)} dB range</span>
      </div>
    </div>
  );
}
function Voice() {
  const f = useCurrentFrame() + S.voice;
  const c = camAt(f);
  return (
    <>
      {SLAB.map((_, k) => <Slab key={k} k={k} f={f} />)}
      <Mesh3d name="s3-wall" transform={T(1.9, 2.0, -4.6, 0, Math.atan2(1, 1.5), 0)}>
        <Cuboid half_size={[9, 2.5, 0.05]} />
        <StandardMaterial base_color="#1c1f24" perceptual_roughness={0.55} />
      </Mesh3d>
      <RectLight transform={Transform.fromXyz(1.9, 3.6, -2.6).lookingAt([1.2, 0.6, -5.2])} intensity={260000} width={7} height={0.6} color={TUNG} />
      <RectLight transform={Transform.fromXyz(9, 1.4, -3).lookingAt([4, 0.6, -3])} intensity={120000} width={0.6} height={2} color={TEAL} />
      {SLAB.map((_, k) => <SlabCard key={k} k={k} f={f} c={c} />)}
    </>
  );
}

// ===== S5 hearing check: the real log of the line being spoken
const HEAR_LINE = 7;
const HEAR = LINES[HEAR_LINE];
const toks = (s: string) => s.split(/\s+/).filter(Boolean);
const matchPct = (want: string, heard: string) => {
  const w = toks(want).map(key), h = new Set(toks(heard).map(key));
  return Math.round((100 * w.filter((x) => h.has(x)).length) / w.length);
};
const PANEL: V3 = [0.15, 1.36, -0.2];
const PANEL_HW = 1.0, PANEL_HH = 0.42;
const hearCam = (lf: number): Cam => {
  const t = ease(lf / (S.words - S.hear));
  const eye: V3 = [0.35 - 0.15 * t, 1.3, 3.5 - 0.6 * t];
  return cam(eye, [0.12, 1.14, -0.2], 34, dist(eye, PANEL));
};
function Hear() {
  const f = useCurrentFrame() + S.hear;
  const c = camAt(f);
  const rowAt = WORD(HEAR_LINE, "heard");
  const tickAt = WORD(HEAR_LINE, "right");
  const tries = HEAR.tries;
  const failed = tries.some((t) => !t.ok);
  const missAt = rowAt;
  const pass = f >= tickAt;
  const pulse = failed && f >= missAt && f < tickAt ? 0.5 + 0.5 * Math.cos((f - missAt) * 0.5) : 0;
  const metal = { base_color: "#a2a8b0", metallic: 0.6, perceptual_roughness: 0.15 };
  const r = projRect(c, [PANEL[0] - PANEL_HW, PANEL[1] + PANEL_HH, PANEL[2] + 0.03], [PANEL[0] + PANEL_HW, PANEL[1] - PANEL_HH, PANEL[2] + 0.03]);
  const box = fitBox({ x: r.x + 34, y: r.y + 30, w: r.w - 68, h: r.h - 60 });
  const wantW = toks(HEAR.text);
  return (
    <>
      <Mesh3d name="s5-desk" transform={T(0, 0.74, 0.25)}><Cuboid half_size={[1.1, 0.025, 0.5]} /><StandardMaterial {...metal} /></Mesh3d>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], i) => (
        <Mesh3d key={i} name={`s5-leg${i}`} transform={T(a * 1.0, 0.36, 0.25 + b * 0.42)}><Cuboid half_size={[0.025, 0.36, 0.025]} /><StandardMaterial {...metal} /></Mesh3d>
      ))}
      <Mesh3d name="s5-mic-base" transform={T(-0.55, 0.775, 0.45)}><Cylinder radius={0.08} half_height={0.012} /><StandardMaterial {...metal} /></Mesh3d>
      <Mesh3d name="s5-mic-stem" transform={T(-0.55, 0.9, 0.45)}><Cylinder radius={0.009} half_height={0.12} /><StandardMaterial {...metal} /></Mesh3d>
      <Mesh3d name="s5-mic-head" transform={T(-0.55, 1.13, 0.45, 0.35, 0, 0)}><Capsule3d radius={0.045} half_length={0.06} /><StandardMaterial base_color="#202328" metallic={0.6} perceptual_roughness={0.32} /></Mesh3d>
      <Mesh3d name="s5-mic-ring" transform={T(-0.55, 1.02, 0.45, Math.PI / 2 + 0.35, 0, 0)}><Torus major_radius={0.05} minor_radius={0.006} /><StandardMaterial base_color="#000000" emissive={glow(pass ? GREEN : CORAL, 4)} /></Mesh3d>
      <Mesh3d name="s5-panel" transform={T(PANEL[0], PANEL[1], PANEL[2])}>
        <Cuboid half_size={[PANEL_HW, PANEL_HH, 0.018]} />
        <StandardMaterial base_color="#ffffff" specular_transmission={1} ior={1.5} thickness={0.04} perceptual_roughness={0.05} />
      </Mesh3d>
      <Mesh3d name="s5-panel-edge" transform={T(PANEL[0], PANEL[1] - PANEL_HH, PANEL[2])}><Cuboid half_size={[PANEL_HW, 0.006, 0.022]} /><StandardMaterial base_color="#000000" emissive={glow(pass ? GREEN : TEAL, 4)} /></Mesh3d>
      <Mesh3d name="s5-back" transform={T(0.1, 0.62, -1.6)}><Cuboid half_size={[1.6, 0.006, 0.006]} /><StandardMaterial base_color="#000000" emissive={glow(TUNG, 3)} /></Mesh3d>
      <RectLight transform={Transform.fromXyz(0, 2.7, 1.3).lookingAt([0, 0.8, 0.2])} intensity={170000} width={1.6} height={0.6} color="#FFE6CC" />
      <RectLight transform={Transform.fromXyz(-2.6, 1.6, -0.6).lookingAt([0, 1, 0])} intensity={70000} width={0.5} height={1.5} color={TEAL} />
      <PointLight name="s5-pulse" transform={Transform.fromXyz(0.15, 0.95, 0.9)} intensity={pass ? 160000 : 30000 + 600000 * pulse} color={pass ? GREEN : "#FF2A3A"} range={5} />
      {inSafe(box) ? (
        <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "row", gap: 20 }}>
            <span style={{ fontFamily: MONO, fontSize: 30, color: DIM, width: 230 }}>WANT</span>
            <span style={{ fontFamily: BODY, fontSize: 36, color: INK, width: box.w - 250 }}>{HEAR.text}</span>
          </div>
          {tries.map((t, i) => {
            const at = rowAt + i * 12;
            const hw = toks(t.heard);
            const wantK = new Set(wantW.map(key));
            return (
              <div key={i} style={{ display: "flex", flexDirection: "row", gap: 20, opacity: ramp(f, at, at + 5) }}>
                <span style={{ fontFamily: MONO, fontSize: 30, color: DIM, width: 230 }}>HEARD try {i + 1}</span>
                <span style={{ fontFamily: BODY, fontSize: 36, color: INK, width: box.w - 250 }}>
                  {hw.map((w, j) => <span key={j} style={{ color: wantK.has(key(w)) ? INK : CORAL, textDecoration: wantK.has(key(w)) ? "none" : "line-through" }}>{w} </span>)}
                </span>
              </div>
            );
          })}
          <div style={{ display: "flex", flexDirection: "row", gap: 20, alignItems: "center", opacity: ramp(f, tickAt, tickAt + 5) }}>
            <span style={{ fontFamily: MONO, fontSize: 30, color: DIM, width: 230 }}>RESULT</span>
            <span style={{ fontFamily: HEAD, fontSize: 46, color: GREEN }}>
              ✓ try {tries.length} · {matchPct(HEAR.text, tries[tries.length - 1].heard)}% match
            </span>
          </div>
        </div>
      ) : null}
    </>
  );
}

// ===== S6 word timing: line 10's words on the floor, each igniting on its captions.json start
const TL = 8;
const TW = LINES[TL].words;
const WSIZE = 0.3;
const wordW = (w: string) => 0.16 * w.length * (WSIZE / 0.3) + 0.04;
const WPOS: V3[] = (() => {
  const out: V3[] = [];
  let x = 0;
  TW.forEach((w, k) => { const ww = wordW(w.w.replace(/[^A-Za-z]/g, "")); out.push([x + ww / 2, 0.13, -k * 0.38]); x += ww + 0.16; });
  return out;
})();
const wordsCam = (lf: number, f: number): Cam => {
  let s = 0;
  for (let k = 1; k < TW.length; k++) s += ease((f - (fr(TW[k].s) - 5)) / 8);
  const i0 = Math.floor(s), i1 = Math.min(TW.length - 1, i0 + 1);
  const p = lerp3(WPOS[i0], WPOS[i1], s - i0);
  const crane = ease(lf / 26);
  const eye = add(p, [0.45, 0.35 + 0.8 * crane, 3.3 - 0.2 * crane]);
  return cam(eye, add(p, [0.1, 0.18, 0]), 36, dist(eye, p));
};
function Words() {
  const f = useCurrentFrame() + S.words;
  const c = camAt(f);
  const cur = TW.reduce((n, w, k) => (f >= fr(w.s) ? k : n), -1);
  const span = 45;
  return (
    <>
      {TW.map((w, k) => {
        const on = f >= fr(w.s);
        const flash = on ? 1 + 1.5 * (1 - ramp(f, fr(w.s), fr(w.s) + 8)) : 0;
        return (
          <Mesh3d key={k} name={`s6-w${k}`} transform={T(WPOS[k][0], WPOS[k][1], WPOS[k][2])}>
            <Text3D size={WSIZE} depth={0.06}>{w.w.replace(/[^A-Za-z']/g, "")}</Text3D>
            <StandardMaterial base_color="#30343b" metallic={0.6} perceptual_roughness={0.15} emissive={glow(CORAL, on ? 1.2 * flash : 0)} />
          </Mesh3d>
        );
      })}
      <RectLight transform={Transform.fromXyz(1.6, 2.4, 1.2).lookingAt([1.6, 0, -1])} intensity={140000} width={4} height={0.6} color="#FFE6CC" />
      <RectLight transform={Transform.fromXyz(-1.5, 0.8, -2.5).lookingAt([1.5, 0.2, -1])} intensity={60000} width={0.4} height={1.4} color={TEAL} />
      {cur >= 0 ? <PointLight name="s6-glow" transform={Transform.fromXyz(WPOS[cur][0], 0.5, WPOS[cur][2] + 0.4)} intensity={90000} color={CORAL} range={3} /> : null}
      {TW.map((w, k) => {
        const p = proj(c, add(WPOS[k], [0, 0.26, 0]));
        if (p[2] <= 0 || p[0] < 150 || p[0] > W - 150 || p[1] < 160 || p[1] > 640) return null;
        const on = f >= fr(w.s);
        return (
          <div key={k} style={{ position: "absolute", left: p[0] - 90, top: p[1] - 40, width: 180, textAlign: "center", fontFamily: MONO, fontSize: 26, color: on ? CORAL : DIM }}>
            {w.s.toFixed(2)} s
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 120, top: 676, width: W - 240, height: 110 }}>
        <div style={{ position: "absolute", left: 0, top: 0, fontFamily: MONO, fontSize: 26, color: DIM }}>frame <span style={{ color: INK }}>{f}</span></div>
        <div style={{ position: "absolute", left: 0, top: 44, width: W - 240, height: 2, backgroundColor: "#3A414B" }} />
        {Array.from({ length: span * 2 + 1 }, (_, i) => {
          const fx = f - span + i;
          const x = ((W - 240) * i) / (span * 2);
          const big = fx % 15 === 0;
          return <div key={i} style={{ position: "absolute", left: x, top: big ? 30 : 38, width: 2, height: big ? 28 : 14, backgroundColor: big ? "#7C8591" : "#4A525D" }} />;
        })}
        {TW.map((w, k) => {
          const i = fr(w.s) - (f - span);
          if (i < 0 || i > span * 2) return null;
          const x = ((W - 240) * i) / (span * 2);
          return (
            <div key={k} style={{ position: "absolute", left: x - 70, top: 64, width: 140, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 4, height: 14, backgroundColor: f >= fr(w.s) ? CORAL : "#7C8591" }} />
              <span style={{ fontFamily: MONO, fontSize: 22, color: f >= fr(w.s) ? CORAL : DIM }}>{fr(w.s)}</span>
            </div>
          );
        })}
        <div style={{ position: "absolute", left: (W - 240) / 2 - 1, top: 22, width: 3, height: 46, backgroundColor: INK }} />
      </div>
    </>
  );
}

// ===== S7 code is the scene: the panel shows this shot's own JSX, values typed live
const CL = 9;
type Edit = { at: number; from: string; to: string };
const typed = (f: number, e: Edit) => {
  if (f < e.at) return e.from;
  const back = e.from.length - (e.from.match(/^\d\.?/)?.[0].length ?? 0);
  const k = Math.floor((f - e.at) / 2);
  if (k < back) return e.from.slice(0, e.from.length - k - 1);
  const keep = e.from.length - back;
  return e.to.slice(0, Math.min(e.to.length, keep + (k - back) + 1 - 1 + 1));
};
const complete = (s: string, prev: number) => (/^\d(\.\d)?$/.test(s) ? parseFloat(s) : prev);
const E_ROUGH: Edit = { at: WORD(CL, "code"), from: "0.8", to: "0.1" };
const E_IOR: Edit = { at: WORD(CL, "rendered"), from: "1.0", to: "1.5" };
const E_COAT: Edit = { at: WORD(CL, "3d"), from: "0", to: "1" };
const S7C: V3 = [1.05, 0.35, -0.3];
const SPH: V3 = [0.75, 0.38, 0.05], TOR: V3 = [1.5, 0.43, -0.1], CUBE: V3 = [0.25, 0.2, -0.85];
const codeCam = (lf: number, f: number): Cam => {
  const t = lf / (S.mont - S.code);
  const a = deg(-14 + 20 * ease(t));
  const eye = add(S7C, [4.6 * Math.sin(a), 0.85, 4.6 * Math.cos(a)]);
  const focus = interpolate(f, [E_IOR.at - 6, E_IOR.at + 6], [dist(eye, SPH), dist(eye, TOR)], clamp);
  const look = add(S7C, [-0.85 * Math.cos(a), 0.1, 0.85 * Math.sin(a)]);
  return cam(eye, look, 36, focus);
};
function Code() {
  const f = useCurrentFrame() + S.code;
  const rs = typed(f, E_ROUGH), is = typed(f, E_IOR), cs = typed(f, E_COAT);
  const rough = complete(rs, 0.8), ior = complete(is, 1.0), coat = complete(cs, 0);
  const editing = [E_ROUGH, E_IOR, E_COAT].findIndex((e) => f >= e.at - 4 && f < e.at + 10);
  const lines: [string, number][] = [
    [`<Mesh3d name="s7-sphere">`, -1],
    [`  <Sphere radius={0.38} />`, -1],
    [`  <StandardMaterial base_color="#8a0f1e"`, -1],
    [`    perceptual_roughness={${rs}}`, 0],
    [`    clearcoat={${cs}} />`, 2],
    [`</Mesh3d>`, -1],
    [`<Mesh3d name="s7-torus">`, -1],
    [`  <Torus major_radius={0.32}`, -1],
    [`    minor_radius={0.09} />`, -1],
    [`  <StandardMaterial`, -1],
    [`    specular_transmission={1}`, -1],
    [`    ior={${is}} thickness={0.18} />`, 1],
    [`</Mesh3d>`, -1],
  ];
  const panelIn = out3((f - S.code - 2) / 12);
  return (
    <>
      <Mesh3d name="s7-sphere" transform={T(SPH[0], SPH[1], SPH[2])}>
        <Sphere radius={0.38} />
        <StandardMaterial base_color="#8a0f1e" perceptual_roughness={rough} clearcoat={coat} clearcoat_perceptual_roughness={0.04} />
      </Mesh3d>
      <Mesh3d name="s7-torus" transform={T(TOR[0], TOR[1], TOR[2], 0, -0.5 + f * 0.01, 0).withRotation(Quat.fromEuler("XYZ", Math.PI / 2, 0, -0.5 + f * 0.012))}>
        <Torus major_radius={0.32} minor_radius={0.09} />
        <StandardMaterial base_color="#ffffff" specular_transmission={1} ior={ior} thickness={0.18} perceptual_roughness={0.03} />
      </Mesh3d>
      <Mesh3d name="s7-cube" transform={T(CUBE[0], CUBE[1], CUBE[2], 0, 0.5, 0)}>
        <Cuboid half_size={[0.2, 0.2, 0.2]} />
        <StandardMaterial base_color="#b8bec6" metallic={0.6} perceptual_roughness={0.15} />
      </Mesh3d>
      <Mesh3d name="s7-neon" transform={T(1.4, 0.5, -1.6, 0, 0, Math.PI / 2)}><Cylinder radius={0.012} half_height={0.5} /><StandardMaterial base_color="#000000" emissive={glow(CORAL, 5)} /></Mesh3d>
      <RectLight transform={Transform.fromXyz(1.9, 0.6, -1.4).lookingAt([1.5, 0.43, -0.1])} intensity={70000} width={0.4} height={0.9} color={TEAL} />
      <Mesh3d name="s7-neon2" transform={T(2.3, 0.5, -1.3)}><Cylinder radius={0.012} half_height={0.5} /><StandardMaterial base_color="#000000" emissive={glow(TEAL, 4)} /></Mesh3d>
      <RectLight transform={Transform.fromXyz(0.6, 2.6, 1.4).lookingAt([1.0, 0.3, -0.3])} intensity={160000} width={1.8} height={0.6} color="#FFE6CC" />
      <RectLight transform={Transform.fromXyz(3.2, 1.3, -1.2).lookingAt([1.0, 0.4, -0.3])} intensity={90000} width={0.6} height={1.6} color={TEAL} />
      <div style={{ position: "absolute", left: 70, top: 150, width: 700, height: 610, borderRadius: 18, backgroundColor: "#0E1116", border: "2px solid #262C35", boxSizing: "border-box",
        padding: 26, display: "flex", flexDirection: "column", opacity: panelIn, transform: `translateX(${(1 - panelIn) * -60}px)` }}>
        <div style={{ fontFamily: MONO, fontSize: 22, color: DIM, marginBottom: 12 }}>teaser/edit.tsx · this shot</div>
        {lines.map(([ln, ed], i) => {
          const hot = ed >= 0 && ed === editing;
          return (
            <div key={i} style={{ fontFamily: MONO, fontSize: 28, height: 40, color: ln.trim().startsWith("<") || ln.trim().startsWith("</") ? "#9FE7F0" : INK,
              backgroundColor: hot ? "#2A1A20" : "#0E1116", whiteSpace: "pre" }}>
              {ln}{hot ? <span style={{ color: CORAL }}>▍</span> : null}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ===== S8 element montage: four hard cuts on the four nouns
const ML = 10;
const MC = { glass: S.mont, fire: WORD(ML, "fire") - 1, fog: WORD(ML, "fog") - 7, sun: WORD(ML, "sunlight") + 10 };
const montPart = (f: number) => (f >= MC.sun ? 3 : f >= MC.fog ? 2 : f >= MC.fire ? 1 : 0);
const montCam = (_lf: number, f: number): Cam => {
  const p = montPart(f);
  if (p === 0) { const t = (f - MC.glass) / 30; const eye: V3 = [0.12 - 0.1 * t, 0.42, 1.05 - 0.08 * t]; return cam(eye, [0, 0.4, 0], 30, dist(eye, [0, 0.4, 0])); }
  if (p === 1) { const t = (f - MC.fire) / 30; const eye: V3 = [0.2, 0.7, 3.6 - 0.25 * t]; return cam(eye, [0, 0.75, 0], 34, dist(eye, [0, 0.7, 0])); }
  if (p === 2) { const t = (f - MC.fog) / 30; const eye: V3 = [-0.3 + 0.15 * t, 1.0, 5.2]; return cam(eye, [0, 0.9, 0], 36, 5.2); }
  const t = (f - MC.sun) / 90;
  const eye: V3 = [0.5 - 0.3 * t, 0.32, 3.4 - 0.4 * t];
  return cam(eye, [0, 0.42, 0], 34, dist(eye, [0, 0.35, 0]));
};
function Montage() {
  const f = useCurrentFrame() + S.mont;
  const p = montPart(f);
  const label = ["<StandardMaterial specular_transmission />", "<Fire />", "<FogVolume />", "<Atmosphere />"][p];
  return (
    <>
      {p === 0 ? (
        <>
          <Mesh3d name="s8-torus" transform={T(0, 0.4, 0, 0.25, f * 0.02, 0)}>
            <Torus major_radius={0.17} minor_radius={0.06} />
            <StandardMaterial base_color="#ffffff" specular_transmission={1} ior={1.5} thickness={0.12} perceptual_roughness={0.02} />
          </Mesh3d>
          {[[-0.35, CORAL], [0.0, TEAL], [0.35, CORAL]].map(([x, col], i) => (
            <Mesh3d key={i} name={`s8-neon${i}`} transform={T(x as number, 0.45, -0.9)}><Cylinder radius={0.014} half_height={0.42} /><StandardMaterial base_color="#000000" emissive={glow(col as string, 6)} /></Mesh3d>
          ))}
          <RectLight transform={Transform.fromXyz(0.6, 1.4, 0.8).lookingAt([0, 0.4, 0])} intensity={60000} width={0.8} height={0.4} color="#FFE6CC" />
        </>
      ) : null}
      {p === 1 ? (
        <>
          <Fire name="s8-fire" position={[0, 0.03, 0]} scale={1.3} intensity={12} opacity={1.6} light={0.7} seed={11} />
          <Fuel at={[0, 0, 0]} name="s8" s={2.6} />
          <Embers f={f} n={16} at={[0, 0.6, 0]} spread={0.25} rise={1.8} name="s8-ember" k={16} />
        </>
      ) : null}
      {p === 2 ? (
        <>
          <FogVolume name="s8-ground" position={[0, 0.3, 0]} scale={[12, 0.6, 9]} density={0.05} scattering={0.6} anisotropy={0.5} falloff={1} />
          <FogVolume name="s8-air" position={[0, 2.0, -0.5]} scale={[7, 3.6, 5]} density={0.018} scattering={0.5} anisotropy={0.7} />
          {[-1.7, 0, 1.7].map((x, i) => (
            <SpotLight key={i} name={`s8-spot${i}`} transform={Transform.fromXyz(x * 1.1, 4.0, -1.2).lookingAt([x, 0, 0])} intensity={1800000} outer_angle={0.16} inner_angle={0.08}
              color={i === 1 ? TEAL : TUNG} shadow_maps_enabled volumetric />
          ))}
          {[-1.7, 0, 1.7].map((x, i) => (
            <Mesh3d key={i} name={`s8-plinth${i}`} transform={T(x, 0.15, 0)}><Cylinder radius={0.18} half_height={0.15} /><StandardMaterial base_color="#a2a8b0" metallic={0.6} perceptual_roughness={0.15} /></Mesh3d>
          ))}
        </>
      ) : null}
      {p === 3 ? (
        <>
          <Atmosphere />
          <DirectionalLight name="s8-sun" transform={Transform.fromXyz(-1.5, 0.7, -10).lookingAt([0, 0, 0])} illuminance={9000} color="#FF9A5A" shadow_maps_enabled soft_shadow_size={0.5} />
          <Mesh3d name="s8-aria" transform={T(0, 0.33, 0)}>
            <Text3D size={0.7} depth={0.16}>Aria</Text3D>
            <StandardMaterial base_color="#16181c" metallic={0.6} perceptual_roughness={0.15} />
          </Mesh3d>
        </>
      ) : null}
      <div style={{ position: "absolute", left: 80, top: 720, padding: "10px 22px", borderRadius: 12, backgroundColor: "#0E1116", border: `2px solid ${p === 1 ? TUNG : p === 3 ? "#FF9A5A" : TEAL}`,
        fontFamily: MONO, fontSize: 28, color: INK }}>{label}</div>
    </>
  );
}

// ===== S11 how it works: the request, then seven glass stations from script to MP4 (cues for the score too)
const AL = 13, PL = 14, RL = 15;
const NODES: { name: string; at: number }[] = [
  { name: "script", at: WORD(PL, "script") },
  { name: "voice", at: WORD(PL, "voices") },
  { name: "heard back", at: WORD(PL, "it") },
  { name: "captions.json", at: WORD(PL, "times") },
  { name: "scene.tsx", at: WORD(PL, "codes") },
  { name: "GPU render", at: WORD(RL, "renders") },
  { name: "export check → MP4", at: WORD(RL, "checks") },
];

// ===== the score (D minor, 120 BPM, one beat = 15 frames), its events also drive the S9 equaliser
const BPM = 120, BEAT = 60 / BPM, BAR = BEAT * 4;
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const sec = (frame: number) => frame / FPS;
const DUCK = { amount: -9 };
const PROG = [[62, 65, 69], [58, 62, 65], [60, 65, 69], [60, 64, 67]]; // Dm Bb F C
const ROOT = [38, 34, 41, 36];
const ENDPROG = [[53, 57, 60, 65], [58, 62, 65, 70], [53, 57, 60, 65], [60, 65, 69, 72]]; // F Bb F F
const ENDROOT = [41, 34, 41, 41];
const END = sec(DURATION);
const T0 = WORDT(1, "aria");
const tBass = LINES[7].start - 0.2, tSolo = LINES[11].start - BAR, tCode = WORDT(11, "code");
const tHush = LINES[13].start - 0.1, tHow = LINES[14].start - 0.05, tDrop = LINES[16].start;
type Ev = [number, number, number]; // time, midi, velocity
const padEv: [number, number[]][] = [], bassEv: Ev[] = [], pluckEv: Ev[] = [], kickEv: Ev[] = [], hatEv: Ev[] = [], clapEv: Ev[] = [];
const hush = (t: number) => t >= tHush && t < tHow;
const solo = (t: number) => t >= tSolo && t < tCode;
for (let t = T0 - Math.ceil(T0 / BAR) * BAR, b = -Math.ceil(T0 / BAR); t < END - 1.5; t += BAR, b++) {
  const bi = ((b % 4) + 4) % 4;
  const fin = t >= tDrop - 0.01;
  const ch = fin ? ENDPROG[bi] : PROG[bi], root = fin ? ENDROOT[bi] : ROOT[bi];
  for (let i = 0; i < 8; i++) {
    const tt = t + (i * BEAT) / 2;
    if (tt < 0 || hush(tt) || tt >= END - 1.5) continue;
    if (i === 0 && tt >= T0 - 0.01 && !solo(tt)) padEv.push([tt, ch]);
    if ((i === 0 || i === 5) && tt >= tBass && !solo(tt)) bassEv.push([tt, root - 12, i ? 0.6 : 0.9]);
    if (tt >= tBass && !solo(tt) && tt < END - 3) hatEv.push([tt, 0, i % 2 ? 0.35 : 0.2]);
    if (((tt >= tCode && tt < tHush) || tt >= tDrop) && !solo(tt) && tt < END - 3) {
      if (i === 0 || i === 3) kickEv.push([tt, 0, i ? 0.6 : 0.9]);
      if (i === 4) clapEv.push([tt, 0, 0.5]);
    }
    if (solo(tt)) pluckEv.push([tt, ch[i % 3] + 12 + (i >= 4 ? 12 : 0), 0.7]);
  }
}
// plucks answer the voice in its pauses
const q8 = (t: number) => T0 + Math.ceil((t - T0) / (BEAT / 2)) * (BEAT / 2);
for (let i = 1; i < LINES.length - 1; i++) {
  const a = q8(LINES[i].end + 0.05), b = LINES[i + 1].start - 0.15;
  if (a < T0 || b - a < 0.5 || hush(a) || solo(a)) continue;
  const bi = ((Math.floor((a - T0) / BAR) % 4) + 4) % 4;
  const ch = a >= tDrop ? ENDPROG[bi] : PROG[bi];
  [0, 1, 2].forEach((n) => { const tt = a + n * (BEAT / 2); if (tt < b) pluckEv.push([tt, ch[(n * 2) % 3] + 24, 0.45]); });
}
kickEv.push([T0, 0, 1], [tCode, 0, 1], [tDrop, 0, 1]);
[MC.fire, MC.fog, MC.sun].forEach((x) => kickEv.push([sec(x), 0, 0.9]));
TW.forEach((w) => hatEv.push([w.s, 0, 0.8]));
bassEv.push([tDrop, 29, 1]);
kickEv.sort((a, b) => a[0] - b[0]); hatEv.sort((a, b) => a[0] - b[0]); pluckEv.sort((a, b) => a[0] - b[0]); bassEv.sort((a, b) => a[0] - b[0]);

Tone.getTransport().bpm.value = BPM;
Tone.buses.music.volume.value = -15;
Tone.buses.music.duck(Tone.buses.voice, DUCK);
const room = new Tone.Reverb({ decay: 5, wet: 0.35 }).connect(Tone.buses.music);
const warm = new Tone.Filter({ type: "lowpass", frequency: 2000, rolloff: -24 }).connect(room);
const pad = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "fatsawtooth" }, envelope: { attack: 0.9, decay: 0.5, sustain: 0.8, release: 2.2 }, volume: -25 }).connect(warm);
const pluck = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.003, decay: 0.28, sustain: 0, release: 0.3 }, volume: -17 }).connect(room);
const bass = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.02, decay: 0.3, sustain: 0.7, release: 0.4 }, volume: -11 }).connect(Tone.buses.music);
const drone = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 2.5, decay: 0.5, sustain: 1, release: 1.5 }, volume: -10 }).connect(Tone.buses.music);
const kick = new Tone.MembraneSynth({ octaves: 4, pitchDecay: 0.04, envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 }, volume: -10 }).connect(Tone.buses.music);
const hatF = new Tone.Filter({ type: "highpass", frequency: 8000 }).connect(Tone.buses.music);
const hat = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.04, sustain: 0 }, volume: -28 }).connect(hatF);
const clapF = new Tone.Filter({ type: "bandpass", frequency: 1500, Q: 1 }).connect(room);
const clap = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.12, sustain: 0 }, volume: -22 }).connect(clapF);
const swellF = new Tone.Filter({ type: "lowpass", frequency: 900 }).connect(Tone.buses.music);
const swell = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 2.6, decay: 0.8, sustain: 0 }, volume: -20 }).connect(swellF);
const riserF = new Tone.Filter({ type: "bandpass", frequency: 2500, Q: 0.7 }).connect(Tone.buses.sfx);
const riser = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 1.3, decay: 0.05, sustain: 0 }, volume: -20 }).connect(riserF);
const swF = new Tone.Filter({ type: "bandpass", frequency: 1100, Q: 0.8 }).connect(Tone.buses.sfx);
const whoosh = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.18, decay: 0.25, sustain: 0 }, volume: -22 }).connect(swF);
const ping = new Tone.MembraneSynth({ octaves: 1.5, pitchDecay: 0.01, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 }, volume: -20 }).connect(room);

const playPad = (tt: number, n: number[]) => pad.triggerAttackRelease(n.map(hz), BAR * 0.98, tt);
const playPluck = (tt: number, e: Ev) => pluck.triggerAttackRelease(hz(e[1]), 0.2, tt, e[2]);
const playKick = (tt: number, e: Ev) => kick.triggerAttackRelease(hz(33), 0.25, tt, e[2]);
const asPart = (ev: Ev[]) => ev.map((e) => [e[0], e] as [number, Ev]);
new Tone.Part(playPad, padEv).start(0);
new Tone.Part(playPluck, asPart(pluckEv)).start(0);
new Tone.Part(playKick, asPart(kickEv)).start(0);
new Tone.Part((tt: number, e: Ev) => bass.triggerAttackRelease(hz(e[1]), BEAT * 1.4, tt, e[2]), asPart(bassEv)).start(0);
new Tone.Part((tt: number, e: Ev) => hat.triggerAttackRelease(0.03, tt, e[2]), asPart(hatEv)).start(0);
new Tone.Part((tt: number, e: Ev) => clap.triggerAttackRelease(0.1, tt, e[2]), asPart(clapEv)).start(0);
drone.triggerAttackRelease(hz(38), T0 + 0.5, 0.05);
swell.triggerAttackRelease(3.2, Math.max(0.05, T0 - 3.0), 0.9);
riser.triggerAttackRelease(1.35, tDrop - 1.3, 0.9);
const whips = [S.title, S.voice, S.hear, S.words, S.code, S.mont, S.music, S.check, S.how, S.end].map((x) => [sec(x) - 0.2, 0] as [number, number]);
new Tone.Part((tt: number) => whoosh.triggerAttackRelease(0.35, tt), whips).start(0);
const PINGS: [number, number][] = [
  ...SLAB.map((s) => [LINES[s.line].start - 0.08, 79] as [number, number]),
  [WORDT(7, "heard"), 50], [WORDT(7, "right"), 84], [LINES[17].end + 0.3, 77],
  ...NODES.map((n, i) => [sec(n.at), 62 + [0, 3, 5, 7, 10, 12, 14][i]] as [number, number]),
];
new Tone.Part((tt: number, m: number) => ping.triggerAttackRelease(hz(m), 0.15, tt, 0.6), PINGS).start(0);
Tone.buses.music.volume.rampTo(-40, 2.0, END - 2.2);
Tone.getTransport().start();

// ===== S9 music: an equaliser driven by the score's own note events
const EQ_COLS = 16;
const column = (inst: string, midi: number) =>
  inst === "kick" ? 0 : inst === "bass" ? 2 + Math.min(2, Math.max(0, Math.floor((midi - 22) / 6))) : inst === "pad" ? 5 + Math.min(4, Math.max(0, Math.floor((midi - 52) / 4))) :
  inst === "pluck" ? 10 + Math.min(4, Math.max(0, Math.floor((midi - 70) / 5))) : inst === "clap" ? 1 : 15;
const EQ_EV: [number, number, number, number][] = []; // time, column, velocity, decay
kickEv.forEach((e) => EQ_EV.push([e[0], 0, e[2], 0.25]));
clapEv.forEach((e) => EQ_EV.push([e[0], 1, e[2], 0.15]));
bassEv.forEach((e) => EQ_EV.push([e[0], column("bass", e[1]), e[2], 0.5]));
padEv.forEach(([t, ch]) => ch.forEach((m) => EQ_EV.push([t, column("pad", m), 0.7, 1.4])));
pluckEv.forEach((e) => EQ_EV.push([e[0], column("pluck", e[1]), e[2], 0.3]));
hatEv.forEach((e) => EQ_EV.push([e[0], 15, e[2], 0.08]));
const eqLevels = (t: number) => {
  const lv = new Array(EQ_COLS).fill(0);
  for (const [te, col, v, d] of EQ_EV) if (te <= t && t - te < 6 * d) lv[col] = Math.max(lv[col], v * Math.exp(-(t - te) / d));
  return lv;
};
const SCORE_CODE = [
  "Tone.getTransport().bpm.value = BPM;",
  "Tone.buses.music.duck(Tone.buses.voice, DUCK);",
  "new Tone.Part(playPluck, asPart(pluckEv)).start(0);",
  "new Tone.Part(playKick, asPart(kickEv)).start(0);",
];
const musicCam = (lf: number): Cam => {
  const t = ease(lf / (S.check - S.music));
  const eye: V3 = [0.8 - 0.05 * t, 0.72 + 0.08 * t, 3.8 - 0.3 * t];
  return cam(eye, [0.75 - 0.05 * t, 0.5, 0], 36, dist(eye, [-0.05, 0.4, 0]));
};
function Music() {
  const f = useCurrentFrame() + S.music;
  const lv = eqLevels(sec(f));
  const env = ENVD.rms[f] ?? 0;
  const voice = Math.min(1, Math.sqrt(env / ENVD.peak) * 1.4);
  return (
    <>
      {lv.map((v, i) => {
        const h = 0.06 + 1.42 * v;
        const col = i < 2 ? CORAL : i < 5 ? TUNG : i < 10 ? TEAL : i < 15 ? "#B8F3FA" : INK;
        return (
          <Mesh3d key={i} name={`s9-eq${i}`} transform={T(-1.1 + i * 0.14, h / 2, 0)}>
            <Cuboid half_size={[0.055, h / 2, 0.055]} />
            <StandardMaterial base_color="#14171c" metallic={0.3} perceptual_roughness={0.2} emissive={glow(col, 0.6 + 5 * v)} />
          </Mesh3d>
        );
      })}
      <RectLight transform={Transform.fromXyz(0, 2.4, 1.4).lookingAt([0, 0, 0])} intensity={110000} width={3.5} height={0.5} color="#FFE6CC" />
      <div style={{ position: "absolute", left: 1150, top: 150, width: 700, height: 600, borderRadius: 18, backgroundColor: "#0E1116", border: "2px solid #262C35", boxSizing: "border-box",
        padding: 26, display: "flex", flexDirection: "column", gap: 14, opacity: out3((f - S.music - 4) / 12) }}>
        <div style={{ fontFamily: MONO, fontSize: 22, color: DIM }}>teaser/edit.tsx · the score</div>
        {SCORE_CODE.map((ln, i) => <div key={i} style={{ fontFamily: MONO, fontSize: 22, color: i === 1 ? TEAL : INK, whiteSpace: "pre" }}>{ln}</div>)}
        <div style={{ height: 10 }} />
        <div style={{ fontFamily: BODY, fontSize: 24, color: DIM }}>voice level → music ducks {DUCK.amount} dB</div>
        <div style={{ position: "relative", width: 640, height: 26, borderRadius: 13, backgroundColor: "#1C2128" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 640 * voice, height: 26, borderRadius: 13, backgroundColor: TEAL }} />
        </div>
        <div style={{ position: "relative", width: 640, height: 26, borderRadius: 13, backgroundColor: "#1C2128" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 640 * (1 - 0.45 * voice), height: 26, borderRadius: 13, backgroundColor: TUNG }} />
        </div>
        <div style={{ display: "flex", flexDirection: "row", gap: 16, marginTop: 18, alignItems: "center" }}>
          <div style={{ padding: "10px 24px", borderRadius: 999, border: `3px solid ${CORAL}`, fontFamily: HEAD, fontSize: 40, color: INK }}>-14 LUFS</div>
          <span style={{ fontFamily: BODY, fontSize: 24, color: DIM }}>{"<Mix lufs={-14} ceiling={-1.5} />"}</span>
        </div>
      </div>
    </>
  );
}

// ===== S10 export check: safe-area guides over the live studio
const XL = 12;
const XCUE = ["inspects", "every", "frame", "before", "see"].map((w) => WORD(XL, w));
const checkCam = (lf: number): Cam => {
  const t = ease(lf / (S.how - S.check));
  const eye: V3 = [0.2, 0.95 + 0.6 * t, 2.8 + 2.6 * t];
  return cam(eye, [0.35, 0.5, 0], 36, dist(eye, [0.3, 0.4, 0]));
};
function Check() {
  const f = useCurrentFrame() + S.check;
  const sweep = ((f - S.check) % 60) / 60;
  return (
    <>
      <Mesh3d name="s10-aria" transform={T(0.9, 0.24, -0.4)}><Text3D size={0.5} depth={0.12}>Aria</Text3D>
        <StandardMaterial base_color="#24090e" perceptual_roughness={0.25} emissive={glow(CORAL, 1.4)} /></Mesh3d>
      <Mesh3d name="s10-sphere" transform={T(-0.35, 0.3, 0.2)}><Sphere radius={0.3} /><StandardMaterial base_color="#8a0f1e" perceptual_roughness={0.1} clearcoat={1} clearcoat_perceptual_roughness={0.04} /></Mesh3d>
      <Mesh3d name="s10-slab" transform={T(0.25, 0.55, 0.45, 0, -0.3, 0)}><Cuboid half_size={[0.32, 0.45, 0.025]} /><StandardMaterial base_color="#ffffff" specular_transmission={1} ior={1.5} thickness={0.05} perceptual_roughness={0.04} /></Mesh3d>
      <Mesh3d name="s10-cube" transform={T(1.9, 0.22, 0.1, 0, 0.6, 0)}><Cuboid half_size={[0.22, 0.22, 0.22]} /><StandardMaterial base_color="#b8bec6" metallic={0.6} perceptual_roughness={0.15} /></Mesh3d>
      <RectLight transform={Transform.fromXyz(0.4, 2.8, 1.6).lookingAt([0.4, 0.2, 0])} intensity={420000} width={2.4} height={0.6} color="#FFE6CC" />
      <PointLight name="s10-warm" transform={Transform.fromXyz(-1.4, 1.0, 1.2)} intensity={250000} color={TUNG} range={6} />
      <RectLight transform={Transform.fromXyz(3.2, 1.2, -1).lookingAt([0.5, 0.4, 0])} intensity={80000} width={0.5} height={1.5} color={TEAL} />
      <div style={{ position: "absolute", left: 60, top: 120, width: W - 120, height: H - 240, border: `2px dashed ${TEAL}`, boxSizing: "border-box", opacity: ramp(f, S.check + 4, S.check + 12) }} />
      <div style={{ position: "absolute", left: 76, top: 132, fontFamily: MONO, fontSize: 22, color: TEAL, opacity: ramp(f, S.check + 8, S.check + 16) }}>safe area · 120 px top/bottom · 60 px sides</div>
      <div style={{ position: "absolute", left: 60, top: 120 + sweep * (H - 240), width: W - 120, height: 3, backgroundColor: TEAL }} />
      <div style={{ position: "absolute", left: 110, top: 220, width: 520, borderRadius: 18, backgroundColor: "#0E1116", border: "2px solid #262C35", boxSizing: "border-box", padding: 28,
        display: "flex", flexDirection: "column", gap: 16, opacity: ramp(f, S.check + 6, S.check + 14) }}>
        <div style={{ fontFamily: MONO, fontSize: 24, color: DIM }}>aria check · out/teaser.mp4</div>
        {CHECKS.map((c, i) => {
          const on = f >= XCUE[i];
          return (
            <div key={c.item} style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: BODY, fontSize: 34, color: on ? INK : DIM }}>{c.item}</span>
              <span style={{ fontFamily: HEAD, fontSize: 40, color: c.ok ? GREEN : CORAL, opacity: on ? 1 : 0, transform: `scale(${on ? 1 + 0.3 * (1 - ramp(f, XCUE[i], XCUE[i] + 6)) : 1})` }}>{c.ok ? "✓" : "✗"}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ===== S11 how it works (shot)
const TERM: V3 = [-1.7, 0.6, 0.3];
const TERM_HW = 0.78, TERM_HH = 0.44;
const NODE = (k: number): V3 => [k * 1.0, 0, -0.2];
const NODE_Y = 0.33, NODE_HW = 0.4, NODE_HH = 0.27;
const mixCam = (x: Cam, y: Cam, t: number): Cam => ({ eye: lerp3(x.eye, y.eye, t), look: lerp3(x.look, y.look, t), fov: x.fov, focus: x.focus + (y.focus - x.focus) * t });
const howCam = (_lf: number, f: number): Cam => {
  const term = cam(add(TERM, [0.12, 0.1, 2.05 - 0.15 * ease((f - S.how) / 60)]), TERM, 36, 2.0);
  let s = 0;
  for (let k = 1; k < 5; k++) s += ease((f - (NODES[k].at - 12)) / 10);
  const p = lerp3(NODE(Math.floor(s)), NODE(Math.min(6, Math.floor(s) + 1)), s - Math.floor(s));
  const d = 1.3 + 0.7 * ease((f - NODES[0].at) / (NODES[4].at - NODES[0].at + 20));
  const rowEye = add(p, [0.25, 0.4 + 0.2 * (d - 1.3), d]);
  const row = cam(rowEye, add(p, [0.12, NODE_Y + 0.05, 0]), 36, dist(rowEye, add(p, [0, NODE_Y, 0])));
  const wideEye: V3 = [3.0, 1.45, 6.6];
  const wide = cam(wideEye, [3.0, 0.62, -0.2], 36, dist(wideEye, add(NODE(5.5), [0, NODE_Y, 0])));
  const a = ease((f - (L(PL) - 16)) / 18), b = ease((f - (L(RL) - 10)) / 22);
  return mixCam(mixCam(term, row, a), wide, b);
};
/** a monospace size at which every line fits w x h */
const monoFit = (lines: string[], w: number, h: number, max: number) =>
  Math.max(16, Math.min(max, w / (0.56 * Math.max(...lines.map((l) => l.length))), h / (1.3 * lines.length)));
function NodeCard({ k, f, c }: { k: number; f: number; c: Cam }) {
  const p = NODE(k);
  const r = projRect(c, [p[0] - NODE_HW, NODE_Y + NODE_HH, p[2] + 0.02], [p[0] + NODE_HW, NODE_Y - NODE_HH, p[2] + 0.02]);
  const padX = r.w * 0.08, padY = r.h * 0.09;
  const box = fitBox({ x: r.x + padX, y: r.y + padY, w: r.w - 2 * padX, h: r.h - 2 * padY });
  if (!inSafe(box) || box.w < 140 || f < L(PL) - 10) return null;
  const on = f >= NODES[k].at;
  const big = box.w >= 330;
  const label = big ? Math.max(44, Math.min(64, box.h * 0.17)) : 26;
  const w3 = LINES[3];
  const cw = w3.words[w3.words.length - 1];
  const ch = box.h - label * 1.35 - 12;
  const txt: string[][] = [
    [(SCRIPT as any).lines[3].say],
    ["line04.wav"],
    [`heard "${w3.tries[0].heard}"`, `✓ try 1 · ok`],
    [`{"w": "${cw.w}",`, ` "s": ${cw.s.toFixed(2)},`, ` "e": ${cw.e.toFixed(2)}}`],
    ["const f = useCurrentFrame();", `f = ${f}`],
    [`1920×1080 · ${FPS} fps`, `${DURATION} frames`],
    [...CHECKS.map((x) => `${x.ok ? "✓" : "✗"} ${x.item}`), "→ teaser.mp4"],
  ];
  const fs = monoFit(txt[k], box.w, k === 1 ? ch * 0.3 : ch, 48);
  const body = k === 1 ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Waveform line={3} f={on ? 99999 : 0} color={TEAL} w={box.w} h={ch * 0.62} />
      <span style={{ fontFamily: MONO, fontSize: fs, color: DIM }}>{txt[1][0]}</span>
    </div>
  ) : (
    <div style={{ display: "flex", flexDirection: "column", gap: fs * 0.25 }}>
      {txt[k].map((t, i) => (
        <span key={i} style={{ fontFamily: MONO, fontSize: k === 4 && i === 1 ? fs * 1.5 : fs, whiteSpace: "pre",
          color: k === 4 && i === 1 ? CORAL : t.startsWith("✓") ? GREEN : INK }}>{t}</span>
      ))}
    </div>
  );
  return (
    <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={{ fontFamily: HEAD, fontSize: label, color: on ? CORAL : "#AEB6C0", lineHeight: 1.1 }}>{k + 1} {NODES[k].name}</span>
      {big && on ? body : null}
    </div>
  );
}
function How() {
  const f = useCurrentFrame() + S.how;
  const c = camAt(f);
  const t0 = WORD(AL, "you"), t1 = LE(AL) - 2;
  const n = Math.max(0, Math.min(REQUEST.length, Math.floor(((f - t0) / (t1 - t0)) * REQUEST.length)));
  const r = projRect(c, [TERM[0] - TERM_HW, TERM[1] + TERM_HH, TERM[2] + 0.09], [TERM[0] + TERM_HW, TERM[1] - TERM_HH, TERM[2] + 0.09]);
  const box = fitBox({ x: r.x + 40, y: r.y + 40, w: r.w - 80, h: r.h - 80 });
  const local = f >= L(RL) - 4;
  const parts = [];
  for (let k = 0; k < NODES.length; k++) {
    const p = NODE(k), on = f >= NODES[k].at;
    const hot = on ? 1 + 2 * (1 - ramp(f, NODES[k].at, NODES[k].at + 10)) : 0;
    const tail = k >= 5 && local ? 1.6 + 0.4 * Math.sin(f * 0.25) : 1;
    parts.push(
      <Mesh3d key={`g${k}`} name={`s11-node${k}`} transform={T(p[0], NODE_Y, p[2])}><Cuboid half_size={[NODE_HW, NODE_HH, 0.015]} />
        <StandardMaterial base_color="#ffffff" specular_transmission={1} ior={1.5} thickness={0.03} perceptual_roughness={0.04} /></Mesh3d>,
      ...([["t", 0, NODE_HH, NODE_HW, 0.005], ["b", 0, -NODE_HH, NODE_HW, 0.005], ["l", -NODE_HW, 0, 0.005, NODE_HH], ["r", NODE_HW, 0, 0.005, NODE_HH]] as [string, number, number, number, number][]).map(([e, x, y, hx, hy]) => (
        <Mesh3d key={`e${k}${e}`} name={`s11-node${k}-${e}`} transform={T(p[0] + x, NODE_Y + y, p[2])}><Cuboid half_size={[hx + 0.005, hy + 0.005, 0.018]} />
          <StandardMaterial base_color="#000000" emissive={glow(k >= 5 ? TEAL : CORAL, on ? 2.5 * hot * tail : 0.25)} /></Mesh3d>
      )),
      <Mesh3d key={`b${k}`} name={`s11-node${k}-base`} transform={T(p[0], 0.025, p[2])}><Cuboid half_size={[NODE_HW + 0.02, 0.025, 0.06]} />
        <StandardMaterial base_color="#a2a8b0" metallic={0.6} perceptual_roughness={0.15} /></Mesh3d>,
    );
    if (k < 6) parts.push(
      <Mesh3d key={`l${k}`} name={`s11-link${k}`} transform={T(p[0] + 0.5, 0.006, p[2] - 0.12)}><Cuboid half_size={[0.5, 0.005, 0.006]} />
        <StandardMaterial base_color="#000000" emissive={glow(CORAL, f >= NODES[k + 1].at ? 5 : 0.15)} /></Mesh3d>,
    );
  }
  return (
    <>
      <Mesh3d name="s11-body" transform={T(TERM[0], TERM[1], TERM[2])}><Cuboid half_size={[TERM_HW + 0.03, TERM_HH + 0.03, 0.06]} /><StandardMaterial base_color="#23272e" metallic={0.6} perceptual_roughness={0.2} /></Mesh3d>
      <Mesh3d name="s11-glass" transform={T(TERM[0], TERM[1], TERM[2] + 0.075)}><Cuboid half_size={[TERM_HW, TERM_HH, 0.012]} />
        <StandardMaterial base_color="#ffffff" specular_transmission={1} ior={1.5} thickness={0.03} perceptual_roughness={0.03} /></Mesh3d>
      <Mesh3d name="s11-edge" transform={T(TERM[0], TERM[1] - TERM_HH - 0.03, TERM[2] + 0.07)}><Cuboid half_size={[TERM_HW, 0.005, 0.01]} /><StandardMaterial base_color="#000000" emissive={glow(TEAL, 3)} /></Mesh3d>
      <Mesh3d name="s11-stand" transform={T(TERM[0], 0.07, TERM[2])}><Cuboid half_size={[0.3, 0.07, 0.18]} /><StandardMaterial base_color="#a2a8b0" metallic={0.6} perceptual_roughness={0.15} /></Mesh3d>
      {parts}
      <RectLight transform={Transform.fromXyz(3, 2.4, 1.6).lookingAt([3, 0.2, -0.2])} intensity={200000} width={7} height={0.5} color="#FFE6CC" />
      <Mesh3d name="s11-wall" transform={T(3, 2.0, -2.6)}><Cuboid half_size={[9, 2.5, 0.05]} /><StandardMaterial base_color="#1c1f24" perceptual_roughness={0.55} /></Mesh3d>
      <RectLight transform={Transform.fromXyz(3, 3.4, -1.2).lookingAt([3, 0.6, -2.6])} intensity={220000} width={9} height={0.5} color={TEAL} />
      <RectLight transform={Transform.fromXyz(-1.2, 2.2, 2.0).lookingAt(TERM)} intensity={50000} width={1.2} height={0.4} color="#FFE6CC" />
      {inSafe(box) && f < L(PL) ? (
        <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, display: "flex", flexDirection: "column", gap: 14, fontFamily: MONO, fontSize: 34 }}>
          <div style={{ fontFamily: BODY, fontSize: 24, color: DIM }}>ask in plain words</div>
          <div style={{ color: INK, whiteSpace: "pre" }}><span style={{ color: TEAL }}>&gt; </span>{REQUEST.slice(0, n)}<span style={{ color: CORAL, opacity: Math.floor(f / 6) % 2 ? 1 : 0.25 }}>▍</span></div>
        </div>
      ) : null}
      {NODES.map((_, k) => <NodeCard key={k} k={k} f={f} c={c} />)}
      {f >= L(RL) + 6 ? <div style={{ position: "absolute", left: 160, top: 140, width: 1600, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, opacity: ramp(f, L(RL) + 6, L(RL) + 16) }}>
        <div style={{ fontFamily: HEAD, fontSize: 60, color: INK }}>runs locally on your PC</div>
        <div style={{ fontFamily: MONO, fontSize: 30, color: TEAL }}>{GPU}</div>
      </div> : null}
    </>
  );
}

// ===== S12 end card
const MON: V3 = [-0.35, 1.0, 0];
const MON_W = 1.56, MON_H = (MON_W * 900) / 1400;
const endCam = (lf: number): Cam => {
  const t = ease(lf / (S.done - 30 - S.end));
  const x = -0.12 + 0.3 * (1 - t);
  const eye: V3 = [x, 1.16, 4.3 - 1.7 * t];
  return cam(eye, [x - 0.02, 1.16, 0], 34, dist(eye, add(MON, [0, 0, 0.03])));
};
function End() {
  const f = useCurrentFrame() + S.end;
  const made = WORD(16, "made") - 4;
  const url = WORD(17, "find") - 4;
  const fade = ramp(f, S.done - 26, S.done - 2);
  return (
    <>
      <Mesh3d name="s12-bezel" transform={T(MON[0], MON[1], MON[2] - 0.01)}><Cuboid half_size={[MON_W / 2 + 0.028, MON_H / 2 + 0.028, 0.025]} /><StandardMaterial base_color="#7d838c" metallic={0.6} perceptual_roughness={0.18} /></Mesh3d>
      <Mesh3d name="s12-glass" transform={T(MON[0], MON[1], MON[2] + 0.0155)}><Cuboid half_size={[MON_W / 2 + 0.012, MON_H / 2 + 0.012, 0.001]} /><StandardMaterial base_color="#050608" perceptual_roughness={0.1} /></Mesh3d>
      <Mesh3d name="s12-screen" shadow={false} transform={T(MON[0], MON[1], MON[2] + 0.017)}><Cuboid half_size={[MON_W / 2, MON_H / 2, 0.0005]} />
        <StandardMaterial base_color="#000000" emissive={glow("#ffffff", 1.25)} emissive_texture={staticFile(SCREENSHOT)} perceptual_roughness={0.9} /></Mesh3d>
      <Mesh3d name="s12-neck" transform={T(MON[0], 0.25, -0.06)}><Cylinder radius={0.03} half_height={0.25} /><StandardMaterial base_color="#a2a8b0" metallic={0.6} perceptual_roughness={0.15} /></Mesh3d>
      <Mesh3d name="s12-foot" transform={T(MON[0], 0.012, -0.06)}><Cuboid half_size={[0.28, 0.012, 0.18]} /><StandardMaterial base_color="#a2a8b0" metallic={0.6} perceptual_roughness={0.15} /></Mesh3d>
      <Mesh3d name="s12-plinth" transform={T(0.92, 0.3, -0.05, 0, -0.3, 0)}><Cuboid half_size={[0.3, 0.3, 0.14]} /><StandardMaterial base_color="#0B0D10" perceptual_roughness={0.22} clearcoat={1} clearcoat_perceptual_roughness={0.04} /></Mesh3d>
      <Mesh3d name="s12-aria" transform={T(0.92, 0.72, -0.05, 0, -0.3, 0)}><Text3D size={0.24} depth={0.07}>Aria</Text3D>
        <StandardMaterial base_color="#24090e" perceptual_roughness={0.2} emissive={glow(CORAL, 1.4)} /></Mesh3d>
      <Fire name="s12-fire" position={[4.0, 0.02, -8]} scale={0.8} intensity={8} light={0.3} seed={5} />
      <Fuel at={[4.0, 0, -8]} name="s12" s={1.6} />
      <RectLight transform={Transform.fromXyz(1.4, 2.4, 2.2).lookingAt([-0.2, 0.8, 0])} intensity={120000} width={1.6} height={0.6} color="#FFE6CC" />
      <RectLight transform={Transform.fromXyz(-2.6, 1.2, -0.6).lookingAt([-0.3, 0.8, 0])} intensity={70000} width={0.5} height={1.6} color={TEAL} />
      {f >= made ? <div style={{ position: "absolute", left: 160, top: 142, width: 1600, textAlign: "center", fontFamily: HEAD, fontSize: 64, color: INK, opacity: ramp(f, made, made + 10) }}>
        made with the <span style={{ color: CORAL }}>Aria</span> skill
      </div> : null}
      {f >= url ? <div style={{ position: "absolute", left: 160, top: 230, width: 1600, display: "flex", justifyContent: "center", opacity: ramp(f, url, url + 8) }}>
        <div style={{ padding: "10px 30px", borderRadius: 14, backgroundColor: "#0E1116", border: `2px solid ${CORAL}`, fontFamily: MONO, fontSize: 52, color: INK }}>{REPO}</div>
      </div> : null}
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, backgroundColor: "#000000", opacity: fade }} />
    </>
  );
}

// ===== the shot table and the one camera
const SHOTS: Shot[] = [
  { name: "open", from: S.open, enter: "cut", cam: openCam },
  { name: "title", from: S.title, enter: "pitch", cam: titleCam },
  { name: "voice", from: S.voice, enter: "yaw", cam: voiceCam },
  { name: "hear", from: S.hear, enter: "yaw", cam: hearCam },
  { name: "words", from: S.words, enter: "yaw", cam: wordsCam },
  { name: "code", from: S.code, enter: "yawL", cam: codeCam },
  { name: "mont", from: S.mont, enter: "yaw", cam: montCam },
  { name: "music", from: S.music, enter: "yawL", cam: musicCam },
  { name: "check", from: S.check, enter: "yaw", cam: checkCam },
  { name: "how", from: S.how, enter: "yawL", cam: howCam },
  { name: "end", from: S.end, enter: "yaw", cam: endCam },
];
const shotAt = (f: number) => { let k = 0; for (let i = 0; i < SHOTS.length; i++) if (f >= SHOTS[i].from) k = i; return k; };
function turn(c: Cam, axis: Enter, a: number): Cam {
  const d = sub(c.look, c.eye), r = len(d);
  let n: V3;
  if (axis === "pitch") {
    const h = Math.hypot(d[0], d[2]), el = Math.atan2(d[1], h) + a * 0.55;
    n = [(d[0] / h) * Math.cos(el) * r, Math.sin(el) * r, (d[2] / h) * Math.cos(el) * r];
  } else {
    const th = axis === "yawL" ? a : -a;
    n = [d[0] * Math.cos(th) + d[2] * Math.sin(th), d[1], -d[0] * Math.sin(th) + d[2] * Math.cos(th)];
  }
  return { ...c, look: add(c.eye, n), blur: true };
}
function camAt(f: number): Cam {
  const k = shotAt(f), s = SHOTS[k];
  const c = s.cam(f - s.from, f);
  if (s.enter !== "cut" && f - s.from < WH) return turn(c, s.enter, -WA * Math.pow(1 - (f - s.from + 1) / (WH + 1), 2));
  const nx = SHOTS[k + 1];
  if (nx && nx.enter !== "cut" && nx.from - f <= WH) return turn(c, nx.enter, WA * Math.pow(1 - (nx.from - f) / (WH + 1), 2));
  return c;
}

// ---- karaoke captions
function Captions({ f }: { f: number }) {
  const i = LINES.findIndex((ln, n) => f >= fr(ln.start) - 2 && f < (n + 1 < LINES.length ? Math.min(fr(LINES[n + 1].start) - 2, fr(ln.end) + 36) : fr(ln.end) + 36));
  if (i < 0) return null;
  const words = LINES[i].words;
  const cur = words.reduce((n, w, k) => (f >= fr(w.s) ? k : n), -1);
  const long = LINES[i].text.length > 60;
  let cut = words.length;
  if (long) {
    const total = LINES[i].text.length;
    let best = Infinity, run = 0;
    words.forEach((w, k) => {
      run += w.w.length + 1;
      const cost = Math.abs(total - 2 * run) - (w.w.endsWith(",") ? 30 : 0);
      if (k < words.length - 1 && cost < best) { best = cost; cut = k + 1; }
    });
  }
  const row = (a: number, b: number) => (
    <div style={{ display: "flex", flexDirection: "row", justifyContent: "center", gap: 14 }}>
      {words.slice(a, b).map((w, j) => {
        const k = a + j;
        return (
          <span key={k} style={{ fontFamily: BODY, fontWeight: 700, fontSize: long ? 42 : 46, color: k === cur ? CORAL : k < cur ? INK : "#AEB6C0", whiteSpace: "pre",
            transform: `scale(${k === cur ? 1 + 0.06 * (1 - ramp(f, fr(w.s), fr(w.s) + 6)) : 1})` }}>{w.w}</span>
        );
      })}
    </div>
  );
  return (
    <div style={{ position: "absolute", left: 160, top: LINES[i].text.length > 60 ? 790 : 820, width: 1600, display: "flex", flexDirection: "row", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 26px", borderRadius: 16, backgroundColor: "rgba(11,13,16,0.72)", maxWidth: 1600 }}>
        {row(0, cut)}
        {long ? row(cut, words.length) : null}
      </div>
    </div>
  );
}

// ---- the film
function Film() {
  const f = useCurrentFrame();
  const c = camAt(f);
  const span = (a: number, b: number, el: any, name: string) => <Sequence from={a} durationInFrames={b - a} name={name}>{el}</Sequence>;
  return (
    <AbsoluteFill style={{ backgroundColor: CHAR }}>
      <Camera3d transform={Transform.fromXyz(c.eye[0], c.eye[1], c.eye[2]).lookingAt(c.look)} projection={{ Perspective: { fov: c.fov } }}>
        <DepthOfField focal_distance={c.focus} aperture_f_stops={2.0} />
      </Camera3d>
      <ToneMapping mode="agx" exposure={-0.3} />
      <Bloom intensity={0.22} threshold={1.2} />
      <Grade vignette={0.3} temperature={0.05} aberration={0.003} />
      <AmbientOcclusion quality="high" />
      <Shadows distance={16} firstCascade={4} mapSize={4096} />
      <VolumetricFog ambient={0} />
      {c.blur ? <MotionBlur shutterAngle={1} samples={8} /> : null}
      <AmbientLight brightness={22} color="#B8C4D8" />
      <Mesh3d name="floor" transform={T(0, -0.05, 0)}>
        <Cuboid half_size={[200, 0.05, 200]} />
        <StandardMaterial base_color="#0B0D10" perceptual_roughness={0.22} clearcoat={1} clearcoat_perceptual_roughness={0.04} />
      </Mesh3d>
      {span(S.open, S.title, <Open />, "S1 ember open")}
      {span(S.title, S.voice, <Title />, "S2 title")}
      {span(S.voice, S.hear, <Voice />, "S3-S4 voices")}
      {span(S.hear, S.words, <Hear />, "S5 hearing check")}
      {span(S.words, S.code, <Words />, "S6 word timing")}
      {span(S.code, S.mont, <Code />, "S7 code is the scene")}
      {span(S.mont, S.music, <Montage />, "S8 elements")}
      {span(S.music, S.check, <Music />, "S9 music")}
      {span(S.check, S.how, <Check />, "S10 export check")}
      {span(S.how, S.end, <How />, "S11 how it works")}
      {span(S.end, S.done, <End />, "S12 end")}
      <Captions f={f} />
      <Audio name="narration" src={staticFile("vo/narration.wav")} bus="voice" gainDb={0} />
      <Mix lufs={-14} ceiling={-1.5} />
    </AbsoluteFill>
  );
}

registerRoot(() => <Composition id="aria-teaser" component={Film} width={W} height={H} fps={FPS} durationInFrames={DURATION} />);
