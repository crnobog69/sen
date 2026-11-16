[CmdletBinding()]
param([Parameter(Position = 0)][string]$Message, [switch]$Local)
$ErrorActionPreference = 'Stop'
$gitDir = Split-Path (Get-Command git -CommandType Application).Source
$gitBash = Join-Path $gitDir '../bin/bash.exe'
if (!(Test-Path -LiteralPath $gitBash)) { $gitBash = (Get-Command bash -CommandType Application).Source }
Push-Location $PSScriptRoot
try {
    $arguments = @('docker-build.sh')
    if ($Local) { $arguments += '--local' }
    elseif ($Message) { $arguments += $Message }
    & $gitBash @arguments
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
