# Equarios local API (Hono + Prisma + Postgres)

## Quick start

From repo root (Docker scale stack + seed + app):

```bash
docker compose up -d
cp server/.env.example server/.env   # first time
npm --prefix server run db:reset     # push schema + seed
npm run dev                          # Vite :5173 + API :8787 (proxy /api)
```

Or separately:

```bash
npm run dev:server
npm run dev:client
```

Health should report `db: up`, `cache: redis`, `storage: s3` when compose + `.env` are wired.

## Demo logins (seeded)

| Account    | Password | Role        |
|------------|----------|-------------|
| SUPER-0001 | super    | superadmin  |
| ADMIN-0001 | admin    | admin       |
| DEMO-1001  | livebid  | member (wholesale) |
| RETAIL-1001 | retail  | member (store) |

Auth uses an **httpOnly** cookie (`livebid_session`). Editing `localStorage` role no longer grants Admin when the API is up.

## Scale stack (`docker compose`)

| Service  | Port        | Env |
|----------|-------------|-----|
| Postgres | 5432        | `DATABASE_URL` |
| Redis    | 6379        | `REDIS_URL` |
| Silo (S3)| 9000 / 9001 | `S3_*` (MinIO-compatible fork) |

Mail / Brevo keys are optional locally (`MAIL_EXPOSE_CODES=1`). Add them when you publish.

## Scripts

- `npm run db:push` — apply schema
- `npm run db:seed` — seed accounts + sample lots
- `npm run db:reset` — wipe + seed
- `npm run smoke` — multi-role API smoke
- `npm run smoke:money` — cart → invoice → paid
- `npm run load:smoke` — health storm
