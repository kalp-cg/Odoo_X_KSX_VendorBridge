# Stop anything on the port, then run the Next.js dev server in THIS window.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\run-frontend.ps1

param([int]$Port = 3000)

$ErrorActionPreference = 'Stop'

$conns = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
foreach ($c in $conns) {
    $p = Get-CimInstance Win32_Process -Filter "ProcessId = $($c.OwningProcess)" -ErrorAction SilentlyContinue
    if ($p) {
        Write-Host "Stopping PID $($p.ProcessId) ($($p.Name)) on port $Port..." -ForegroundColor Yellow
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
        $parent = (Get-CimInstance Win32_Process -Filter "ProcessId = $($p.ParentProcessId)" -ErrorAction SilentlyContinue)
        if ($parent -and $parent.Name -match '^(node|npm|npm\.cmd|npx|next|powershell|pwsh)\.exe$') {
            Stop-Process -Id $parent.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
}

Start-Sleep -Milliseconds 500

Set-Location -LiteralPath (Join-Path $PSScriptRoot '..\frontend')
Write-Host "Starting frontend (next dev) on port $Port..." -ForegroundColor Green
npm run dev
