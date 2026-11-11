"""Brand guard: the render engine's name may appear only where the code has to call the engine.

    python scripts/brand-guard.py               # tracked files (what CI sees)
    python scripts/brand-guard.py --untracked   # also untracked, not-ignored files (before a commit)

Exits 1 and lists every file:line outside the allowed locations.
"""
import fnmatch
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAME = re.compile(r"\b" + bytes([114, 97, 101, 97]).decode() + r"\b", re.I)  # spelled as bytes so this file passes
ALLOWED = [
    "templates/short/aria/*.ts",
    "examples/*/aria/*.ts",
    "tools/aria.py",
    "install.ps1",
    "scripts/uninstall.ps1",
]


def files(untracked):
    args = ["git", "ls-files", "-z", "--cached"] + (["--others", "--exclude-standard"] if untracked else [])
    out = subprocess.run(args, cwd=ROOT, capture_output=True, check=True).stdout
    return sorted({p for p in out.decode("utf-8").split("\0") if p})


def allowed(path):
    return any(fnmatch.fnmatchcase(path, pat) and path.count("/") == pat.count("/") for pat in ALLOWED)


def main():
    bad = []
    for rel in files("--untracked" in sys.argv[1:]):
        path = os.path.join(ROOT, rel)
        if allowed(rel) or not os.path.isfile(path):
            continue
        if NAME.search(rel):
            bad.append(f"{rel}: (in the path)")
        data = open(path, "rb").read()
        if b"\0" in data[:8192]:  # binary
            continue
        for n, line in enumerate(data.decode("utf-8", "replace").splitlines(), 1):
            if NAME.search(line):
                bad.append(f"{rel}:{n}: {line.strip()[:120]}")
    if bad:
        print("brand-guard: the engine name appears outside the allowed files:\n  " + "\n  ".join(bad))
        sys.exit(1)
    print("brand-guard: ok")


if __name__ == "__main__":
    main()
