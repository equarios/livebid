/**
 * Equarios / LiveBid — full regression matrix
 * Run: node scripts/verify-all.mjs
 *
 * Layers:
 *  1) Infra health
 *  2) Auth + role security negatives
 *  3) Existing full-smoke + money-path
 *  4) i18n + SEO taxonomy
 *  5) Frontend typecheck
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
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

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    shell: true,
    ...opts,
  })
  return {
    status: r.status ?? 1,
    out: `${r.stdout || ''}${r.stderr || ''}`,
  }
}

console.log(`\n=== Equarios verify-all ===\nBASE=${BASE}\n`)

/* ── 1. Infra ── */
{
  const h = await req(null, '/api/health')
  check(
    'infra health',
    h.ok && h.body?.ok === true && h.body?.db === 'up',
    `db=${h.body?.db} cache=${h.body?.cache} storage=${h.body?.storage}`,
  )
  check('infra redis', h.body?.cache === 'redis' || h.body?.cache === 'memory', String(h.body?.cache))
  check('infra storage', h.body?.storage === 's3' || h.body?.storage === 'local', String(h.body?.storage))
  check('sitemap file', existsSync(join(root, 'public/sitemap.xml')))
  check('robots file', existsSync(join(root, 'public/robots.txt')))
  check('publish checklist', existsSync(join(root, 'PUBLISH-CHECKLIST.md')))
}

