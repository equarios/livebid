/**
 * Broad API smoke — multi-role auth + core surfaces + trailing-slash.
 * Exit 0 only if every required check passes.
 */
const BASE = (process.env.BASE || 'http://localhost:8787').replace(/\/$/, '')
const accounts = [
  { role: 'buyer', ident: 'DEMO-1001', password: 'livebid' },
  { role: 'admin', ident: 'ADMIN-0001', password: 'admin' },
  { role: 'super', ident: 'SUPER-0001', password: 'super' },
  { role: 'retail', ident: 'RETAIL-1001', password: 'retail' },
]

function jar() {
  const c = new Map()
  return {
    store(r) {
      for (const line of r.headers.getSetCookie?.() || []) {
        const p = line.split(';')[0]
        const i = p.indexOf('=')
        if (i > 0) c.set(p.slice(0, i), p.slice(i + 1))
      }
    },
    header() {
      return [...c].map(([k, v]) => `${k}=${v}`).join('; ')
    },
  }
}

async function req(session, path, opts = {}) {
  const r = await fetch(BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Cookie: session?.header?.() || '',
      ...(opts.headers || {}),
    },
    redirect: 'manual',
  })
  session?.store?.(r)
  const t = await r.text()
  let body = null
  try {
    body = t ? JSON.parse(t) : null
  } catch {
    body = t
  }
  return { ok: r.ok, status: r.status, body, headers: r.headers }
}

const results = []
function check(name, pass, detail = '') {
  results.push({ name, pass: Boolean(pass), detail })
  const mark = pass ? 'PASS' : 'FAIL'
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function login(ident, password) {
  const s = jar()
  const r = await req(s, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ ident, password }),
  })
  check(`login ${ident}`, r.ok && r.body?.user, `status=${r.status} role=${r.body?.user?.role || '?'}`)
  return s
}

async function main() {
  console.log(`BASE=${BASE}\n`)

  // Health + trailing slash
  for (const p of ['/api/health', '/api/health/']) {
    const r = await req(null, p)
    check(p, r.ok && r.body?.ok === true, `status=${r.status} db=${r.body?.db} storage=${r.body?.storage}`)
  }

  const sessions = {}
  for (const a of accounts) {
    sessions[a.role] = await login(a.ident, a.password)
  }
  const { buyer, admin, super: superS, retail } = sessions

  const me = await req(buyer, '/api/auth/me')
  check('auth/me', me.ok && me.body?.user?.accountId, me.body?.user?.accountId || String(me.status))

  // Trailing slash on nested router
  for (const p of ['/api/notices', '/api/notices/']) {
    const r = await req(buyer, p)
    check(p, r.ok && Array.isArray(r.body?.notices), `status=${r.status} n=${r.body?.notices?.length}`)
  }

  const prefs = await req(buyer, '/api/notices/prefs')
  check('notices/prefs', prefs.ok && prefs.body?.prefs, String(prefs.status))

  // Commerce bootstrap (buyer)
  const boot = await req(buyer, '/api/commerce/bootstrap')
  check(
    'commerce/bootstrap',
    boot.ok && Array.isArray(boot.body?.lots),
    `lots=${boot.body?.lots?.length} invoices=${boot.body?.invoices?.length}`,
  )

  const lots = await req(buyer, '/api/commerce/lots?limit=5')
  check('commerce/lots', lots.ok && Array.isArray(lots.body?.lots), `status=${lots.status}`)

  // Bid only on auction channel lots
  const auctionLot = (boot.body?.lots || []).find(
    (l) =>
      (l.channel === 'auction' || String(l.id || '').startsWith('AU-')) &&
      l.status !== 'sold' &&
      l.status !== 'closed',
  )
  if (auctionLot) {
    const bidAmt = Number(auctionLot.currentBid || auctionLot.price || auctionLot.startPrice || 100) + 1
    const bid = await req(buyer, '/api/commerce/bids', {
      method: 'POST',
      headers: { 'Idempotency-Key': `full-smoke-${Date.now()}` },
      body: JSON.stringify({ lotId: auctionLot.id, amount: bidAmt, qty: auctionLot.moq || 1 }),
    })
    check(
      'commerce/bids',
      bid.ok || bid.status === 400 || bid.status === 409,
      `lot=${auctionLot.id} status=${bid.status} ${bid.body?.error || 'ok'}`,
    )
  } else {
    check('commerce/bids', true, 'skipped — no open auction lot')
  }

  // Marketplace cart add if MP lot available
  const mpLot = (boot.body?.lots || []).find(
    (l) => l.channel === 'marketplace' || String(l.id || '').startsWith('MP-'),
  )
  if (mpLot) {
    const cart = await req(buyer, '/api/commerce/cart', {
      method: 'POST',
      body: JSON.stringify({ lotId: mpLot.id, qty: mpLot.moq || 1 }),
    })
    check('commerce/cart add', cart.ok || cart.status === 400, `lot=${mpLot.id} status=${cart.status}`)
  } else {
    check('commerce/cart add', true, 'skipped — no MP lot')
  }

  // Catalog / store / community / settings / imei / marketing
  const surfaces = [
    ['catalog lots', '/api/catalog/lots', buyer, (r) => r.ok],
    ['account wholesale-app', '/api/account/wholesale-application', buyer, (r) => r.ok],
    ['store products', '/api/store/products', buyer, (r) => r.ok],
    ['store products retail', '/api/store/products', retail, (r) => r.ok],
    ['community listings', '/api/community/listings', buyer, (r) => r.ok],
    ['settings fees super', '/api/settings/fees', superS, (r) => r.ok && r.body?.fees],
    ['settings fees buyer denied', '/api/settings/fees', buyer, (r) => r.status === 403],
    ['imei packs admin', '/api/imei/packs', admin, (r) => r.ok],
    ['marketing status admin', '/api/marketing/status', admin, (r) => r.ok],
    ['staff wholesale apps', '/api/account/staff/wholesale-applications', admin, (r) => r.ok],
    ['metrics json', '/api/metrics', null, (r) => r.ok],
  ]

  for (const [name, path, session, ok] of surfaces) {
    const r = await req(session, path)
    check(name, ok(r), `status=${r.status}`)
  }

  const adminBoot = await req(admin, '/api/commerce/bootstrap')
  check('admin bootstrap', adminBoot.ok, `status=${adminBoot.status}`)

  const superBoot = await req(superS, '/api/commerce/bootstrap')
  check('super bootstrap', superBoot.ok, `status=${superBoot.status}`)

  // Real WebSocket connect
  let wsOk = false
  let wsDetail = ''
  try {
    const { default: WebSocket } = await import('ws')
    wsOk = await new Promise((resolve) => {
      const ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/ws')
      const t = setTimeout(() => {
        wsDetail = 'timeout'
        try {
          ws.close()
        } catch {
          /* ignore */
        }
        resolve(false)
      }, 3000)
      ws.on('open', () => {
        clearTimeout(t)
        wsDetail = 'open'
        ws.close()
        resolve(true)
      })
      ws.on('error', (e) => {
        clearTimeout(t)
        wsDetail = String(e.message || e)
        resolve(false)
      })
    })
  } catch (e) {
    wsDetail = String(e)
  }
  check('websocket /ws', wsOk, wsDetail)

  // Logout
  const out = await req(buyer, '/api/auth/logout', { method: 'POST' })
  check('logout', out.ok, String(out.status))

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length) {
    console.log('FAILED:')
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`)
    process.exit(1)
  }
  console.log('OK full smoke')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
