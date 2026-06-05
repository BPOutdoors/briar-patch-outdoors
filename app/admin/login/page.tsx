'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) {
      setMessage('Error: ' + error.message)
    } else {
      setMessage('Check your email for a login link!')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Briar Patch Outdoors Admin</h1>
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border p-3 rounded mb-4"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-700 text-white p-3 rounded font-semibold hover:bg-green-800"
          >
            {loading ? 'Sending...' : 'Send Login Link'}
          </button>
        </form>
        {message && <p className="mt-4 text-center text-sm text-gray-600">{message}</p>}
      </div>
    </div>
  )
}