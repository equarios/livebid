import { cacheGet, cacheSet } from './cache'

const TTL_SEC = 15 * 60

export async function getIdempotentJson<T>(scope: string, key: string): Promise<T | null> {
  const raw = await cacheGet(`idem:${scope}:${key}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function setIdempotentJson(scope: string, key: string, value: unknown): Promise<void> {
  await cacheSet(`idem:${scope}:${key}`, JSON.stringify(value), TTL_SEC)
}
