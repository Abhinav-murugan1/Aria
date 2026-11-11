"""The aria CLI without a GPU: help, errors and `aria new`."""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLI = os.path.join(ROOT, "tools", "aria.py")
VERBS = ["new", "voice", "voice-preset", "say", "meter", "still", "render", "check", "make", "share", "doctor", "engine"]


def aria(*args, cwd=None):
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    return subprocess.run([sys.executable, CLI, *args], cwd=cwd, capture_output=True, text=True, encoding="utf-8",
                          env=env)


def test_help_lists_every_verb():
    for flag in ([], ["--help"], ["help"]):
        r = aria(*flag)
        assert r.returncode == 0
        assert "usage: aria <command>" in r.stdout
        for verb in VERBS:
            assert f"\n  {verb} " in r.stdout, verb


def test_unknown_command_fails():
    r = aria("nope")
    assert r.returncode != 0
    assert "unknown command 'nope'" in r.stderr


def test_usage_errors_fail():
    for verb in ("new", "make", "share", "still"):
        r = aria(verb)
        assert r.returncode != 0 and "usage: aria" in r.stderr, verb


def test_new_copies_the_template(tmp_path):
    r = aria("new", "film", "--shape", "16:9", cwd=tmp_path)
    assert r.returncode == 0, r.stderr
    proj = tmp_path / "film"
    for f in ("edit.tsx", "script.json", os.path.join("aria", "index.ts")):
        assert (proj / f).is_file(), f
    for d in ("media", "out", "stills"):
        assert (proj / d).is_dir(), d
    edit = (proj / "edit.tsx").read_text(encoding="utf-8")
    assert "const W = 1920, H = 1080;" in edit
    assert "1920x1080" in r.stdout


def test_new_defaults_to_vertical(tmp_path):
    assert aria("new", "short", cwd=tmp_path).returncode == 0
    assert "const W = 1080, H = 1920;" in (tmp_path / "short" / "edit.tsx").read_text(encoding="utf-8")


def test_new_square(tmp_path):
    assert aria("new", "sq", "--shape", "1:1", cwd=tmp_path).returncode == 0
    assert "const W = 1080, H = 1080;" in (tmp_path / "sq" / "edit.tsx").read_text(encoding="utf-8")


def test_new_refuses_to_overwrite(tmp_path):
    (tmp_path / "taken").mkdir()
    r = aria("new", "taken", cwd=tmp_path)
    assert r.returncode != 0 and "already exists" in r.stderr
