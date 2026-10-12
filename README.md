# LiveBid

Demo B2B site for **live device auctions** and a **fixed-price marketplace**. Inspired by the flow of wholesale bidding platforms (member login, real-time lots, sealed bids, invoices) — original product, not a copy of AUCNET/GBS.

## Demo login

- Account ID: `DEMO-1001`
- Password: `livebid`

## Run

```bash
npm install
docker compose up -d          # Postgres + Redis + Silo (S3)
cp server/.env.example server/.env   # first time
npm --prefix server run db:reset
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). API health: http://localhost:8787/api/health  
See `server/README.md` for logins, smoke scripts, and scale-stack notes.

## Languages

Header language switcher: 22 locales (see `src/i18n/locales.ts`). Preference in `localStorage` (`livebid-locale`); `?lang=` on SEO URLs also applies. Super Copy edits English only; other locales are code packs under `src/i18n/packs/`.

## SEO / worldwide discovery

- Public category URLs: `/wholesale/c`, `/wholesale/c/phones`, `/wholesale/c/phones/unlocked`, `/wholesale/c/phones/unlocked/apple`, …
- Taxonomy: device class × condition (new/used/refurb/recycled/scrap/locked/unlocked) × brand / OS
- `npm run seo:generate` → `public/sitemap.xml` + `robots.txt` (set `SITE_URL` for your domain)
- `npm run build` also prerenders top category HTML shells into `dist/` for crawlers
- **Staging dry-run:** [`STAGING.md`](./STAGING.md) — build + SPA fallback (+ optional Cloudflare Tunnel HTTPS)
- **On publish:** [`LAUNCH-ONLY.md`](./LAUNCH-ONLY.md) (keys/API/hosting) + [`PUBLISH-CHECKLIST.md`](./PUBLISH-CHECKLIST.md) (all search engines + B2B discovery)

## Testing

```bash
npm run verify          # health + security + full-smoke + money + i18n/SEO + tsc
npm run test:e2e        # L2 Playwright (desks + access gates) — Vite + API must be up
npm run verify:all      # verify + e2e
```

See [`TEST-MATRIX.md`](./TEST-MATRIX.md) for the full layered plan (API → desks → SEO → security → scale).
