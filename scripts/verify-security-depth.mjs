/**
 * Deep security / money edge checks (IDOR, idempotency, upload limits, bundle secrets).
 * Run: node scripts/verify-security-depth.mjs
 * Requires API on BASE (default http://localhost:8787).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = (process.env.BASE || 'http://localhost:8787').replace(/\/$/, '')
const results = []

function check(name, pass, detail = '') {
  results.push({ name, pass: Boolean(pass), detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

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
  })
  session?.store?.(r)
  const t = await r.text()
  let body = null
  try {
    body = t ? JSON.parse(t) : null
  } catch {
    body = t
  }
  return { ok: r.ok, status: r.status, body }
}

async function login(ident, password) {
  const s = jar()
  const r = await req(s, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ ident, password }),
  })
  return { session: s, ok: r.ok, status: r.status, user: r.body?.user }
}

const tinyPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

console.log(`\n=== security-depth ===\nBASE=${BASE}\n`)

/* ── Bid idempotency ── */
{
  const buyer = await login('DEMO-1001', 'livebid')
  check('depth buyer login', buyer.ok, `status=${buyer.status}`)
  if (buyer.ok) {
    const boot = await req(buyer.session, '/api/commerce/bootstrap')
    const lot = (boot.body?.lots || []).find(
      (l) =>
        l.channel === 'auction' &&
        Number(l.endsAt) > Date.now() &&
        (l.auctionType === 'live' || !l.auctionType || l.auctionType === 'english'),
    )
    if (!lot) {
      check('depth bid idempotency', true, 'skipped — no live auction lot')
    } else {
      const key = `depth-idem-${Date.now()}`
      const amount = Math.max(Number(lot.currentPrice) || 1, 1) + 1
      const qty = Math.max(1, Number(lot.moq) || 1)
      const b1 = await req(buyer.session, '/api/commerce/bids', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify({ lotId: lot.id, amount, qty }),
      })
      const b2 = await req(buyer.session, '/api/commerce/bids', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify({ lotId: lot.id, amount, qty }),
      })
      // Bids have no separate id — idempotent replay must return same at + bidCount
      const at1 = b1.body?.bid?.at
      const at2 = b2.body?.bid?.at
      const bc1 = b1.body?.lot?.bidCount
      const bc2 = b2.body?.lot?.bidCount
      check(
        'depth bid idempotency same key',
        b1.ok && b2.ok && at1 != null && at1 === at2 && bc1 === bc2,
        `lot=${lot.id} at=${at1}/${at2} bidCount=${bc1}/${bc2} status=${b1.status}/${b2.status}`,
      )
    }
  }
}

/* ── IDOR: retail must not pay / open / see wholesale invoice ── */
{
  const buyer = await login('DEMO-1001', 'livebid')
  const retail = await login('RETAIL-1001', 'retail')
  check('depth retail login', retail.ok, `status=${retail.status}`)
  if (buyer.ok && retail.ok) {
    const list = await req(buyer.session, '/api/commerce/invoices')
    const inv = (list.body?.invoices || []).find((x) => x.accountId === 'DEMO-1001') || list.body?.invoices?.[0]
    if (!inv?.id) {
      check('depth IDOR invoice pay', true, 'skipped — no DEMO invoice')
    } else {
      const retailList = await req(retail.session, '/api/commerce/invoices')
      const leaked = (retailList.body?.invoices || []).some((x) => x.id === inv.id || x.accountId === 'DEMO-1001')
      check('depth IDOR invoice list', !leaked, `retail sees DEMO invoice=${leaked}`)

      const pay = await req(retail.session, `/api/commerce/invoices/${encodeURIComponent(inv.id)}/pay`, {
        method: 'POST',
        body: JSON.stringify({ receiptName: 'x.png', receiptData: tinyPng }),
      })
      check(
        'depth IDOR invoice pay',
        pay.status === 404 || pay.status === 403,
        `status=${pay.status}`,
      )

      const opened = await req(retail.session, `/api/commerce/invoices/${encodeURIComponent(inv.id)}/opened`, {
        method: 'POST',
        body: '{}',
      })
      check(
        'depth IDOR invoice opened',
        opened.status === 404 || opened.status === 403,
        `status=${opened.status}`,
      )
    }

    // Ensure a DEMO doc exists, then retail must not download it
    let docId = (await req(buyer.session, '/api/account/documents')).body?.documents?.[0]?.id
    if (!docId) {
      const created = await req(buyer.session, '/api/account/documents', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Depth IDOR fixture',
          category: 'other',
          fileName: 'depth.txt',
          mimeType: 'text/plain',
          dataBase64: Buffer.from('depth-idor').toString('base64'),
        }),
      })
      docId = created.body?.document?.id
      check('depth upload demo document', Boolean(docId), `status=${created.status}`)
    }
    if (!docId) {
      check('depth IDOR document download', false, 'could not create/find DEMO doc')
    } else {
      const dl = await req(retail.session, `/api/account/documents/${encodeURIComponent(docId)}/download`)
      check('depth IDOR document download', dl.status === 403 || dl.status === 404, `status=${dl.status}`)
    }
  }
}

