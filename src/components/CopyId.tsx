import { useState } from 'react'

export function CopyId({ value }: { value: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      type="button"
      className="copy-id"
      title="Copy lot ID"
      onClick={async (e) => {
        e.stopPropagation()
        try {
          await navigator.clipboard.writeText(value)
          setOk(true)
          window.setTimeout(() => setOk(false), 1200)
        } catch {
          setOk(false)
        }
      }}
    >
      {ok ? 'Copied' : value}
    </button>
  )
}
