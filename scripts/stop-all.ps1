# Stop anything listening on the dev ports.
foreach ($port in 4000, 3000) {
    $conns = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        $p = Get-CimInstance Win32_Process -Filter "ProcessId = $($c.OwningProcess)" -ErrorAction SilentlyContinue
        if ($p) {
            Write-Host "Stopping PID $($p.ProcessId) ($($p.Name)) on port $port" -ForegroundColor Yellow
            Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
}
Write-Host "Done." -ForegroundColor Green
