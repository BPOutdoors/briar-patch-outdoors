'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

type Tab = 'orders' | 'profile'

export default function AccountPage() {
  const router = useRouter()
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('orders')

  // Auth form state
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Customer data
  const [customer, setCustomer] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  // Profile edit
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '', phone: '', address: '', city: '', state: 'GA', zip: '' })
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
      if (session?.user?.email) loadCustomerData(session.user.email)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user?.email) loadCustomerData(session.user.email)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadCustomerData(userEmail: string) {
    const { data: cust } = await supabase
      .from('customers')
      .select('*')
      .eq('email', userEmail)
      .single()
    if (cust) {
      setCustomer(cust)
      setProfileForm({
        first_name: cust.first_name || '',
        last_name: cust.last_name || '',
        phone: cust.phone || '',
        address: cust.address || '',
        city: cust.city || '',
        state: cust.state || 'GA',
        zip: cust.zip || '',
      })
    }
    setOrdersLoading(true)
    const { data: orderData } = await supabase
      .from('orders')
      .select('*, order_items(product_name, quantity, unit_price, line_total)')
      .eq('customer_email', userEmail)
      .order('created_at', { ascending: false })
    setOrders(orderData || [])
    setOrdersLoading(false)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setAuthLoading(true); setAuthError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthError(error.message)
    setAuthLoading(false)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName || !lastName) { setAuthError('First and last name are required'); return }
    setAuthLoading(true); setAuthError('')
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setAuthError(error.message); setAuthLoading(false); return }
    // Create/update customer record
    if (data.user) {
      await supabase.from('customers').upsert({
        email,
        first_name: firstName,
        last_name: lastName,
        created_source: 'web_account',
      }, { onConflict: 'email' })
    }
    setAuthMessage('Account created! Check your email to confirm, then sign in.')
    setAuthMode('login')
    setAuthLoading(false)
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setAuthLoading(true); setAuthError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/account/reset-password`,
    })
    if (error) setAuthError(error.message)
    else setAuthMessage('Password reset link sent! Check your email.')
    setAuthLoading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setCustomer(null); setOrders([])
  }

  async function saveProfile() {
    if (!customer) return
    setSavingProfile(true)
    await supabase.from('customers').update({
      first_name: profileForm.first_name,
      last_name: profileForm.last_name,
      phone: profileForm.phone || null,
      address: profileForm.address || null,
      city: profileForm.city || null,
      state: profileForm.state || null,
      zip: profileForm.zip || null,
      updated_at: new Date().toISOString(),
    }).eq('id', customer.id)
    setCustomer({ ...customer, ...profileForm })
    setEditingProfile(false)
    setSavingProfile(false)
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'processing': return { bg: '#dbeafe', text: '#1d4ed8' }
      case 'shipped': return { bg: '#d1fae5', text: '#065f46' }
      case 'completed': return { bg: '#d1fae5', text: '#065f46' }
      case 'pending': return { bg: '#fef3c7', text: '#92400e' }
      case 'cancelled': return { bg: '#fee2e2', text: '#dc2626' }
      default: return { bg: '#f3f4f6', text: '#6b7280' }
    }
  }

  if (loading) {
    return (
      <>
        <Nav />
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-gray-300 text-sm animate-pulse">Loading...</div>
        </div>
        <Footer />
      </>
    )
  }

  // ---- NOT LOGGED IN ----
  if (!session) {
    return (
      <>
        <Nav />
        <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
                {authMode === 'login' ? 'Sign In' : authMode === 'register' ? 'Create Account' : 'Reset Password'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {authMode === 'login' ? 'View your orders and manage your account' : authMode === 'register' ? 'Create an account to track your orders' : 'Enter your email to receive a reset link'}
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border p-8" style={{ borderColor: '#e5e7eb' }}>

              {authMessage && (
                <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 font-medium">
                  {authMessage}
                </div>
              )}
              {authError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
                  {authError}
                </div>
              )}

              <form onSubmit={authMode === 'login' ? handleLogin : authMode === 'register' ? handleRegister : handleForgotPassword}
                className="space-y-4">

                {authMode === 'register' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">First Name *</label>
                      <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required
                        className="w-full border rounded-lg px-3 py-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Last Name *</label>
                      <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required
                        className="w-full border rounded-lg px-3 py-2.5 text-sm" />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    className="w-full border rounded-lg px-3 py-2.5 text-sm" />
                </div>

                {authMode !== 'forgot' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Password</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                      className="w-full border rounded-lg px-3 py-2.5 text-sm" />
                  </div>
                )}

                <button type="submit" disabled={authLoading}
                  className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-50"
                  style={{ backgroundColor: 'var(--primary)' }}>
                  {authLoading ? 'Please wait...' : authMode === 'login' ? 'Sign In' : authMode === 'register' ? 'Create Account' : 'Send Reset Link'}
                </button>
              </form>

              <div className="mt-5 text-center space-y-2">
                {authMode === 'login' && (
                  <>
                    <button onClick={() => { setAuthMode('forgot'); setAuthError(''); setAuthMessage('') }}
                      className="text-xs text-gray-400 hover:text-gray-600 block w-full">
                      Forgot your password?
                    </button>
                    <p className="text-sm text-gray-500">
                      Don't have an account?{' '}
                      <button onClick={() => { setAuthMode('register'); setAuthError(''); setAuthMessage('') }}
                        className="font-bold" style={{ color: 'var(--primary)' }}>
                        Create one
                      </button>
                    </p>
                  </>
                )}
                {authMode !== 'login' && (
                  <p className="text-sm text-gray-500">
                    <button onClick={() => { setAuthMode('login'); setAuthError(''); setAuthMessage('') }}
                      className="font-bold" style={{ color: 'var(--primary)' }}>
                      ← Back to sign in
                    </button>
                  </p>
                )}
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 mt-4">
              Ordered as a guest?{' '}
              <a href="tel:7067496994" style={{ color: 'var(--primary)' }} className="font-semibold">
                Call us at (706) 749-6994
              </a>{' '}for order status.
            </p>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  // ---- LOGGED IN ----
  const displayName = customer ? `${customer.first_name} ${customer.last_name}` : session.user.email

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-gray-50">

        {/* Account header */}
        <div style={{ backgroundColor: 'var(--primary)' }} className="py-8 px-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">My Account</p>
              <h1 className="text-xl font-bold text-white">{displayName}</h1>
              <p className="text-sm text-white/70 mt-0.5">{session.user.email}</p>
            </div>
            <button onClick={handleSignOut}
              className="text-xs font-semibold px-4 py-2 rounded-lg border border-white/30 text-white/80 hover:bg-white/10 transition-colors">
              Sign Out
            </button>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-6">

          {/* Stats */}
          {customer && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-white border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Total Orders</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{orders.length}</p>
              </div>
              <div className="bg-white border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Total Spent</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
                  ${(customer.lifetime_spend || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mb-5 border-b" style={{ borderColor: '#e5e7eb' }}>
            {[{ key: 'orders', label: 'Order History' }, { key: 'profile', label: 'Profile' }].map(t => (
              <button key={t.key} onClick={() => setTab(t.key as Tab)}
                className="px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors"
                style={{ borderColor: tab === t.key ? 'var(--primary)' : 'transparent', color: tab === t.key ? 'var(--primary)' : '#888' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ---- ORDERS TAB ---- */}
          {tab === 'orders' && (
            <div>
              {ordersLoading ? (
                <div className="text-center py-8 text-gray-400 text-sm">Loading orders...</div>
              ) : orders.length === 0 ? (
                <div className="bg-white border rounded-xl p-10 text-center" style={{ borderColor: '#e5e7eb' }}>
                  <p className="font-semibold text-gray-400 mb-2">No orders yet</p>
                  <p className="text-sm text-gray-400 mb-4">Your order history will appear here</p>
                  <button onClick={() => router.push('/shop')}
                    className="px-6 py-2.5 rounded-lg font-bold text-white text-sm"
                    style={{ backgroundColor: 'var(--primary)' }}>
                    Start Shopping
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map(order => {
                    const status = getStatusColor(order.status)
                    const isExpanded = expandedOrder === order.id
                    return (
                      <div key={order.id} className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
                        <button onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-bold text-sm" style={{ color: 'var(--primary)' }}>{order.order_number}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                              style={{ backgroundColor: status.bg, color: status.text }}>
                              {order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
                            </span>
                            {order.fulfillment_type === 'pickup' && (
                              <span className="text-xs text-gray-400">📍 Local Pickup</span>
                            )}
                            {order.fulfillment_type === 'shipping' && (
                              <span className="text-xs text-gray-400">📦 Shipped</span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0">
                            <div className="text-right hidden sm:block">
                              <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                              <p className="text-sm font-bold" style={{ color: 'var(--primary)' }}>${order.total?.toFixed(2)}</p>
                            </div>
                            <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t px-5 py-4" style={{ borderColor: '#f0f0f0' }}>
                            {/* Items */}
                            <div className="space-y-2 mb-4">
                              {(order.order_items || []).map((item: any, i: number) => (
                                <div key={i} className="flex justify-between text-sm">
                                  <span className="text-gray-700">{item.quantity}× {item.product_name}</span>
                                  <span className="font-semibold" style={{ color: 'var(--primary)' }}>${item.line_total?.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                            {/* Totals */}
                            <div className="border-t pt-3 space-y-1 text-xs text-gray-500" style={{ borderColor: '#f0f0f0' }}>
                              <div className="flex justify-between"><span>Subtotal</span><span>${order.subtotal?.toFixed(2)}</span></div>
                              {order.shipping_cost > 0 && <div className="flex justify-between"><span>Shipping</span><span>${order.shipping_cost?.toFixed(2)}</span></div>}
                              {order.tax > 0 && <div className="flex justify-between"><span>Tax</span><span>${order.tax?.toFixed(2)}</span></div>}
                              <div className="flex justify-between font-bold text-sm pt-1 border-t" style={{ borderColor: '#f0f0f0', color: 'var(--primary)' }}>
                                <span>Total</span><span>${order.total?.toFixed(2)}</span>
                              </div>
                            </div>
                            {/* Tracking */}
                            {order.tracking_number && (
                              <div className="mt-3 p-3 rounded-lg bg-blue-50 text-sm text-blue-800">
                                <span className="font-semibold">Tracking: </span>{order.tracking_number}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ---- PROFILE TAB ---- */}
          {tab === 'profile' && (
            <div className="bg-white border rounded-xl p-6" style={{ borderColor: '#e5e7eb' }}>
              {!editingProfile ? (
                <>
                  <div className="flex justify-between items-center mb-5">
                    <h2 className="font-bold text-sm" style={{ color: 'var(--primary)' }}>Personal Information</h2>
                    <button onClick={() => setEditingProfile(true)}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg border"
                      style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                      Edit
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {[
                      { label: 'First Name', value: customer?.first_name },
                      { label: 'Last Name', value: customer?.last_name },
                      { label: 'Email', value: session.user.email },
                      { label: 'Phone', value: customer?.phone },
                      { label: 'Address', value: customer?.address },
                      { label: 'City', value: customer?.city },
                      { label: 'State', value: customer?.state },
                      { label: 'ZIP', value: customer?.zip },
                    ].map(f => (
                      <div key={f.label}>
                        <p className="text-xs font-semibold text-gray-400 mb-0.5">{f.label}</p>
                        <p className="text-gray-700">{f.value || <span className="text-gray-300">—</span>}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 pt-4 border-t" style={{ borderColor: '#f0f0f0' }}>
                    <button onClick={() => router.push('/account/change-password')}
                      className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>
                      Change Password →
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="font-bold text-sm mb-5" style={{ color: 'var(--primary)' }}>Edit Profile</h2>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">First Name</label>
                        <input type="text" value={profileForm.first_name}
                          onChange={e => setProfileForm(f => ({ ...f, first_name: e.target.value }))}
                          className="w-full border rounded-lg px-3 py-2.5 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Last Name</label>
                        <input type="text" value={profileForm.last_name}
                          onChange={e => setProfileForm(f => ({ ...f, last_name: e.target.value }))}
                          className="w-full border rounded-lg px-3 py-2.5 text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Phone</label>
                      <input type="tel" value={profileForm.phone}
                        onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                        className="w-full border rounded-lg px-3 py-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Street Address</label>
                      <input type="text" value={profileForm.address}
                        onChange={e => setProfileForm(f => ({ ...f, address: e.target.value }))}
                        className="w-full border rounded-lg px-3 py-2.5 text-sm" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-1">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">City</label>
                        <input type="text" value={profileForm.city}
                          onChange={e => setProfileForm(f => ({ ...f, city: e.target.value }))}
                          className="w-full border rounded-lg px-3 py-2.5 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">State</label>
                        <input type="text" value={profileForm.state} maxLength={2}
                          onChange={e => setProfileForm(f => ({ ...f, state: e.target.value.toUpperCase() }))}
                          className="w-full border rounded-lg px-3 py-2.5 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">ZIP</label>
                        <input type="text" value={profileForm.zip}
                          onChange={e => setProfileForm(f => ({ ...f, zip: e.target.value }))}
                          className="w-full border rounded-lg px-3 py-2.5 text-sm" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-5">
                    <button onClick={saveProfile} disabled={savingProfile}
                      className="flex-1 py-2.5 rounded-lg font-bold text-white text-sm"
                      style={{ backgroundColor: savingProfile ? '#9ca3af' : 'var(--primary)' }}>
                      {savingProfile ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button onClick={() => setEditingProfile(false)}
                      className="flex-1 py-2.5 rounded-lg font-bold text-sm border"
                      style={{ borderColor: '#ddd', color: '#666' }}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </main>
      <Footer />
    </>
  )
}
