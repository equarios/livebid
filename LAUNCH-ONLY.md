# Equarios — launch-only reminders (keys / production)

**Remind Earthvi of this file + `PUBLISH-CHECKLIST.md` whenever they say launch / publish / go live / deploy production.**

Product features, i18n (22 langs), SEO categories, verify harness, and Playwright e2e are built **before** launch.  
On launch day you only need **hosting + secrets + discovery** — not new app features.

---

## Production secrets & services (set then)

Copy from `server/.env.example` into real `server/.env` (never commit):

| Item | Why |
|---|---|
| `DATABASE_URL` | Production Postgres |
| `REDIS_URL` | Cache / rate limits |
| `S3_*` / `CDN_BASE_URL` | Real object storage (not local Silo) |
| `RESEND_API_KEY` or mail provider | Real email verify / password reset (`MAIL_EXPOSE_CODES=0`) |
| `BREVO_API_KEY` + sender / list / webhook | Marketing (optional but planned) |
| `CARE_INLINE=0` + separate worker | Production care loop |
| `SITE_URL=https://YOUR-DOMAIN` | Sitemap + prerender absolute URLs |
| HTTPS + SPA fallback | Deep links `/wholesale/c/...` |

## Launch commands (after keys)

```bash
$env:SITE_URL="https://YOUR-DOMAIN"
npm run seo:generate
npm run build
# deploy dist/ + run API/worker against prod DB/Redis/S3
npm run verify          # against staging if available
npm run test:e2e        # optional smoke on staging URL: PLAYWRIGHT_BASE_URL=...
npm run test:e2e:mobile # phone + tablet overflow / menu (same PLAYWRIGHT_BASE_URL)
```

## Then discovery (not Google only)

Follow **`PUBLISH-CHECKLIST.md`**: Google, Bing, Yandex, Baidu, Naver + B2B/social.

## Staging dry-run (before launch keys)

See **`STAGING.md`**: build → `docker compose -f docker-compose.staging.yml up` → `npm run staging:check`  
Optional throwaway HTTPS: Cloudflare Tunnel (`….trycloudflare.com`).

## Do NOT wait for launch to finish

- Languages / SEO taxonomy / category pages — **already done**
- `npm run verify` + `npm run test:e2e` + `npm run test:e2e:mobile` — **run anytime locally**
- Filling real lots — can start before or after DNS
