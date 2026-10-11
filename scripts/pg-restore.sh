#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
FILE=${1:?Usage: pg-restore.sh path/to/equarios-....sql.gz}
echo "Restoring $FILE (DESTRUCTIVE)"
printf 'Type YES to continue: '
read -r confirm
[ "$confirm" = "YES" ] || { echo Aborted; exit 1; }

docker compose -f "$ROOT/docker-compose.ha.yml" exec -T postgres \
  psql -U equarios -d equarios -v ON_ERROR_STOP=1 \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

gunzip -c "$FILE" |
  docker compose -f "$ROOT/docker-compose.ha.yml" exec -T postgres \
    psql -U equarios -d equarios -v ON_ERROR_STOP=1

echo "Restore complete."
