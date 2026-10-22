import { storeConditionHint, storeIsAsIs } from '../lib/storeCondition'

type ProductBits = {
  simLocked?: boolean | null
  activationLocked?: boolean | null
  grade?: string | null
}

type Props = {
  product: ProductBits
  /** card = compact; detail = larger with hint */
  variant?: 'card' | 'detail' | 'cart'
  className?: string
}

/** Clean lock — closed shackle. */
function LockClosedIcon() {
  return (
    <svg className="store-cond-svg" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 11V8.2C8 5.9 9.8 4 12 4s4 1.9 4 4.2V11"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="5.5"
        y="11"
        width="13"
        height="9.5"
        rx="2.25"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M12 14.25v2.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Clean unlock — open shackle. */
function LockOpenIcon() {
  return (
    <svg className="store-cond-svg" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 11V8.2C8 5.9 9.8 4 12 4c1.7 0 3.15 1.1 3.75 2.65"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="5.5"
        y="11"
        width="13"
        height="9.5"
        rx="2.25"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M12 14.25v2.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Warning triangle. */
function WarnIcon() {
  return (
    <svg className="store-cond-svg" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4.75 20.25 19H3.75L12 4.75Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M12 10v4.25"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.75" r="0.9" fill="currentColor" />
    </svg>
  )
}

/** Lock / unlock + as-is badges so low price isn’t mistaken for a clean unit. */
export function StoreConditionBadges({ product, variant = 'card', className }: Props) {
  const asIs = storeIsAsIs(product)
  const hint = variant !== 'card' ? storeConditionHint(product) : null

  return (
    <span
      className={`store-cond${variant !== 'card' ? ` is-${variant}` : ''}${
        className ? ` ${className}` : ''
      }`}
    >
      <span className="store-cond-badges" role="list">
        <span
          className={`store-cond-badge${product.simLocked ? ' is-warn' : ' is-ok'}`}
          role="listitem"
          title={product.simLocked ? 'SIM locked — may not work on all carriers' : 'SIM unlocked'}
        >
          <span className="store-cond-ico">
            {product.simLocked ? <LockClosedIcon /> : <LockOpenIcon />}
          </span>
          <span className="store-cond-txt">
            {product.simLocked ? 'SIM locked' : 'SIM unlocked'}
          </span>
        </span>
        <span
          className={`store-cond-badge${product.activationLocked ? ' is-warn' : ' is-ok'}`}
          role="listitem"
          title={
            product.activationLocked
              ? 'Activation locked — may need original account'
              : 'Activation open'
          }
        >
          <span className="store-cond-ico">
            {product.activationLocked ? <LockClosedIcon /> : <LockOpenIcon />}
          </span>
          <span className="store-cond-txt">
            {product.activationLocked ? 'Act locked' : 'Act open'}
          </span>
        </span>
        {asIs ? (
          <span
            className="store-cond-badge is-warn"
            role="listitem"
            title="Sold as-is — possible faults or heavy wear"
          >
            <span className="store-cond-ico">
              <WarnIcon />
            </span>
            <span className="store-cond-txt">As-is · Grade {product.grade}</span>
          </span>
        ) : null}
      </span>
      {hint ? <span className="store-cond-hint">{hint}</span> : null}
    </span>
  )
}