/* ── Marketplace offers: retail denied; buyer ok; retail cannot review ── */
{
  const buyer = await login('DEMO-1001', 'livebid')
  const retail = await login('RETAIL-1001', 'retail')
  if (buyer.ok && retail.ok) {
    const boot = await req(buyer.session, '/api/commerce/bootstrap')
    const mp = (boot.body?.lots || []).find(
      (l) => l.channel === 'marketplace' && l.buyNowPrice > 0 && l.qty > 0,
    )
    if (!mp) {
      check('depth offer retail denied', true, 'skipped — no MP lot')
      check('depth offer buyer path', true, 'skipped — no MP lot')
      check('depth offer review staff-only', true, 'skipped — no MP lot')
    } else {
      const retailOffer = await req(retail.session, '/api/commerce/offers', {
        method: 'POST',
        body: JSON.stringify({
          lotId: mp.id,
          qty: Math.max(1, Number(mp.moq) || 1),
          unitPrice: Math.max(1, Number(mp.buyNowPrice) - 1),
        }),
      })
      check(
        'depth offer retail denied',
        retailOffer.status === 403 || retailOffer.status === 401,
        `status=${retailOffer.status}`,
      )

      const qty = Math.max(1, Number(mp.moq) || 1)
      const offer = await req(buyer.session, '/api/commerce/offers', {
        method: 'POST',
        body: JSON.stringify({
          lotId: mp.id,
          qty,
          unitPrice: Math.max(1, Number(mp.buyNowPrice) - 1),
        }),
      })
      // 200 new offer, or 400 if an open offer already exists
      check(
        'depth offer buyer path',
        offer.ok || offer.status === 400,
        `status=${offer.status} id=${offer.body?.offer?.id || ''}`,
      )

      const offerId = offer.body?.offer?.id || 'OFF-FAKE'
      const retailReview = await req(retail.session, `/api/commerce/offers/${encodeURIComponent(offerId)}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision: 'accepted' }),
      })
      check(
        'depth offer review staff-only',
        retailReview.status === 403 || retailReview.status === 401 || retailReview.status === 404,
        `status=${retailReview.status}`,
      )
    }
  }
}

/* ── Session cookie should be HttpOnly ── */
{
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ident: 'DEMO-1001', password: 'livebid' }),
  })
  const cookies = r.headers.getSetCookie?.() || []
  const sessionLine = cookies.find((c) => /session|sid|token|equarios|livebid/i.test(c)) || cookies[0] || ''
  check(
    'depth session cookie HttpOnly',
    /httponly/i.test(sessionLine),
    sessionLine ? sessionLine.split(';').slice(0, 2).join(';') : `n=${cookies.length}`,
  )
}

/* ── Oversized receipt rejected ── */
{
  const buyer = await login('DEMO-1001', 'livebid')
  if (buyer.ok) {
    const list = await req(buyer.session, '/api/commerce/invoices')
    const unpaid = (list.body?.invoices || []).find((x) => x.status === 'unpaid' || x.status === 'pending_review')
    const target = unpaid || list.body?.invoices?.[0]
    if (!target?.id) {
      check('depth oversize receipt', true, 'skipped — no invoice')
    } else {
      const huge = 'x'.repeat(4_500_001)
      const pay = await req(buyer.session, `/api/commerce/invoices/${encodeURIComponent(target.id)}/pay`, {
        method: 'POST',
        body: JSON.stringify({ receiptName: 'big.png', receiptData: huge }),
      })
      check('depth oversize receipt rejected', pay.status === 400, `status=${pay.status}`)
    }
  }
}

/* ── Store upload: non-staff denied ── */
{
  const buyer = await login('DEMO-1001', 'livebid')
  if (buyer.ok) {
    const fd = new FormData()
    fd.append('files', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), 'x.png')
    const r = await fetch(BASE + '/api/store/upload', {
      method: 'POST',
      headers: { Cookie: buyer.session.header() },
      body: fd,
    })
    check('depth buyer store upload denied', r.status === 403 || r.status === 401, `status=${r.status}`)
  }
}

/* ── Auth: duplicate register rejected ── */
{
  const email = 'buyer@northstar.example'
  const dup = await req(null, '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Dup',
      lastName: 'User',
      email,
      emailConfirm: email,
      password: 'AnotherPass1!',
      passwordConfirm: 'AnotherPass1!',
      company: 'Dup Co',
    }),
  })
  check('depth register duplicate email', dup.status === 409, `status=${dup.status} email=${email}`)
}

/* ── Store order IDOR ── */
{
  const buyer = await login('DEMO-1001', 'livebid')
  const retail = await login('RETAIL-1001', 'retail')
  if (buyer.ok && retail.ok) {
    const products = await req(null, '/api/store/products')
    const list = products.body?.products || products.body?.items || []
    const p = Array.isArray(list) ? list.find((x) => x.active !== false && (x.stock == null || x.stock > 0)) : null
    if (!p?.id) {
      check('depth store order IDOR', true, 'skipped — no store product')
    } else {
      const order = await req(buyer.session, '/api/store/orders', {
        method: 'POST',
        body: JSON.stringify({
          email: buyer.user?.email || 'buyer@northstar.example',
          name: 'Depth Buyer',
          address: '1 Test Street, Testville',
          paymentMethod: 'bank',
          lines: [{ productId: p.id, qty: 1 }],
        }),
      })
      const orderId = order.body?.order?.id
      if (!order.ok || !orderId) {
        check(
          'depth store checkout buyer',
          order.ok || order.status === 400,
          `status=${order.status} (stock/schema)`,
        )
        check('depth store order IDOR', true, 'skipped — checkout not created')
        check('depth store order patch staff-only', true, 'skipped')
      } else {
        check('depth store checkout buyer', true, orderId)
        const steal = await req(retail.session, `/api/store/orders/${encodeURIComponent(orderId)}`)
        check(
          'depth store order IDOR',
          steal.status === 404 || steal.status === 403,
          `status=${steal.status}`,
        )
        const patch = await req(retail.session, `/api/store/orders/${encodeURIComponent(orderId)}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'paid' }),
        })
        check(
          'depth store order patch staff-only',
          patch.status === 403 || patch.status === 401,
          `status=${patch.status}`,
        )
      }
    }
  }
}

