# Equarios / LiveBid — publish & worldwide discovery checklist

**Remind Earthvi of this file + `LAUNCH-ONLY.md` whenever they say they will publish, launch, go live, or deploy to production.**

Goal: appear in **all major search engines and discovery channels**, not Google alone. Category URLs under `/wholesale/c/...` + `sitemap.xml` + prerender are the technical base; this checklist is what to do on publish day.

**Launch day is mostly keys/API/hosting** — see `LAUNCH-ONLY.md` (mail, Brevo, prod DB/Redis/S3, `SITE_URL`). Features/tests are already in the repo. Before go-live, prefer `npm run verify` + `npm run test:e2e` + `npm run test:e2e:mobile` green (or `npm run verify:all`).

---

## 0. Before go-live (app)

- [ ] Set real domain: `SITE_URL=https://YOUR-DOMAIN` then `npm run seo:generate && npm run build`
- [ ] Confirm `https://YOUR-DOMAIN/robots.txt` and `https://YOUR-DOMAIN/sitemap.xml` load
- [ ] Spot-check category pages: `/wholesale/c`, `/wholesale/c/phones`, `/wholesale/c/phones/unlocked`
- [ ] View Source on a category URL — title + description present (prerender)
- [ ] HTTPS + SPA fallback so deep links (`/wholesale/c/...`) do not 404
- [ ] 22 languages + language button; Super Copy stays English-only
- [ ] Lots upload with clear maker/model/description/locks so SEO taxonomy auto-infers

---

## 1. Search engines (submit sitemap everywhere)

Same `sitemap.xml` works for most engines. Register the property and submit the sitemap URL in each:

| Engine / region | Webmaster / tools | Notes |
|---|---|---|
| **Google** | [Google Search Console](https://search.google.com/search-console) | Sitemap + URL inspection |
| **Bing** (+ Yahoo, DuckDuckGo often use Bing index) | [Bing Webmaster Tools](https://www.bing.com/webmasters) | Can import GSC; submit sitemap |
| **Yandex** (RU / CIS) | [Yandex Webmaster](https://webmaster.yandex.com/) | Important for Русский traffic |
| **Baidu** (China) | [Baidu Ziyuan / Webmaster](https://ziyuan.baidu.com/) | May need ICP / China hosting for strong ranks |
| **Naver** (Korea) | [Naver Search Advisor](https://searchadvisor.naver.com/) | 한국어 market |
| **Seznam** (Czech) | [Seznam Webmaster](https://webmaster.seznam.cz/) | Optional EU |
| **Apple** | Apple business / Maps if you use local presence | Brand + location, not classic sitemap |

Also:

- [ ] Bing URL submission / IndexNow (if host supports) for faster Bing pickup
- [ ] Do **not** block bots in `robots.txt` except private desks (`/admin`, `/super`, `/account`, auth)
- [ ] Keep `hreflang` / `?lang=` working for multilingual crawls

---

## 2. Everywhere else (not only search boxes)

Wholesale buyers often find desks outside Google. On publish, seed presence:

### Brand & trust
- [ ] Consistent **Equarios** name, logo, D-U-N-S, verified-member text across site + profiles
- [ ] Company pages: LinkedIn, Facebook business, X, Instagram, Google Business (if relevant)
- [ ] WhatsApp / WeChat / email enquiry match footer contact

### B2B / trade discovery
- [ ] Industry directories & dealer lists (region-specific GSM / ITAD / wholesale boards)
- [ ] Alibaba / Made-in-China / similar B2B listings (link back to Equarios wholesale)
- [ ] Trade WhatsApp / Telegram groups (careful: value-first, not spam)
- [ ] GsmExchange / ITAD / Kadorf-style communities if already a member

### App & link graph
- [ ] Homepage, footer, and wholesale hub link to `/wholesale/c` (already in product)
- [ ] External profiles all link to `https://YOUR-DOMAIN/wholesale`
- [ ] After publish, earn a few real backlinks (partners, suppliers, press)

### Ads (optional, after organic base)
- [ ] Bing Ads / Google Ads on high-intent wholesale terms only (unlocked iPhone lots, scrap phones wholesale, etc.)
- [ ] Avoid competing head-on with Amazon/eBay on pure retail “buy iPhone” alone

---

## 3. After publish (first 2 weeks)

- [ ] Re-submit sitemap if URLs change
- [ ] Upload real lots across phones / tablets / laptops / consoles / scrap / refurb so category pages stay filled
- [ ] Watch Search Console + Bing for coverage errors
- [ ] Fix any 404s on prerendered category paths
- [ ] Note languages that get traffic → prioritize those packs / markets

---

## 4. Already built in the product (do not redo)

- 22 UI languages + RTL (ar, he, ur)
- SEO taxonomy auto-inferred on upload (device / condition / lock / brand / OS)
- Public routes `/wholesale/c/...`
- `public/sitemap.xml`, `robots.txt`, build-time prerender shells
- Meta, canonical, hreflang, JSON-LD on category pages

---

## One-line reminder

**On publish: deploy with real `SITE_URL` → submit sitemap to Google, Bing, Yandex, Baidu, Naver → seed brand + B2B directories + socials → fill lots on category URLs.**
