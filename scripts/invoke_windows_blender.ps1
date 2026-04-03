param(
  [string]$BlenderExe = $env:BLENDER_EXECUTABLE,
  [string]$BlenderArgsEncoded = '',

  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$BlenderArgs
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($BlenderExe)) {
  throw 'BLENDER_EXECUTABLE is not set. Define it in .env before calling run_windows_blender.sh.'
}

Set-Location 'C:\'
$resolvedBlenderArgs = @()
if (-not [string]::IsNullOrEmpty($BlenderArgsEncoded)) {
  $resolvedBlenderArgs = @($BlenderArgsEncoded -split "`n" | Where-Object { $_ -ne '' })
}
elseif ($BlenderArgs) {
  $resolvedBlenderArgs = $BlenderArgs
}

& $BlenderExe @resolvedBlenderArgs
exit $LASTEXITCODE
