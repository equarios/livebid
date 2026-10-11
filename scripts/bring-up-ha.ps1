$ErrorActionPreference = "Stop"
$env:Path = "$env:ProgramFiles\Docker\Docker\resources\bin;" + $env:Path
Set-Location "C:\Users\Lenovo\livebid"

Write-Host "Waiting for Docker engine..."
$deadline = (Get-Date).AddMinutes(5)
do {
  Start-Process "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 5
  docker info 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { break }
} while ((Get-Date) -lt $deadline)

if ($LASTEXITCODE -ne 0) { throw "Docker engine not ready. Open Docker Desktop and wait until it is running, then re-run this script." }

Write-Host "Building and starting HA stack..."
docker compose -f docker-compose.ha.yml up -d --build
Write-Host "Health check..."
Start-Sleep -Seconds 8
try {
  (Invoke-WebRequest -Uri "http://localhost:8080/api/health" -UseBasicParsing).Content
} catch {
  Write-Host "Health endpoint not ready yet: $_"
  docker compose -f docker-compose.ha.yml ps
}
