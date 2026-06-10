'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '@/lib/cart-context'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePathname } from 'next/navigation'

export default function Nav() {
  const { itemCount, openCart } = useCart()
  const [hasSale, setHasSale] = useState(false)
  const [accountUser, setAccountUser] = useState<any>(null)
  const pathname = usePathname()

  useEffect(() => {
    const now = new Date().toISOString()
    supabase.from('sales').select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .or(`start_date.is.null,start_date.lte.${now}`)
      .or(`end_date.is.null,end_date.gte.${now}`)
      .then(({ count }) => setHasSale((count ?? 0) > 0))
    supabase.auth.getSession().then(({ data: { session } }) => setAccountUser(session?.user || null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setAccountUser(session?.user || null))
    return () => subscription.unsubscribe()
  }, [])

  return (
    <nav style={{ backgroundColor: '#C4A882', color: '#2C2C2C' }} className="px-6 py-4 shadow-md">
      <div className="max-w-screen-2xl mx-auto flex justify-between items-center">
        <Link href="/">
          <Image src="/logo.png" alt="Briar Patch Outdoors" width={220} height={80} className="object-contain" />
        </Link>
        <div className="hidden md:flex gap-8 text-sm font-semibold uppercase tracking-wide">
          <Link href="/shop" className="hover:text-amber-800 transition-colors">Shop</Link>
          {hasSale && (
            <Link href="/sale" className="relative hover:text-amber-800 transition-colors" style={{ color: '#b91c1c' }}>
              Sale
              <span className="absolute -top-2 -right-3 w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            </Link>
          )}
          <Link href="/about" className="hover:text-amber-800 transition-colors">About Us</Link>
          <Link href="/contact" className="hover:text-amber-800 transition-colors">Contact</Link>
        </div>
        <div className="flex items-center gap-4">
          {/* Account icon */}
          <Link href="/account" className="hover:text-amber-800 transition-colors" title={accountUser ? 'My Account' : 'Sign In'}>
            {accountUser ? (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: 'var(--primary)' }}>
                {accountUser.email?.[0]?.toUpperCase()}
              </div>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </Link>
          <button onClick={openCart} className="relative hover:text-amber-800 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {itemCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center"
                style={{ backgroundColor: 'var(--primary)' }}>
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </nav>
  )
}
