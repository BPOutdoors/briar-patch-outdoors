'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

const navItems = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Products', href: '/admin/products' },
  { label: 'Inventory', href: '/admin/inventory' },
  { label: 'Orders', href: '/admin/orders' },
  { label: 'Customers', href: '/admin/customers' },
  { label: 'Reports', href: '/admin/reports' },
  { label: 'Hero Banners', href: '/admin/banners' },
  { label: 'Payouts', href: '/admin/payouts' },
  { label: 'Promotions', href: '/admin/sales' },
  { label: 'Tax Nexus', href: '/admin/tax-nexus' },
  { label: 'Integrations', href: '/admin/integrations' },
  { label: 'Settings', href: '/admin/settings' },
]

const POS_ROUTE = '/admin/pos'

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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Image src="/logo.png" alt="Briar Patch Outdoors" width={160} height={60} className="object-contain opacity-50" />
    </div>
  )
  if (pathname === '/admin/login') return <>{children}</>
  if (pathname === POS_ROUTE) return <>{children}</>

  const activeLabel = navItems.find(i => i.href === pathname)?.label || 'Admin'

  return (
    <div className="min-h-screen flex bg-white">

      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-56' : 'w-14'} transition-all duration-300 flex flex-col border-r`}
        style={{ backgroundColor: '#C4A882', height: '100vh', position: 'sticky', top: 0, borderColor: '#b39470' }}
      >
        {/* Logo area */}
        <div className="flex items-center justify-between px-3 py-4 border-b" style={{ borderColor: '#b39470' }}>
          {sidebarOpen && (
            <Image src="/logo.png" alt="Briar Patch Outdoors" width={120} height={45} className="object-contain" />
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded transition-colors hover:bg-black/10"
            style={{ color: '#2C2C2C', marginLeft: sidebarOpen ? 'auto' : '0' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {sidebarOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M6 5l7 7-7 7" />
              }
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                title={!sidebarOpen ? item.label : undefined}
                className="flex items-center px-3 py-2.5 mx-2 my-0.5 rounded-lg text-sm transition-colors"
                style={{
                  backgroundColor: isActive ? 'rgba(0,0,0,0.15)' : 'transparent',
                  color: isActive ? '#1a1a1a' : '#3a2e1e',
                  fontWeight: isActive ? '700' : '500',
                  borderLeft: isActive ? '3px solid #4A5E2F' : '3px solid transparent',
                }}
              >
                {sidebarOpen && <span>{item.label}</span>}
                {!sidebarOpen && (
                  <span className="font-bold text-xs" style={{ color: isActive ? '#1a1a1a' : '#3a2e1e' }}>
                    {item.label.slice(0, 2)}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* POS Button */}
        <div className="px-2 py-2 border-t" style={{ borderColor: '#b39470' }}>
          <Link
            href="/admin/pos"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold w-full transition-colors"
            style={{ backgroundColor: 'var(--primary)', color: 'white' }}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {sidebarOpen && <span>Open POS</span>}
          </Link>
        </div>

        {/* Bottom — user + sign out */}
        <div className="p-3 border-t" style={{ borderColor: '#b39470' }}>
          {sidebarOpen && (
            <p className="text-xs truncate mb-2 px-1" style={{ color: '#3a2e1e' }}>{user?.email}</p>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full transition-colors hover:bg-black/10"
            style={{ color: '#3a2e1e' }}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {sidebarOpen && <span className="font-medium">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ height: '100vh' }}>

        {/* Top Bar */}
        <header className="flex items-center justify-between px-6 py-3 border-b bg-white"
          style={{ borderColor: '#e5e7eb' }}>
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-lg" style={{ color: 'var(--primary)' }}>
              {activeLabel}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/shop" target="_blank"
              className="text-xs font-semibold px-3 py-1.5 rounded border transition-colors hover:bg-gray-50"
              style={{ borderColor: '#ddd', color: '#666' }}>
              View Shop ↗
            </Link>
            <div className="flex items-center gap-2 text-sm" style={{ color: '#666' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: 'var(--primary)' }}>
                {user?.email?.[0]?.toUpperCase()}
              </div>
              <span className="hidden sm:block text-xs">{user?.email}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6 bg-white" style={{ height: 'calc(100vh - 57px)' }}>
          {children}
        </main>

      </div>
    </div>
  )
}
