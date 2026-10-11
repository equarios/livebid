import { Hono } from 'hono'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { requireStaff, requireUser, type AuthedEnv, type SessionUser } from '../auth'
import { prisma } from '../db'

export const imeiRoutes = new Hono<AuthedEnv>()

function isStaff(user: SessionUser) {
  return user.role === 'admin' || user.role === 'superadmin'
}

function normImei(raw: string) {
  return raw.replace(/[\s-]/g, '').trim()
}

function validImei(imei: string) {
  return /^\d{14,16}$/.test(imei)
}

const rowSchema = z.object({
  imei: z.string().min(1),
  unlockCode: z.string().min(1),
  model: z.string().optional(),
  box: z.string().optional(),
})

function cleanRows(raw: z.infer<typeof rowSchema>[]) {
  const out: Array<{ imei: string; unlockCode: string; model: string | null; box: string | null }> = []
  const seen = new Set<string>()
  for (const r of raw) {
    const imei = normImei(r.imei)
    const unlockCode = r.unlockCode.trim()
    if (!validImei(imei) || !unlockCode) continue
    if (seen.has(imei)) continue
    seen.add(imei)
    out.push({
      imei,
      unlockCode,
      model: r.model?.trim() || null,
      box: r.box?.trim() || null,
    })
  }
  return out
}

async function canAccessPack(user: SessionUser, pack: { accountId: string | null }) {
  if (isStaff(user)) return true
  return Boolean(pack.accountId && pack.accountId === user.accountId)
}

function mapPackSummary(
  p: {
    id: string
    title: string
    accountId: string | null
    invoiceId: string | null
    note: string | null
    createdBy: string
    createdAt: Date
    _count: { devices: number }
    account?: { company: string; accountId: string } | null
  },
) {
  return {
    id: p.id,
    title: p.title,
    accountId: p.accountId,
    invoiceId: p.invoiceId,
    note: p.note,
    createdBy: p.createdBy,
    createdAt: p.createdAt.toISOString(),
    rowCount: p._count.devices,
    company: p.account?.company ?? null,
  }
}

imeiRoutes.get('/packs', requireUser, async (c) => {
  const user = c.get('user')
  const packs = await prisma.imeiPack.findMany({
    where: isStaff(user) ? undefined : { accountId: user.accountId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { devices: true } },
      account: { select: { accountId: true, company: true } },
    },
  })
  return c.json({ packs: packs.map(mapPackSummary) })
})

imeiRoutes.get('/packs/:id', requireUser, async (c) => {
  const user = c.get('user')
  const pack = await prisma.imeiPack.findUnique({
    where: { id: c.req.param('id') },
    include: {
      devices: { orderBy: { imei: 'asc' } },
      account: { select: { accountId: true, company: true } },
      _count: { select: { devices: true } },
    },
  })
  if (!pack) return c.json({ error: 'Pack not found.' }, 404)
  if (!(await canAccessPack(user, pack))) return c.json({ error: 'Not allowed.' }, 403)
  return c.json({
    pack: mapPackSummary(pack),
    devices: pack.devices.map((d) => ({
      id: d.id,
      imei: d.imei,
      unlockCode: d.unlockCode,
      model: d.model,
      box: d.box,
    })),
  })
})

imeiRoutes.post('/packs', requireUser, requireStaff, async (c) => {
  const user = c.get('user')
  const body = z
    .object({
      title: z.string().min(1).max(120),
      accountId: z.string().optional().nullable(),
      invoiceId: z.string().optional().nullable(),
      note: z.string().optional().nullable(),
      rows: z.array(rowSchema).optional().default([]),
    })
    .safeParse(await c.req.json())
  if (!body.success) return c.json({ error: 'Invalid pack payload.' }, 400)

  const rows = cleanRows(body.data.rows)
  if (body.data.rows.length > 0 && !rows.length) {
    return c.json({ error: 'No valid IMEI rows (need 14–16 digit IMEI + unlock code).' }, 400)
  }

  const accountId = body.data.accountId?.trim() || null
  if (accountId) {
    const acc = await prisma.account.findUnique({ where: { accountId } })
    if (!acc) return c.json({ error: 'Buyer account not found.' }, 400)
  }

  const pack = await prisma.imeiPack.create({
    data: {
      title: body.data.title.trim(),
      accountId,
      invoiceId: body.data.invoiceId?.trim() || null,
      note: body.data.note?.trim() || null,
      createdBy: user.accountId,
      devices: rows.length ? { create: rows } : undefined,
    },
    include: {
      _count: { select: { devices: true } },
      account: { select: { accountId: true, company: true } },
    },
  })

  return c.json({ pack: mapPackSummary(pack) }, 201)
})

