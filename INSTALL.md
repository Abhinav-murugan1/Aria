# Installing Aria

Aria has two halves:

1. **The local toolchain**: the render engine, the `aria` command, and (for voice) a Python environment with the
   voice models. Every agent needs this. It runs on your machine: Windows 10/11, a GPU with Vulkan or DX12,
   `ffmpeg` on PATH, and for voice an NVIDIA GPU with ~6 GB VRAM (CPU works, slowly).
2. **The agent files**: what teaches your coding agent to use it. Claude Code gets skills and slash commands; other
   agents get `AGENTS.md` or a rule file generated from it.

## 1. The toolchain (every route)

```powershell
git clone https://github.com/Abhinav-murugan1/Aria; cd Aria
./install.ps1 -EngineOnly -Voice   # render engine + voice environment (~5 GB) + `aria` on PATH
aria doctor                        # engine, ffmpeg, gpu, voice, kokoro: all should say ok
```

- Leave out `-Voice` if you only want the picture side; add it later by running the same line again.
- `ffmpeg` missing: `winget install Gyan.FFmpeg`.
- Open a new terminal after installing so `aria` is on PATH. Without PATH, `python tools/aria.py ...` works the same.
- Keep the clone: the `aria` command and the voice environment live inside it.

`-EngineOnly` installs the toolchain without copying any agent files. Plain `./install.ps1` (no switch) also copies
the skills and slash commands into `~/.claude` (the older Claude Code route below).

## 2. Your agent

### Claude Code (recommended: plugin)

```
/plugin marketplace add Abhinav-murugan1/Aria
/plugin install aria@aria
```
The plugin brings the skills `aria`, `aria-video`, `aria-voice`, `aria-brag` (launch videos) and the `/aria-*`
slash commands (shown as `/aria-short`, or `/aria:aria-short` when another command has the same name). Then run the
toolchain step above with `-EngineOnly`.

**Pick one route, not both.** `./install.ps1` without `-EngineOnly` registers the same skills and commands by
copying them into `~/.claude/skills` and `~/.claude/commands`. Doing both loads every skill twice. If you used that
route before and switch to the plugin, run `./scripts/uninstall.ps1` first, then `./install.ps1 -EngineOnly -Voice`.

### Codex

Codex reads `AGENTS.md` automatically when you work inside the clone. To use Aria from other projects, the
repository is also a Codex plugin marketplace (`.agents/plugins/marketplace.json` pointing at `plugin.json`): add
the repository as a marketplace in Codex's plugin manager and install `aria`.

### Cursor

`.cursor/rules/aria.mdc` applies when the clone is open, and is attached whenever an `edit.tsx` or `script.json` is in
play. For another project, copy `.cursor/rules/aria.mdc` into that project's `.cursor/rules/`. The repository also
carries a Cursor plugin manifest (`.cursor-plugin/plugin.json`).

### Gemini CLI

```
gemini extensions install https://github.com/Abhinav-murugan1/Aria
```
The extension loads `AGENTS.md` as its context file (`gemini-extension.json`).

### OpenCode

Inside the clone, `opencode.json` loads `AGENTS.md` and `.opencode/command/` provides the `/aria-*` commands. For
other projects, copy `.opencode/command/aria-*.md` into `~/.config/opencode/command/` and add the full path of
`AGENTS.md` to `instructions` in your global OpenCode config.

### Windsurf, Cline, Kiro, Qoder

Each reads its own rules folder when the clone is the open workspace:

| agent | file |
|---|---|
| Windsurf | `.windsurf/rules/aria.md` (applied when the request is about video or narration) |
| Cline | `.clinerules/aria.md` |
| Kiro | `.kiro/steering/aria.md` (always included) |
| Qoder | `.qoder/rules/aria.md` |

For another project, copy that one file into the same folder of that project.

### Devin, Grok, Kimi, OpenClaw, Pi and anything else

Point the agent at `AGENTS.md` in the clone ("read AGENTS.md in the Aria folder and follow it"). It is the complete
guide: setup, the pipeline, the `aria` CLI, the quality rules and the consent and publishing rules.

## Check it works

Ask your agent: *"make a 15 second vertical short about why cats knead, warm narrator"*. It should run `aria new`,
write `script.json`, voice it, look at stills and hand you `out/NAME.mp4`. If anything fails, run `aria doctor`.

## Uninstall

```powershell
./scripts/uninstall.ps1 -DryRun    # see what would be removed
./scripts/uninstall.ps1            # remove skills/commands from ~/.claude, the PATH entry and ARIA_ENGINE
```
Plugin installs: `/plugin uninstall aria@aria`. The render engine is left installed as a shared dependency. Deleting
the clone removes the voice environment and models.

## For contributors

`AGENTS.md`, `commands/` and `VERSION` are the sources. After editing any of them run
`python scripts/sync-agents.py`: it regenerates the rule files and OpenCode commands and stamps the version into every
manifest. CI fails if they are out of date (`--check`).
