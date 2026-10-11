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
    imageUrl: images[0] || null,
    images,
    active: p.active,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }
}

function mapOrder(o: {
  id: string
  accountId: string | null
  email: string
  name: string
  phone: string | null
  address: string
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
  return {
    id: o.id,
    accountId: o.accountId,
    email: o.email,
    name: o.name,
    phone: o.phone,
    address: o.address,
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

storeRoutes.get('/products', optionalUser, async (c) => {
  const user = c.get('user')
  const staff = isStaff(user)
  const category = String(c.req.query('category') || '').trim()
  const q = String(c.req.query('q') || '').trim()

  const products = await prisma.storeProduct.findMany({
    where: {
      ...(staff ? {} : { active: true, stock: { gt: 0 } }),
      ...(category ? { category } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { description: { contains: q } },
              { category: { contains: q } },
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
      imageUrl: z.string().nullable().optional(),
      images: z.array(z.string()).max(MAX_STORE_IMAGES).optional(),
      active: z.boolean().optional(),
    })
    .safeParse(await c.req.json())
  if (!body.success) return c.json({ error: 'Invalid product.' }, 400)

  let slug = (body.data.slug?.trim() || slugify(body.data.title)).slice(0, 80)
  const clash = await prisma.storeProduct.findUnique({ where: { slug } })
  if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`

  const images = normalizeImageList(body.data.images, body.data.imageUrl)

  const product = await prisma.storeProduct.create({
    data: {
      title: body.data.title.trim(),
      slug,
      description: body.data.description?.trim() || '',
      price: body.data.price,
      compareAt: body.data.compareAt ?? null,
      stock: body.data.stock,
      category: body.data.category?.trim() || 'Phones',
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
      imageUrl: z.string().nullable().optional(),
      images: z.array(z.string()).max(MAX_STORE_IMAGES).optional(),
      active: z.boolean().optional(),
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

  const product = await prisma.storeProduct.update({
    where: { id: existing.id },
    data: {
      title: body.data.title?.trim(),
      description: body.data.description?.trim(),
      price: body.data.price,
      compareAt: body.data.compareAt === undefined ? undefined : body.data.compareAt,
      stock: body.data.stock,
      category: body.data.category?.trim(),
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
  address: z.string().min(4).max(500),
  note: z.string().max(500).optional(),
  paymentMethod: z.enum(['card', 'paypal', 'bank']),
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
  const shippingFee = subtotal >= 200 ? 0 : 12
  const total = subtotal + shippingFee
  const id = `ST-${Date.now().toString(36).toUpperCase()}`

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
        address: body.data.address.trim(),
        note: body.data.note?.trim() || null,
        paymentMethod: body.data.paymentMethod,
        status: 'pending_payment',
        subtotal,
        shippingFee,
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
    })
    .safeParse(await c.req.json())
  if (!body.success) return c.json({ error: 'Invalid update.' }, 400)

  const existing = await prisma.storeOrder.findUnique({ where: { id: c.req.param('id') } })
  if (!existing) return c.json({ error: 'Order not found.' }, 404)

  const now = new Date()
  const product = await prisma.storeOrder.update({
    where: { id: existing.id },
    data: {
      status: body.data.status,
      paymentRef: body.data.paymentRef === undefined ? undefined : body.data.paymentRef,
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
  return c.json({ order: mapOrder(product) })
})