imeiRoutes.patch('/packs/:id', requireUser, requireStaff, async (c) => {
  const body = z
    .object({
      title: z.string().min(1).max(120).optional(),
      accountId: z.string().nullable().optional(),
      invoiceId: z.string().nullable().optional(),
      note: z.string().nullable().optional(),
    })
    .safeParse(await c.req.json())
  if (!body.success) return c.json({ error: 'Invalid update.' }, 400)

  const existing = await prisma.imeiPack.findUnique({ where: { id: c.req.param('id') } })
  if (!existing) return c.json({ error: 'Pack not found.' }, 404)

  if (body.data.accountId) {
    const acc = await prisma.account.findUnique({ where: { accountId: body.data.accountId } })
    if (!acc) return c.json({ error: 'Buyer account not found.' }, 400)
  }

  const pack = await prisma.imeiPack.update({
    where: { id: existing.id },
    data: {
      title: body.data.title?.trim(),
      accountId: body.data.accountId === undefined ? undefined : body.data.accountId?.trim() || null,
      invoiceId: body.data.invoiceId === undefined ? undefined : body.data.invoiceId?.trim() || null,
      note: body.data.note === undefined ? undefined : body.data.note?.trim() || null,
    },
    include: {
      _count: { select: { devices: true } },
      account: { select: { accountId: true, company: true } },
    },
  })
  return c.json({ pack: mapPackSummary(pack) })
})

imeiRoutes.post('/packs/:id/rows', requireUser, requireStaff, async (c) => {
  const body = z.object({ rows: z.array(rowSchema).min(1) }).safeParse(await c.req.json())
  if (!body.success) return c.json({ error: 'Invalid rows.' }, 400)

  const pack = await prisma.imeiPack.findUnique({ where: { id: c.req.param('id') } })
  if (!pack) return c.json({ error: 'Pack not found.' }, 404)

  const rows = cleanRows(body.data.rows)
  if (!rows.length) return c.json({ error: 'No valid IMEI rows.' }, 400)

  let upserted = 0
  for (const row of rows) {
    await prisma.imeiDevice.upsert({
      where: { packId_imei: { packId: pack.id, imei: row.imei } },
      create: { packId: pack.id, ...row },
      update: { unlockCode: row.unlockCode, model: row.model, box: row.box },
    })
    upserted++
  }

  const next = await prisma.imeiPack.findUnique({
    where: { id: pack.id },
    include: {
      _count: { select: { devices: true } },
      account: { select: { accountId: true, company: true } },
    },
  })
  return c.json({ pack: next ? mapPackSummary(next) : null, upserted })
})

imeiRoutes.delete('/packs/:id', requireUser, requireStaff, async (c) => {
  const existing = await prisma.imeiPack.findUnique({ where: { id: c.req.param('id') } })
  if (!existing) return c.json({ error: 'Pack not found.' }, 404)
  await prisma.imeiPack.delete({ where: { id: existing.id } })
  return c.json({ ok: true })
})

imeiRoutes.patch('/devices/:id', requireUser, requireStaff, async (c) => {
  const body = z
    .object({
      imei: z.string().optional(),
      unlockCode: z.string().optional(),
      model: z.string().nullable().optional(),
      box: z.string().nullable().optional(),
    })
    .safeParse(await c.req.json())
  if (!body.success) return c.json({ error: 'Invalid device update.' }, 400)

  const existing = await prisma.imeiDevice.findUnique({ where: { id: c.req.param('id') } })
  if (!existing) return c.json({ error: 'Device not found.' }, 404)

  const nextImei = body.data.imei != null ? normImei(body.data.imei) : existing.imei
  if (!validImei(nextImei)) return c.json({ error: 'IMEI must be 14–16 digits.' }, 400)
  const unlockCode =
    body.data.unlockCode != null ? body.data.unlockCode.trim() : existing.unlockCode
  if (!unlockCode) return c.json({ error: 'Unlock code required.' }, 400)

  if (nextImei !== existing.imei) {
    const clash = await prisma.imeiDevice.findUnique({
      where: { packId_imei: { packId: existing.packId, imei: nextImei } },
    })
    if (clash) return c.json({ error: 'That IMEI already exists in this pack.' }, 409)
  }

  const device = await prisma.imeiDevice.update({
    where: { id: existing.id },
    data: {
      imei: nextImei,
      unlockCode,
      model:
        body.data.model === undefined
          ? undefined
          : body.data.model?.trim() || null,
      box: body.data.box === undefined ? undefined : body.data.box?.trim() || null,
    },
  })
  return c.json({
    device: {
      id: device.id,
      imei: device.imei,
      unlockCode: device.unlockCode,
      model: device.model,
      box: device.box,
      packId: device.packId,
    },
  })
})

