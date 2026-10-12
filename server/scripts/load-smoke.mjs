/**
 * Phase 3 smoke load test — health storm + optional bid storm.
 *
 *   node scripts/load-smoke.mjs
 *   BASE=http://localhost:8787 CONCURRENCY=50 ROUNDS=20 node scripts/load-smoke.mjs
 *   BID=1 IDENT=DEMO-1001 PASS=livebid LOT=... node scripts/load-smoke.mjs
 */

const BASE = (process.env.BASE || 'http://localhost:8787').replace(/\/$/, '')
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY) || 40)
const ROUNDS = Math.max(1, Number(process.env.ROUNDS) || 10)
const DO_BID = process.env.BID === '1'

function pct(sorted, p) {
  if (!sorted.length) return 0
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[i]
}

async function timed(fn) {
  const t0 = performance.now()
  try {
    const res = await fn()
    return { ok: res.ok, status: res.status, ms: performance.now() - t0 }
  } catch (e) {
    return { ok: false, status: 0, ms: performance.now() - t0, error: e instanceof Error ? e.message : String(e) }
  }
}

async function healthStorm() {
  const results = []
  for (let r = 0; r < ROUNDS; r++) {
    const batch = Array.from({ length: CONCURRENCY }, () =>
      timed(() => fetch(`${BASE}/api/health`)),
    )
    results.push(...(await Promise.all(batch)))
  }
  return results
}

async function bidStorm() {
  const ident = process.env.IDENT || 'DEMO-1001'
  const password = process.env.PASS || 'livebid'
  const lotId = process.env.LOT
  if (!lotId) {
    console.log('BID=1 set but LOT missing — skip bid storm')
    return []
  }

  const jar = new Map()
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ident, password }),
  })
  const setCookie = login.headers.getSetCookie?.() || []
  for (const c of setCookie) {
    const [pair] = c.split(';')
    const [k, v] = pair.split('=')
    if (k && v) jar.set(k.trim(), v.trim())
  }
  if (!login.ok) {
    console.log('login failed', login.status, await login.text())
    return []
  }
  const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')

  const results = []
  for (let r = 0; r < ROUNDS; r++) {
    const batch = Array.from({ length: Math.min(CONCURRENCY, 20) }, (_, i) =>
      timed(() =>
        fetch(`${BASE}/api/commerce/bids`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie,
            'Idempotency-Key': `load-${r}-${i}-${Date.now()}`,
          },
          body: JSON.stringify({
            lotId,
            amount: 1 + r + i * 0.01,
            qty: 1,
          }),
        }),
      ),
    )
    results.push(...(await Promise.all(batch)))
  }
  return results
}

function report(label, results) {
  const ok = results.filter((r) => r.ok).length
  const ms = results.map((r) => r.ms).sort((a, b) => a - b)
  console.log(`\n${label}`)
  console.log(`  requests=${results.length} ok=${ok} fail=${results.length - ok}`)
  console.log(
    `  latency_ms p50=${pct(ms, 50).toFixed(1)} p95=${pct(ms, 95).toFixed(1)} p99=${pct(ms, 99).toFixed(1)}`,
  )
}

async function bootstrapStorm() {
  const ident = process.env.IDENT || 'DEMO-1001'
  const password = process.env.PASS || 'livebid'
  const jar = new Map()
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ident, password }),
  })
  for (const c of login.headers.getSetCookie?.() || []) {
    const [pair] = c.split(';')
    const [k, v] = pair.split('=')
    if (k && v) jar.set(k.trim(), v.trim())
  }
  if (!login.ok) {
    console.log('bootstrap storm: login failed', login.status)
    return []
  }
  const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  const results = []
  const rounds = Math.min(ROUNDS, 5)
  const conc = Math.min(CONCURRENCY, 15)
  for (let r = 0; r < rounds; r++) {
    const batch = Array.from({ length: conc }, () =>
      timed(() =>
        fetch(`${BASE}/api/commerce/bootstrap`, {
          headers: { cookie },
        }),
      ),
    )
    results.push(...(await Promise.all(batch)))
  }
  return results
}

console.log(`load-smoke BASE=${BASE} CONCURRENCY=${CONCURRENCY} ROUNDS=${ROUNDS}`)
const health = await healthStorm()
report('health', health)

const boot = await bootstrapStorm()
if (boot.length) {
  report('commerce/bootstrap', boot)
  const bootOk = boot.filter((r) => r.ok).length
  if (bootOk < boot.length * 0.95) {
    console.error(`load-smoke FAIL: bootstrap success ${bootOk}/${boot.length} < 95%`)
    process.exit(1)
  }
}

if (DO_BID) {
  const bids = await bidStorm()
  if (bids.length) report('bids', bids)
}

const healthOk = health.filter((r) => r.ok).length
if (healthOk < health.length) {
  console.error(`load-smoke FAIL: health ${healthOk}/${health.length}`)
  process.exit(1)
}

const metrics = await fetch(`${BASE}/api/metrics`).then((r) => r.json()).catch(() => null)
if (metrics) console.log('\nserver metrics', JSON.stringify(metrics, null, 2))
console.log('\nOK load-smoke')

