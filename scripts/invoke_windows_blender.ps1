param(
  [string]$BlenderExe = $env:BLENDER_EXECUTABLE,

  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$BlenderArgs
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($BlenderExe)) {
  throw 'BLENDER_EXECUTABLE is not set. Define it in .env before calling run_windows_blender.sh.'
}

Set-Location 'C:\'
& $BlenderExe @BlenderArgs
exit $LASTEXITCODE
