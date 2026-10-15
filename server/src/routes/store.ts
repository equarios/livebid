import { Hono } from 'hono'
import { z } from 'zod'
import {
  optionalUser,
  requireStaff,
  requireUser,
  type AuthedEnv,
  type SessionUser,
} from '../auth'
import { prisma } from '../db'
import { readFulfillment } from '../feeConfig'
import {
  isFulfillmentMode,
  isValidPickupDate,
  publicStoreFulfillment,
  resolveShippingQuote,
  type FulfillmentMode,
} from '../fulfillment'
import { normalizeOrigin } from '../origins'
import { assertPickupSlotOpen, slotOccupancyForDate } from '../pickupCapacity'
import { ensureShippingAddendum } from '../shippingAddendum'
import { notify } from '../notify'
import {
  MAX_STORE_IMAGES,
  MAX_UPLOAD_BYTES,
  normalizeImageList,
  processAndSaveStoreImage,
} from '../storeImages'

export const storeRoutes = new Hono<AuthedEnv>()

function isStaff(user: SessionUser | undefined) {
  return user?.role === 'admin' || user?.role === 'superadmin'
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || `item-${Date.now().toString(36)}`
}

function mapProduct(p: {
  id: string
  title: string
  slug: string
  description: string
  price: number
  compareAt: number | null
  stock: number
  category: string
  brand?: string | null
  modelNumber?: string | null
  capacity?: string | null
  color?: string | null
  grade?: string | null
  battery?: number | null
  origin?: string | null
  simLocked?: boolean | null
  activationLocked?: boolean | null
  imageUrl: string | null
  images?: unknown
  active: boolean
  createdAt: Date
  updatedAt: Date
}) {
  const images = normalizeImageList(p.images, p.imageUrl)
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    description: p.description,
    price: p.price,
    compareAt: p.compareAt,
    stock: p.stock,
    category: p.category,
    brand: (p.brand || '').trim(),
    modelNumber: (p.modelNumber || '').trim(),
    capacity: (p.capacity || '').trim(),
    color: (p.color || '').trim(),
    grade: (p.grade || '').trim(),
    battery: Math.max(0, Math.floor(Number(p.battery) || 0)),
    origin: normalizeOrigin(p.origin),
    simLocked: Boolean(p.simLocked),
    activationLocked: Boolean(p.activationLocked),
    imageUrl: images[0] || null,
    images,
    active: p.active,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }
}

const storeSpecFields = {
  modelNumber: z.string().max(80).optional(),
  capacity: z.string().max(40).optional(),
  color: z.string().max(40).optional(),
  grade: z.string().max(16).optional(),
  battery: z.number().int().min(0).max(100).optional(),
  origin: z.string().max(8).optional(),
  simLocked: z.boolean().optional(),
  activationLocked: z.boolean().optional(),
}

function specDataFromBody(data: {
  modelNumber?: string
  capacity?: string
  color?: string
  grade?: string
  battery?: number
  origin?: string
  simLocked?: boolean
  activationLocked?: boolean
}) {
  return {
    modelNumber: data.modelNumber !== undefined ? data.modelNumber.trim() : undefined,
    capacity: data.capacity !== undefined ? data.capacity.trim() : undefined,
    color: data.color !== undefined ? data.color.trim() : undefined,
    grade: data.grade !== undefined ? data.grade.trim() : undefined,
    battery: data.battery !== undefined ? data.battery : undefined,
    origin: data.origin !== undefined ? normalizeOrigin(data.origin) : undefined,
    simLocked: data.simLocked,
    activationLocked: data.activationLocked,
  }
}

function mapOrder(o: {
  id: string
  accountId: string | null
  email: string
  name: string
  phone: string | null
  address: string
  fulfillmentMode?: string | null
  courierCarrier?: string | null
  courierAccount?: string | null
  readyForCollect?: boolean | null
  shippingFeeQuoted?: boolean | null
  pickupDate?: string | null
  pickupSlot?: string | null
  status: string
  paymentMethod: string
  paymentRef: string | null
  subtotal: number
  shippingFee: number
  total: number
  note: string | null
  createdAt: Date
  paidAt: Date | null
  shippedAt: Date | null
  lines: Array<{
    id: string
    productId: string | null
    title: string
    unitPrice: number
    qty: number
  }>
}) {
  const mode = isFulfillmentMode(o.fulfillmentMode) ? o.fulfillmentMode : 'delivery'
  return {
    id: o.id,
    accountId: o.accountId,
    email: o.email,
    name: o.name,
    phone: o.phone,
    address: o.address,
    fulfillmentMode: mode,
    courierCarrier: o.courierCarrier ?? null,
    courierAccount: o.courierAccount ?? null,
    readyForCollect: Boolean(o.readyForCollect),
    shippingFeeQuoted: o.shippingFeeQuoted !== false,
    pickupDate: o.pickupDate ?? null,
    pickupSlot: o.pickupSlot ?? null,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentRef: o.paymentRef,
    subtotal: o.subtotal,
    shippingFee: o.shippingFee,
    total: o.total,
    note: o.note,
    createdAt: o.createdAt.toISOString(),
    paidAt: o.paidAt?.toISOString() ?? null,
    shippedAt: o.shippedAt?.toISOString() ?? null,
    lines: o.lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      title: l.title,
      unitPrice: l.unitPrice,
      qty: l.qty,
    })),
  }
}

