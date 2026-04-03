param(
  [string]$BlenderExe = $env:BLENDER_EXECUTABLE,

  [Parameter(Mandatory = $true)]
  [string]$ValidationScript,

  [Parameter(Mandatory = $true)]
  [string]$AddonParent,

  [Parameter(Mandatory = $true)]
  [string]$FixtureList
)

$ErrorActionPreference = 'Stop'

$arguments = @(
  '--background',
  '--factory-startup',
  '--python',
  $ValidationScript,
  '--',
  $AddonParent
)
$fixtures = $FixtureList.Split('|', [System.StringSplitOptions]::RemoveEmptyEntries)
$arguments += $fixtures

$invokeScript = Join-Path $PSScriptRoot 'invoke_windows_blender.ps1'
& $invokeScript -BlenderExe $BlenderExe @arguments
exit $LASTEXITCODE
