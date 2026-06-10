'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BROAD_CATEGORIES } from '@/lib/categories'

const emptyForm = {
  name: '',
  description: '',
  discount_type: 'percent' as 'percent' | 'fixed',
  discount_value: '',
  applies_to: 'all' as 'all' | 'category' | 'products',
  category_slugs: [] as string[],
  product_ids: [] as string[],
  start_date: '',
  end_date: '',
  is_active: true,
}

export default function SalesPage() {
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  // Product search for "specific products" mode
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<any[]>([])
  const [selectedProducts, setSelectedProducts] = useState<any[]>([])
  const [searchingProducts, setSearchingProducts] = useState(false)

  useEffect(() => { loadSales() }, [])

  async function loadSales() {
    setLoading(true)
    const { data } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false })
    setSales(data || [])
    setLoading(false)
  }

  async function searchProducts(q: string) {
    setProductSearch(q)
    if (q.length < 2) { setProductResults([]); return }
    setSearchingProducts(true)
    const { data } = await supabase
      .from('products')
      .select('id, name, brand, display_price, kinsey_sku')
      .ilike('name', `%${q}%`)
      .eq('visible', true)
      .limit(10)
    setProductResults(data || [])
    setSearchingProducts(false)
  }

  function addProduct(p: any) {
    if (selectedProducts.find(x => x.id === p.id)) return
    setSelectedProducts(prev => [...prev, p])
    setForm(f => ({ ...f, product_ids: [...f.product_ids, p.id] }))
    setProductSearch('')
    setProductResults([])
  }

  function removeProduct(id: string) {
    setSelectedProducts(prev => prev.filter(p => p.id !== id))
    setForm(f => ({ ...f, product_ids: f.product_ids.filter(x => x !== id) }))
  }

  function toggleCategory(slug: string) {
    setForm(f => ({
      ...f,
      category_slugs: f.category_slugs.includes(slug)
        ? f.category_slugs.filter(s => s !== slug)
        : [...f.category_slugs, slug],
    }))
  }

  function openNew() {
    setForm({ ...emptyForm })
    setSelectedProducts([])
    setEditingId(null)
    setShowForm(true)
  }

  async function openEdit(sale: any) {
    setForm({
      name: sale.name || '',
      description: sale.description || '',
      discount_type: sale.discount_type || 'percent',
      discount_value: sale.discount_value?.toString() || '',
      applies_to: sale.applies_to || 'all',
      category_slugs: sale.category_slugs || [],
      product_ids: sale.product_ids || [],
      start_date: sale.start_date ? sale.start_date.slice(0, 16) : '',
      end_date: sale.end_date ? sale.end_date.slice(0, 16) : '',
      is_active: sale.is_active ?? true,
    })
    // Load selected products
    if (sale.product_ids?.length) {
      const { data } = await supabase
        .from('products')
        .select('id, name, brand, display_price, kinsey_sku')
        .in('id', sale.product_ids)
      setSelectedProducts(data || [])
    } else {
      setSelectedProducts([])
    }
    setEditingId(sale.id)
    setShowForm(true)
  }

  async function saveSale() {
    if (!form.name || !form.discount_value) {
      showMsg('Name and discount value are required', 'error'); return
    }
    if (form.applies_to === 'category' && form.category_slugs.length === 0) {
      showMsg('Select at least one category', 'error'); return
    }
    if (form.applies_to === 'products' && form.product_ids.length === 0) {
      showMsg('Select at least one product', 'error'); return
    }
    setSaving(true)
    const payload = {
      name: form.name,
      description: form.description || null,
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      applies_to: form.applies_to,
      category_slugs: form.applies_to === 'category' ? form.category_slugs : null,
      product_ids: form.applies_to === 'products' ? form.product_ids : null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    }
    if (editingId) {
      const { error } = await supabase.from('sales').update(payload).eq('id', editingId)
      if (error) { showMsg(error.message, 'error'); setSaving(false); return }
    } else {
      const { error } = await supabase.from('sales').insert(payload)
      if (error) { showMsg(error.message, 'error'); setSaving(false); return }
    }
    showMsg(editingId ? 'Sale updated!' : 'Sale created!', 'success')
    setSaving(false)
    setShowForm(false)
    loadSales()
  }

  async function toggleActive(sale: any) {
    await supabase.from('sales').update({ is_active: !sale.is_active, updated_at: new Date().toISOString() }).eq('id', sale.id)
    loadSales()
  }

  async function deleteSale(id: string) {
    if (!confirm('Delete this sale?')) return
    await supabase.from('sales').delete().eq('id', id)
    loadSales()
  }

  function showMsg(msg: string, type: 'success' | 'error') {
    setMessage(msg); setMessageType(type)
    setTimeout(() => setMessage(''), 4000)
  }

  function getSaleStatus(sale: any) {
    const now = new Date()
    if (!sale.is_active) return { label: 'Inactive', color: '#6b7280', bg: '#f3f4f6' }
    if (sale.start_date && new Date(sale.start_date) > now) return { label: 'Scheduled', color: '#1565c0', bg: '#e3f2fd' }
    if (sale.end_date && new Date(sale.end_date) < now) return { label: 'Expired', color: '#9ca3af', bg: '#f3f4f6' }
    return { label: 'Active', color: '#15803d', bg: '#dcfce7' }
  }

  function formatDiscount(sale: any) {
    return sale.discount_type === 'percent' ? `${sale.discount_value}% off` : `$${sale.discount_value} off`
  }

  function formatScope(sale: any) {
    if (sale.applies_to === 'all') return 'All Products'
    if (sale.applies_to === 'category') {
      const names = (sale.category_slugs || []).map((s: string) => BROAD_CATEGORIES.find(c => c.slug === s)?.name || s)
      return names.join(', ')
    }
    return `${(sale.product_ids || []).length} specific product${sale.product_ids?.length !== 1 ? 's' : ''}`
  }

  return (
    <div className="max-w-5xl">
      {message && (
        <div className="mb-4 p-3 rounded text-sm font-semibold text-white"
          style={{ backgroundColor: messageType === 'success' ? 'var(--secondary)' : '#dc2626' }}>
          {message}
        </div>
      )}

      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm text-gray-500">{sales.length} sale{sales.length !== 1 ? 's' : ''} total · {sales.filter(s => getSaleStatus(s).label === 'Active').length} active</p>
        </div>
        <button onClick={openNew}
          className="px-5 py-2.5 rounded-lg text-sm font-bold text-white"
          style={{ backgroundColor: 'var(--primary)' }}>
          + New Sale
        </button>
      </div>

      {/* Sales list */}
      {loading ? (
        <div className="p-8 text-center text-gray-400">Loading...</div>
      ) : sales.length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center">
          <p className="font-semibold text-gray-500 mb-2">No sales created yet</p>
          <p className="text-sm text-gray-400 mb-4">Create a sale to discount specific products, categories, or your entire store</p>
          <button onClick={openNew}
            className="px-5 py-2.5 rounded-lg text-sm font-bold text-white"
            style={{ backgroundColor: 'var(--primary)' }}>
            Create First Sale
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sales.map(sale => {
            const status = getSaleStatus(sale)
            return (
              <div key={sale.id} className="bg-white border rounded-xl p-5 flex items-start gap-4"
                style={{ borderColor: status.label === 'Active' ? '#bbf7d0' : '#e5e7eb', opacity: status.label === 'Expired' ? 0.7 : 1 }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-bold text-base" style={{ color: 'var(--primary)' }}>{sale.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                      style={{ backgroundColor: status.bg, color: status.color }}>
                      {status.label}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-gray-100 text-gray-600">
                      {formatDiscount(sale)}
                    </span>
                  </div>
                  {sale.description && <p className="text-sm text-gray-500 mb-2">{sale.description}</p>}
                  <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                    <span><span className="font-semibold text-gray-600">Applies to:</span> {formatScope(sale)}</span>
                    {sale.start_date && <span><span className="font-semibold text-gray-600">Starts:</span> {new Date(sale.start_date).toLocaleDateString()}</span>}
                    {sale.end_date && <span><span className="font-semibold text-gray-600">Ends:</span> {new Date(sale.end_date).toLocaleDateString()}</span>}
                    {!sale.start_date && !sale.end_date && <span className="text-gray-400">No date limits</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => toggleActive(sale)}
                    className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                    style={{ backgroundColor: sale.is_active ? 'var(--primary)' : '#d1d5db' }}>
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                      style={{ transform: sale.is_active ? 'translateX(20px)' : 'translateX(4px)' }} />
                  </button>
                  <button onClick={() => openEdit(sale)}
                    className="px-3 py-1.5 rounded border text-xs font-semibold"
                    style={{ borderColor: '#ddd', color: 'var(--primary)' }}>Edit</button>
                  <button onClick={() => deleteSale(sale.id)}
                    className="px-3 py-1.5 rounded border text-xs font-semibold border-red-200 text-red-500">
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Sale Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
                  {editingId ? 'Edit Sale' : 'New Sale'}
                </h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 text-2xl">×</button>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Sale Name *</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Summer Sale, Black Friday, Archery Blowout"
                    className="w-full border rounded-lg px-3 py-2.5 text-sm" />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Description (optional)</label>
                  <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Shown to customers"
                    className="w-full border rounded-lg px-3 py-2.5 text-sm" />
                </div>

                {/* Discount */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Discount *</label>
                  <div className="flex gap-2">
                    <select value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value as any })}
                      className="border rounded-lg px-3 py-2.5 text-sm">
                      <option value="percent">Percent Off (%)</option>
                      <option value="fixed">Fixed Amount ($)</option>
                    </select>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                        {form.discount_type === 'percent' ? '%' : '$'}
                      </span>
                      <input type="number" min="0" step={form.discount_type === 'percent' ? '1' : '0.01'}
                        value={form.discount_value}
                        onChange={e => setForm({ ...form, discount_value: e.target.value })}
                        placeholder="0"
                        className="w-full border rounded-lg pl-7 pr-3 py-2.5 text-sm" />
                    </div>
                  </div>
                </div>

                {/* Applies to */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2">Applies To *</label>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { value: 'all', label: 'All Products' },
                      { value: 'category', label: 'Categories' },
                      { value: 'products', label: 'Specific Items' },
                    ].map(opt => (
                      <button key={opt.value} onClick={() => setForm({ ...form, applies_to: opt.value as any })}
                        className="py-2 px-3 rounded-lg border text-xs font-semibold transition-all"
                        style={{
                          backgroundColor: form.applies_to === opt.value ? 'var(--primary)' : 'white',
                          color: form.applies_to === opt.value ? 'white' : '#555',
                          borderColor: form.applies_to === opt.value ? 'var(--primary)' : '#ddd',
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Category selector */}
                  {form.applies_to === 'category' && (
                    <div className="flex flex-wrap gap-2 p-3 rounded-lg border" style={{ borderColor: '#e5e7eb' }}>
                      {BROAD_CATEGORIES.map(cat => (
                        <button key={cat.slug} onClick={() => toggleCategory(cat.slug)}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                          style={{
                            backgroundColor: form.category_slugs.includes(cat.slug) ? cat.color : 'white',
                            color: form.category_slugs.includes(cat.slug) ? 'white' : '#555',
                            borderColor: form.category_slugs.includes(cat.slug) ? cat.color : '#ddd',
                          }}>
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Product selector */}
                  {form.applies_to === 'products' && (
                    <div className="border rounded-lg p-3" style={{ borderColor: '#e5e7eb' }}>
                      <div className="relative mb-2">
                        <input type="text" placeholder="Search products to add..."
                          value={productSearch}
                          onChange={e => searchProducts(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-sm" />
                        {productResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-xl z-10 mt-1 max-h-48 overflow-y-auto">
                            {productResults.map(p => (
                              <button key={p.id} onClick={() => addProduct(p)}
                                className="w-full px-3 py-2.5 text-left hover:bg-gray-50 border-b last:border-b-0 text-sm">
                                <span className="font-semibold">{p.name}</span>
                                <span className="text-gray-400 ml-2 text-xs">{p.brand} · ${p.display_price?.toFixed(2)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {selectedProducts.length > 0 ? (
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {selectedProducts.map(p => (
                            <div key={p.id} className="flex items-center justify-between px-2 py-1.5 rounded bg-gray-50 text-xs">
                              <span className="font-medium">{p.name}</span>
                              <button onClick={() => removeProduct(p.id)} className="text-gray-300 hover:text-red-400 ml-2">×</button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-2">No products selected yet</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Start Date (optional)</label>
                    <input type="datetime-local" value={form.start_date}
                      onChange={e => setForm({ ...form, start_date: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">End Date (optional)</label>
                    <input type="datetime-local" value={form.end_date}
                      onChange={e => setForm({ ...form, end_date: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2.5 text-sm" />
                  </div>
                </div>

                {/* Active toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <span className="text-sm font-semibold text-gray-700">Active</span>
                  <button onClick={() => setForm({ ...form, is_active: !form.is_active })}
                    className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                    style={{ backgroundColor: form.is_active ? 'var(--primary)' : '#d1d5db' }}>
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                      style={{ transform: form.is_active ? 'translateX(20px)' : 'translateX(4px)' }} />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={saveSale} disabled={saving}
                  className="flex-1 py-3 rounded-lg font-bold text-white text-sm"
                  style={{ backgroundColor: saving ? '#9ca3af' : 'var(--primary)' }}>
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Sale'}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-3 rounded-lg font-bold text-sm border"
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
