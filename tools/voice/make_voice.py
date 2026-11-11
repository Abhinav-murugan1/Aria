"""aria voice: make a new expressive voice preset to clone from.

    python make_voice.py OUT.wav --kokoro af_heart          # start from a Kokoro voice (no recording needed)
    python make_voice.py OUT.wav --sample my-read.wav       # start from a recording you own or have rights to

Why two steps: Turbo clones the *delivery* of its sample as well as the timbre. A flat sample gives a flat narrator.
So the base voice first reads a few lively lines through the original Chatterbox with high exaggeration, and that
expressive read becomes the preset. Narrate with it: narrate.py ... --voice OUT.wav

Kokoro voices (need tools/voice/.venv-kokoro and models/kokoro-v1.0.onnx + voices-v1.0.bin; install.ps1 -Voice):
  af_heart (warm female, explainers)  am_adam (male, stories/horror)  af_bella  am_michael  bf_emma  bm_george ...
Only clone voices you own or have permission to use.
"""
import argparse
import os
import tempfile

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
LINES = [
    ("Okay, this one honestly surprised me!", 1.0, 0.35),
    ("It happens every single day...", 0.8, 0.35),
    ("and almost nobody notices it.", 0.7, 0.3),
    ("Isn't that wild?", 1.0, 0.35),
]
BASE_TEXT = ("Hello! This is a short reading so the narrator can learn my voice. I speak clearly, at an easy pace, "
             "and I sound like I enjoy telling you about it.")


def kokoro_sample(voice, out):
    """Kokoro lives in its own venv (it needs numpy 2; Chatterbox needs numpy 1)."""
    import subprocess
    py = os.path.join(HERE, ".venv-kokoro", "Scripts" if os.name == "nt" else "bin", "python.exe" if os.name == "nt" else "python")
    subprocess.check_call([py, os.path.join(HERE, "kokoro_say.py"), voice, "1.0", out, BASE_TEXT])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--kokoro", help="Kokoro voice name, e.g. af_heart")
    src.add_argument("--sample", help="a clean 5-20 s recording to start from")
    ap.add_argument("--exaggeration", type=float, default=0.6)
    args = ap.parse_args()

    base = args.sample
    if args.kokoro:
        base = os.path.join(tempfile.mkdtemp(), "base.wav")
        kokoro_sample(args.kokoro, base)

    import torch
    from chatterbox.tts import ChatterboxTTS
    tts = ChatterboxTTS.from_pretrained(device="cuda" if torch.cuda.is_available() else "cpu")
    tts.prepare_conditionals(base, exaggeration=args.exaggeration)
    parts = []
    for i, (text, ex, cfg) in enumerate(LINES):
        torch.manual_seed(7 + i)
        a = tts.generate(text, exaggeration=ex, cfg_weight=cfg, temperature=0.8).squeeze(0).cpu().numpy()
        parts += [a, np.zeros(int(0.25 * tts.sr), dtype=np.float32)]
    sf.write(args.out, np.concatenate(parts), tts.sr)
    print(f"aria voice preset: {args.out} ({sum(len(p) for p in parts) / tts.sr:.1f}s)")


if __name__ == "__main__":
    main()
