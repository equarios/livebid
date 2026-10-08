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

  return (
    <div className="you-cell">
      <div className="you-cell-top">
        {kind ? <span className={`pill pill-${kindClass || 'market'}`}>{kind}</span> : null}
        <div className={status.className}>{status.label}</div>
      </div>
      {sealed ? (
        <div className="muted tiny">Pcs hidden until close</div>
      ) : (
        <>
          <div className="fill-track" title={`You are winning ${myPcs} of ${total} pcs`}>
            {myPcs > 0 ? <span className="fill-mine" style={{ width: `${minePct}%` }} /> : null}
            {restPct > 0 ? <span className="fill-open" style={{ width: `${restPct}%` }} /> : null}
          </div>
          <div className="muted tiny">
            {myPcs}/{total} pcs
          </div>
        </>
      )}
    </div>
  )
}
