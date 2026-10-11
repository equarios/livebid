/** Lightweight placeholders while store catalog / cart / orders hydrate. */
export function StoreCatalogSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="store-lot-grid store-skeleton-grid" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="store-skeleton-card" style={{ animationDelay: `${i * 40}ms` }}>
          <div className="store-skeleton-media" />
          <div className="store-skeleton-lines">
            <span className="store-skeleton-line is-sm" />
            <span className="store-skeleton-line" />
            <span className="store-skeleton-line is-md" />
            <span className="store-skeleton-line is-btn" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function StoreBlockSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="store-block-skeleton" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="store-skeleton-row" style={{ animationDelay: `${i * 50}ms` }}>
          <span className="store-skeleton-thumb" />
          <div className="store-skeleton-lines">
            <span className="store-skeleton-line" />
            <span className="store-skeleton-line is-md" />
          </div>
        </div>
      ))}
    </div>
  )
}
