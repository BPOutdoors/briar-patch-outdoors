'use client'

import { useEffect, useState } from 'react'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

const TOPICS = [
  'General Question',
  'Order Status',
  'Bow Service / Tuning',
  'Arrow Building',
  'Product Inquiry',
  'Pricing / Quote Request',
  'Shipping & Returns',
  'Other',
]

// Deer season hours: July 1 – February 7 (a week after deer season ends Jan 31)
// Off season hours: February 8 – June 30
function isDeerSeason(date: Date): boolean {
  const month = date.getMonth() + 1 // 1-12
  const day = date.getDate()
  if (month >= 7) return true
  if (month === 1) return true
  if (month === 2 && day <= 7) return true
  return false
}

function getSeasonalHours() {
  const now = new Date()
  const season = isDeerSeason(now)
  if (season) {
    return {
      label: '🦌 Deer Season Hours',
      hours: 'Most days 2:00 PM – 9:00 PM',
      days: 'July 1 – February 7',
      open: 14,
      close: 21,
      season: 'deer',
    }
  } else {
    return {
      label: '🌿 Off-Season Hours',
      hours: 'Most days 12:00 PM – 6:00 PM',
      days: 'February 8 – June 30',
      open: 12,
      close: 18,
      season: 'off',
    }
  }
}

function getOpenStatus() {
  const now = new Date()
  const hours = getSeasonalHours()
  const currentHour = now.getHours()
  const isOpen = currentHour >= hours.open && currentHour < hours.close
  return { isOpen, hours }
}

