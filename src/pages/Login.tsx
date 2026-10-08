import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthFrame } from '../components/AuthFrame'
import { useStore } from '../store'

export function Login() {
  const { user, login, requestPasswordReset, resetPassword, settings } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from || '/auctions'
  const [ident, setIdent] = useState('')
  const [password, setPassword] = useState('')
  const [step, setStep] = useState<'email' | 'password' | 'reset'>('email')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [newPass, setNewPass] = useState('')
  const [issuedCode, setIssuedCode] = useState<string | null>(null)
  const [resetOk, setResetOk] = useState<string | null>(null)

  if (user) return <Navigate to={from} replace />

  function onEmail(e: FormEvent) {
    e.preventDefault()
    if (!ident.trim()) {
      setError('Enter your email address or account ID.')
      return
    }
    setError(null)
    setStep('password')
  }

  function onPassword(e: FormEvent) {
    e.preventDefault()
    const err = login(ident, password)
    if (err) setError(err)
    else {
      if (!remember) {
        /* demo still uses localStorage session */
      }
      navigate(from, { replace: true })
    }
  }

  function onRequestReset(e: FormEvent) {
    e.preventDefault()
    const result = requestPasswordReset(ident)
    if ('error' in result) {
      setError(result.error)
      setIssuedCode(null)
      return
    }
    setError(null)
    setIssuedCode(result.code)
    setResetOk(null)
  }

  function onApplyReset(e: FormEvent) {
    e.preventDefault()
    const err = resetPassword(ident, code, newPass)
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setResetOk('Password updated. Sign in with the new password.')
    setPassword('')
    setNewPass('')
    setCode('')
    setIssuedCode(null)
    setStep('password')
  }

  return (
    <AuthFrame>
      <h1>Welcome back!</h1>
      {step === 'email' ? (
        <form onSubmit={onEmail}>
          <p>Enter your email address</p>
          <label>
            <span className="sr-only">Email Address</span>
            <input
              autoComplete="username"
              placeholder="Email Address"
              value={ident}
              onChange={(e) => setIdent(e.target.value)}
            />
          </label>
          <label className="check-inline">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember me
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn-bstock" type="submit">
            Let&apos;s go
          </button>
        </form>
      ) : step === 'reset' ? (
        <form onSubmit={issuedCode ? onApplyReset : onRequestReset}>
          <p>Reset password for <strong>{ident}</strong></p>
          {!issuedCode ? (
            <button className="btn-bstock" type="submit">
              Send reset code
            </button>
          ) : (
            <>
              <p className="ok">
                Demo cannot email, so your code is <strong>{issuedCode}</strong>. It expires in 30 minutes.
              </p>
              <label>
                Reset code
                <input value={code} onChange={(e) => setCode(e.target.value)} />
              </label>
              <label>
                New password
                <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
              </label>
              <button className="btn-bstock" type="submit">
                Set new password
              </button>
            </>
          )}
          {error ? <p className="error">{error}</p> : null}
          <p>
            <button
              type="button"
              className="linkish"
              onClick={() => {
                setStep('password')
                setError(null)
                setIssuedCode(null)
              }}
            >
              Back to sign in
            </button>
          </p>
        </form>
      ) : (
        <form onSubmit={onPassword}>
          <p>
            Password for <strong>{ident}</strong>
          </p>
          <label>
            <span className="sr-only">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          {resetOk ? <p className="ok">{resetOk}</p> : null}
          <button className="btn-bstock" type="submit">
            {settings.copy.signInButton}
          </button>
          {settings.features.forgotPassword ? (
            <p>
              <button
                type="button"
                className="linkish"
                onClick={() => {
                  setStep('reset')
                  setError(null)
                  setIssuedCode(null)
                }}
              >
                {settings.copy.btnForgot}
              </button>
            </p>
          ) : null}
          <p>
            <button type="button" className="linkish" onClick={() => { setStep('email'); setError(null) }}>
              Use a different email
            </button>
          </p>
        </form>
      )}
      {settings.features.register ? (
        <p className="auth-foot">
          Don&apos;t have an account? <Link to="/register">Create Account</Link>
        </p>
      ) : null}
      <p className="demo-hint">
        Client: <strong>buyer@northstar.example</strong> or <strong>DEMO-1001</strong> / <strong>livebid</strong>
        <br />
        Admin: <strong>ops@livebid.example</strong> / <strong>admin</strong>
        <br />
        Super admin: <strong>super@livebid.example</strong> / <strong>super</strong>
      </p>
    </AuthFrame>
  )
}
