#!/bin/sh
# Continuous backup loop for docker-compose.ha.yml (default: every 24h).
set -eu
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
INTERVAL_SEC="${BACKUP_INTERVAL_SEC:-86400}"

echo "[pg-backup] starting keep=${KEEP_DAYS}d interval=${INTERVAL_SEC}s"

while true; do
  STAMP=$(date -u +%Y%m%dT%H%M%SZ)
  OUT="/backups/equarios-${STAMP}.sql.gz"
  echo "[pg-backup] writing ${OUT}"
  if pg_dump --no-owner --format=plain | gzip -c > "${OUT}"; then
    echo "[pg-backup] ok ${OUT}"
  else
    echo "[pg-backup] FAILED"
    rm -f "${OUT}" || true
  fi
  find /backups -name 'equarios-*.sql.gz' -type f -mtime "+${KEEP_DAYS}" -delete 2>/dev/null || true
  sleep "${INTERVAL_SEC}"
done