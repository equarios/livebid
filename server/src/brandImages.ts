import { randomBytes } from 'node:crypto'
import sharp from 'sharp'
import { putPublicObject } from './objectStorage'

export const MAX_BRAND_LOGO_BYTES = 8 * 1024 * 1024

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function isFlatFill(r: number, g: number, b: number, a: number): boolean {
  if (a < 12) return true
  const nearWhite = r > 248 && g > 248 && b > 248
  const nearBlack = r < 12 && g < 12 && b < 12
  return nearWhite || nearBlack
}

/** Clear flat white/black only when connected to the image edge (keeps map whites inside the Q). */
async function knockOutEdgeBackground(buf: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buf, { failOn: 'none' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const w = info.width
  const h = info.height
  const px = Buffer.from(data)
  const seen = new Uint8Array(w * h)
  const stack: number[] = []

  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const idx = y * w + x
    if (seen[idx]) return
    const i = idx * 4
    if (!isFlatFill(px[i], px[i + 1], px[i + 2], px[i + 3])) return
    seen[idx] = 1
    stack.push(idx)
  }

  for (let x = 0; x < w; x++) {
    push(x, 0)
    push(x, h - 1)
  }
  for (let y = 0; y < h; y++) {
    push(0, y)
    push(w - 1, y)
  }

  while (stack.length) {
    const idx = stack.pop()!
    const x = idx % w
    const y = (idx / w) | 0
    const i = idx * 4
    px[i + 3] = 0
    push(x + 1, y)
    push(x - 1, y)
    push(x, y + 1)
    push(x, y - 1)
  }

  return sharp(px, {
    raw: { width: w, height: h, channels: 4 },
  })
    .png()
    .toBuffer()
}

/** Auto-orient, trim empty padding, PNG with alpha. Returns public URL path. */
export async function processAndSaveBrandLogo(buf: Buffer, mime: string): Promise<string> {
  if (!ALLOWED.has(mime) && mime !== 'application/octet-stream') {
    throw new Error('Only JPEG, PNG, WebP, or GIF images are allowed.')
  }
  if (buf.byteLength > MAX_BRAND_LOGO_BYTES) {
    throw new Error('Logo must be under 8 MB.')
  }

  const id = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`
  const filename = `${id}.png`

  const oriented = await sharp(buf, { failOn: 'none' }).rotate().ensureAlpha().png().toBuffer()
  const cleared = await knockOutEdgeBackground(oriented)
  const processed = await sharp(cleared)
    .trim({ threshold: 0 })
    .resize({
      width: 960,
      height: 960,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()

  return putPublicObject({
    folder: 'brand',
    filename,
    body: processed,
    contentType: 'image/png',
  })
}
