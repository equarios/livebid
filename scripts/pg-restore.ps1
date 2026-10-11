# Restore a .sql.gz backup into the HA Postgres (DESTRUCTIVE).
# Usage:  powershell -File scripts/pg-restore.ps1 -BackupFile .\backups\equarios-....sql.gz

param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$compose = Join-Path $root 'docker-compose.ha.yml'
$path = (Resolve-Path $BackupFile).Path
$name = [System.IO.Path]::GetFileName($path)
$remote = "/backups/$name"

Write-Host "Restoring $path (this replaces current DB data)"
$confirm = Read-Host "Type YES to continue"
if ($confirm -ne 'YES') { throw 'Aborted' }

docker compose -f $compose cp $path "postgres:$remote"
docker compose -f $compose exec -T postgres `
  sh -c "psql -U equarios -d equarios -v ON_ERROR_STOP=1 -c `"DROP SCHEMA public CASCADE; CREATE SCHEMA public;`" && gunzip -c '$remote' | psql -U equarios -d equarios -v ON_ERROR_STOP=1"

Write-Host "Restore complete. Restarting API + worker..."
docker compose -f $compose restart api1 api2 worker
Write-Host "Done."
