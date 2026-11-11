<#
.SYNOPSIS
  Uninstall Aria: remove the skills and slash commands that install.ps1 copied into ~/.claude, take this clone's
  bin folder off your user PATH and clear the ARIA_ENGINE user variable. Asks nothing.

  The render engine itself is left installed: it is a shared dependency other tools may use.
  If you installed Aria as a Claude Code plugin, remove that with: /plugin uninstall aria@aria

.EXAMPLE
  ./scripts/uninstall.ps1 -DryRun   # print what would be removed, change nothing
  ./scripts/uninstall.ps1
#>
param([switch]$DryRun)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$bin = Join-Path $Root "bin"
$verb = if ($DryRun) { "would remove" } else { "removed" }

function Remove-Path($p) {
  if (Test-Path $p) {
    if (-not $DryRun) { Remove-Item -Recurse -Force $p }
    Write-Host "aria: $verb $p"
  }
}

# 1. skills and slash commands (only Aria's own files)
foreach ($s in "aria", "aria-video", "aria-voice") { Remove-Path (Join-Path $HOME ".claude\skills\$s") }
$commands = Join-Path $HOME ".claude\commands"
if (Test-Path $commands) {
  foreach ($c in Get-ChildItem $commands -Filter "aria-*.md") { Remove-Path $c.FullName }
}

# 2. this clone's bin folder off the user PATH
$path = [Environment]::GetEnvironmentVariable("Path", "User")
if ($path) {
  $norm = { param($x) $x.Trim().TrimEnd("\").ToLowerInvariant() }
  $parts = $path -split ";" | Where-Object { $_ -ne "" }
  $keep = $parts | Where-Object { (& $norm $_) -ne (& $norm $bin) }
  if (@($keep).Count -ne @($parts).Count) {
    if (-not $DryRun) { [Environment]::SetEnvironmentVariable("Path", ($keep -join ";"), "User") }
    Write-Host "aria: $verb $bin from your user PATH"
  }
}

# 3. the engine location variable (the engine stays installed)
if ([Environment]::GetEnvironmentVariable("ARIA_ENGINE", "User")) {
  if (-not $DryRun) { [Environment]::SetEnvironmentVariable("ARIA_ENGINE", $null, "User") }
  Write-Host "aria: $verb the ARIA_ENGINE user variable"
}

Write-Host "aria: the render engine was left installed (a shared dependency). The voice environment lives in this"
Write-Host "      clone (tools\voice\.venv, .venv-kokoro, models): deleting the clone removes it."
if ($DryRun) { Write-Host "aria: dry run, nothing was changed" }
