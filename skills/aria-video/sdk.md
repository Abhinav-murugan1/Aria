# Aria SDK: what to import

Every composition imports from the project's `aria/` bridge. Main entry `./aria`; the rest by area.

## `./aria` (core)
- Structure: `registerRoot`, `Composition` (id, component, width, height, fps, durationInFrames), `AbsoluteFill`,
  `Sequence` (from, durationInFrames, name), `Series`, `Loop`, `Freeze`.
- Time: `useCurrentFrame()`, `useVideoConfig()` (width, height, fps, durationInFrames).
- Motion: `interpolate(f, inRange, outRange, {extrapolateLeft, extrapolateRight})`, `spring`, `Easing`,
  ready moves `fade`, `rise`, `slide`, `pop`, `slam`, `wipe`, `pushIn`, `stagger`.
- Media: `staticFile("path/in/media")`, `Img`, `Video`, `Audio` (src, bus: "voice"|"music"|"sfx", gainDb, name).
- Mix: `<Mix lufs={-14} ceiling={-1.5} />` once per film: loudness-normalises the whole mix.
- Words: `useWords`, `word("phrase")`, `findPhrase` for footage with a words.json (cut-by-words workflows).
- Games: `useGameState(initial, step)`, `useInput()` (pure `step`, keys in).

## `./aria/tone` (music and sound design)
Tone.js inside the render: `Tone.PolySynth`, `Tone.Synth`, `Tone.FMSynth`, `Tone.MembraneSynth`, `Tone.NoiseSynth`,
`Tone.Filter`, `Tone.Reverb`, `Tone.Part`, `Tone.getTransport()`, buses `Tone.buses.music | voice | sfx` with
`.volume`, `.duck(otherBus, {amount})`, `.volume.rampTo(db, seconds, at)`. See music.md.

## 3D (see 3d.md)
| import | gives |
|---|---|
| `./aria/camera` | `Camera3d` (transform, projection `{ Perspective: { fov } }`; children: post effects like `DepthOfField`) |
| `./aria/light` | `AmbientLight` (brightness, color), `DirectionalLight` (illuminance, shadow_maps_enabled), `PointLight` (intensity, range), `SpotLight` |
| `./aria/mesh` | `Mesh3d` (transform, name) with a shape child: `Cuboid` (half_size), `Sphere`, `Cylinder`, `Capsule3d`, `Torus`, `Plane3d`, `Cone` |
| `./aria/pbr` | `StandardMaterial` (base_color, metallic, perceptual_roughness, emissive, base_color_texture), `Fog`, `ToonMaterial` |
| `./aria/3d` | `Text3D` (size, depth; child text), `Bloom` (intensity, threshold), `Entity` (group with a transform), `Physics` |
| `./aria/transform` | `Transform.fromXyz(x,y,z)`, `.withRotation(Quat.fromEuler("XYZ", rx, ry, rz))`, `.withScale([sx,sy,sz])`, `.lookingAt([x,y,z])` |
| `./aria/color` | `Srgba.hex("#8b5cf6")`, `LinearRgba.from(c).mul(k)` (emissive above 1 glows with Bloom) |
| `./aria/math` | `Affine2` (texture uv transforms) |
| `./aria/post_process` | `Bloom`, `DepthOfField`, `MotionBlur`, `Grade`, `ToneMapping` |
| `./aria/text` | `Text3D`, `RichText` |

2D UI (divs, text, images) draws over the 3D view in the same frame: put 3D first in the tree, UI after.
