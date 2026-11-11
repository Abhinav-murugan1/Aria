"""aria voice: the emotion meter. How much a narration moves, in numbers, so "more emotion" can be checked.

    python meter.py FILE.wav [FILE.wav ...] [--json OUT.json]

Prints median pitch, pitch spread (std of voiced f0, semitones), pitch range (5th-95th percentile) and loudness
range. Judge spread on whole narrations (20 s or more): flat TTS sits near 2-2.5 st, lively human narration
around 4-6 st. On a single short line, compare median pitch and range between emotions instead.
"""
import json
import os
import sys

import librosa
import numpy as np

args = sys.argv[1:]
out = None
if "--json" in args:
    out = args[args.index("--json") + 1]
    args = [a for a in args if a not in ("--json", out)]
res = {}
for f in args:
    y, sr = librosa.load(f, sr=22050)
    f0, voiced, _ = librosa.pyin(y, fmin=60, fmax=500, sr=sr)
    st = 12 * np.log2(f0[voiced & ~np.isnan(f0)] / 100)
    rms = librosa.feature.rms(y=y)[0]
    db = 20 * np.log10(rms[rms > 1e-3])
    r = {"median_hz": round(float(100 * 2 ** (np.median(st) / 12)), 1), "spread": round(float(st.std()), 2),
         "range": round(float(np.percentile(st, 95) - np.percentile(st, 5)), 2),
         "loudness_range": round(float(np.percentile(db, 95) - np.percentile(db, 10)), 1), "seconds": round(len(y) / sr, 2)}
    res[os.path.splitext(os.path.basename(f))[0]] = r
    verdict = "" if r["seconds"] < 15 else " | flat" if r["spread"] < 2.8 else " | lively" if r["spread"] >= 4 else " | ok"
    print(f"{f}: median {r['median_hz']:4.0f} Hz | spread {r['spread']:3.1f} st | range {r['range']:4.1f} st | "
          f"loudness range {r['loudness_range']:4.1f} dB{verdict}")
if out:
    json.dump(res, open(out, "w", encoding="utf-8"), indent=1)
