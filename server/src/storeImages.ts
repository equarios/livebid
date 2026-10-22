import { randomBytes } from 'node:crypto'
import sharp from 'sharp'
import { putPublicObject } from './objectStorage'

export const MAX_STORE_IMAGES = 8
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export function normalizeImageList(raw: unknown, fallbackUrl?: string | null): string[] {
  const out: string[] = []
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item !== 'string') continue
      const u = item.trim()
      if (!u || out.includes(u)) continue
      out.push(u)
      if (out.length >= MAX_STORE_IMAGES) break
    }
  }
  if (!out.length && fallbackUrl?.trim()) out.push(fallbackUrl.trim())
  return out
}

/** Auto-orient, fit inside 1600px, WebP ~75. Returns public URL path. */
export async function processAndSaveStoreImage(buf: Buffer, mime: string): Promise<string> {
  if (!ALLOWED.has(mime) && mime !== 'application/octet-stream') {
    throw new Error('Only JPEG, PNG, WebP, or GIF images are allowed.')
  }
  if (buf.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error('Each image must be under 12 MB.')
  }

  const id = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`
  const filename = `${id}.webp`

  const processed = await sharp(buf, { failOn: 'none' })
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 75, effort: 4 })
    .toBuffer()

  return putPublicObject({
    folder: 'store',
    filename,
    body: processed,
    contentType: 'image/webp',
  })
}

const VIDEO_ALLOWED = new Set(['video/mp4', 'video/webm', 'video/quicktime'])
export const MAX_TRADE_IN_VIDEO_BYTES = 40 * 1024 * 1024

/** Store trade-in condition clip as-is (mp4/webm/mov). */
export async function saveTradeInVideo(buf: Buffer, mime: string): Promise<string> {
  const type = (mime || '').toLowerCase()
  if (!VIDEO_ALLOWED.has(type) && type !== 'application/octet-stream') {
    throw new Error('Only MP4, WebM, or MOV video is allowed.')
  }
  if (buf.byteLength > MAX_TRADE_IN_VIDEO_BYTES) {
    throw new Error('Video must be under 40 MB.')
  }
  const ext =
    type === 'video/webm' ? 'webm' : type === 'video/quicktime' ? 'mov' : 'mp4'
  const id = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`
  const filename = `ti-${id}.${ext}`
  return putPublicObject({
    folder: 'store',
    filename,
    body: buf,
    contentType: type === 'application/octet-stream' ? 'video/mp4' : type,
  })
}
