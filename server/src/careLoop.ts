import { initCache } from './cache'
import { runCareJobs } from './settle'

const DEFAULT_MS = 30_000

/** Shared interval loop for API (optional) or dedicated worker. */
export async function startCareLoop(opts?: { label?: string; intervalMs?: number }) {
  const label = opts?.label || 'care'
  const fromEnv = Number(process.env.CARE_INTERVAL_MS)
  const intervalMs = Math.max(
    5_000,
    opts?.intervalMs ?? (Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_MS),
  )

  await initCache()
  console.log(`[${label}] care loop every ${intervalMs}ms`)

  let busy = false
  const tick = async () => {
    if (busy) return
    busy = true
    try {
      await runCareJobs()
    } finally {
      busy = false
    }
  }

  void tick()
  const timer = setInterval(() => void tick(), intervalMs)

  const stop = () => {
    clearInterval(timer)
    console.log(`[${label}] stopped`)
  }

  process.once('SIGINT', () => {
    stop()
    process.exit(0)
  })
  process.once('SIGTERM', () => {
    stop()
    process.exit(0)
  })

  return stop
}
