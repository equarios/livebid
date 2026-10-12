/**
 * After `vite build`, copies dist/index.html into each SEO path as index.html
 * with unique <title>, description, canonical, and a crawlable static body.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const routesFile = join(root, 'scripts', 'seo-prerender-routes.json')

if (!existsSync(dist) || !existsSync(join(dist, 'index.html'))) {
  console.error('prerender-seo: dist/index.html missing — run vite build first')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(routesFile, 'utf8'))
const baseHtml = readFileSync(join(dist, 'index.html'), 'utf8')
const siteUrl = (manifest.siteUrl || 'https://equarios.com').replace(/\/$/, '')

const LABELS = {
  phones: 'Mobile phones',
  tablets: 'Tablets & iPads',
  pcs: 'PCs & desktops',
  laptops: 'Laptops',
  chromebooks: 'Chromebooks',
  consoles: 'Gaming consoles',
  other: 'Other devices',
  new: 'New',
  used: 'Used',
  refurbished: 'Refurbished',
  recycled: 'Recycled',
  scrap: 'Scrap',
  locked: 'Locked',
  unlocked: 'Unlocked',
  apple: 'Apple',
  samsung: 'Samsung',
  google: 'Google',
  sony: 'Sony',
  microsoft: 'Microsoft',
  nintendo: 'Nintendo',
}

function titleFor(path) {
  if (path === '/wholesale/c') return 'Equarios | Wholesale devices worldwide'
  if (path === '/wholesale') return 'Equarios | B2B wholesale desk'
  if (path === '/buyers') return 'Equarios | For buyers'
  if (path === '/sellers') return 'Equarios | For sellers'
  if (path === '/support') return 'Equarios | Support'
  const parts = path.replace(/^\/wholesale\/c\/?/, '').split('/').filter(Boolean)
  const bits = parts.map((p) => LABELS[p] || p)
  return bits.length ? `${bits.join(' ')} wholesale | Equarios` : 'Equarios wholesale'
}

function descFor(path) {
  const t = titleFor(path).replace(/ \| Equarios$/, '').replace(/^Equarios \| /, '')
  return `Equarios B2B wholesale: buy and sell ${t.toLowerCase()} — new, used, locked, unlocked, refurbished, recycled, and scrap. Phones, tablets, PCs, laptops, Chromebooks, and gaming consoles worldwide.`
}

function inject(html, { title, description, canonical, path }) {
  let out = html
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`)
  if (/<meta\s+name=["']description["']/i.test(out)) {
    out = out.replace(
      /<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?>/i,
      `<meta name="description" content="${escapeAttr(description)}" />`,
    )
  } else {
    out = out.replace(
      /<\/head>/i,
      `    <meta name="description" content="${escapeAttr(description)}" />\n    <link rel="canonical" href="${escapeAttr(canonical)}" />\n  </head>`,
    )
  }
  if (!/<link\s+rel=["']canonical["']/i.test(out)) {
    out = out.replace(
      /<\/head>/i,
      `    <link rel="canonical" href="${escapeAttr(canonical)}" />\n  </head>`,
    )
  } else {
    out = out.replace(
      /<link\s+rel=["']canonical["']\s+href=["'][^"']*["']\s*\/?>/i,
      `<link rel="canonical" href="${escapeAttr(canonical)}" />`,
    )
  }
  const staticBlock = `
    <noscript>
      <main style="max-width:720px;margin:2rem auto;padding:0 1rem;font-family:system-ui,sans-serif">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(description)}</p>
        <p><a href="/wholesale/c">All wholesale categories</a> · <a href="/register">Apply as buyer</a> · <a href="/buyers">For buyers</a></p>
        <p>Path: ${escapeHtml(path)}</p>
      </main>
    </noscript>`
  out = out.replace(/<div id="root"><\/div>/i, `<div id="root"></div>${staticBlock}`)
  return out
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;')
}

let written = 0
for (const path of manifest.prerender || []) {
  const canonical = `${siteUrl}${path}`
  const title = titleFor(path)
  const description = descFor(path)
  const html = inject(baseHtml, { title, description, canonical, path })
  const dir = path === '/' ? dist : join(dist, ...path.split('/').filter(Boolean))
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), html)
  written++
}

/* Ensure sitemap + robots land in dist */
for (const name of ['sitemap.xml', 'robots.txt']) {
  const src = join(root, 'public', name)
  if (existsSync(src)) writeFileSync(join(dist, name), readFileSync(src))
}

console.log(`prerender-seo: wrote ${written} HTML shells under dist/`)
