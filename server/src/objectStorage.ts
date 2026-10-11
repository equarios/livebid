import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

let client: S3Client | null = null

function s3Enabled() {
  return Boolean(process.env.S3_BUCKET?.trim() && process.env.S3_ACCESS_KEY?.trim() && process.env.S3_SECRET_KEY?.trim())
}

function getClient() {
  if (!s3Enabled()) return null
  if (client) return client
  const endpoint = process.env.S3_ENDPOINT?.trim() || undefined
  client = new S3Client({
    region: process.env.S3_REGION?.trim() || 'us-east-1',
    endpoint,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === '1' || Boolean(endpoint),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY!.trim(),
      secretAccessKey: process.env.S3_SECRET_KEY!.trim(),
    },
  })
  return client
}

export function storageBackend(): 's3' | 'local' {
  return s3Enabled() ? 's3' : 'local'
}

/**
 * Persist bytes under uploads/<folder>/<filename>.
 * Returns a public URL (CDN/S3 base) or local /uploads/... path.
 */
export async function putPublicObject(opts: {
  folder: 'store' | 'brand'
  filename: string
  body: Buffer
  contentType: string
}): Promise<string> {
  const key = `uploads/${opts.folder}/${opts.filename}`
  const s3 = getClient()
  const bucket = process.env.S3_BUCKET?.trim()

  if (s3 && bucket) {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: opts.body,
        ContentType: opts.contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )
    const base = (process.env.S3_PUBLIC_BASE_URL || process.env.CDN_BASE_URL || '').replace(/\/$/, '')
    if (base) return `${base}/${key}`
    if (process.env.S3_ENDPOINT) {
      return `${process.env.S3_ENDPOINT.replace(/\/$/, '')}/${bucket}/${key}`
    }
    return `https://${bucket}.s3.amazonaws.com/${key}`
  }

  const dir = path.resolve(process.cwd(), 'uploads', opts.folder)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, opts.filename), opts.body)
  return `/uploads/${opts.folder}/${opts.filename}`
}
