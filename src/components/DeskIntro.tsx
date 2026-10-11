/** Thin desk banner — brand + one line. Keeps auction/marketplace command bars intact. */
export function DeskIntro({
  brand,
  title,
  body,
  tone = 'default',
}: {
  brand: string
  title: string
  body: string
  /** `trade` = stronger brand strip for Auctions / Marketplace */
  tone?: 'default' | 'trade'
}) {
  return (
    <header className={`desk-intro${tone === 'trade' ? ' is-trade' : ''}`}>
      <p className="desk-intro-brand">{brand}</p>
      <div className="desk-intro-copy">
        <h1>{title}</h1>
        <p>{body}</p>
      </div>
    </header>
  )
}
