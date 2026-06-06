# Open backend in one window, frontend in another, after freeing the ports.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\run-all.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

# Free the ports first (in this process).
foreach ($port in 4000, 3000) {
    $conns = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        $p = Get-CimInstance Win32_Process -Filter "ProcessId = $($c.OwningProcess)" -ErrorAction SilentlyContinue
        if ($p) {
            Write-Host "Freeing port $port (stopping PID $($p.ProcessId) $($p.Name))" -ForegroundColor Yellow
            Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
}
Start-Sleep -Milliseconds 800

# Open dedicated windows.
$be = Start-Process -FilePath "powershell.exe" -ArgumentList @(
    '-NoExit', '-ExecutionPolicy', 'Bypass',
    '-File', (Join-Path $PSScriptRoot 'run-backend.ps1')
) -PassThru -WindowStyle Normal
Write-Host "Backend window started (PID $($be.Id))" -ForegroundColor Green

Start-Sleep -Seconds 1

$fe = Start-Process -FilePath "powershell.exe" -ArgumentList @(
    '-NoExit', '-ExecutionPolicy', 'Bypass',
    '-File', (Join-Path $PSScriptRoot 'run-frontend.ps1')
) -PassThru -WindowStyle Normal
Write-Host "Frontend window started (PID $($fe.Id))" -ForegroundColor Green

Write-Host ""
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Backend:  http://localhost:4000/api/v1" -ForegroundColor Cyan
Write-Host "Swagger:  http://localhost:4000/api/v1/docs" -ForegroundColor Cyan
