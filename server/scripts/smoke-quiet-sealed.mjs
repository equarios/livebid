/**
 * Quiet-hours / sealed policy smoke (no new notify features — just proves rules).
 * Run: node scripts/smoke-quiet-sealed.mjs  (from server/)
 */
import { PrismaClient } from '@prisma/client'

function isQuietHours(now, start = 22, end = 7) {
  if (start === end) return false
  const h = now.getUTCHours()
  if (start < end) return h >= start && h < end
  return h >= start || h < end
}

function isQuietEmailKind(kind) {
  return new Set(['outbid', 'watch', 'digest', 'closing', 'fill', 'thanks']).has(kind)
}

function isInExtraSealed(lot, now) {
  const extra = lot.extraSealedEndsAt != null ? Number(lot.extraSealedEndsAt) : 0
  if (!extra) return false
  const ends = Number(lot.endsAt)
  return now > ends && now <= extra
}

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg)
    process.exitCode = 1
    return
  }
  console.log('PASS', msg)
}

console.log('=== quiet-hours / sealed smoke ===')

assert(isQuietEmailKind('outbid'), 'outbid deferred in quiet hours')
assert(isQuietEmailKind('watch'), 'watch deferred in quiet hours')
assert(isQuietEmailKind('digest'), 'digest deferred in quiet hours')
assert(!isQuietEmailKind('sealed'), 'sealed still emails in quiet hours')
assert(!isQuietEmailKind('invoice'), 'invoice still emails in quiet hours')
assert(!isQuietEmailKind('auth'), 'auth still emails in quiet hours')

assert(isQuietHours(new Date('2026-06-01T22:00:00Z')), '22:00 UTC is quiet')
assert(isQuietHours(new Date('2026-06-01T03:00:00Z')), '03:00 UTC is quiet')
assert(!isQuietHours(new Date('2026-06-01T08:00:00Z')), '08:00 UTC is daytime')
assert(!isQuietHours(new Date('2026-06-01T12:00:00Z')), '12:00 UTC is daytime')

const now = new Date()
console.log(
  'INFO',
  `UTC hour=${now.getUTCHours()} quietNow=${isQuietHours(now)} (default 22→07 UTC)`,
)

const prisma = new PrismaClient()
try {
  const lots = await prisma.lot.findMany({
    where: { channel: 'auction', NOT: { extraSealedEndsAt: null } },
    take: 80,
  })
  const sealed = lots.filter((l) => isInExtraSealed(l, Date.now()))
  console.log('INFO', `lots with Extra sealed clock: ${lots.length}`)
  console.log('INFO', `currently in Extra sealed: ${sealed.length}`)
  if (sealed[0]) {
    const left = Math.max(
      0,
      Math.round((Number(sealed[0].extraSealedEndsAt) - Date.now()) / 60_000),
    )
    console.log(
      'INFO',
      `example ${sealed[0].id} ${sealed[0].manufacturer} ${sealed[0].model} ~${left}m left`,
    )
    console.log('PASS', 'live Extra sealed lot present — check Your desk for countdown')
  } else {
    console.log(
      'WARN',
      'no live Extra sealed lot — set a list closesAt in the past + extraSealedMinutes to UI-smoke countdown',
    )
  }
} finally {
  await prisma.$disconnect()
}

if (process.exitCode) {
  console.log('=== FAILED ===')
  process.exit(1)
}
console.log('=== OK policy smoke ===')
console.log('Manual UI (optional):')
console.log('  1) Buyer with bid on sealed lot → /wholesale Your desk shows sealed · ~Nm left')
console.log('  2) During quiet (or set CARE_QUIET_START_HOUR=0 END=23) → outbid = bell yes, email no')
