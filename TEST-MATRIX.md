# Equarios / LiveBid — intelligent test matrix

**Rule:** a big app is never “100% of every pixel forever.”  
Confidence comes from **risk layers** you can re-run, not from one manual marathon.

## Intelligent plan (how we get sure)

| Layer | Purpose | Command | When |
|---|---|---|---|
| **L1 Core** | Health, auth, role denials, money path, tsc, i18n/SEO files | `npm run verify` | Every change |
| **L2 Product UI** | Desks, actions, account, public/SEO, staff, money UI | `npm run test:e2e` | Before publish / weekly |
| **L3 Worldwide** | 22 langs, RTL, sitemap, category URLs | inside `verify` + e2e `l2-i18n` / `l2-public` | Before publish |
| **L4 Security** | Role gates, logout, wholesale vs retail, staff mutates | `verify` security block + e2e `l4-security` | Every change |
| **L5 Ops / scale** | Staging SPA, load smoke, HA optional | `staging:check`, `npm --prefix server run load:smoke` | Before real traffic |
| **L6 Launch** | Keys + discovery only | `LAUNCH-ONLY.md` + `PUBLISH-CHECKLIST.md` | Go-live day |

**Confidence claims (honest):**

| Claim | Allowed when |
|---|---|
| Core API + money + security negatives OK | `npm run verify` green |
| UI desks + gates OK | `npm run test:e2e` green |
| Staging SPA / deep links OK | `npm run staging:check` green |
| Publish-ready (product) | L1–L5 green locally |
| Online / production-ready | + launch keys + real domain + checklist |

“100% sure every future bug is impossible” is **not** a valid claim.  
“Regression harness green on risk layers” **is**.

## One-shot full local confidence

```powershell
# Vite :5173 + API :8787 must be up for e2e
npm run verify                 # includes security-depth (IDOR, bid idempotency, uploads, bundle scan)
npm run test:e2e
npm run test:e2e:browsers      # chromium + firefox gates/security/public
npm run staging:check          # if docker staging on :8088
npm --prefix server run load:smoke
```

Or: `npm run verify:all` (= verify + Playwright chromium).

## What each harness proves

| Command | Proves |
|---|---|
| `npm run verify` | Health, role gates, logout kill, full-smoke, money paid, **security-depth** (IDOR, bid idempotency, oversize receipt, store upload staff-only, client bundle secret scan), i18n/SEO, tsc |
| `npm run verify:depth` | Security-depth alone |
| `npm run test:e2e:browsers` | Chromium + Firefox gates / L4 security / public SEO |
| `npm run test:e2e` | Playwright: desks, gates, bid/fav/cart, account, public SEO, staff, i18n, L4 UI security, money UI |
| `npm --prefix server run smoke` | Multi-role API surfaces + WebSocket |
| `npm --prefix server run smoke:money` | Cart → invoice → receipt → paid |
| `npm --prefix server run load:smoke` | Concurrent pressure smoke |
| `npm run staging:check` | Built `dist/` + nginx SPA fallback + `/api/health` |

## Residual risk (always true for this size of app)

- Real buyer edge cases (weird lots, disputed invoices, race bids under load)
- Production mail / Brevo / real S3 misconfig (launch-day only)
- Browser quirks not covered by Chromium Playwright
- New features after this harness — re-run layers, don’t assume

## Playwright specs

- `l2-desks` / `l2-gates` / `l2-actions` / `l2-account`
- `l2-public` / `l2-staff` / `l2-i18n` / `l2-money`
- `l4-security` — logout, retail community, admin vs retail admin URL

Launch day still only needs keys — see `LAUNCH-ONLY.md`.
