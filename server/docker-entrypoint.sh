#!/bin/sh
set -e

ROLE="${1:-api}"

echo "[entrypoint] role=$ROLE"

if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] prisma db push"
  npx prisma db push --skip-generate
fi

if [ "$ROLE" = "worker" ]; then
  exec npx tsx src/worker.ts
fi

if [ "$SEED_ON_BOOT" = "1" ]; then
  echo "[entrypoint] seeding"
  npx tsx prisma/seed.ts || true
fi

exec npx tsx src/index.ts
