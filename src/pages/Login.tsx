import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { AuthFrame } from '../components/AuthFrame'
import { canUseWholesaleDesk, wholesaleHome } from '../lib/channelAccess'
import { useStore } from '../store'
import type { SiteSettings, User } from '../types'

function postLoginPath(
  user: User,
  isStaff: boolean,
  settings: Pick<SiteSettings, 'showAuctions' | 'showMarketplace'>,
  fromRaw?: string,
) {
  if (!canUseWholesaleDesk(user, isStaff)) return '/account'
  if (fromRaw && fromRaw !== '/login' && fromRaw !== '/register') return fromRaw
  return wholesaleHome(settings)
}

export function Login() {
  const {
    user,
    login,
    verifyEmail,
    resendVerifyEmail,
    requestPasswordReset,
    resetPassword,
    settings,
    isStaff,
  } = useStore()
  const location = useLocation()
  const fromRaw = (location.state as { from?: string } | null)?.from
  const [ident, setIdent] = useState('')
  const [password, setPassword] = useState('')
  const [step, setStep] = useState<'email' | 'password' | 'reset' | 'verify'>('email')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [newPass, setNewPass] = useState('')
  const [issuedCode, setIssuedCode] = useState<string | null>(null)
  const [resetOk, setResetOk] = useState<string | null>(null)
  const [verifyIdent, setVerifyIdent] = useState('')

  if (user) {
    return <Navigate to={postLoginPath(user, isStaff, settings, fromRaw)} replace />
  }

  function onEmail(e: FormEvent) {
    e.preventDefault()
    if (!ident.trim()) {
      setError('Enter your email address or account ID.')
      return
    }
    setError(null)
    setStep('password')
  }

  async function onPassword(e: FormEvent) {
    e.preventDefault()
    const result = await login(ident, password)
    if (result && typeof result === 'object' && result.needsVerify) {
      setError(null)
      setVerifyIdent(result.accountId || result.email || ident)
      setIssuedCode(result.code || null)
      setCode('')
      setStep('verify')
      return
    }
    if (typeof result === 'string') setError(result)
    else if (!remember) {
      /* session cookie is httpOnly; remember is UI-only for now */
    }
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const err = await verifyEmail(verifyIdent || ident, code)
    if (err) setError(err)
  }

  async function onResendVerify() {
    setError(null)
    const result = await resendVerifyEmail(verifyIdent || ident)
    if ('error' in result) {
      setError(result.error)
      return
    }
    if (result.code) setIssuedCode(result.code)
    else setIssuedCode('__sent__')
  }

  async function onRequestReset(e: FormEvent) {
    e.preventDefault()
    const result = await requestPasswordReset(ident)
    if ('error' in result) {
      setError(result.error)
      setIssuedCode(null)
      return
    }
    setError(null)
    setIssuedCode(result.code || '__sent__')
    setResetOk(result.message || null)
  }

  async function onApplyReset(e: FormEvent) {
    e.preventDefault()
    const err = await resetPassword(ident, code, newPass)
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

  function goForgot() {
    if (!ident.trim()) {
      setError('Enter your email address or account ID first.')
      return
    }
    setError(null)
    setIssuedCode(null)
    setResetOk(null)
    setStep('reset')
  }

  return (
    <AuthFrame>
      <h1>
        {step === 'verify'
          ? 'Verify your email'
          : step === 'reset'
            ? 'Forgot password'
            : 'Welcome back!'}
      </h1>
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
          <p className="auth-forgot">
            <button type="button" className="linkish" onClick={goForgot}>
              {settings.copy.btnForgot || 'Forgot password?'}
            </button>
          </p>
        </form>
      ) : step === 'verify' ? (
        <form onSubmit={onVerify}>
          <p className="muted">
            Enter the code sent to <strong>{verifyIdent || ident}</strong> to finish signing in.
          </p>
          {issuedCode && issuedCode !== '__sent__' ? (
            <p className="ok tiny">
              Local/dev code: <strong>{issuedCode}</strong>
            </p>
          ) : issuedCode === '__sent__' ? (
            <p className="ok tiny">A new code was sent.</p>
          ) : null}
          <label>
            Verification code
            <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn-bstock" type="submit">
            Verify and continue
          </button>
          <p>
            <button type="button" className="linkish" onClick={() => void onResendVerify()}>
              Resend code
            </button>
          </p>
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
              Back to password
            </button>
          </p>
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
                {issuedCode && issuedCode !== '__sent__' ? (
                  <>
                    Reset code sent (also shown here in local/dev): <strong>{issuedCode}</strong>.
                    Expires in 30 minutes.
                  </>
                ) : (
                  <>Check your email for a reset code. It expires in 30 minutes.</>
                )}
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
          <p className="auth-forgot">
            <button type="button" className="linkish" onClick={goForgot}>
              {settings.copy.btnForgot || 'Forgot password?'}
            </button>
          </p>
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
      <details className="auth-demo">
        <summary>Demo accounts</summary>
        <ul>
          <li>
            Wholesale <strong>DEMO-1001</strong> / <strong>livebid</strong>
          </li>
          <li>
            Retail <strong>RETAIL-1001</strong> / <strong>retail</strong>
          </li>
          <li>
            Admin <strong>ops@livebid.example</strong> / <strong>admin</strong>
          </li>
          <li>
            Super <strong>super@livebid.example</strong> / <strong>super</strong>
          </li>
        </ul>
      </details>
    </AuthFrame>
  )
}
