import { useState, type FormEvent } from 'react'

interface AdminLoginProps {
  onSuccess: (token: string) => void
}

export function AdminLogin({ onSuccess }: AdminLoginProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        setError('Invalid password')
        return
      }
      const data = await res.json()
      onSuccess(data.token)
    } catch {
      setError('Connection error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-32 px-6">
      <div className="rounded-lg border border-outline-variant bg-surface p-8">
        <div className="flex items-center gap-2 mb-6">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: '24px' }}>lock</span>
          <h2 className="text-lg font-bold text-on-surface">Admin Access</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-secondary mb-1.5">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 rounded border border-outline-variant bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Enter admin password"
          />
          {error && (
            <p className="text-sm text-red-500 mt-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full mt-4 px-4 py-2 rounded bg-primary text-on-primary text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  )
}
