/** Thin desk banner — brand + one line. Keeps auction/marketplace command bars intact. */
export function DeskIntro({
  brand,
  title,
  body,
}: {
  brand: string
  title: string
  body: string
}) {
  return (
    <header className="desk-intro">
      <p className="desk-intro-brand">{brand}</p>
      <div className="desk-intro-copy">
        <h1>{title}</h1>
        <p>{body}</p>
      </div>
    </header>
  )
}
