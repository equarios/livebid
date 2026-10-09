import { useEffect, useState } from 'react'
import { fillCopy, isEndingSoon, timeLeft } from '../lib/format'
import { useStore } from '../store'

/** Local 1s clock for countdown UI only — does not re-render the whole app. */
function useLocalNow(endsAt: number) {
  const [now, setNow] = useState(() => Date.now())
  const closed = endsAt <= now

  useEffect(() => {
    if (closed) return
    setNow(Date.now())
    const t = setInterval(() => {
      const stamp = Date.now()
      setNow(stamp)
      if (endsAt <= stamp) clearInterval(t)
    }, 1000)
    return () => clearInterval(t)
  }, [endsAt, closed])

  return now
}

export function TimeLeft({
  endsAt,
  closedLabel,
  warn,
}: {
  endsAt: number
  closedLabel?: string
  warn?: boolean
}) {
  const now = useLocalNow(endsAt)
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
        <div
          className="warn-tiny"
          title={`Under ${settings.endingSoonMinutes} min left`}
        >
          {fillCopy(settings.copy.endingSoon, { n: settings.endingSoonMinutes })}
        </div>
      ) : null}
    </span>
  )
}

export function EndsIn({ endsAt }: { endsAt: number }) {
  const now = useLocalNow(endsAt)
  const { settings } = useStore()
  return (
    <>
      <div className="label">{endsAt <= now ? settings.copy.closed : 'Ends in'}</div>
      <TimeLeft endsAt={endsAt} closedLabel="00:00:00" warn />
    </>
  )
}
