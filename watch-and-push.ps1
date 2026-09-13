# FORENSURE — Auto Git Push Watcher
# Watches the project for file changes and auto-commits + pushes to GitHub
# Run this once: right-click -> "Run with PowerShell" OR run in terminal

param(
    [string]$WatchPath = $PSScriptRoot,
    [int]$DebounceSeconds = 4
)

Write-Host ""
Write-Host "╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   FORENSURE — Auto GitHub Sync Watcher       ║" -ForegroundColor Cyan
Write-Host "║   Watching for changes...  (Ctrl+C to stop)  ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "📁 Watching: $WatchPath" -ForegroundColor Yellow
Write-Host "⏱  Debounce: $DebounceSeconds seconds after last change" -ForegroundColor Yellow
Write-Host ""

# Set up the FileSystemWatcher
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $WatchPath
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true
$watcher.NotifyFilter = [System.IO.NotifyFilters]::LastWrite -bor [System.IO.NotifyFilters]::FileName

# Folders/files to ignore
$ignoredPaths = @(
    "node_modules", ".git", "dist", "__pycache__",
    ".pytest_cache", "*.pyc", ".wvenv", "venv",
    "*.log", "securedata.db", ".DS_Store"
)

# Shared state
$global:lastChangeTime = [datetime]::MinValue
$global:pendingPush = $false
$global:changeCount = 0

function Should-Ignore($path) {
    foreach ($pattern in $ignoredPaths) {
        if ($path -like "*$pattern*") { return $true }
    }
    return $false
}

function Get-CommitMessage {
    $time = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $count = $global:changeCount
    if ($count -eq 1) {
        return "auto: $count file changed at $time"
    }
    return "auto: $count files changed at $time"
}

# Event handler — fires on any file change
$onChange = {
    $path = $Event.SourceEventArgs.FullPath
    if (Should-Ignore $path) { return }

    $global:lastChangeTime = [datetime]::Now
    $global:pendingPush = $true
    $global:changeCount++

    $fileName = Split-Path $path -Leaf
    Write-Host "  ✏  Changed: $fileName" -ForegroundColor Gray
}

# Register events
Register-ObjectEvent $watcher "Changed" -Action $onChange | Out-Null
Register-ObjectEvent $watcher "Created" -Action $onChange | Out-Null
Register-ObjectEvent $watcher "Deleted" -Action $onChange | Out-Null
Register-ObjectEvent $watcher "Renamed" -Action $onChange | Out-Null

Write-Host "✅ Watcher started. Save any file to trigger auto-push." -ForegroundColor Green
Write-Host ""

# Main loop — checks every second if debounce period has passed
try {
    while ($true) {
        Start-Sleep -Seconds 1

        if ($global:pendingPush) {
            $elapsed = ([datetime]::Now - $global:lastChangeTime).TotalSeconds
            if ($elapsed -ge $DebounceSeconds) {
                $global:pendingPush = $false
                $count = $global:changeCount
                $global:changeCount = 0

                Write-Host ""
                Write-Host "🔄 Pushing $count change(s) to GitHub..." -ForegroundColor Cyan

                Push-Location $WatchPath

                # Stage all changes
                $addOutput = git add --all 2>&1
                
                # Check if there's actually anything to commit
                $status = git status --porcelain 2>&1
                if (-not $status) {
                    Write-Host "  ℹ  Nothing new to commit (already up to date)" -ForegroundColor Gray
                    Pop-Location
                    continue
                }

                # Commit
                $msg = Get-CommitMessage
                $commitOutput = git commit -m $msg 2>&1
                if ($LASTEXITCODE -ne 0) {
                    Write-Host "  ⚠  Commit failed: $commitOutput" -ForegroundColor Red
                    Pop-Location
                    continue
                }

                # Push
                $pushOutput = git push 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "  ✅ Pushed! → github.com/yashdhanani09/FORENSURE" -ForegroundColor Green
                    Write-Host "     Commit: $msg" -ForegroundColor DarkGray
                    if ($env:VERCEL_URL -or $true) {
                        Write-Host "     Vercel will auto-redeploy in ~60 seconds 🚀" -ForegroundColor DarkGray
                    }
                } else {
                    Write-Host "  ❌ Push failed: $pushOutput" -ForegroundColor Red
                }

                Pop-Location
                Write-Host ""
            }
        }
    }
} finally {
    $watcher.EnableRaisingEvents = $false
    $watcher.Dispose()
    Write-Host "Watcher stopped." -ForegroundColor Yellow
}
