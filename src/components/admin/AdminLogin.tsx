import { useEffect, useState, type FormEvent } from 'react'

interface AdminLoginProps {
  /** The token, and the admin it names. */
  onSuccess: (token: string, user: string) => void
  /** Shown above the form, e.g. why the user is seeing it again (expired session). */
  notice?: string
}

interface LoginOptions {
  password: boolean
  sso: boolean
  /** Who the single sign-on gateway says is asking; null when the page was not opened through it. */
  user: string | null
}

async function errorOf(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null
  return typeof body?.error === 'string' ? body.error : fallback
}

/**
 * Signing in to the admin screens: as yourself through single sign-on (the gateway names you, the
 * directory says you are an admin), or with the shared password where that is still allowed.
 */
export function AdminLogin({ onSuccess, notice }: AdminLoginProps) {
  const [options, setOptions] = useState<LoginOptions | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState<'sso' | 'password' | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/admin/login/options', { headers: { Accept: 'application/json' } })
      .then(res => (res.ok ? res.json() : null))
      .then((o: LoginOptions | null) => { if (!cancelled) setOptions(o ?? { password: true, sso: false, user: null }) })
      .catch(() => { if (!cancelled) setOptions({ password: true, sso: false, user: null }) })
    return () => { cancelled = true }
  }, [])

  async function finish(res: Response) {
    const data = (await res.json().catch(() => null)) as { token?: unknown; user?: unknown } | null
    if (typeof data?.token !== 'string' || !data.token) {
      setError('Invalid server response')
      return
    }
    onSuccess(data.token, typeof data.user === 'string' ? data.user : 'password')
  }

  async function signInSso() {
    setError('')
    setLoading('sso')
    try {
      const res = await fetch('/admin/login/sso', { method: 'POST' })
      if (!res.ok) {
        setError(await errorOf(res, res.status === 403 ? 'You are not an admin of this service.' : 'Could not sign you in.'))
        return
      }
      await finish(res)
    } catch {
      setError('Connection error')
    } finally {
      setLoading(null)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading('password')
    try {
      const res = await fetch('/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.status === 429 || res.status === 403) {
        // Too many wrong passwords from this address, or the password is turned off here.
        setError(await errorOf(res, 'Try again later.'))
        return
      }
      if (!res.ok) {
        setError('Invalid password')
        return
      }
      await finish(res)
    } catch {
      setError('Connection error')
    } finally {
      setLoading(null)
    }
  }

  const ssoReady = options?.sso && options.user

  return (
    <div className="max-w-sm mx-auto mt-32 px-6">
      <div className="rounded-lg border border-outline-variant bg-surface p-8">
        <div className="flex items-center gap-2 mb-6">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: '24px' }}>lock</span>
          <h2 className="text-lg font-bold text-on-surface">Admin Access</h2>
        </div>
        {notice && (
          <p role="status" className="text-sm text-secondary mb-4">{notice}</p>
        )}

        {options?.sso && (
          <div className="mb-6">
            <button
              type="button"
              onClick={signInSso}
              disabled={!ssoReady || loading !== null}
              className="w-full px-4 py-2 rounded bg-primary text-on-primary text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading === 'sso' ? 'Signing in…' : ssoReady ? `Sign in as ${options.user}` : 'Sign in with your account'}
            </button>
            {!options.user && (
              <p className="text-xs text-secondary mt-2">
                Open this page through the company sign-on to sign in as yourself.
              </p>
            )}
          </div>
        )}

        {options?.password !== false && (
          <form onSubmit={handleSubmit}>
            {options?.sso && (
              <p className="text-[11px] uppercase tracking-widest text-secondary mb-3">Or with the shared password</p>
            )}
            <label htmlFor="admin-password" className="block text-sm font-medium text-secondary mb-1.5">Password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus={!ssoReady}
              className="w-full px-3 py-2 rounded border border-outline-variant bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter admin password"
            />
            <button
              type="submit"
              disabled={loading !== null || !password}
              className={`w-full mt-4 px-4 py-2 rounded text-sm font-medium transition-opacity disabled:opacity-50 ${
                options?.sso ? 'border border-outline-variant text-on-surface hover:border-primary/60' : 'bg-primary text-on-primary hover:opacity-90'
              }`}
            >
              {loading === 'password' ? 'Verifying...' : 'Enter'}
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-500 mt-3">{error}</p>
        )}
      </div>
    </div>
  )
}
