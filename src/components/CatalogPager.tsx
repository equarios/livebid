import { useEffect, useState, type FormEvent } from 'react'
import { pageWindow } from '../lib/catalogPaging'

type Props = {
  page: number
  pageCount: number
  pageSize: number
  total: number
  onPage: (page: number) => void
  label?: string
}

/** Numbered pager + jump-to-page for store / marketplace / auctions catalogs. */
export function CatalogPager({
  page,
  pageCount,
  pageSize,
  total,
  onPage,
  label = 'Catalog pages',
}: Props) {
  const [jump, setJump] = useState(String(page))

  useEffect(() => {
    setJump(String(page))
  }, [page])

  if (pageCount <= 1 || total < 1) return null

  function submitJump(e: FormEvent) {
    e.preventDefault()
    const n = Number.parseInt(jump, 10)
    if (!Number.isFinite(n)) {
      setJump(String(page))
      return
    }
    onPage(Math.min(Math.max(1, n), pageCount))
  }

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <nav className="pager store-pager" aria-label={label}>
      <button
        type="button"
        className="store-pager-btn"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label="Previous page"
      >
        ‹
      </button>
      {pageWindow(page, pageCount).map((n) =>
        n < 0 ? (
          <span key={`gap-${n}`} className="store-pager-gap" aria-hidden>
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            className={`store-pager-btn${n === page ? ' is-active' : ''}`}
            aria-current={n === page ? 'page' : undefined}
            onClick={() => onPage(n)}
          >
            {n}
          </button>
        ),
      )}
      <button
        type="button"
        className="store-pager-btn"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
        aria-label="Next page"
      >
        ›
      </button>
      <form className="store-pager-jump" onSubmit={submitJump}>
        <label>
          Go to
          <input
            type="number"
            min={1}
            max={pageCount}
            inputMode="numeric"
            value={jump}
            onChange={(e) => setJump(e.target.value)}
            aria-label={`Go to page (1–${pageCount})`}
          />
        </label>
        <button type="submit" className="store-pager-btn">
          Go
        </button>
      </form>
      <p className="pager-note tiny muted">
        {from}–{to} of {total}
        {pageCount > 1 ? ` · page ${page}/${pageCount}` : ''}
      </p>
    </nav>
  )
}
