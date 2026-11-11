"""aria: make videos and voices from code. One command for the whole pipeline.

usage: aria <command> [args]

  new NAME [--shape 9:16|16:9|1:1]     start a project from the template (edit.tsx, script.json, aria/ SDK)
  voice SCRIPT.json OUT_DIR [...]      expressive narration + word-timed captions (narrate.py flags pass through)
  voice-preset OUT.wav --kokoro NAME   make a new expressive voice to clone (or --sample REC.wav)
  say VOICE SPEED OUT.wav "text"       quick Kokoro line (drafts, timing passes)
  meter FILE.wav ...                   emotion meter: pitch spread / range of a narration
  still EDIT.tsx FRAMES [DIR]          render stills to look at (FRAMES like 0,90,300)
  render EDIT.tsx -o OUT [...]         render video / PNG frames on the GPU
  check VIDEO.mp4 [...]                check an export: clipped text, safe areas, contrast, loudness, blotching
  make EDIT.tsx NAME [--dark]          render -> share encode -> check, into out/NAME.mp4 (+ NAME-raw.mp4)
  share IN.mp4 OUT.mp4 [--dark]        H.264/AAC copy any player and platform takes (--dark: deblock dark scenes)
  doctor                               check the engine, ffmpeg, GPU and the voice environment
  engine ARGS...                       pass anything else straight to the render engine
"""
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE_DIR = os.path.join(ROOT, "tools", "voice")
_ENGINE_NAME = re.compile(r"\braea\b", re.I)


def engine_path():
    env = os.environ.get("ARIA_ENGINE")
    if env and os.path.exists(env):
        return env
    exe = "raea.exe" if os.name == "nt" else "raea"
    for p in (os.path.join(os.path.expanduser("~"), ".raea", "bin", exe), shutil.which(exe)):
        if p and os.path.exists(p):
            return p
    sys.exit("aria: render engine not found. Run install.ps1 (or set ARIA_ENGINE to the engine binary).")


def voice_python(venv=".venv"):
    env = os.environ.get("ARIA_VOICE_PYTHON") if venv == ".venv" else None
    if env and os.path.exists(env):
        return env
    p = os.path.join(VOICE_DIR, venv, "Scripts" if os.name == "nt" else "bin", "python.exe" if os.name == "nt" else "python")
    if os.path.exists(p):
        return p
    sys.exit("aria: voice environment missing. Run install.ps1 -Voice (or set ARIA_VOICE_PYTHON).")


def run_engine(args, quiet=False):
    """Run the engine, speaking aria in its output."""
    proc = subprocess.Popen([engine_path(), *args], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                            encoding="utf-8", errors="replace")
    lines = []
    for line in proc.stdout:
        line = _ENGINE_NAME.sub("aria", line)
        lines.append(line)
        if not quiet and "WARN" not in line:
            sys.stdout.write(line)
            sys.stdout.flush()
    return proc.wait(), "".join(lines)


def run_voice(script, args, venv=".venv"):
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", PYTHONIOENCODING="utf-8", PYTHONWARNINGS="ignore")
    return subprocess.call([voice_python(venv), os.path.join(VOICE_DIR, script), *args], env=env)


def ffmpeg(args):
    return subprocess.call(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args])


def share(src, dst, dark=False):
    vf = ["-vf", "deblock=filter=strong:block=8,gradfun=strength=1.4:radius=16"] if dark else []
    crf = "17" if dark else "20"
    return ffmpeg(["-i", src, *vf, "-c:v", "libx264", "-preset", "slow", "-crf", crf, "-aq-mode", "3",
                   "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", dst])


def cmd_new(argv):
    if not argv:
        sys.exit("usage: aria new NAME [--shape 9:16|16:9|1:1]")
    name, shape = argv[0], argv[argv.index("--shape") + 1] if "--shape" in argv else "9:16"
    if os.path.exists(name):
        sys.exit(f"aria: {name} already exists")
    shutil.copytree(os.path.join(ROOT, "templates", "short"), name)
    w, h = {"9:16": (1080, 1920), "16:9": (1920, 1080), "1:1": (1080, 1080)}[shape]
    edit = os.path.join(name, "edit.tsx")
    src = open(edit, encoding="utf-8").read().replace("const W = 1080, H = 1920;", f"const W = {w}, H = {h};")
    open(edit, "w", encoding="utf-8").write(src)
    for d in ("media", "out", "stills"):
        os.makedirs(os.path.join(name, d), exist_ok=True)
    print(f"aria: new project {name} ({shape} {w}x{h})\n  1. write script.json   2. aria voice script.json media/vo\n"
          f"  3. edit edit.tsx        4. aria still edit.tsx 0,60,120   5. aria make edit.tsx {os.path.basename(name)}")


