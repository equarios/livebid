# Equarios — staging dry-run (throwaway domain)

Proves **production build + HTTPS + SPA deep-link fallback** without waiting for launch keys (mail/Brevo/real S3 can stay demo).

## What this checks

- `npm run build` (sitemap + prerender into `dist/`)
- Nginx serves `dist/` with `try_files` so `/wholesale/c/...` and `/account` do not 404
- Same-origin `/api` + `/ws` through the edge
- Optional: real HTTPS URL via Cloudflare Tunnel (free throwaway hostname)

## A. Local staging (no domain)

```powershell
# From repo root — use any placeholder URL for absolute sitemap links
$env:SITE_URL="http://localhost:8088"
npm run build

docker compose -f docker-compose.staging.yml up -d --build

# Wait ~15s for API seed, then:
npm run staging:check
```

Open http://localhost:8088 — click into auctions, a category URL, refresh on `/account` (should stay on the app, not nginx 404).

Stop later:

```powershell
docker compose -f docker-compose.staging.yml down
```

## B. Throwaway HTTPS domain (Cloudflare Tunnel)

1. Install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/).
2. With staging stack up on `:8088`:

```powershell
cloudflared tunnel --url http://localhost:8088
```

3. Copy the `https://….trycloudflare.com` URL it prints.
4. Rebuild sitemap/prerender against that URL, reload static files:

```powershell
$env:SITE_URL="https://YOUR-SUBDOMAIN.trycloudflare.com"
npm run build
# nginx already mounts ./dist — just re-check
$env:STAGING_BASE_URL=$env:SITE_URL
npm run staging:check
```

5. Optional: set `CORS_ORIGINS` if you ever split API host (same-origin tunnel usually needs none).

Tunnel URL dies when you stop `cloudflared` — fine for a dry-run.

## C. What launch still needs (not staging)

Real prod secrets — see `LAUNCH-ONLY.md`: Postgres/Redis/S3, mail, Brevo, final `SITE_URL`, then `PUBLISH-CHECKLIST.md` for search engines.

## Playwright against staging

```powershell
$env:PLAYWRIGHT_BASE_URL="http://localhost:8088"
npm run test:e2e
```
