import { fillCopy, isEndingSoon, timeLeft } from '../lib/format'
import { useNow, useStore } from '../store'

export function TimeLeft({
  endsAt,
  closedLabel,
  warn,
}: {
  endsAt: number
  closedLabel?: string
  warn?: boolean
}) {
  const now = useNow()
  const { settings } = useStore()
  const closed = endsAt <= now
  const label = closedLabel ?? settings.copy.closed
  return (
    <span className={`countdown ${closed ? 'closed' : ''}`}>
      {closed ? label : timeLeft(endsAt, now)}
      {warn &&
      !closed &&
      settings.features.endingSoon &&
      isEndingSoon(endsAt, now, settings.endingSoonMinutes) ? (
        <div className="warn-tiny">{fillCopy(settings.copy.endingSoon, { n: settings.endingSoonMinutes })}</div>
      ) : null}
    </span>
  )
}

export function EndsIn({ endsAt }: { endsAt: number }) {
  const now = useNow()
  const { settings } = useStore()
  return (
    <>
      <div className="label">{endsAt <= now ? settings.copy.closed : 'Ends in'}</div>
      <TimeLeft endsAt={endsAt} closedLabel="00:00:00" warn />
    </>
  )
}
