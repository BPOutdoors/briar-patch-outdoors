'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const PRESET_COLORS = [
  { label: 'Forest Green', value: '#4A5E2F' },
  { label: 'Dark Brown', value: '#3a2e1e' },
  { label: 'Navy', value: '#1a3a4a' },
  { label: 'Deep Red', value: '#7a1a1a' },
  { label: 'Slate', value: '#2d3748' },
  { label: 'Black', value: '#1a1a1a' },
]

const emptyForm = {
  heading: '',
  subheading: '',
  button_text: 'Shop Now',
  button_link: '/shop',
  bg_color: '#4A5E2F',
  text_color: '#ffffff',
  is_active: true,
  sort_order: 0,
}

export default function BannersPage() {
  const [banners, setBanners] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })

  useEffect(() => { fetchBanners() }, [])

  async function fetchBanners() {
    setLoading(true)
    const { data } = await supabase
      .from('hero_banners')
      .select('*')
      .order('sort_order')
    if (data) setBanners(data)
    setLoading(false)
  }

  function openNew() {
    setForm({ ...emptyForm, sort_order: banners.length })
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(banner: any) {
    setForm({
      heading: banner.heading,
      subheading: banner.subheading || '',
      button_text: banner.button_text || 'Shop Now',
      button_link: banner.button_link || '/shop',
      bg_color: banner.bg_color || '#4A5E2F',
      text_color: banner.text_color || '#ffffff',
      is_active: banner.is_active,
      sort_order: banner.sort_order ?? 0,
    })
    setEditingId(banner.id)
    setShowForm(true)
  }

  async function saveBanner() {
    if (!form.heading.trim()) {
      showMsg('Heading is required', 'error')
      return
    }
    setSaving(true)
    if (editingId) {
      const { error } = await supabase.from('hero_banners').update(form).eq('id', editingId)
      if (error) showMsg('Error saving banner', 'error')
      else { showMsg('Banner updated!', 'success'); setShowForm(false); fetchBanners() }
    } else {
      const { error } = await supabase.from('hero_banners').insert(form)
      if (error) showMsg('Error creating banner', 'error')
      else { showMsg('Banner created!', 'success'); setShowForm(false); fetchBanners() }
    }
    setSaving(false)
  }

  async function toggleActive(banner: any) {
    await supabase.from('hero_banners').update({ is_active: !banner.is_active }).eq('id', banner.id)
    setBanners(banners.map(b => b.id === banner.id ? { ...b, is_active: !b.is_active } : b))
  }

  async function deleteBanner(id: string) {
    if (!confirm('Delete this banner?')) return
    await supabase.from('hero_banners').delete().eq('id', id)
    setBanners(banners.filter(b => b.id !== id))
    showMsg('Banner deleted', 'success')
  }

  async function moveOrder(id: string, direction: 'up' | 'down') {
    const idx = banners.findIndex(b => b.id === id)
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === banners.length - 1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const updated = [...banners]
    const tempOrder = updated[idx].sort_order
    updated[idx].sort_order = updated[swapIdx].sort_order
    updated[swapIdx].sort_order = tempOrder
    ;[updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]]
    setBanners([...updated])
    await supabase.from('hero_banners').update({ sort_order: updated[idx].sort_order }).eq('id', updated[idx].id)
    await supabase.from('hero_banners').update({ sort_order: updated[swapIdx].sort_order }).eq('id', updated[swapIdx].id)
  }

  function showMsg(msg: string, type: 'success' | 'error') {
    setMessage(msg); setMessageType(type)
    setTimeout(() => setMessage(''), 4000)
  }

  return (
    <div className="max-w-4xl space-y-6">

      {message && (
        <div className="p-3 rounded text-sm font-semibold text-white"
          style={{ backgroundColor: messageType === 'success' ? 'var(--secondary)' : '#dc2626' }}>
          {message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 mt-1">
            Manage the hero banners shown at the top of your shop page. Active banners rotate automatically.
          </p>
        </div>
        <button
          onClick={openNew}
          className="px-5 py-2.5 rounded font-bold text-white text-sm"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          + New Banner
        </button>
      </div>

      {/* Banner List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-10 text-gray-400">Loading banners...</div>
        ) : banners.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-white rounded-lg shadow">
            No banners yet. Create your first one above.
          </div>
        ) : banners.map((banner, idx) => (
          <div key={banner.id} className="bg-white rounded-lg shadow overflow-hidden">
            {/* Preview strip */}
            <div className="px-6 py-5 text-white relative" style={{ backgroundColor: banner.bg_color, color: banner.text_color }}>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold">{banner.heading}</h2>
                  {banner.subheading && <p className="text-sm mt-1 opacity-80">{banner.subheading}</p>}
                  {banner.button_text && (
                    <div className="mt-3 inline-block px-4 py-1.5 rounded text-sm font-semibold border border-white/50">
                      {banner.button_text} →
                    </div>
                  )}
                </div>
                <span className={`px-2 py-1 rounded text-xs font-bold flex-shrink-0 ml-4 ${banner.is_active ? 'bg-green-500/30 text-white' : 'bg-black/30 text-white/70'}`}>
                  {banner.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="px-6 py-3 flex items-center gap-3 flex-wrap" style={{ backgroundColor: '#fafafa' }}>
              <button onClick={() => openEdit(banner)}
                className="px-3 py-1.5 rounded text-xs font-semibold border"
                style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                Edit
              </button>
              <button onClick={() => toggleActive(banner)}
                className="px-3 py-1.5 rounded text-xs font-semibold border"
                style={{ borderColor: banner.is_active ? '#dc2626' : '#2e7d32', color: banner.is_active ? '#dc2626' : '#2e7d32' }}>
                {banner.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <div className="flex gap-1 ml-auto">
                <button onClick={() => moveOrder(banner.id, 'up')} disabled={idx === 0}
                  className="px-2 py-1.5 rounded text-xs border disabled:opacity-30"
                  style={{ borderColor: '#ddd', color: '#666' }}>↑</button>
                <button onClick={() => moveOrder(banner.id, 'down')} disabled={idx === banners.length - 1}
                  className="px-2 py-1.5 rounded text-xs border disabled:opacity-30"
                  style={{ borderColor: '#ddd', color: '#666' }}>↓</button>
              </div>
              <button onClick={() => deleteBanner(banner.id)}
                className="px-3 py-1.5 rounded text-xs font-semibold text-red-500 hover:text-red-700">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
                  {editingId ? 'Edit Banner' : 'New Banner'}
                </h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
              </div>

              {/* Live Preview */}
              <div className="rounded-lg overflow-hidden mb-5">
                <div className="px-5 py-6" style={{ backgroundColor: form.bg_color, color: form.text_color }}>
                  <p className="text-lg font-bold">{form.heading || 'Banner Heading'}</p>
                  {form.subheading && <p className="text-sm mt-1 opacity-80">{form.subheading}</p>}
                  {form.button_text && (
                    <div className="mt-3 inline-block px-4 py-1.5 rounded text-sm font-semibold border border-white/50">
                      {form.button_text} →
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Heading *</label>
                  <input type="text" value={form.heading} onChange={e => setForm({ ...form, heading: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm" placeholder="Get Ready for Deer Season" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Subheading</label>
                  <input type="text" value={form.subheading} onChange={e => setForm({ ...form, subheading: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm" placeholder="Optional supporting text" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Button Text</label>
                    <input type="text" value={form.button_text} onChange={e => setForm({ ...form, button_text: e.target.value })}
                      className="w-full border rounded px-3 py-2 text-sm" placeholder="Shop Now" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Button Link</label>
                    <input type="text" value={form.button_link} onChange={e => setForm({ ...form, button_link: e.target.value })}
                      className="w-full border rounded px-3 py-2 text-sm" placeholder="/shop" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Background Color</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {PRESET_COLORS.map(c => (
                      <button key={c.value} onClick={() => setForm({ ...form, bg_color: c.value })}
                        className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                        style={{ backgroundColor: c.value, borderColor: form.bg_color === c.value ? '#fff' : 'transparent', outline: form.bg_color === c.value ? `2px solid ${c.value}` : 'none' }}
                        title={c.label} />
                    ))}
                    <input type="color" value={form.bg_color} onChange={e => setForm({ ...form, bg_color: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border" title="Custom color" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })}
                      className="w-4 h-4" />
                    <span className="text-sm font-semibold text-gray-600">Active (show on shop page)</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={saveBanner} disabled={saving}
                  className="flex-1 py-2.5 rounded font-bold text-white text-sm"
                  style={{ backgroundColor: saving ? '#9ca3af' : 'var(--primary)' }}>
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Banner'}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded font-bold text-sm border"
                  style={{ borderColor: '#ddd', color: '#666' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
