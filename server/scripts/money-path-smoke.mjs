/** One-shot money-path smoke against local API. */
const base = process.env.API_BASE || 'http://localhost:8787'

function jar() {
  const cookies = new Map()
  return {
    store(res) {
      const raw = res.headers.getSetCookie?.() || []
      for (const line of raw) {
        const part = line.split(';')[0]
        const i = part.indexOf('=')
        if (i > 0) cookies.set(part.slice(0, i), part.slice(i + 1))
      }
    },
    header() {
      return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
    },
  }
}

async function req(session, path, opts = {}) {
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Cookie: session.header(),
      ...(opts.headers || {}),
    },
  })
  session.store(res)
  const text = await res.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!res.ok) {
    const err = new Error(`${opts.method || 'GET'} ${path} → ${res.status} ${JSON.stringify(body)}`)
    err.status = res.status
    err.body = body
    throw err
  }
  return body
}

async function login(ident, password) {
  const session = jar()
  await req(session, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ ident, password }),
  })
  return session
}

const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

async function main() {
  const health = await fetch(`${base}/api/health`).then((r) => r.json())
  console.log('health', health.ok, health.db)

  const buyer = await login('DEMO-1001', 'livebid')
  const boot = await req(buyer, '/api/commerce/bootstrap')
  const lot = (boot.lots || []).find(
    (l) => l.channel === 'marketplace' && l.buyNowPrice > 0 && l.qty > 0,
  )
  if (!lot) throw new Error('No marketplace lot')
  console.log('lot', lot.id, lot.buyNowPrice)

  try {
    await req(buyer, `/api/commerce/cart/${encodeURIComponent(lot.id)}`, { method: 'DELETE' })
  } catch {
    /* empty */
  }
  await req(buyer, '/api/commerce/cart', {
    method: 'POST',
    body: JSON.stringify({ lotId: lot.id, qty: 1 }),
  })
  const { order } = await req(buyer, '/api/commerce/cart/checkout', { method: 'POST' })
  console.log('cart', order.id)

  const admin = await login('ADMIN-0001', 'admin')
  await req(admin, `/api/commerce/cart-orders/${encodeURIComponent(order.id)}/review`, {
    method: 'POST',
    body: JSON.stringify({ decision: 'accepted' }),
  })
  console.log('admin accepted cart')

  const buyer2 = await login('DEMO-1001', 'livebid')
  const { invoice } = await req(
    buyer2,
    `/api/commerce/cart-orders/${encodeURIComponent(order.id)}/confirm`,
    { method: 'POST' },
  )
  console.log('draft', invoice.id, invoice.status)

  const superS = await login('SUPER-0001', 'super')
  const i1 = await req(superS, `/api/commerce/invoices/${encodeURIComponent(invoice.id)}/issue`, {
    method: 'POST',
    body: JSON.stringify({ side: 'admin', decision: 'accepted' }),
  })
  console.log('issue admin', i1.invoice.status)
  const i2 = await req(superS, `/api/commerce/invoices/${encodeURIComponent(invoice.id)}/issue`, {
    method: 'POST',
    body: JSON.stringify({ side: 'super', decision: 'accepted' }),
  })
  console.log('issue super', i2.invoice.status, 'issuedAt', i2.invoice.issuedAt)

  const buyer3 = await login('DEMO-1001', 'livebid')
  const list = await req(buyer3, '/api/commerce/invoices')
  const mine = (list.invoices || []).find((x) => x.id === invoice.id)
  console.log('buyer sees', mine?.id, mine?.status)
  if (!mine || mine.status !== 'unpaid') throw new Error('Buyer should see unpaid invoice')

  const pay = await req(buyer3, `/api/commerce/invoices/${encodeURIComponent(invoice.id)}/pay`, {
    method: 'POST',
    body: JSON.stringify({ receiptName: 'receipt.png', receiptData: png }),
  })
  console.log('receipt', pay.invoice.status)

  const aPay = await req(
    admin,
    `/api/commerce/invoices/${encodeURIComponent(invoice.id)}/review-payment`,
    {
      method: 'POST',
      body: JSON.stringify({ side: 'admin', decision: 'accepted' }),
    },
  )
  console.log('pay admin', aPay.invoice.status)
  const sPay = await req(
    superS,
    `/api/commerce/invoices/${encodeURIComponent(invoice.id)}/review-payment`,
    {
      method: 'POST',
      body: JSON.stringify({ side: 'super', decision: 'accepted' }),
    },
  )
  console.log('pay super', sPay.invoice.status)
  if (sPay.invoice.status !== 'paid') throw new Error('Expected paid')

  const final = (await req(buyer3, '/api/commerce/invoices')).invoices.find(
    (x) => x.id === invoice.id,
  )
  console.log('FINAL', final.id, final.status)
  console.log('OK money path')
}

main().catch((e) => {
  console.error('FAIL', e.message)
  process.exit(1)
})