imeiRoutes.delete('/devices/:id', requireUser, requireStaff, async (c) => {
  const existing = await prisma.imeiDevice.findUnique({ where: { id: c.req.param('id') } })
  if (!existing) return c.json({ error: 'Device not found.' }, 404)
  await prisma.imeiDevice.delete({ where: { id: existing.id } })
  return c.json({ ok: true, packId: existing.packId })
})

function mapDeviceRow(d: {
  id: string
  imei: string
  unlockCode: string
  model: string | null
  box: string | null
  pack: { id: string; title: string; accountId: string | null; invoiceId: string | null }
}) {
  return {
    id: d.id,
    imei: d.imei,
    unlockCode: d.unlockCode,
    model: d.model,
    box: d.box,
    packId: d.pack.id,
    packTitle: d.pack.title,
    invoiceId: d.pack.invoiceId,
    accountId: d.pack.accountId,
  }
}

/** Staff: browse / filter all devices across packs (paginated). */
imeiRoutes.get('/devices', requireUser, requireStaff, async (c) => {
  const q = String(c.req.query('q') || '').trim()
  const accountId = String(c.req.query('accountId') || '').trim()
  const packId = String(c.req.query('packId') || '').trim()
  const invoiceId = String(c.req.query('invoiceId') || '').trim()
  const take = Math.min(500, Math.max(1, Number(c.req.query('take') || 200) || 200))
  const skip = Math.max(0, Number(c.req.query('skip') || 0) || 0)
  const digits = normImei(q)

  const where: Prisma.ImeiDeviceWhereInput = {}

  if (packId) where.packId = packId

  const packFilter: Prisma.ImeiPackWhereInput = {}
  if (accountId) packFilter.accountId = accountId
  if (invoiceId) packFilter.invoiceId = invoiceId
  if (Object.keys(packFilter).length) where.pack = packFilter

  if (q) {
    where.OR = [
      ...(digits.length >= 4 ? [{ imei: { contains: digits } }] : []),
      { unlockCode: { contains: q } },
      { model: { contains: q } },
      { box: { contains: q } },
      { pack: { title: { contains: q } } },
      { pack: { accountId: { contains: q } } },
      { pack: { invoiceId: { contains: q } } },
    ]
  }

  const [total, devices] = await Promise.all([
    prisma.imeiDevice.count({ where }),
    prisma.imeiDevice.findMany({
      where,
      take,
      skip,
      orderBy: [{ packId: 'asc' }, { imei: 'asc' }],
      include: {
        pack: {
          select: { id: true, title: true, accountId: true, invoiceId: true },
        },
      },
    }),
  ])

  return c.json({
    total,
    take,
    skip,
    devices: devices.map(mapDeviceRow),
  })
})

imeiRoutes.get('/search', requireUser, async (c) => {
  const user = c.get('user')
  const raw = String(c.req.query('q') || '').trim()
  const digits = normImei(raw)
  const staff = isStaff(user)

  if (staff) {
    if (raw.length < 2) {
      return c.json({ error: 'Enter at least 2 characters (IMEI, unlock, buyer, pack, or invoice).' }, 400)
    }
  } else if (!validImei(digits) && digits.length < 8) {
    return c.json({ error: 'Enter at least 8 digits, or a full IMEI.' }, 400)
  }

  const devices = await prisma.imeiDevice.findMany({
    where: staff
      ? {
          OR: [
            ...(digits.length >= 4 ? [{ imei: digits.length >= 14 ? digits : { contains: digits } }] : []),
            { unlockCode: { contains: raw } },
            { model: { contains: raw } },
            { box: { contains: raw } },
            { pack: { title: { contains: raw } } },
            { pack: { accountId: { contains: raw } } },
            { pack: { invoiceId: { contains: raw } } },
          ],
        }
      : {
          imei: digits.length >= 14 ? digits : { contains: digits },
          pack: { accountId: user.accountId },
        },
    take: staff ? 100 : 40,
    orderBy: { imei: 'asc' },
    include: {
      pack: {
        select: {
          id: true,
          title: true,
          accountId: true,
          invoiceId: true,
        },
      },
    },
  })

  return c.json({
    query: raw,
    matches: devices.map(mapDeviceRow),
  })
})
