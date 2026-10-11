import { cacheIncr } from './cache'

/** Sliding-ish window via minute bucket. Returns null if allowed, else retry-after seconds. */
export async function rateLimitOrRetryAfter(
  key: string,
  limit: number,
  windowSec = 60,
): Promise<number | null> {
  const bucket = Math.floor(Date.now() / (windowSec * 1000))
  const n = await cacheIncr(`rl:${key}:${bucket}`, windowSec + 5)
  if (n > limit) return windowSec
  return null
}