export default function ContactPage() {
  const [openStatus, setOpenStatus] = useState<{ isOpen: boolean; hours: ReturnType<typeof getSeasonalHours> } | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', topic: '', message: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState('')

  useEffect(() => {
    setOpenStatus(getOpenStatus())
    const interval = setInterval(() => setOpenStatus(getOpenStatus()), 60000)
    return () => clearInterval(interval)
  }, [])

  const seasonHours = getSeasonalHours()

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Required'
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email required'
    if (!form.topic) e.topic = 'Please select a topic'
    if (!form.message.trim()) e.message = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSending(true)
    setServerError('')
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const result = await res.json()
    if (result.ok) {
      setSent(true)
    } else {
      setServerError('Something went wrong. Please call us at (706) 749-6994.')
    }
    setSending(false)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--cream)' }}>
      <Nav />

      {/* Hero */}
      <div className="relative h-56 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1448375240586-882707db888b?w=1600&q=80"
          alt="Outdoors"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex items-center justify-center">
          <h1 className="text-5xl font-bold text-white drop-shadow-lg">Come See Us</h1>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

          {/* LEFT — Store Info */}
          <div className="space-y-8">

            {/* Currently Open / Closed */}
            {openStatus && (
              <div className="flex items-center gap-3 p-4 rounded-lg border-2"
                style={{
                  borderColor: openStatus.isOpen ? '#4A5E2F' : '#9ca3af',
                  backgroundColor: openStatus.isOpen ? '#f0f7ec' : '#f9fafb',
                }}>
                <div className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: openStatus.isOpen ? '#4A5E2F' : '#9ca3af' }} />
                <div>
                  <p className="font-bold text-sm" style={{ color: openStatus.isOpen ? '#2e7d32' : '#6b7280' }}>
                    {openStatus.isOpen ? "We're Open Right Now!" : 'Currently Closed'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {openStatus.isOpen
                      ? `Open today until ${openStatus.hours.close === 21 ? '9:00 PM' : '6:00 PM'}`
                      : "Give us a call and we may be able to meet you at the store"}
                  </p>
                </div>
              </div>
            )}

            {/* Store Hours */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--primary)' }}>Store Hours</h2>

              {seasonHours.season === 'deer' ? (
                <div className="p-4 rounded-lg mb-4 border-2 border-amber-400" style={{ backgroundColor: '#fffbeb' }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold text-sm">🦌 Deer Season Hours</p>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: '#C4842A', color: 'white' }}>
                      Now Active
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Most days 2:00 PM – 9:00 PM</p>
                  <p className="text-xs text-gray-400 mt-0.5">July 1 – February 7</p>
                </div>
              ) : (
                <div className="p-4 rounded-lg mb-4 border-2 border-green-400" style={{ backgroundColor: '#f0f7ec' }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold text-sm">🌿 Off-Season Hours</p>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: '#4A5E2F', color: 'white' }}>
                      Now Active
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Most days 12:00 PM – 6:00 PM</p>
                  <p className="text-xs text-gray-400 mt-0.5">February 8 – June 30</p>
                </div>
              )}

              {/* Call Ahead Note */}
              <div className="p-3 rounded-lg border flex gap-3 items-start" style={{ borderColor: '#C4A882', backgroundColor: 'var(--cream-dark)' }}>
                <span className="text-xl flex-shrink-0">📞</span>
                <p className="text-sm text-gray-600 leading-relaxed">
                  <strong>We live right near the store.</strong> If you need something outside our regular hours, give us a call — we&apos;re happy to meet you at the shop.
                </p>
              </div>
            </div>

            {/* Address + Phone */}
            <div className="bg-white rounded-lg shadow p-6 space-y-5">
              <h2 className="text-xl font-bold" style={{ color: 'var(--primary)' }}>Find Us</h2>

              <div className="flex gap-4 items-start">
                <div className="text-2xl flex-shrink-0">📍</div>
                <div>
                  <p className="font-semibold">Briar Patch Outdoors</p>
                  <p className="text-gray-600">104 Dennis Station Rd, Unit B</p>
                  <p className="text-gray-600">Eatonton, GA 31024</p>
                  <a
                    href="https://maps.google.com/?q=104+Dennis+Station+Rd+Unit+B+Eatonton+GA+31024"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-sm font-semibold hover:underline"
                    style={{ color: 'var(--secondary)' }}
                  >
                    Get Directions →
                  </a>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="text-2xl flex-shrink-0">📱</div>
                <div>
                  <p className="font-semibold">Phone</p>
                  <a href="tel:+17067496994" className="text-gray-600 hover:underline text-lg font-medium"
                    style={{ color: 'var(--primary)' }}>
                    (706) 749-6994
                  </a>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="text-2xl flex-shrink-0">✉️</div>
                <div>
                  <p className="font-semibold">Email</p>
                  <a href="mailto:services@briarpatchoutdoors.com" className="text-gray-600 hover:underline"
                    style={{ color: 'var(--primary)' }}>
                    services@briarpatchoutdoors.com
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — Map + Contact Form */}
          <div className="space-y-8">

            {/* Google Maps Embed */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3313.5!2d-83.3897!3d33.3293!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2s104+Dennis+Station+Rd%2C+Eatonton%2C+GA+31024!5e0!3m2!1sen!2sus!4v1"
                width="100%"
                height="280"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Briar Patch Outdoors location"
              />
            </div>

            {/* Contact Form */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--primary)' }}>Send Us a Message</h2>
              <p className="text-sm text-gray-500 mb-5">We&apos;ll get back to you as soon as we can.</p>

              {sent ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">✅</div>
                  <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--primary)' }}>Message Sent!</h3>
                  <p className="text-gray-500 text-sm">Thanks for reaching out. We&apos;ll get back to you soon.</p>
                  <button
                    onClick={() => { setSent(false); setForm({ name: '', email: '', phone: '', topic: '', message: '' }) }}
                    className="mt-4 text-sm underline"
                    style={{ color: 'var(--secondary)' }}
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {serverError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">{serverError}</div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Your Name *</label>
                      <input type="text" required value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        className={`w-full border rounded px-3 py-2 text-sm ${errors.name ? 'border-red-400' : ''}`}
                        placeholder="Blake Smith" />
                      {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
                      <input type="tel" value={form.phone}
                        onChange={e => setForm({ ...form, phone: e.target.value })}
                        className="w-full border rounded px-3 py-2 text-sm"
                        placeholder="(706) 555-0100" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
                    <input type="email" required value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      className={`w-full border rounded px-3 py-2 text-sm ${errors.email ? 'border-red-400' : ''}`}
                      placeholder="you@example.com" />
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Topic *</label>
                    <select value={form.topic}
                      onChange={e => setForm({ ...form, topic: e.target.value })}
                      className={`w-full border rounded px-3 py-2 text-sm bg-white ${errors.topic ? 'border-red-400' : ''}`}>
                      <option value="">Select a topic...</option>
                      {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {errors.topic && <p className="text-xs text-red-500 mt-1">{errors.topic}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Message *</label>
                    <textarea required rows={4} value={form.message}
                      onChange={e => setForm({ ...form, message: e.target.value })}
                      className={`w-full border rounded px-3 py-2 text-sm resize-none ${errors.message ? 'border-red-400' : ''}`}
                      placeholder="Ask us about products, bow tuning, hours, or anything else..." />
                    {errors.message && <p className="text-xs text-red-500 mt-1">{errors.message}</p>}
                  </div>
                  <button type="submit" disabled={sending}
                    className="w-full py-3 rounded font-bold text-white transition-colors"
                    style={{ backgroundColor: sending ? '#9ca3af' : 'var(--primary)' }}>
                    {sending ? 'Sending...' : 'Send Message'}
                  </button>
                </form>
              )}
            </div>

          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
