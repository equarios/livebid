import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AuthFrame } from '../components/AuthFrame'
import { canUseWholesaleDesk, publicHome, wholesaleHome } from '../lib/channelAccess'
import { useStore } from '../store'

type Step = 'identity' | 'password' | 'verify'

export function Register() {
  const { user, register, verifyEmail, resendVerifyEmail, settings, isStaff } = useStore()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [emailConfirm, setEmailConfirm] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [updates, setUpdates] = useState(true)
  const [step, setStep] = useState<Step>('identity')
  const [ident, setIdent] = useState('')
  const [code, setCode] = useState('')
  const [issuedCode, setIssuedCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) {
    const dest = canUseWholesaleDesk(user, isStaff) ? wholesaleHome(settings) : publicHome(settings)
    return <Navigate to={dest === '/' ? '/account' : dest} replace />
  }
  if (!settings.features.register && step !== 'verify') return <Navigate to="/login" replace />

  function onIdentity(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!firstName.trim() || !lastName.trim()) {
      setError('Enter your first and last name.')
      return
    }
    if (!email.trim()) {
      setError('Enter your email address.')
      return
    }
    if (email.trim().toLowerCase() !== emailConfirm.trim().toLowerCase()) {
      setError('Email addresses do not match.')
      return
    }
    setStep('password')
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== passwordConfirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setBusy(true)
    try {
      const result = await register({
        firstName,
        lastName,
        email,
        emailConfirm,
        password,
        passwordConfirm,
      })
      if (typeof result === 'string') {
        setError(result)
        return
      }
      setIdent(result.accountId || email)
      setIssuedCode(result.code || null)
      setCode('')
      setStep('verify')
    } finally {
      setBusy(false)
    }
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const err = await verifyEmail(ident, code)
    if (err) setError(err)
  }

  async function onResend() {
    setError(null)
    const result = await resendVerifyEmail(ident || email)
    if ('error' in result) {
      setError(result.error)
      return
    }
    if (result.code) setIssuedCode(result.code)
    else setIssuedCode('__sent__')
  }

  const title =
    step === 'verify' ? 'Verify your email' : step === 'password' ? 'Set a password' : 'Create your account'

  return (
    <AuthFrame>
      <h1>{title}</h1>

      {step === 'identity' ? (
        <form onSubmit={onIdentity}>
          <p>Enter your name and email</p>
          <div className="auth-row">
            <label>
              <span className="sr-only">First name</span>
              <input
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete="given-name"
              />
            </label>
            <label>
              <span className="sr-only">Last name</span>
              <input
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                autoComplete="family-name"
              />
            </label>
          </div>
          <label>
            <span className="sr-only">Email Address</span>
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            <span className="sr-only">Confirm email</span>
            <input
              type="email"
              placeholder="Confirm email"
              value={emailConfirm}
              onChange={(e) => setEmailConfirm(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn-bstock" type="submit">
            Continue
          </button>
        </form>
      ) : null}

      {step === 'password' ? (
        <form onSubmit={(e) => void onRegister(e)}>
          <p>
            Password for <strong>{email}</strong>
          </p>
          <label>
            <span className="sr-only">Password</span>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </label>
          <label>
            <span className="sr-only">Confirm password</span>
            <input
              type="password"
              placeholder="Confirm password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </label>
          <label className="check-inline">
            <input type="checkbox" checked={updates} onChange={(e) => setUpdates(e.target.checked)} />
            Email me updates on inventory and promotions.
          </label>
          {error ? <p className="error">{error}</p> : null}
          <p className="tiny muted">
            By creating an account you agree to eQuarios buyer terms. Wholesale access is a separate application
            after signup.
          </p>
          <button className="btn-bstock" type="submit" disabled={busy}>
            {busy ? 'Creating…' : settings.copy.signUpButton || 'Create account'}
          </button>
          <p>
            <button
              type="button"
              className="linkish"
              onClick={() => {
                setStep('identity')
                setError(null)
              }}
            >
              Use a different email
            </button>
          </p>
        </form>
      ) : null}

      {step === 'verify' ? (
        <form onSubmit={(e) => void onVerify(e)}>
          <p className="muted">
            Enter the code sent to <strong>{email || ident}</strong> to activate your account.
          </p>
          {issuedCode && issuedCode !== '__sent__' ? (
            <p className="ok tiny">
              Local/dev code: <strong>{issuedCode}</strong>
            </p>
          ) : issuedCode === '__sent__' ? (
            <p className="ok tiny">A new code was sent.</p>
          ) : null}
          <label>
            <span className="sr-only">Verification code</span>
            <input
              placeholder="Verification code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn-bstock" type="submit">
            Verify and continue
          </button>
          <p>
            <button type="button" className="linkish" onClick={() => void onResend()}>
              Resend code
            </button>
          </p>
        </form>
      ) : null}

      <p className="auth-foot">
        {step === 'verify' ? (
          <Link to="/login">Sign In</Link>
        ) : (
          <>
            Already have an account? <Link to="/login">Sign In</Link>
          </>
        )}
      </p>
    </AuthFrame>
  )
}
