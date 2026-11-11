---
description: Check the Aria environment (engine, ffmpeg, GPU, voice) and say how to fix it
allowed-tools: Bash(aria doctor:*), Bash(python:*), Bash(ls:*)
---
Run `aria doctor` and check that `~/.claude/skills/aria*` and `~/.claude/commands/aria-*.md` exist. Report each
problem with its fix (`./install.ps1`, `./install.ps1 -Voice`, `winget install Gyan.FFmpeg`). Do not install or
change anything yourself unless the user says yes, and never touch system or security settings.
