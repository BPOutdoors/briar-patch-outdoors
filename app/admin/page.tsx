'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/admin/login')
      } else {
        setUser(session.user)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/admin/login')
      } else {
        setUser(session.user)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-green-700 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Briar Patch Outdoors — Admin</h1>
        <button onClick={handleSignOut} className="bg-white text-green-700 px-4 py-2 rounded font-semibold">
          Sign Out
        </button>
      </div>
      <div className="p-8">
        <p className="text-gray-600 mb-6">Logged in as {user?.email}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded shadow">
            <h2 className="text-lg font-bold mb-2">Products</h2>
            <p className="text-gray-500 text-sm">Manage your product catalog and pricing</p>
          </div>
          <div className="bg-white p-6 rounded shadow">
            <h2 className="text-lg font-bold mb-2">Orders</h2>
            <p className="text-gray-500 text-sm">View and manage customer orders</p>
          </div>
          <div className="bg-white p-6 rounded shadow">
            <h2 className="text-lg font-bold mb-2">Sync</h2>
            <p className="text-gray-500 text-sm">Sync products from Kinsey's</p>
          </div>
        </div>
      </div>
    </div>
  )
}