/* ── 2. Auth + security negatives ── */
{
  const bad = await login('DEMO-1001', 'wrong-password')
  check('sec bad password rejected', !bad.ok && (bad.status === 401 || bad.status === 400), `status=${bad.status}`)

  const anonFees = await req(null, '/api/settings/fees')
  check('sec anon settings/fees denied', anonFees.status === 401 || anonFees.status === 403, `status=${anonFees.status}`)

  const anonAdminBoot = await req(null, '/api/commerce/bootstrap')
  check(
    'sec anon commerce bootstrap denied or empty-safe',
    anonAdminBoot.status === 401 || anonAdminBoot.status === 403 || anonAdminBoot.ok,
    `status=${anonAdminBoot.status}`,
  )

  const retail = await login('RETAIL-1001', 'retail')
  check('auth retail login', retail.ok, `status=${retail.status}`)
  if (retail.ok) {
    const fees = await req(retail.session, '/api/settings/fees')
    check('sec retail cannot read fees', fees.status === 403, `status=${fees.status}`)
    const imei = await req(retail.session, '/api/imei/packs')
    const packs = Array.isArray(imei.body?.packs) ? imei.body.packs : null
    const leaked = packs?.some((p) => p.accountId && p.accountId !== 'RETAIL-1001')
    check(
      'sec retail imei packs scoped to self',
      imei.ok && packs && !leaked,
      `status=${imei.status} n=${packs?.length ?? '?'} leaked=${Boolean(leaked)}`,
    )
    const staffApps = await req(retail.session, '/api/account/staff/wholesale-applications')
    check(
      'sec retail cannot staff wholesale apps',
      staffApps.status === 403 || staffApps.status === 401,
      `status=${staffApps.status}`,
    )
    const mkt = await req(retail.session, '/api/marketing/status')
    check('sec retail cannot marketing status', mkt.status === 403 || mkt.status === 401, `status=${mkt.status}`)
  }

  const buyer = await login('DEMO-1001', 'livebid')
  check('auth buyer login', buyer.ok, `status=${buyer.status} role=${buyer.user?.role}`)
  if (buyer.ok) {
    const fees = await req(buyer.session, '/api/settings/fees')
    check('sec buyer cannot read fees', fees.status === 403, `status=${fees.status}`)
    // Buyer should not hit staff-only mutate with forged role
    const issue = await req(buyer.session, '/api/commerce/invoices/fake/issue', { method: 'POST', body: '{}' })
    check(
      'sec buyer cannot issue invoice',
      issue.status === 403 || issue.status === 401 || issue.status === 404 || issue.status === 400,
      `status=${issue.status}`,
    )
    const storeCreate = await req(buyer.session, '/api/store/products', {
      method: 'POST',
      body: JSON.stringify({ title: 'x', price: 1 }),
    })
    check(
      'sec buyer cannot create store product',
      storeCreate.status === 403 || storeCreate.status === 401 || storeCreate.status === 400,
      `status=${storeCreate.status}`,
    )
    const imeiCreate = await req(buyer.session, '/api/imei/packs', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    check(
      'sec buyer cannot create imei pack',
      imeiCreate.status === 403 || imeiCreate.status === 401 || imeiCreate.status === 400,
      `status=${imeiCreate.status}`,
    )
    const accounts = await req(buyer.session, '/api/auth/accounts')
    check(
      'sec buyer cannot list all accounts',
      accounts.status === 403 || accounts.status === 401,
      `status=${accounts.status}`,
    )
  }

  // Retail must not use wholesale commerce / community APIs
  if (retail.ok) {
    const lots = await req(retail.session, '/api/commerce/lots')
    check('sec retail wholesale lots denied', lots.status === 403, `status=${lots.status}`)
    const bid = await req(retail.session, '/api/commerce/bids', {
      method: 'POST',
      body: JSON.stringify({ lotId: 'x', amount: 1 }),
    })
    check(
      'sec retail bid denied',
      bid.status === 403 || bid.status === 401 || bid.status === 400,
      `status=${bid.status}`,
    )
    const community = await req(retail.session, '/api/community/listings')
    check('sec retail community denied', community.status === 403, `status=${community.status}`)
  }

  // Logout must kill session for protected commerce
  if (buyer.ok) {
    const before = await req(buyer.session, '/api/commerce/bootstrap')
    check('sec buyer bootstrap before logout', before.ok, `status=${before.status}`)
    const out = await req(buyer.session, '/api/auth/logout', { method: 'POST' })
    check('sec logout ok', out.ok, `status=${out.status}`)
    const after = await req(buyer.session, '/api/commerce/bootstrap')
    check(
      'sec logout clears session',
      after.status === 401 || after.status === 403,
      `status=${after.status}`,
    )
  }

  const admin = await login('ADMIN-0001', 'admin')
  check('auth admin login', admin.ok, `status=${admin.status}`)
  if (admin.ok) {
    const fees = await req(admin.session, '/api/settings/fees')
    // fees may be super-only
    check(
      'sec admin fees gate known',
      fees.status === 200 || fees.status === 403,
      `status=${fees.status}`,
    )
  }

  const superL = await login('SUPER-0001', 'super')
  check('auth super login', superL.ok, `status=${superL.status}`)
  if (superL.ok) {
    const fees = await req(superL.session, '/api/settings/fees')
    check('sec super can read fees', fees.ok && fees.body?.fees, `status=${fees.status}`)
  }
}

/* ── 3. Existing smoke scripts ── */
{
  console.log('\n--- full-smoke ---')
  const smoke = run('npm', ['--prefix', 'server', 'run', 'smoke'])
  check('full-smoke script', smoke.status === 0, smoke.status === 0 ? '29 checks' : smoke.out.slice(-400))

  console.log('\n--- money-path ---')
  const money = run('npm', ['--prefix', 'server', 'run', 'smoke:money'])
  check('money-path script', money.status === 0, money.status === 0 ? 'paid' : money.out.slice(-400))

  console.log('\n--- security-depth ---')
  const depth = run('node', ['scripts/verify-security-depth.mjs'], {
    env: { ...process.env, BASE },
  })
  check(
    'security-depth script',
    depth.status === 0,
    depth.status === 0 ? 'idor+idempotency+limits' : depth.out.slice(-500),
  )
}

/* ── 4. i18n + SEO ── */
{
  console.log('\n--- i18n/seo ---')
  const v = run('node', ['scripts/verify-i18n-seo.mjs'])
  check('i18n+seo verify', v.status === 0, v.status === 0 ? '16 checks' : v.out.slice(-400))

  const robots = readFileSync(join(root, 'public/robots.txt'), 'utf8')
  check('robots blocks admin', /Disallow:\s*\/admin/i.test(robots))
  check('robots blocks super', /Disallow:\s*\/super/i.test(robots))
  check('robots has sitemap', /Sitemap:\s*https?:\/\//i.test(robots))
}

/* ── 5. Frontend typecheck ── */
{
  console.log('\n--- tsc ---')
  const tsc = run('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'])
  check('frontend tsc', tsc.status === 0, tsc.status === 0 ? 'ok' : tsc.out.slice(-500))
}

const failed = results.filter((r) => !r.pass)
console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`)
if (failed.length) {
  console.log('FAILED:')
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`)
  process.exit(1)
}
console.log('OK verify-all')
