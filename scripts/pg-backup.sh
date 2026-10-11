#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
OUT_DIR="$ROOT/backups"
mkdir -p "$OUT_DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="$OUT_DIR/equarios-${STAMP}.sql.gz"
echo "Backing up to $OUT"
docker compose -f "$ROOT/docker-compose.ha.yml" exec -T postgres \
  pg_dump -U equarios -d equarios --no-owner | gzip -c > "$OUT"
ls -lt "$OUT_DIR" | head -n 6
