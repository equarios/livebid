import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store'

export function Login() {
  const { user, login } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from || '/auctions'
  const [accountId, setAccountId] = useState('DEMO-1001')
  const [password, setPassword] = useState('livebid')
  const [error, setError] = useState<string | null>(null)

  if (user) return <Navigate to={from} replace />

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const err = login(accountId, password)
    if (err) setError(err)
    else navigate(from, { replace: true })
  }

  return (
    <div className="auth-split">
      <aside className="auth-hero">
        <div className="auth-hero-title">LIVEBID WHOLESALE</div>
        <div className="stack">
          {['#1a1a1a', '#f2f2f2', '#111', '#ececec', '#222', '#fafafa'].map((c, i) => (
            <div key={i} className="phone-layer" style={{ background: c, transform: `translateY(${i * 18}px)` }} />
          ))}
        </div>
      </aside>
      <section className="auth-panel">
        <div className="lock-icon" aria-hidden>
          🔒
        </div>
        <h1>Sign in</h1>
        <p className="muted">Member access for live auctions and marketplace.</p>
        <form onSubmit={onSubmit}>
          <label>
            Your Account ID
            <input
              autoComplete="username"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn btn-navy" type="submit">
            Sign in
          </button>
        </form>
        <p className="auth-links">
          <button type="button" className="linkish" onClick={() => setPassword('')}>
            Forgot password?
          </button>
          <Link to="/register">Don&apos;t have an account? Sign Up</Link>
        </p>
        <p className="demo-hint">
          Demo: <strong>DEMO-1001</strong> / <strong>livebid</strong>
          <br />
          Admin: <strong>ADMIN-0001</strong> / <strong>admin</strong>
        </p>
      </section>
    </div>
  )
}
