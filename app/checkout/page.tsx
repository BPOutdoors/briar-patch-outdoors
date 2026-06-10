'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/cart-context'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const GA_TAX_RATE = 0.08
const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

function CheckoutForm({ clientSecret, total, orderData, onSuccess }: {
  clientSecret: string
  total: number
  orderData: any
  onSuccess: (orderNumber: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setProcessing(true)
    setError('')

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (stripeError) {
      setError(stripeError.message || 'Payment failed')
      setProcessing(false)
      return
    }

    if (paymentIntent?.status === 'succeeded') {
      // Save order to DB
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...orderData, payment_intent_id: paymentIntent.id }),
      })
      const result = await res.json()
      if (result.success) {
        onSuccess(result.order_number)
      } else {
        setError(result.error || 'Order could not be saved. Please contact us.')
        setProcessing(false)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full mt-5 py-4 rounded-xl font-bold text-white text-sm transition-opacity disabled:opacity-50"
        style={{ backgroundColor: 'var(--primary)' }}>
        {processing ? 'Processing...' : `Pay $${total.toFixed(2)}`}
      </button>
    </form>
  )
}

export default function CheckoutPage() {
  const router = useRouter()
  const { items, subtotal, clearCart } = useCart()

  const [step, setStep] = useState<'info' | 'payment' | 'complete'>('info')
  const [clientSecret, setClientSecret] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [loadingIntent, setLoadingIntent] = useState(false)

  const [fulfillment, setFulfillment] = useState<'pickup' | 'shipping'>('pickup')
  const [customer, setCustomer] = useState({ first_name: '', last_name: '', email: '', phone: '' })
  const [shipping, setShipping] = useState({ address: '', city: '', state: 'GA', zip: '' })
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [freeShippingThreshold, setFreeShippingThreshold] = useState(350)
  const [flatShippingRate, setFlatShippingRate] = useState(9.99)

  useEffect(() => {
    import('@/lib/supabase').then(({ supabase }) => {
      supabase.from('store_settings').select('key,value').in('key', ['free_shipping_threshold', 'flat_shipping_rate']).then(({ data }) => {
        if (data) {
          data.forEach((s: any) => {
            if (s.key === 'free_shipping_threshold') setFreeShippingThreshold(parseFloat(s.value) || 350)
            if (s.key === 'flat_shipping_rate') setFlatShippingRate(parseFloat(s.value) || 9.99)
          })
        }
      })
    })
  }, [])

  const hasOutOfStock = items.some(i => !i.in_stock)
  const shippingCost = fulfillment === 'shipping' ? (subtotal >= freeShippingThreshold ? 0 : flatShippingRate) : 0
  const isGaTax = fulfillment === 'pickup' || shipping.state === 'GA'
  const tax = isGaTax ? subtotal * GA_TAX_RATE : 0
  const total = subtotal + tax + shippingCost

  useEffect(() => {
    if (items.length === 0 && step !== 'complete') router.push('/shop')
  }, [items])

  function validate() {
    const e: Record<string, string> = {}
    if (!customer.first_name) e.first_name = 'Required'
    if (!customer.last_name) e.last_name = 'Required'
    if (!customer.email || !/\S+@\S+\.\S+/.test(customer.email)) e.email = 'Valid email required'
    if (fulfillment === 'shipping') {
      if (!shipping.address) e.address = 'Required'
      if (!shipping.city) e.city = 'Required'
      if (!shipping.zip) e.zip = 'Required'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function proceedToPayment() {
    if (!validate()) return
    setLoadingIntent(true)
    const res = await fetch('/api/stripe/payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: total, metadata: { email: customer.email } }),
    })
    const { client_secret, error } = await res.json()
    if (error) { setErrors({ _: error }); setLoadingIntent(false); return }
    setClientSecret(client_secret)
    setStep('payment')
    setLoadingIntent(false)
  }

  function handleSuccess(num: string) {
    setOrderNumber(num)
    clearCart()
    setStep('complete')
    // Send confirmation email (non-blocking)
    fetch('/api/order-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_number: num,
        customer,
        items,
        subtotal,
        tax,
        shipping_cost: shippingCost,
        total,
        fulfillment,
        shipping_address: fulfillment === 'shipping' ? shipping : null,
        has_out_of_stock: hasOutOfStock,
      }),
    })
  }

  const orderData = { items, customer, fulfillment, shipping_address: fulfillment === 'shipping' ? shipping : null, notes }

  // ---- COMPLETE ----
  if (step === 'complete') {
    return (
      <>
        <Nav />
        <main className="min-h-screen bg-white flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center py-16">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ backgroundColor: '#d4edda' }}>
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#2e7d32" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--primary)' }}>Order Confirmed!</h1>
            <p className="text-gray-500 mb-1">Order <span className="font-bold text-gray-700">{orderNumber}</span></p>
            <p className="text-sm text-gray-400 mb-6">A confirmation will be sent to {customer.email}</p>
            {hasOutOfStock && (
              <div className="p-4 rounded-lg border text-sm text-left mb-6"
                style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
                <p className="font-semibold mb-1">Note about your order</p>
                <p>One or more items are currently out of stock with our distributor. We'll confirm availability and notify you once your item ships.</p>
              </div>
            )}
            {fulfillment === 'pickup' && (
              <div className="p-4 rounded-lg border text-sm text-left mb-6"
                style={{ backgroundColor: 'var(--cream-dark)', borderColor: '#d4b896' }}>
                <p className="font-semibold mb-1" style={{ color: 'var(--primary)' }}>Local Pickup</p>
                <p className="text-gray-600">We'll contact you at {customer.email || customer.phone} when your order is ready for pickup in Eatonton, GA.</p>
              </div>
            )}
            <button onClick={() => router.push('/shop')}
              className="px-8 py-3 rounded-xl font-bold text-white"
              style={{ backgroundColor: 'var(--primary)' }}>
              Continue Shopping
            </button>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--primary)' }}>Checkout</h1>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

            {/* LEFT — Form */}
            <div className="lg:col-span-3 space-y-5">

              {step === 'info' && (
                <>
                  {/* Out of stock notice */}
                  {hasOutOfStock && (
                    <div className="p-4 rounded-xl border text-sm"
                      style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
                      <p className="font-semibold mb-1">One or more items are out of stock</p>
                      <p>Our distributor is currently out of stock on some items in your cart. You can still complete your order — we'll confirm and notify you once your items ship.</p>
                    </div>
                  )}

                  {/* Contact info */}
                  <div className="bg-white rounded-xl border p-5" style={{ borderColor: '#e5e7eb' }}>
                    <h2 className="font-bold text-sm mb-4" style={{ color: 'var(--primary)' }}>Contact Information</h2>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">First Name *</label>
                        <input type="text" value={customer.first_name}
                          onChange={e => setCustomer({ ...customer, first_name: e.target.value })}
                          className={`w-full border rounded-lg px-3 py-2.5 text-sm ${errors.first_name ? 'border-red-400' : ''}`} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Last Name *</label>
                        <input type="text" value={customer.last_name}
                          onChange={e => setCustomer({ ...customer, last_name: e.target.value })}
                          className={`w-full border rounded-lg px-3 py-2.5 text-sm ${errors.last_name ? 'border-red-400' : ''}`} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Email *</label>
                        <input type="email" value={customer.email}
                          onChange={e => setCustomer({ ...customer, email: e.target.value })}
                          className={`w-full border rounded-lg px-3 py-2.5 text-sm ${errors.email ? 'border-red-400' : ''}`} />
                        {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Phone</label>
                        <input type="tel" value={customer.phone}
                          onChange={e => setCustomer({ ...customer, phone: e.target.value })}
                          className="w-full border rounded-lg px-3 py-2.5 text-sm" />
                      </div>
                    </div>
                  </div>

                  {/* Fulfillment */}
                  <div className="bg-white rounded-xl border p-5" style={{ borderColor: '#e5e7eb' }}>
                    <h2 className="font-bold text-sm mb-4" style={{ color: 'var(--primary)' }}>Fulfillment</h2>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <button onClick={() => setFulfillment('pickup')}
                        className="p-4 rounded-xl border-2 text-left transition-all"
                        style={{ borderColor: fulfillment === 'pickup' ? 'var(--primary)' : '#e5e7eb', backgroundColor: fulfillment === 'pickup' ? 'var(--cream-dark)' : 'white' }}>
                        <p className="font-bold text-sm" style={{ color: 'var(--primary)' }}>Free Local Pickup</p>
                        <p className="text-xs text-gray-500 mt-1">Pick up in Eatonton, GA</p>
                        <p className="text-xs font-bold mt-1 text-green-600">FREE</p>
                      </button>
                      <button onClick={() => setFulfillment('shipping')}
                        className="p-4 rounded-xl border-2 text-left transition-all"
                        style={{ borderColor: fulfillment === 'shipping' ? 'var(--primary)' : '#e5e7eb', backgroundColor: fulfillment === 'shipping' ? 'var(--cream-dark)' : 'white' }}>
                        <p className="font-bold text-sm" style={{ color: 'var(--primary)' }}>Ship to Me</p>
                        <p className="text-xs text-gray-500 mt-1">Standard shipping</p>
                        <p className="text-xs font-bold mt-1" style={{ color: subtotal >= 100 ? '#16a34a' : '#1a1a1a' }}>
                          {subtotal >= 100 ? 'FREE (order over $100)' : '$9.99'}
                        </p>
                      </button>
                    </div>

                    {fulfillment === 'shipping' && (
                      <div className="space-y-3 border-t pt-4" style={{ borderColor: '#f0f0f0' }}>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1">Street Address *</label>
                          <input type="text" value={shipping.address}
                            onChange={e => setShipping({ ...shipping, address: e.target.value })}
                            className={`w-full border rounded-lg px-3 py-2.5 text-sm ${errors.address ? 'border-red-400' : ''}`} />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-1">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">City *</label>
                            <input type="text" value={shipping.city}
                              onChange={e => setShipping({ ...shipping, city: e.target.value })}
                              className={`w-full border rounded-lg px-3 py-2.5 text-sm ${errors.city ? 'border-red-400' : ''}`} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">State</label>
                            <select value={shipping.state} onChange={e => setShipping({ ...shipping, state: e.target.value })}
                              className="w-full border rounded-lg px-3 py-2.5 text-sm">
                              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">ZIP *</label>
                            <input type="text" value={shipping.zip}
                              onChange={e => setShipping({ ...shipping, zip: e.target.value })}
                              className={`w-full border rounded-lg px-3 py-2.5 text-sm ${errors.zip ? 'border-red-400' : ''}`} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="bg-white rounded-xl border p-5" style={{ borderColor: '#e5e7eb' }}>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Order Notes (optional)</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                      placeholder="Special instructions, gift message, etc."
                      className="w-full border rounded-lg px-3 py-2.5 text-sm resize-none" />
                  </div>

                  {errors._ && <p className="text-sm text-red-600">{errors._}</p>}

                  <button onClick={proceedToPayment} disabled={loadingIntent}
                    className="w-full py-4 rounded-xl font-bold text-white text-sm disabled:opacity-50"
                    style={{ backgroundColor: 'var(--primary)' }}>
                    {loadingIntent ? 'Loading...' : 'Continue to Payment →'}
                  </button>
                </>
              )}

              {step === 'payment' && clientSecret && (
                <div className="bg-white rounded-xl border p-5" style={{ borderColor: '#e5e7eb' }}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-sm" style={{ color: 'var(--primary)' }}>Payment</h2>
                    <button onClick={() => setStep('info')}
                      className="text-xs font-semibold"
                      style={{ color: 'var(--primary)' }}>← Edit Info</button>
                  </div>
                  {/* Contact summary */}
                  <div className="text-xs text-gray-500 mb-4 p-3 rounded-lg" style={{ backgroundColor: '#fafafa' }}>
                    <p>{customer.first_name} {customer.last_name} · {customer.email}</p>
                    {fulfillment === 'pickup'
                      ? <p className="font-semibold mt-0.5" style={{ color: 'var(--primary)' }}>Free Local Pickup — Eatonton, GA</p>
                      : <p className="mt-0.5">{shipping.address}, {shipping.city}, {shipping.state} {shipping.zip}</p>
                    }
                  </div>
                  <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                    <CheckoutForm
                      clientSecret={clientSecret}
                      total={total}
                      orderData={orderData}
                      onSuccess={handleSuccess}
                    />
                  </Elements>
                  <p className="text-xs text-center text-gray-400 mt-3">
                    Secured by Stripe · Your payment info is never stored on our servers
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT — Order summary */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border p-5 sticky top-4" style={{ borderColor: '#e5e7eb' }}>
                <h2 className="font-bold text-sm mb-4" style={{ color: 'var(--primary)' }}>Order Summary</h2>
                <div className="space-y-3 mb-4">
                  {items.map(item => (
                    <div key={item.id} className="flex gap-3">
                      <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                        {item.image_url && item.image_url !== 'none' ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-contain p-1" />
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold leading-snug line-clamp-2">{item.name}</p>
                        {!item.in_stock && <p className="text-xs text-amber-600">Ships when available</p>}
                        <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                      </div>
                      <p className="text-sm font-semibold flex-shrink-0" style={{ color: 'var(--primary)' }}>
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-3 space-y-1.5" style={{ borderColor: '#f0f0f0' }}>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Shipping</span>
                    <span>{shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}`}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Tax {isGaTax ? '(GA 8%)' : ''}</span>
                    <span>{isGaTax ? `$${tax.toFixed(2)}` : 'Not collected'}</span>
                  </div>
                  {!isGaTax && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Sales tax not collected for out-of-state orders. You may owe use tax in your state.
                    </p>
                  )}
                  <div className="flex justify-between text-sm font-bold pt-1 border-t" style={{ borderColor: '#f0f0f0', color: 'var(--primary)' }}>
                    <span>Total</span><span>${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
