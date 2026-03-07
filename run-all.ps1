# ============================================================
#  run-all.ps1 — Start tunes and LocalQR in one shot
#  Usage: .\run-all.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "============================================" -ForegroundColor DarkCyan
Write-Host "  ML Project — Starting all apps" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  [1] tunes        → http://localhost:5000" -ForegroundColor Cyan
Write-Host "  [2] LocalQR     → http://localhost:5173" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Press Ctrl+C to stop both servers." -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor DarkCyan
Write-Host ""

# Start tunes in a new window
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$root\tunes'; `$host.UI.RawUI.WindowTitle = 'tunes :5000'; npm run dev"
)

# Small delay so ports don't collide on startup
Start-Sleep -Seconds 2

# Start explorers-earth in a new window
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$root\explorers-earth'; `$host.UI.RawUI.WindowTitle = 'explorers-earth :5173'; npm run dev"
)

Write-Host "✅ Both servers launched in separate windows." -ForegroundColor Green
Write-Host "   Close those windows (or press Ctrl+C in each) to stop them." -ForegroundColor Gray
