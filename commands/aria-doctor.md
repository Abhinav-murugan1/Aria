---
description: Check the Aria environment (engine, ffmpeg, GPU, voice) and say how to fix it
allowed-tools: Bash(aria doctor:*), Bash(python:*), Bash(ls:*)
---
Run `aria doctor` (if `aria` is not on PATH: `python "${CLAUDE_PLUGIN_ROOT}/tools/aria.py" doctor`) and check that
the Aria skills are loaded (the Aria plugin, or `~/.claude/skills/aria*`). Report each problem with its fix
(`./install.ps1 -EngineOnly`, `./install.ps1 -EngineOnly -Voice`, `winget install Gyan.FFmpeg`). Do not install or
change anything yourself unless the user says yes, and never touch system or security settings.
