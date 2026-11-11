<#
.SYNOPSIS
  Install Aria: the render engine, the Aria skills and slash commands for Claude Code, the `aria` command and (with
  -Voice) the voice environment.

.EXAMPLE
  ./install.ps1                     # engine + skills + slash commands + aria command
  ./install.ps1 -Voice              # also the voice environment (~5 GB: CUDA torch, Chatterbox Turbo, faster-whisper, Kokoro)
  ./install.ps1 -EngineOnly -Voice  # engine + voice + aria command only: use this when Aria is installed as a plugin
#>
param([switch]$Voice, [switch]$SkipEngine, [switch]$EngineOnly)
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

# 1. render engine (a GPU renderer for React/TypeScript compositions)
if (-not $SkipEngine) {
  $engine = Join-Path $HOME ".raea\bin\raea.exe"
  if (-not (Test-Path $engine)) {
    Write-Host "aria: installing the render engine..."
    Invoke-RestMethod https://raea.io/install.ps1 | Invoke-Expression
  }
  [Environment]::SetEnvironmentVariable("ARIA_ENGINE", $engine, "User")
  $env:ARIA_ENGINE = $engine
  Write-Host "aria: engine ok"
}

# 2. skills for Claude Code (skipped with -EngineOnly: the plugin already provides them)
if ($EngineOnly) {
  Write-Host "aria: -EngineOnly: skills and slash commands not copied (the plugin or your agent provides them)"
} else {
  $skills = Join-Path $HOME ".claude\skills"
  New-Item -ItemType Directory -Force $skills | Out-Null
  foreach ($s in "aria", "aria-video", "aria-voice", "aria-brag") {
    $dst = Join-Path $skills $s
    if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
    Copy-Item -Recurse (Join-Path $Root "skills\$s") $dst
  }
  Write-Host "aria: skills installed to $skills (aria, aria-video, aria-voice, aria-brag)"

  # 2b. slash commands: only aria-*.md files are written; nothing else in the folder is touched
  $commands = Join-Path $HOME ".claude\commands"
  New-Item -ItemType Directory -Force $commands | Out-Null
  foreach ($c in Get-ChildItem (Join-Path $Root "commands") -Filter "aria-*.md") {
    Copy-Item -Force $c.FullName (Join-Path $commands $c.Name)
    Write-Host "aria: installed /$($c.BaseName)"
  }
}

# 3. the aria command on PATH
$bin = Join-Path $Root "bin"
$path = [Environment]::GetEnvironmentVariable("Path", "User")
if (($path -split ";") -notcontains $bin) {
  [Environment]::SetEnvironmentVariable("Path", "$path;$bin", "User")
  Write-Host "aria: added $bin to your PATH (open a new terminal)"
}

# 4. voice environment
if ($Voice) {
  $vdir = Join-Path $Root "tools\voice"
  python -m pip install --quiet uv
  Push-Location $vdir
  try {
    python -m uv venv --python 3.11 .venv
    python -m uv pip install --python .venv\Scripts\python.exe torch==2.6.0+cu124 torchaudio==2.6.0+cu124 --index-url https://download.pytorch.org/whl/cu124
    python -m uv pip install --python .venv\Scripts\python.exe -r requirements.txt
    python -m uv venv --python 3.11 .venv-kokoro
    python -m uv pip install --python .venv-kokoro\Scripts\python.exe -r requirements-kokoro.txt
    New-Item -ItemType Directory -Force models | Out-Null
    $rel = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
    foreach ($m in "kokoro-v1.0.onnx", "voices-v1.0.bin") {
      if (-not (Test-Path "models\$m")) { Invoke-WebRequest "$rel/$m" -OutFile "models\$m" }
    }
  } finally { Pop-Location }
  Write-Host "aria: voice ok (first narration downloads the Turbo and whisper models, ~3 GB)"
}

python (Join-Path $Root "tools\aria.py") doctor
