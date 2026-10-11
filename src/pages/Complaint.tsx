import { useState, type FormEvent } from 'react'

export function Complaint() {
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setSent(true)
    setText('')
  }

  return (
    <div className="complaint-page">
      <p className="muted tiny mypage-intro">
        Lot, invoice, or shipping issue — staff review from Admin.
      </p>
      <form className="complaint-form" onSubmit={onSubmit}>
        <label>
          Details
          <textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Lot ID, invoice #, what went wrong…"
            required
          />
        </label>
        {sent ? <p className="ok tiny">Complaint submitted.</p> : null}
        <button type="submit" className="btn btn-primary btn-sm">
          Submit
        </button>
      </form>
    </div>
  )
}
