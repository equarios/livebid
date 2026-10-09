# Equarios local API (Hono + Prisma + SQLite)

## Quick start

From repo root:

```bash
npm run server:reset   # first time / reset DB + seed
npm run dev            # Vite :5173 + API :8787 (proxy /api)
```

Or separately:

```bash
npm run dev:server
npm run dev:client
```

## Demo logins (seeded)

| Account    | Password | Role        |
|------------|----------|-------------|
| SUPER-0001 | super    | superadmin  |
| ADMIN-0001 | admin    | admin       |
| DEMO-1001  | livebid  | member      |

Auth uses an **httpOnly** cookie (`livebid_session`). Editing `localStorage` role no longer grants Admin when the API is up.

## Two-browser local test checklist

1. Start `npm run dev` (API health: `http://localhost:8787/api/health`).
2. **Window A (Chrome):** sign in as `DEMO-1001` / `livebid`.
3. **Window B (Edge/incognito):** sign in as `ADMIN-0001` / `admin`.
4. Buyer: Marketplace → add `MP-11021` to cart → My Page → Marketplace → **Add To Cart** (checkout).
5. Confirm buyer cart is empty and a checkout request appears; Admin Work shows the same cart order.
6. Admin: Accept cart → Buyer: Confirm → invoice draft created; stock on `MP-11021` drops.
7. Buyer: bid on `LOT-1001` → Admin sees updated price/bid count after refresh/bootstrap.
8. In buyer DevTools, set `localStorage.livebid-auth` to `{role:"admin",...}` → reload → still **not** Admin (session cookie wins).
9. Sign out buyer; sign in as a second buyer (register new pending account, Super-accept, or seed another) → carts do not mix.

## Scripts

- `npm run db:push` — apply schema
- `npm run db:seed` — seed accounts + sample lots
- `npm run db:reset` — wipe + seed
