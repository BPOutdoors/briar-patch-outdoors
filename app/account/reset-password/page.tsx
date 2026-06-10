'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    setDone(true)
    setTimeout(() => router.push('/account'), 2500)
  }

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border p-8" style={{ borderColor: '#e5e7eb' }}>
            {done ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--primary)' }}>Password updated!</h2>
                <p className="text-sm text-gray-400">Redirecting to your account...</p>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--primary)' }}>Set New Password</h1>
                <p className="text-sm text-gray-500 mb-6">Choose a new password for your account</p>
                {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">{error}</div>}
                <form onSubmit={handleReset} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">New Password</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                      className="w-full border rounded-lg px-3 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Confirm Password</label>
                    <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                      className="w-full border rounded-lg px-3 py-2.5 text-sm" />
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-50"
                    style={{ backgroundColor: 'var(--primary)' }}>
                    {loading ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
