import { TimeLeft } from './TimeLeft'

function toneFromStatus(className: string) {
  if (className.includes('win') && !className.includes('lose')) return 'win'
  if (className.includes('lose')) return 'lose'
  if (className.includes('sealed')) return 'sealed'
  return 'idle'
}

export function FillBar({
  total,
  myPcs,
  sealed,
  status,
  kind,
  kindClass,
  endsAt,
  amount,
  amountNote,
}: {
  total: number
  myPcs: number
  sealed?: boolean
  status: { label: string; className: string }
  kind?: string
  kindClass?: string
  endsAt?: number
  amount?: string | null
  amountNote?: string | null
}) {
  const minePct = total > 0 ? Math.min(100, (myPcs / total) * 100) : 0
  const tone = toneFromStatus(status.className)
  const title = sealed
    ? `You bid ${myPcs} of ${total} pcs on this model`
    : `You are winning ${myPcs} of ${total} pcs`

  return (
    <div className={`win-panel is-${tone}`} title={title}>
      <div className="win-panel-top">
        <div className="win-panel-tags">
          {kind ? <span className={`pill pill-${kindClass || 'market'}`}>{kind}</span> : null}
          <span className={`win-panel-status ${status.className}`}>{status.label}</span>
        </div>
        {endsAt != null ? <TimeLeft endsAt={endsAt} warn /> : null}
      </div>
      <div className="fill-track">
        {myPcs > 0 ? <span className="fill-mine" style={{ width: `${minePct}%` }} /> : null}
      </div>
      <div className="win-panel-meta">
        <span className="win-panel-pcs">
          {myPcs.toLocaleString()}/{total.toLocaleString()} pcs
        </span>
        {amount != null ? (
          <strong className={`win-panel-amt${amount === 'Hidden' ? ' is-muted' : ''}`}>
            {amount}
          </strong>
        ) : null}
      </div>
      {amountNote ? <span className="muted tiny win-panel-note">{amountNote}</span> : null}
    </div>
  )
}
