"""Per-frame loudness envelope of the narration (30 fps), for waveforms drawn from the real audio.

    tools/voice/.venv/Scripts/python.exe examples/teaser/env.py examples/teaser/media/vo/narration.wav examples/teaser/media/env.json
"""
import json
import sys

import numpy as np
import soundfile as sf

FPS = 30
a, sr = sf.read(sys.argv[1], dtype="float32")
if a.ndim > 1:
    a = a.mean(axis=1)
hop = sr / FPS
n = int(len(a) / hop) + 1
rms = []
for i in range(n):
    seg = a[int(i * hop): int((i + 1) * hop)]
    rms.append(float(np.sqrt(np.mean(seg ** 2))) if len(seg) else 0.0)
rms = np.array(rms)
db = 20 * np.log10(np.maximum(rms, 1e-5))
json.dump({"fps": FPS, "rms": [round(float(x), 4) for x in rms], "db": [round(float(x), 1) for x in db],
           "peak": round(float(rms.max()), 4)}, open(sys.argv[2], "w"), separators=(",", ":"))
print(f"env: {n} frames, peak rms {rms.max():.3f}")