/** Public store checkout policy (guests + buyers). */
storeRoutes.get('/fulfillment', (c) => {
  return c.json({ fulfillment: publicStoreFulfillment(readFulfillment()) })
})

/** Remaining capacity per pickup window for a date (YYYY-MM-DD). */
storeRoutes.get('/fulfillment/slots', async (c) => {
  const cfg = readFulfillment()
  const date = String(c.req.query('date') || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isValidPickupDate(date, cfg)) {
    return c.json({ error: 'Choose a valid pickup date.' }, 400)
  }
  const slots = await slotOccupancyForDate(date, cfg)
  return c.json({ date, pickupSlotCap: cfg.pickupSlotCap, slots })
})

storeRoutes.get('/products', optionalUser, async (c) => {
  const user = c.get('user')
  const staff = isStaff(user)
  const category = String(c.req.query('category') || '').trim()
  const q = String(c.req.query('q') || '').trim()

  const soldFreshSince = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const products = await prisma.storeProduct.findMany({
    where: {
      // Public: active only; sold-out kept for 14 days (updatedAt), then hidden. Staff sees all.
      ...(staff
        ? {}
        : {
            active: true,
            OR: [{ stock: { gt: 0 } }, { stock: 0, updatedAt: { gte: soldFreshSince } }],
          }),
      ...(category ? { category } : {}),
      ...(q
        ? {
            AND: [
              {
                OR: [
                  { title: { contains: q } },
                  { description: { contains: q } },
                  { category: { contains: q } },
                  { brand: { contains: q } },
                ],
              },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
  })
  return c.json({ products: products.map(mapProduct) })
})

storeRoutes.get('/products/:idOrSlug', optionalUser, async (c) => {
  const user = c.get('user')
  const key = c.req.param('idOrSlug')
  const product = await prisma.storeProduct.findFirst({
    where: { OR: [{ id: key }, { slug: key }] },
  })
  if (!product) return c.json({ error: 'Product not found.' }, 404)
  if (!product.active && !isStaff(user)) return c.json({ error: 'Product not found.' }, 404)
  return c.json({ product: mapProduct(product) })
})

/** Multi-file upload — auto resize / WebP. Returns public URL paths. */
storeRoutes.post('/upload', requireUser, requireStaff, async (c) => {
  const body = await c.req.parseBody({ all: true })
  const raw = body['files'] ?? body['file']
  const list = Array.isArray(raw) ? raw : raw ? [raw] : []
  const files = list.filter((f): f is File => typeof f === 'object' && f !== null && 'arrayBuffer' in f)

  if (!files.length) return c.json({ error: 'Choose one or more image files.' }, 400)
  if (files.length > MAX_STORE_IMAGES) {
    return c.json({ error: `Upload at most ${MAX_STORE_IMAGES} images at a time.` }, 400)
  }

  const urls: string[] = []
  try {
    for (const file of files) {
      if (file.size > MAX_UPLOAD_BYTES) {
        return c.json({ error: `${file.name || 'Image'} is over 12 MB.` }, 400)
      }
      const buf = Buffer.from(await file.arrayBuffer())
      const url = await processAndSaveStoreImage(buf, file.type || 'application/octet-stream')
      urls.push(url)
    }
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Image processing failed.' }, 400)
  }
  return c.json({ urls })
})

storeRoutes.post('/products', requireUser, requireStaff, async (c) => {
  const body = z
    .object({
      title: z.string().min(1).max(160),
      slug: z.string().optional(),
      description: z.string().optional(),
      price: z.number().positive(),
      compareAt: z.number().positive().nullable().optional(),
      stock: z.number().int().min(0),
      category: z.string().optional(),
      brand: z.string().optional(),
      imageUrl: z.string().nullable().optional(),
      images: z.array(z.string()).max(MAX_STORE_IMAGES).optional(),
      active: z.boolean().optional(),
      ...storeSpecFields,
    })
    .safeParse(await c.req.json())
  if (!body.success) return c.json({ error: 'Invalid product.' }, 400)

  let slug = (body.data.slug?.trim() || slugify(body.data.title)).slice(0, 80)
  const clash = await prisma.storeProduct.findUnique({ where: { slug } })
  if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`

  const images = normalizeImageList(body.data.images, body.data.imageUrl)
  const specs = specDataFromBody(body.data)

  const product = await prisma.storeProduct.create({
    data: {
      title: body.data.title.trim(),
      slug,
      description: body.data.description?.trim() || '',
      price: body.data.price,
      compareAt: body.data.compareAt ?? null,
      stock: body.data.stock,
      category: body.data.category?.trim() || 'Phones',
      brand: body.data.brand?.trim() || '',
      modelNumber: specs.modelNumber || '',
      capacity: specs.capacity || '',
      color: specs.color || '',
      grade: specs.grade || '',
      battery: specs.battery ?? 0,
      origin: specs.origin || 'INT',
      simLocked: specs.simLocked ?? false,
      activationLocked: specs.activationLocked ?? false,
      imageUrl: images[0] || null,
      images,
      active: body.data.active ?? true,
    },
  })
  return c.json({ product: mapProduct(product) }, 201)
})

storeRoutes.patch('/products/:id', requireUser, requireStaff, async (c) => {
  const body = z
    .object({
      title: z.string().min(1).max(160).optional(),
      description: z.string().optional(),
      price: z.number().positive().optional(),
      compareAt: z.number().positive().nullable().optional(),
      stock: z.number().int().min(0).optional(),
      category: z.string().optional(),
      brand: z.string().optional(),
      imageUrl: z.string().nullable().optional(),
      images: z.array(z.string()).max(MAX_STORE_IMAGES).optional(),
      active: z.boolean().optional(),
      ...storeSpecFields,
    })
    .safeParse(await c.req.json())
  if (!body.success) return c.json({ error: 'Invalid update.' }, 400)

  const existing = await prisma.storeProduct.findUnique({ where: { id: c.req.param('id') } })
  if (!existing) return c.json({ error: 'Product not found.' }, 404)

  const imagePatch =
    body.data.images !== undefined
      ? (() => {
          const images = normalizeImageList(body.data.images, body.data.imageUrl)
          return { images, imageUrl: images[0] || null }
        })()
      : body.data.imageUrl !== undefined
        ? (() => {
            const images = normalizeImageList(existing.images, body.data.imageUrl)
            if (body.data.imageUrl?.trim()) {
              const cover = body.data.imageUrl.trim()
              const rest = images.filter((u) => u !== cover)
              const next = [cover, ...rest].slice(0, MAX_STORE_IMAGES)
              return { images: next, imageUrl: cover }
            }
            return { images, imageUrl: images[0] || null }
          })()
        : {}

  const specs = specDataFromBody(body.data)
  const product = await prisma.storeProduct.update({
    where: { id: existing.id },
    data: {
      title: body.data.title?.trim(),
      description: body.data.description?.trim(),
      price: body.data.price,
      compareAt: body.data.compareAt === undefined ? undefined : body.data.compareAt,
      stock: body.data.stock,
      category: body.data.category?.trim(),
      brand: body.data.brand === undefined ? undefined : body.data.brand.trim(),
      ...specs,
      active: body.data.active,
      ...imagePatch,
    },
  })
  return c.json({ product: mapProduct(product) })
})

storeRoutes.delete('/products/:id', requireUser, requireStaff, async (c) => {
  const existing = await prisma.storeProduct.findUnique({ where: { id: c.req.param('id') } })
  if (!existing) return c.json({ error: 'Product not found.' }, 404)
  await prisma.storeProduct.delete({ where: { id: existing.id } })
  return c.json({ ok: true })
})

const checkoutSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  phone: z.string().optional(),
  address: z.string().max(500).optional(),
  note: z.string().max(500).optional(),
  paymentMethod: z.enum(['card', 'paypal', 'bank', 'usdt', 'cash']),
  fulfillmentMode: z.enum(['pickup', 'delivery', 'buyer_courier']).optional(),
  courierCarrier: z.string().max(80).optional(),
  courierAccount: z.string().max(80).optional(),
  pickupDate: z.string().max(12).optional(),
  pickupSlot: z.string().max(40).optional(),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().int().positive().max(99),
      }),
    )
    .min(1)
    .max(40),
})

storeRoutes.post('/orders', optionalUser, async (c) => {
  const user = c.get('user')
  const body = checkoutSchema.safeParse(await c.req.json())
  if (!body.success) return c.json({ error: 'Invalid checkout. Check email, address, and cart.' }, 400)

  const cfg = readFulfillment()
  const mode: FulfillmentMode =
    body.data.fulfillmentMode && cfg.storeModes.includes(body.data.fulfillmentMode)
      ? body.data.fulfillmentMode
      : cfg.defaultStoreMode
  if (!cfg.storeModes.includes(mode)) {
    return c.json({ error: 'No fulfillment options are enabled for the store.' }, 400)
  }

  const address = (body.data.address || '').trim()
  if (mode === 'delivery' && address.length < 8) {
    return c.json({ error: 'Enter a full shipping address for delivery.' }, 400)
  }
  const courierCarrier = (body.data.courierCarrier || '').trim()
  const courierAccount = (body.data.courierAccount || '').trim()
  if (mode === 'buyer_courier' && courierCarrier.length < 2) {
    return c.json({ error: 'Choose your courier (FedEx, UPS, DHL, or Other).' }, 400)
  }
  let pickupDate: string | null = null
  let pickupSlot: string | null = null
  if (mode === 'pickup') {
    pickupDate = (body.data.pickupDate || '').trim() || null
    pickupSlot = (body.data.pickupSlot || '').trim() || null
    if (!pickupDate || !isValidPickupDate(pickupDate, cfg)) {
      return c.json({ error: 'Choose a valid pickup date.' }, 400)
    }
    if (!pickupSlot || !cfg.pickupSlots.includes(pickupSlot)) {
      return c.json({ error: 'Choose a pickup time window.' }, 400)
    }
    const cap = await assertPickupSlotOpen({ date: pickupDate, slot: pickupSlot, cfg })
    if (!cap.ok) return c.json({ error: cap.error }, 409)
  }

  const ids = body.data.lines.map((l) => l.productId)
  const products = await prisma.storeProduct.findMany({
    where: { id: { in: ids }, active: true },
  })
  const byId = new Map(products.map((p) => [p.id, p]))

  const built: Array<{ productId: string; title: string; unitPrice: number; qty: number }> = []
  for (const line of body.data.lines) {
    const p = byId.get(line.productId)
    if (!p) return c.json({ error: 'A product in your cart is no longer available.' }, 400)
    if (p.stock < line.qty) {
      return c.json({ error: `${p.title} only has ${p.stock} in stock.` }, 400)
    }
    built.push({
      productId: p.id,
      title: p.title,
      unitPrice: p.price,
      qty: line.qty,
    })
  }

  const subtotal = built.reduce((s, l) => s + l.unitPrice * l.qty, 0)
  const quote = resolveShippingQuote({ mode, subtotal, cfg })
  const shippingFee = quote.fee
  const total = Math.round((subtotal + shippingFee) * 100) / 100
  const id = `ST-${Date.now().toString(36).toUpperCase()}`
  const shipAddress =
    mode === 'delivery'
      ? address
      : mode === 'pickup'
        ? `PICKUP · ${cfg.pickupLabel} · ${pickupDate} ${pickupSlot}`
        : `BUYER COURIER · ${courierCarrier}${courierAccount ? ` · acct ${courierAccount}` : ''}`

  const order = await prisma.$transaction(async (tx) => {
    for (const line of built) {
      const updated = await tx.storeProduct.updateMany({
        where: { id: line.productId, stock: { gte: line.qty } },
        data: { stock: { decrement: line.qty } },
      })
      if (updated.count !== 1) throw new Error('STOCK')
    }
    return tx.storeOrder.create({
      data: {
        id,
        accountId: user?.accountId ?? null,
        email: body.data.email.trim().toLowerCase(),
        name: body.data.name.trim(),
        phone: body.data.phone?.trim() || null,
        address: shipAddress,
        fulfillmentMode: mode,
        courierCarrier: mode === 'buyer_courier' ? courierCarrier : null,
        courierAccount: mode === 'buyer_courier' ? courierAccount || null : null,
        pickupDate,
        pickupSlot,
        note: body.data.note?.trim() || null,
        paymentMethod: body.data.paymentMethod,
        status: 'pending_payment',
        subtotal,
        shippingFee,
        shippingFeeQuoted: quote.quoted,
        total,
        lines: {
          create: built.map((l) => ({
            productId: l.productId,
            title: l.title,
            unitPrice: l.unitPrice,
            qty: l.qty,
          })),
        },
      },
      include: { lines: true },
    })
  }).catch((e) => {
    if (e instanceof Error && e.message === 'STOCK') return null
    throw e
  })

  if (!order) return c.json({ error: 'Stock changed — refresh cart and try again.' }, 409)
  return c.json({ order: mapOrder(order) }, 201)
})

storeRoutes.get('/orders', requireUser, async (c) => {
  const user = c.get('user')!
  const staff = isStaff(user)
  const orders = await prisma.storeOrder.findMany({
    where: staff ? {} : { OR: [{ accountId: user.accountId }, { email: user.email }] },
    include: { lines: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return c.json({ orders: orders.map(mapOrder) })
})

storeRoutes.get('/orders/:id', requireUser, async (c) => {
  const user = c.get('user')!
  const staff = isStaff(user)
  const order = await prisma.storeOrder.findUnique({
    where: { id: c.req.param('id') },
    include: { lines: true },
  })
  if (!order) return c.json({ error: 'Order not found.' }, 404)
  if (!staff && order.accountId !== user.accountId && order.email !== user.email) {
    return c.json({ error: 'Order not found.' }, 404)
  }
  return c.json({ order: mapOrder(order) })
})

storeRoutes.patch('/orders/:id', requireUser, requireStaff, async (c) => {
  const body = z
    .object({
      status: z.enum(['pending_payment', 'paid', 'shipped', 'cancelled']).optional(),
      paymentRef: z.string().nullable().optional(),
      readyForCollect: z.boolean().optional(),
      shippingFee: z.number().min(0).optional(),
      shippingFeeQuoted: z.boolean().optional(),
    })
    .safeParse(await c.req.json())
  if (!body.success) return c.json({ error: 'Invalid update.' }, 400)

  const existing = await prisma.storeOrder.findUnique({ where: { id: c.req.param('id') } })
  if (!existing) return c.json({ error: 'Order not found.' }, 404)

  const now = new Date()
  const becomingReady =
    body.data.readyForCollect === true && !existing.readyForCollect
  const quoting =
    body.data.shippingFee != null || body.data.shippingFeeQuoted === true
  const wasUnquoted = existing.shippingFeeQuoted === false
  let nextFee = existing.shippingFee
  let nextQuoted = existing.shippingFeeQuoted
  let nextTotal = existing.total
  if (quoting) {
    nextFee = body.data.shippingFee != null ? body.data.shippingFee : existing.shippingFee
    nextQuoted = true
    nextTotal = Math.round((existing.subtotal + nextFee) * 100) / 100
  }
  const product = await prisma.storeOrder.update({
    where: { id: existing.id },
    data: {
      status: body.data.status,
      paymentRef: body.data.paymentRef === undefined ? undefined : body.data.paymentRef,
      readyForCollect:
        body.data.readyForCollect === undefined ? undefined : body.data.readyForCollect,
      shippingFee: quoting ? nextFee : undefined,
      shippingFeeQuoted: quoting ? nextQuoted : undefined,
      total: quoting ? nextTotal : undefined,
      paidAt:
        body.data.status === 'paid' && !existing.paidAt
          ? now
          : body.data.status && body.data.status !== 'paid'
            ? existing.paidAt
            : undefined,
      shippedAt:
        body.data.status === 'shipped' && !existing.shippedAt
          ? now
          : body.data.status && body.data.status !== 'shipped'
            ? existing.shippedAt
            : undefined,
    },
    include: { lines: true },
  })

  if (becomingReady && existing.accountId) {
    const mode = isFulfillmentMode(existing.fulfillmentMode)
      ? existing.fulfillmentMode
      : 'delivery'
    const label =
      mode === 'pickup'
        ? 'Ready for pickup'
        : mode === 'buyer_courier'
          ? 'Ready for your courier collect'
          : 'Ready to ship'
    await notify({
      id: `N-STORE-READY-${existing.id}`,
      accountId: existing.accountId,
      kind: 'shipping',
      title: label,
      body: `Store order ${existing.id} is ready${mode === 'buyer_courier' && existing.courierCarrier ? ` · ${existing.courierCarrier}` : ''}.`,
      href: '/store/orders',
    })
  }

  let shippingInvoiceId: string | null = null
  if (quoting && wasUnquoted && nextFee > 0) {
    const add = await ensureShippingAddendum({
      parentId: existing.id,
      accountId: existing.accountId,
      fee: nextFee,
      wasUnquoted: true,
      channel: 'marketplace',
      lotId: 'SHIPPING',
      shipAddress: existing.address || undefined,
      shipEmail: existing.email || undefined,
      shipPhone: existing.phone || undefined,
      shipCompany: existing.name || undefined,
      parentLabel: existing.id,
    })
    shippingInvoiceId = add.invoiceId
  }

  return c.json({ order: mapOrder(product), shippingInvoiceId })
})
