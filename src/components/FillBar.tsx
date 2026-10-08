export function FillBar({
  total,
  myPcs,
  sealed,
  status,
  kind,
  kindClass,
}: {
  total: number
  myPcs: number
  sealed?: boolean
  status: { label: string; className: string }
  kind?: string
  kindClass?: string
}) {
  const minePct = total > 0 ? (myPcs / total) * 100 : 0
  const restPct = Math.max(0, 100 - minePct)
  const title = sealed
    ? `You bid ${myPcs} of ${total} pcs on this model`
    : `You are winning ${myPcs} of ${total} pcs`

  return (
    <div className="you-cell">
      <div className="you-cell-top">
        {kind ? <span className={`pill pill-${kindClass || 'market'}`}>{kind}</span> : null}
        <div className={status.className}>{status.label}</div>
      </div>
      <div className="fill-track" title={title}>
        {myPcs > 0 ? <span className="fill-mine" style={{ width: `${minePct}%` }} /> : null}
        {restPct > 0 ? <span className="fill-open" style={{ width: `${restPct}%` }} /> : null}
        <span className="fill-label">
          {myPcs}/{total} pcs
        </span>
      </div>
    </div>
  )
}
