/**
 * Prove build + SPA fallback: deep paths return HTML (not nginx 404).
 * Default base: http://localhost:8088 (docker-compose.staging.yml)
 *
 *   STAGING_BASE_URL=http://localhost:8088 node scripts/staging-spa-check.mjs
 */
const base = (process.env.STAGING_BASE_URL || 'http://localhost:8088').replace(/\/$/, '')

const paths = [
  '/',
  '/auctions',
  '/marketplace',
  '/account',
  '/wholesale/c',
  '/wholesale/c/phones',
  '/wholesale/c/phones/unlocked',
  '/robots.txt',
  '/sitemap.xml',
  '/api/health',
]

function okStatus(path, status) {
  if (path === '/api/health') return status === 200 || status === 503
  return status >= 200 && status < 400
}

async function check(path) {
  const url = `${base}${path}`
  // Follow redirects so prerender dirs (301 → trailing slash) still count as HTML
  const res = await fetch(url, { redirect: 'follow' })
  const ct = res.headers.get('content-type') || ''
  const body = await res.text()
  const pass = okStatus(path, res.status)
  let detail = `${res.status} ${ct.split(';')[0] || ''}`.trim()

  if (path === '/api/health') {
    const jsonOk = body.includes('"service"') || body.includes('"ok"')
    return { path, pass: pass && jsonOk, detail: jsonOk ? detail : `${detail} (bad body)` }
  }
  if (path.endsWith('.xml') || path.endsWith('.txt')) {
    return { path, pass: pass && body.length > 10, detail }
  }
  // SPA / prerender: must be HTML, not plain 404 text
  const html = /<!doctype html|<html/i.test(body)
  return {
    path,
    pass: pass && html,
    detail: html ? detail : `${detail} (not HTML — SPA fallback missing?)`,
  }
}

const results = []
for (const p of paths) {
  try {
    results.push(await check(p))
  } catch (e) {
    results.push({ path: p, pass: false, detail: String(e.message || e) })
  }
}

let failed = 0
for (const r of results) {
  const mark = r.pass ? 'ok' : 'FAIL'
  if (!r.pass) failed++
  console.log(`${mark.padEnd(4)} ${r.path}  →  ${r.detail}`)
}

if (failed) {
  console.error(`\nstaging-spa-check: ${failed}/${results.length} failed against ${base}`)
  process.exit(1)
}
console.log(`\nstaging-spa-check: ${results.length}/${results.length} ok (${base})`)
