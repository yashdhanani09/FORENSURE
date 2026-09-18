# FORENSURE Bridge — Silent Elevated Background Daemon
$ErrorActionPreference = "SilentlyContinue"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# 1. Free port 8000 if occupied
try {
    Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 600
} catch {}

# 2. Locate bridge executable or Python environment
$candidateExes = @(
    (Join-Path $scriptDir "FORENSURE-Bridge.exe"),
    (Join-Path (Split-Path $scriptDir -Parent) "backend\dist\FORENSURE-Bridge\FORENSURE-Bridge.exe"),
    (Join-Path $scriptDir "dist\FORENSURE-Bridge\FORENSURE-Bridge.exe")
)

$targetExe = $null
foreach ($c in $candidateExes) {
    if (Test-Path $c) {
        $targetExe = $c
        break
    }
}

if ($targetExe) {
    Start-Process -FilePath $targetExe -WorkingDirectory (Split-Path $targetExe -Parent) -WindowStyle Hidden
} elseif (Test-Path (Join-Path $scriptDir ".wvenv\Scripts\python.exe")) {
    $pyPath = Join-Path $scriptDir ".wvenv\Scripts\python.exe"
    Start-Process -FilePath $pyPath -ArgumentList "agent_entry.py" -WorkingDirectory $scriptDir -WindowStyle Hidden
} elseif (Test-Path (Join-Path (Split-Path $scriptDir -Parent) "backend\.wvenv\Scripts\python.exe")) {
    $pyPath = Join-Path (Split-Path $scriptDir -Parent) "backend\.wvenv\Scripts\python.exe"
    $workDir = Join-Path (Split-Path $scriptDir -Parent) "backend"
    Start-Process -FilePath $pyPath -ArgumentList "agent_entry.py" -WorkingDirectory $workDir -WindowStyle Hidden
}
