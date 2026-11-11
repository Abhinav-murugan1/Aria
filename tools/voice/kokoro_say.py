"""aria voice: fast, clean, non-cloned speech with Kokoro (CPU is fine). Good for drafts and timing passes.

    python kokoro_say.py VOICE SPEED OUT.wav "text"
    python kokoro_say.py --list

Models: tools/voice/models/kokoro-v1.0.onnx and voices-v1.0.bin (install.ps1 downloads them).
Never stretch vowels in phonemes for stress: it bends words. Stress with pace, pauses and punctuation (! ? ...).
"""
import os
import sys

import soundfile as sf
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
k = Kokoro(os.path.join(HERE, "models", "kokoro-v1.0.onnx"), os.path.join(HERE, "models", "voices-v1.0.bin"))

if sys.argv[1] == "--list":
    print(" ".join(sorted(k.get_voices())))
    sys.exit(0)

voice, speed, out, text = sys.argv[1], float(sys.argv[2]), sys.argv[3], sys.argv[4]
samples, rate = k.create(text, voice=voice, speed=speed, lang="en-us" if voice[0] == "a" else "en-gb")
sf.write(out, samples, rate)
print(f"{out}: {len(samples) / rate:.2f} s at {rate} Hz")
