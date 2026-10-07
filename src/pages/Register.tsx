import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useStore } from '../store'

export function Register() {
  const { user, register } = useStore()
  const navigate = useNavigate()
  const [accountId, setAccountId] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (user) return <Navigate to="/auctions" replace />

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const err = register(accountId, company, email, password)
    if (err) setError(err)
    else navigate('/auctions', { replace: true })
  }

  return (
    <div className="auth-split">
      <aside className="auth-hero alt">
        <div className="auth-hero-title">APPLY FOR MEMBERSHIP</div>
      </aside>
      <section className="auth-panel">
        <h1>Sign up</h1>
        <p className="muted">B2B wholesale. Demo registration is local to this browser.</p>
        <form onSubmit={onSubmit}>
          <label>
            Desired account ID
            <input value={accountId} onChange={(e) => setAccountId(e.target.value)} />
          </label>
          <label>
            Company name
            <input value={company} onChange={(e) => setCompany(e.target.value)} />
          </label>
          <label>
            Work email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn btn-navy" type="submit">
            Create account
          </button>
        </form>
        <p className="auth-links">
          <Link to="/login">Already a member? Sign in</Link>
        </p>
      </section>
    </div>
  )
}
