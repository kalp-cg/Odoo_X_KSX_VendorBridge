# Stop anything on the port, then run the dev server in THIS window.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\run-backend.ps1

param([int]$Port = 4000)

$ErrorActionPreference = 'Stop'

# 1) Find and kill anything listening on the port (kills whole process tree).
$conns = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
foreach ($c in $conns) {
    $p = Get-CimInstance Win32_Process -Filter "ProcessId = $($c.OwningProcess)" -ErrorAction SilentlyContinue
    if ($p) {
        Write-Host "Stopping PID $($p.ProcessId) ($($p.Name)) on port $Port..." -ForegroundColor Yellow
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
        # Walk up the parent tree to kill npm/npx wrappers too
        $parent = (Get-CimInstance Win32_Process -Filter "ProcessId = $($p.ParentProcessId)" -ErrorAction SilentlyContinue)
        if ($parent -and $parent.Name -match '^(node|npm|npm\.cmd|npx|powershell|pwsh)\.exe$') {
            Stop-Process -Id $parent.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
}

# 2) Brief pause so the OS releases the socket.
Start-Sleep -Milliseconds 500

# 3) Switch to backend dir and run dev in foreground (this window).
Set-Location -LiteralPath (Join-Path $PSScriptRoot '..\backend')
Write-Host "Starting backend (nest start --watch) on port $Port..." -ForegroundColor Green
npm run start:dev