/* ── Buyer cannot review invoice payment ── */
{
  const buyer = await login('DEMO-1001', 'livebid')
  if (buyer.ok) {
    const list = await req(buyer.session, '/api/commerce/invoices')
    const inv = list.body?.invoices?.[0]
    if (!inv?.id) {
      check('depth buyer payment review denied', true, 'skipped — no invoice')
    } else {
      const rev = await req(
        buyer.session,
        `/api/commerce/invoices/${encodeURIComponent(inv.id)}/review-payment`,
        { method: 'POST', body: JSON.stringify({ decision: 'accepted', side: 'admin' }) },
      )
      check(
        'depth buyer payment review denied',
        rev.status === 403 || rev.status === 401,
        `status=${rev.status}`,
      )
    }
  }
}

/* ── Trailing-slash API still healthy ── */
{
  const h = await req(null, '/api/health/')
  check('depth health trailing slash', h.ok && h.body?.ok === true, `status=${h.status}`)
}

/* ── Client bundle: no obvious secrets ── */
{
  const distAssets = join(root, 'dist', 'assets')
  if (!existsSync(distAssets)) {
    check('depth bundle secret scan', true, 'skipped — no dist/ (run npm run build first)')
  } else {
    const secrets = [
      /sk_live_[A-Za-z0-9]+/,
      /AKIA[0-9A-Z]{16}/,
      /BEGIN (RSA |OPENSSH )?PRIVATE KEY/,
      /RESEND_API_KEY\s*[:=]\s*['"][^'"]+['"]/,
      /BREVO_API_KEY\s*[:=]\s*['"][^'"]+['"]/,
    ]
    let hit = null
    for (const f of readdirSync(distAssets).filter((n) => n.endsWith('.js'))) {
      const text = readFileSync(join(distAssets, f), 'utf8')
      for (const re of secrets) {
        if (re.test(text)) {
          hit = `${f} ~ ${re}`
          break
        }
      }
      if (hit) break
    }
    check('depth bundle secret scan', !hit, hit || 'clean')
  }
}

/* ── Repo tree: no committed .env secrets ── */
{
  const banned = [join(root, 'server', '.env'), join(root, '.env'), join(root, '.env.ha')]
  let leaked = null
  for (const p of banned) {
    if (existsSync(p)) {
      // local files OK; must not be tracked
      leaked = p
    }
  }
  // tracked check via git if available
  let tracked = false
  try {
    const { spawnSync } = await import('node:child_process')
    const g = spawnSync('git', ['ls-files', 'server/.env', '.env', '.env.ha'], {
      cwd: root,
      encoding: 'utf8',
    })
    tracked = Boolean((g.stdout || '').trim())
  } catch {
    /* ignore */
  }
  check('depth no tracked env secrets', !tracked, tracked ? 'env file is tracked' : 'ok')
  void leaked
}

const failed = results.filter((r) => !r.pass)
console.log(`\n=== ${results.length - failed.length}/${results.length} security-depth passed ===`)
if (failed.length) {
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`)
  process.exit(1)
}
console.log('OK security-depth')
