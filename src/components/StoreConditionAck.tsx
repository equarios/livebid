import { useEffect, useState } from 'react'
import type { StoreProductDto } from '../lib/api'
import { storeIsAsIs } from '../lib/storeCondition'

type ProductBits = Pick<StoreProductDto, 'simLocked' | 'activationLocked' | 'grade'>

type Props = {
  product: ProductBits
  checked: boolean
  onChange: (checked: boolean) => void
  /** Increment to pulse the card after a failed add. */
  nudge?: number
  className?: string
}

function CheckIcon() {
  return (
    <svg className="store-cond-ack-check" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6.5 12.5 10.2 16 17.5 8.5"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ackChips(product: ProductBits) {
  const chips: string[] = []
  if (product.simLocked) chips.push('SIM locked')
  if (product.activationLocked) chips.push('Activation locked')
  if (storeIsAsIs(product)) chips.push(`Grade ${product.grade} · as-is`)
  return chips
}

/** Confirm lock / as-is before add — shared by popup + PDP. */
export function StoreConditionAck({
  product,
  checked,
  onChange,
  nudge = 0,
  className,
}: Props) {
  const [pulse, setPulse] = useState(false)
  const chips = ackChips(product)

  useEffect(() => {
    if (!nudge) return
    setPulse(true)
    const id = window.setTimeout(() => setPulse(false), 900)
    return () => window.clearTimeout(id)
  }, [nudge])

  return (
    <label
      className={`store-cond-ack${checked ? ' is-on' : ''}${pulse ? ' is-nudge' : ''}${
        className ? ` ${className}` : ''
      }`}
    >
      <span className="store-cond-ack-box" aria-hidden>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="store-cond-ack-tick">
          <CheckIcon />
        </span>
      </span>
      <span className="store-cond-ack-body">
        <strong className="store-cond-ack-title">Confirm before adding</strong>
        {chips.length ? (
          <span className="store-cond-ack-chips" aria-hidden>
            {chips.map((c) => (
              <em key={c} className="store-cond-ack-chip">
                {c}
              </em>
            ))}
          </span>
        ) : null}
        <span className="store-cond-ack-copy">
          I understand these limits and still want this unit.
        </span>
      </span>
    </label>
  )
}
