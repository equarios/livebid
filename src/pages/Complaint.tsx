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
    <form className="card account-card" onSubmit={onSubmit}>
      <h2>Complaint</h2>
      <p className="muted">Tell ops about a lot, invoice, or shipping issue. Super admin reviews these in this demo.</p>
      <label>
        Details
        <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} required />
      </label>
      {sent ? <p className="ok">Complaint submitted.</p> : null}
      <button type="submit" className="btn btn-primary">
        Submit
      </button>
    </form>
  )
}
