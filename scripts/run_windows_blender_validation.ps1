param(
  [Parameter(Mandatory = $true)]
  [string]$BlenderExe,

  [Parameter(Mandatory = $true)]
  [string]$ValidationScript,

  [Parameter(Mandatory = $true)]
  [string]$AddonParent,

  [Parameter(Mandatory = $true)]
  [string]$FixtureList
)

$ErrorActionPreference = 'Stop'
Set-Location 'C:\'

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

& $BlenderExe @arguments
exit $LASTEXITCODE
