import { useEffect, useState } from 'react'

/** Number input that allows clearing while typing; commits on blur. */
export function NumberField({
  value,
  min,
  max,
  step = 1,
  className,
  disabled,
  'aria-label': ariaLabel,
  onCommit,
}: {
  value: number
  min?: number
  max?: number
  step?: number | string
  className?: string
  disabled?: boolean
  'aria-label'?: string
  onCommit: (n: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  useEffect(() => {
    setDraft(null)
  }, [value])

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      className={className}
      disabled={disabled}
      aria-label={ariaLabel}
      value={draft ?? String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft == null) return
        const fallback = min != null && min > 0 ? min : 0
        let n = draft.trim() === '' ? fallback : Number(draft)
        if (!Number.isFinite(n)) n = value
        if (min != null) n = Math.max(min, n)
        if (max != null) n = Math.min(max, n)
        if (step === 1 || step === '1') n = Math.floor(n)
        onCommit(n)
        setDraft(null)
      }}
    />
  )
}
