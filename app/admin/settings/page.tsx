'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BROAD_CATEGORIES } from '@/lib/categories'

type Setting = {
  key: string
  value: string
  label: string
  type: string
  group_name: string
}

const GROUP_LABELS: Record<string, string> = {
  store: 'Store Information',
  shipping: 'Shipping',
  tax: 'Tax',
  inventory: 'Inventory',
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, Setting>>({})
  const [edited, setEdited] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  // Category visibility
  const [visibility, setVisibility] = useState<Record<string, boolean>>({})
  const [savingCat, setSavingCat] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'general' | 'categories'>('general')

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const [{ data: settingsData }, { data: catData }] = await Promise.all([
      supabase.from('store_settings').select('*'),
      supabase.from('category_visibility').select('*'),
    ])
    if (settingsData) {
      const map: Record<string, Setting> = {}
      settingsData.forEach((s: Setting) => { map[s.key] = s })
      setSettings(map)
    }
    if (catData) {
      const map: Record<string, boolean> = {}
      catData.forEach((r: any) => { map[r.slug] = r.enabled })
      setVisibility(map)
    }
    setLoading(false)
  }

  function handleChange(key: string, value: string) {
    setEdited(prev => ({ ...prev, [key]: value }))
  }

  function getValue(key: string) {
    return edited[key] !== undefined ? edited[key] : (settings[key]?.value ?? '')
  }

  function isDirty(key: string) {
    return edited[key] !== undefined && edited[key] !== settings[key]?.value
  }

  async function saveSetting(key: string) {
    if (!isDirty(key)) return
    setSaving(key)
    const { error } = await supabase
      .from('store_settings')
      .update({ value: edited[key], updated_at: new Date().toISOString() })
      .eq('key', key)
    if (!error) {
      setSettings(prev => ({ ...prev, [key]: { ...prev[key], value: edited[key] } }))
      setEdited(prev => { const n = { ...prev }; delete n[key]; return n })
      showMsg('Saved!', 'success')
    } else {
      showMsg('Error saving: ' + error.message, 'error')
    }
    setSaving(null)
  }

  async function saveAll() {
    const dirtyKeys = Object.keys(edited).filter(k => isDirty(k))
    if (!dirtyKeys.length) return
    setSaving('all')
    for (const key of dirtyKeys) {
      await supabase.from('store_settings')
        .update({ value: edited[key], updated_at: new Date().toISOString() })
        .eq('key', key)
    }
    await loadAll()
    setEdited({})
    showMsg(`${dirtyKeys.length} setting${dirtyKeys.length > 1 ? 's' : ''} saved!`, 'success')
    setSaving(null)
  }

  async function toggleCategory(slug: string, enabled: boolean) {
    setSavingCat(slug)
    await supabase.from('category_visibility')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('slug', slug)
    setVisibility(prev => ({ ...prev, [slug]: enabled }))
    setSavingCat(null)
  }

  function showMsg(msg: string, type: 'success' | 'error') {
    setMessage(msg); setMessageType(type)
    setTimeout(() => setMessage(''), 3000)
  }

  // Group settings
  const grouped = Object.values(settings).reduce((acc, s) => {
    const g = s.group_name || 'other'
    if (!acc[g]) acc[g] = []
    acc[g].push(s)
    return acc
  }, {} as Record<string, Setting[]>)

  const hasDirty = Object.keys(edited).some(k => isDirty(k))
  const enabledCount = Object.values(visibility).filter(Boolean).length

  return (
    <div className="max-w-3xl">
      {message && (
        <div className="mb-4 p-3 rounded text-sm font-semibold text-white"
          style={{ backgroundColor: messageType === 'success' ? 'var(--secondary)' : '#dc2626' }}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: '#e5e7eb' }}>
        {[{ key: 'general', label: 'General Settings' }, { key: 'categories', label: 'Shop Categories' }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className="px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px"
            style={{ borderColor: activeTab === t.key ? 'var(--primary)' : 'transparent', color: activeTab === t.key ? 'var(--primary)' : '#888' }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-gray-400 text-sm">Loading...</p> : (
        <>
          {/* ===== GENERAL SETTINGS ===== */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {Object.entries(GROUP_LABELS).map(([groupKey, groupLabel]) => {
                const groupSettings = grouped[groupKey] || []
                if (!groupSettings.length) return null
                return (
                  <div key={groupKey} className="bg-white border rounded-xl overflow-hidden">
                    <div className="px-6 py-3 border-b" style={{ backgroundColor: '#fafafa' }}>
                      <h2 className="font-bold text-sm" style={{ color: 'var(--primary)' }}>{groupLabel}</h2>
                    </div>
                    <div className="divide-y" style={{ borderColor: '#f0f0f0' }}>
                      {groupSettings.map(s => (
                        <div key={s.key} className="flex items-center gap-4 px-6 py-4">
                          <div className="flex-1">
                            <label className="block text-sm font-semibold text-gray-700 mb-0.5">{s.label}</label>
                            <p className="text-xs text-gray-400">{s.key}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {s.type === 'boolean' ? (
                              <button
                                onClick={() => {
                                  const newVal = getValue(s.key) === 'true' ? 'false' : 'true'
                                  handleChange(s.key, newVal)
                                  setTimeout(() => saveSetting(s.key), 0)
                                }}
                                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                                style={{ backgroundColor: getValue(s.key) === 'true' ? 'var(--primary)' : '#d1d5db' }}>
                                <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                                  style={{ transform: getValue(s.key) === 'true' ? 'translateX(20px)' : 'translateX(4px)' }} />
                              </button>
                            ) : (
                              <>
                                <div className="relative">
                                  {s.type === 'number' && (s.key.includes('rate') || s.key.includes('threshold') || s.key.includes('shipping')) && (
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                                      {s.key.includes('rate') ? '%' : '$'}
                                    </span>
                                  )}
                                  <input
                                    type={s.type === 'number' ? 'number' : 'text'}
                                    value={getValue(s.key)}
                                    onChange={e => handleChange(s.key, e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') saveSetting(s.key) }}
                                    className={`border rounded-lg py-2 text-sm transition-colors ${s.type === 'number' ? 'w-28 text-right pr-3' : 'w-72 px-3'} ${isDirty(s.key) ? 'border-amber-400 bg-amber-50' : ''}`}
                                    style={{ paddingLeft: s.type === 'number' ? (s.key.includes('rate') || s.key.includes('threshold') || s.key.includes('shipping') ? '1.75rem' : '0.75rem') : undefined }}
                                  />
                                </div>
                                {isDirty(s.key) && (
                                  <button onClick={() => saveSetting(s.key)} disabled={saving === s.key}
                                    className="px-3 py-2 rounded-lg text-xs font-bold text-white whitespace-nowrap"
                                    style={{ backgroundColor: saving === s.key ? '#9ca3af' : 'var(--secondary)' }}>
                                    {saving === s.key ? '...' : 'Save'}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              {hasDirty && (
                <div className="flex justify-end">
                  <button onClick={saveAll} disabled={saving === 'all'}
                    className="px-6 py-2.5 rounded-lg font-bold text-white text-sm"
                    style={{ backgroundColor: saving === 'all' ? '#9ca3af' : 'var(--primary)' }}>
                    {saving === 'all' ? 'Saving...' : 'Save All Changes'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ===== CATEGORY VISIBILITY ===== */}
          {activeTab === 'categories' && (
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b" style={{ backgroundColor: '#fafafa' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-sm" style={{ color: 'var(--primary)' }}>Shop Categories</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Control which categories appear on the public shop page</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: 'var(--cream-dark)', color: 'var(--primary)' }}>
                    {enabledCount} of {BROAD_CATEGORIES.length} active
                  </span>
                </div>
              </div>
              <div className="divide-y" style={{ borderColor: '#f0f0f0' }}>
                {BROAD_CATEGORIES.map(cat => {
                  const enabled = visibility[cat.slug] ?? true
                  return (
                    <div key={cat.slug} className="flex items-center justify-between px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        <div>
                          <p className="text-sm font-semibold" style={{ color: enabled ? '#1a1a1a' : '#9ca3af' }}>{cat.name}</p>
                          <p className="text-xs text-gray-400">{cat.description}</p>
                        </div>
                      </div>
                      <button onClick={() => toggleCategory(cat.slug, !enabled)}
                        disabled={savingCat === cat.slug}
                        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                        style={{ backgroundColor: enabled ? 'var(--primary)' : '#d1d5db', opacity: savingCat === cat.slug ? 0.6 : 1 }}>
                        <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                          style={{ transform: enabled ? 'translateX(20px)' : 'translateX(4px)' }} />
                      </button>
                    </div>
                  )
                })}
              </div>
              <div className="px-6 py-3 border-t text-xs text-gray-400" style={{ backgroundColor: '#fafafa' }}>
                Disabled categories are hidden from the shop and their products won't appear in searches.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
