import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DEFAULT_SETTINGS } from '../data'
import { hubConditionLinks, hubDeviceChipLinks } from '../lib/seoTaxonomy'
import { useStore } from '../store'

/** Device | Condition chips under the public wholesale header. */
export function WholesaleCatSubnav() {
  const { settings } = useStore()
  const pages = { ...DEFAULT_SETTINGS.pages, ...settings.pages }
  const [catMode, setCatMode] = useState<'device' | 'condition'>('device')
  return (
    <div className="wholesale-cat-subnav" aria-label="Browse by category">
      <nav className="wholesale-cat-slim">
        <div className="wholesale-cat-mode" role="tablist" aria-label="Category mode">
          <button
            type="button"
            role="tab"
            aria-selected={catMode === 'device'}
            className={catMode === 'device' ? 'is-on' : undefined}
            onClick={() => setCatMode('device')}
          >
            {pages.wholesaleCatDeviceLabel}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={catMode === 'condition'}
            className={catMode === 'condition' ? 'is-on' : undefined}
            onClick={() => setCatMode('condition')}
          >
            {pages.wholesaleCatConditionLabel}
          </button>
        </div>
        <div className="wholesale-cat-slim-row">
          {catMode === 'device' ? (
            <ul className="wholesale-cat-chips is-device" role="tabpanel">
              {hubDeviceChipLinks().map((d) => (
                <li key={d.id}>
                  <Link to={d.to}>{d.label}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="wholesale-cat-chips is-condition" role="tabpanel">
              {hubConditionLinks().map((c) => (
                <li key={c.id}>
                  <Link to={c.to}>{c.label}</Link>
                </li>
              ))}
            </ul>
          )}
          <Link className="wholesale-cat-all" to="/wholesale/c">
            {pages.wholesaleCatAllLabel}
          </Link>
        </div>
      </nav>
    </div>
  )
}
