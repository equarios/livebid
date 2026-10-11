# One-shot Postgres backup from the HA compose stack into ./backups
# Usage:  powershell -File scripts/pg-backup.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$compose = Join-Path $root 'docker-compose.ha.yml'
$outDir = Join-Path $root 'backups'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMddTHHmmssZ'
$name = "equarios-$stamp.sql.gz"
$remote = "/backups/$name"
$outFile = Join-Path $outDir $name

Write-Host "Backing up to $outFile"
docker compose -f $compose exec -T postgres `
  sh -c "pg_dump -U equarios -d equarios --no-owner | gzip -c > '$remote'"
docker compose -f $compose cp "postgres:$remote" $outFile

Write-Host "Done: $outFile"
Get-ChildItem $outDir | Sort-Object LastWriteTime -Descending | Select-Object -First 5
