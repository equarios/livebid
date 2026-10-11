import { createClient, type RedisClientType } from 'redis'

type MemoryEntry = { value: string; expiresAt: number | null }

const memory = new Map<string, MemoryEntry>()

function memGet(key: string): string | null {
  const row = memory.get(key)
  if (!row) return null
  if (row.expiresAt != null && row.expiresAt <= Date.now()) {
    memory.delete(key)
    return null
  }
  return row.value
}

function memSet(key: string, value: string, ttlSec?: number) {
  memory.set(key, {
    value,
    expiresAt: ttlSec && ttlSec > 0 ? Date.now() + ttlSec * 1000 : null,
  })
}

let redis: RedisClientType | null = null
let redisReady = false
let redisTried = false

/** Optional Redis — falls back to in-process memory when unset / down. */
export async function initCache(): Promise<'redis' | 'memory'> {
  if (redisTried) return redisReady ? 'redis' : 'memory'
  redisTried = true
  const url = process.env.REDIS_URL?.trim()
  if (!url) return 'memory'

  try {
    redis = createClient({ url })
    redis.on('error', () => {
      redisReady = false
    })
    await redis.connect()
    redisReady = true
    console.log('[cache] Redis connected')
    return 'redis'
  } catch (e) {
    console.warn('[cache] Redis unavailable, using memory:', e instanceof Error ? e.message : e)
    redis = null
    redisReady = false
    return 'memory'
  }
}

export function cacheBackend(): 'redis' | 'memory' {
  return redisReady && redis ? 'redis' : 'memory'
}

export async function cacheGet(key: string): Promise<string | null> {
  if (redisReady && redis) {
    try {
      return await redis.get(key)
    } catch {
      /* fall through */
    }
  }
  return memGet(key)
}

export async function cacheSet(key: string, value: string, ttlSec?: number): Promise<void> {
  if (redisReady && redis) {
    try {
      if (ttlSec && ttlSec > 0) await redis.set(key, value, { EX: ttlSec })
      else await redis.set(key, value)
      return
    } catch {
      /* fall through */
    }
  }
  memSet(key, value, ttlSec)
}

/** Increment counter; sets TTL on first hit when provided. */
export async function cacheIncr(key: string, ttlSec?: number): Promise<number> {
  if (redisReady && redis) {
    try {
      const n = await redis.incr(key)
      if (n === 1 && ttlSec && ttlSec > 0) await redis.expire(key, ttlSec)
      return n
    } catch {
      /* fall through */
    }
  }
  const cur = Number(memGet(key) || '0') + 1
  memSet(key, String(cur), ttlSec)
  return cur
}

/** SET if not exists. Returns true when this caller owns the key. */
export async function cacheSetNx(key: string, value: string, ttlSec: number): Promise<boolean> {
  if (redisReady && redis) {
    try {
      const res = await redis.set(key, value, { NX: true, EX: ttlSec })
      return res === 'OK'
    } catch {
      /* fall through */
    }
  }
  if (memGet(key) != null) return false
  memSet(key, value, ttlSec)
  return true
}

export async function cacheDel(key: string): Promise<void> {
  if (redisReady && redis) {
    try {
      await redis.del(key)
      return
    } catch {
      /* fall through */
    }
  }
  memory.delete(key)
}