def cmd_make(argv):
    if len(argv) < 2:
        sys.exit("usage: aria make EDIT.tsx NAME [--dark]")
    edit, name = argv[0], argv[1]
    out = os.path.join(os.path.dirname(os.path.abspath(edit)), "out")
    os.makedirs(out, exist_ok=True)
    raw, final, man = (os.path.join(out, f"{name}-raw.mp4"), os.path.join(out, f"{name}.mp4"),
                       os.path.join(out, f"{name}.render.json"))
    code, _ = run_engine(["render", edit, "-o", raw, "--manifest", man, "--quality", "master"])
    if code:
        sys.exit(code)
    if share(raw, final, "--dark" in argv):
        sys.exit("aria: share encode failed")
    code, _ = run_engine(["check", final, "--manifest", man, "-o", os.path.join(out, f"{name}.check.json")])
    print(f"aria: {final} ({'check clean' if code == 0 else 'check found P0/P1 issues: read the check above'})")
    sys.exit(code)


def cmd_doctor(_):
    ok = True
    try:
        e = engine_path()
        print(f"engine   ok   {e}")
    except SystemExit as x:
        print(f"engine   MISSING  {x}")
        ok = False
    print(f"ffmpeg   {'ok' if shutil.which('ffmpeg') else 'MISSING (winget install Gyan.FFmpeg)'}")
    ok &= bool(shutil.which("ffmpeg"))
    gpu = subprocess.run(["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"], capture_output=True,
                         text=True) if shutil.which("nvidia-smi") else None
    print(f"gpu      {gpu.stdout.strip() if gpu and gpu.returncode == 0 else 'no NVIDIA GPU seen (voice runs on CPU, slowly)'}")
    p = os.path.join(VOICE_DIR, ".venv", "Scripts" if os.name == "nt" else "bin")
    print(f"voice    {'ok' if os.path.exists(p) or os.environ.get('ARIA_VOICE_PYTHON') else 'not installed (install.ps1 -Voice)'}")
    models = os.path.exists(os.path.join(VOICE_DIR, "models", "kokoro-v1.0.onnx"))
    print(f"kokoro   {'ok' if models else 'models missing (install.ps1 -Voice)'}")
    sys.exit(0 if ok else 1)


def main():
    for stream in (sys.stdout, sys.stderr):  # the engine prints arrows and quotes; Windows consoles default to cp1252
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help", "help"):
        print(__doc__)
        return
    cmd, argv = sys.argv[1], sys.argv[2:]
    if cmd == "new":
        cmd_new(argv)
    elif cmd == "voice":
        sys.exit(run_voice("narrate.py", argv))
    elif cmd == "voice-preset":
        sys.exit(run_voice("make_voice.py", argv))
    elif cmd == "say":
        sys.exit(run_voice("kokoro_say.py", argv, ".venv-kokoro"))
    elif cmd == "meter":
        sys.exit(run_voice("meter.py", argv))
    elif cmd == "still":
        if len(argv) < 2:
            sys.exit("usage: aria still EDIT.tsx 0,90,300 [DIR]")
        sys.exit(run_engine(["render", argv[0], "--at", argv[1], "-o", (argv[2] if len(argv) > 2 else "stills") + "/"])[0])
    elif cmd in ("render", "check"):
        sys.exit(run_engine([cmd, *argv])[0])
    elif cmd == "make":
        cmd_make(argv)
    elif cmd == "share":
        if len(argv) < 2:
            sys.exit("usage: aria share IN.mp4 OUT.mp4 [--dark]")
        sys.exit(share(argv[0], argv[1], "--dark" in argv))
    elif cmd == "doctor":
        cmd_doctor(argv)
    elif cmd == "engine":
        sys.exit(run_engine(argv)[0])
    else:
        sys.exit(f"aria: unknown command {cmd!r}. aria help lists them.")


if __name__ == "__main__":
    main()
