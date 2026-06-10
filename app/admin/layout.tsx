'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

const navItems = [
  { label: 'Dashboard', href: '/admin', icon: '📊' },
  { label: 'Products', href: '/admin/products', icon: '📦' },
  { label: 'Inventory', href: '/admin/inventory', icon: '🗃️' },
  { label: 'Orders', href: '/admin/orders', icon: '🛒' },
  { label: 'Customers', href: '/admin/customers', icon: '👥' },
  { label: 'Reports', href: '/admin/reports', icon: '📈' },
  { label: 'Payouts', href: '/admin/payouts', icon: '💳' },
  { label: 'Integrations', href: '/admin/integrations', icon: '🔗' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && pathname !== '/admin/login') {
        router.push('/admin/login')
      } else {
        setUser(session?.user)
      }
      setLoading(false)
    })
  }, [router, pathname])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--cream)' }}>Loading...</div>
  if (pathname === '/admin/login') return <>{children}</>

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#F0EBE0' }}>

      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-16'} transition-all duration-300 flex flex-col shadow-lg`}
        style={{ backgroundColor: 'var(--secondary-dark)', color: 'white', height: '100vh', position: 'sticky', top: 0 }}
      >
        {/* Logo */}
        <div className="p-4 flex items-center justify-between border-b border-green-800">
          {sidebarOpen && (
            <Image src="/logo.png" alt="Briar Patch Outdoors" width={130} height={50} className="object-contain" />
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white hover:text-yellow-300 ml-auto">
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                  isActive
                    ? 'text-white font-bold border-l-4'
                    : 'text-green-200 hover:text-white hover:bg-green-900'
                }`}
                style={isActive ? { borderColor: 'var(--accent)', backgroundColor: 'rgba(0,0,0,0.2)' } : {}}
              >
                <span className="text-lg">{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Sign Out */}
        <div className="p-4 border-t border-green-800">
          <button
            onClick={handleSignOut}
            className={`flex items-center gap-3 text-sm text-green-200 hover:text-white transition-colors ${!sidebarOpen && 'justify-center'}`}
          >
            <span>🚪</span>
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ height: '100vh' }}>

        {/* Top Bar */}
        <header className="px-6 py-4 flex justify-between items-center shadow-sm" style={{ backgroundColor: '#C4A882' }}>
          <h1 className="font-bold text-lg" style={{ color: '#2C2C2C' }}>
            {navItems.find(i => i.href === pathname)?.label || 'Admin'}
          </h1>
          <div className="flex items-center gap-3 text-sm" style={{ color: '#2C2C2C' }}>
            <span>👤</span>
            <span>{user?.email}</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6" style={{ height: 'calc(100vh - 57px)' }}>
          {children}
        </main>

      </div>
    </div>
  )
}