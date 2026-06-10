'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type RestockItem = {
  id: string
  created_at: string
  product_id: string | null
  product_name: string
  brand: string | null
  kinsey_sku: string | null
  quantity_needed: number
  status: 'pending' | 'ordered' | 'received' | 'cancelled'
  fulfillment_type: 'in_store' | 'store_order' | 'dropship' | null
  notes: string | null
  added_by: string | null
  order_id: string | null
  customer_name: string | null
  customer_phone: string | null
  po_number: string | null
  ordered_at: string | null
  received_at: string | null
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending:   { bg: '#fef3c7', text: '#92400e', label: 'Pending' },
  ordered:   { bg: '#dbeafe', text: '#1e40af', label: 'Ordered' },
  received:  { bg: '#d1fae5', text: '#065f46', label: 'Received' },
  cancelled: { bg: '#f3f4f6', text: '#6b7280', label: 'Cancelled' },
}

const FULFILLMENT_LABELS: Record<string, string> = {
  in_store: 'In Store',
  store_order: '📋 Order / Pickup',
  dropship: '🚚 Dropship',
}

export default function RestockPage() {
  const [items, setItems] = useState<RestockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [editPO, setEditPO] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ product_name: '', brand: '', kinsey_sku: '', quantity_needed: 1, notes: '', fulfillment_type: 'store_order' as const })
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadItems() }, [statusFilter])

  async function loadItems() {
    setLoading(true)
    let query = supabase.from('restock_list').select('*').order('created_at', { ascending: false })
    if (statusFilter !== 'all') query = query.eq('status', statusFilter)
    const { data } = await query
    setItems(data || [])
    setLoading(false)
  }

  async function updateStatus(id: string, status: RestockItem['status'], extra?: Partial<RestockItem>) {
    const update: any = { status, ...extra }
    if (status === 'ordered') update.ordered_at = new Date().toISOString()
    if (status === 'received') update.received_at = new Date().toISOString()
    await supabase.from('restock_list').update(update).eq('id', id)
    loadItems()
  }

  async function saveEdit(id: string) {
    await supabase.from('restock_list').update({ notes: editNotes, po_number: editPO }).eq('id', id)
    setEditingId(null)
    loadItems()
  }

  async function searchProducts(q: string) {
    setProductSearch(q)
    if (q.length < 2) { setProductResults([]); return }
    const { data } = await supabase.from('products')
      .select('id, name, brand, kinsey_sku')
      .or(`name.ilike.%${q}%,brand.ilike.%${q}%,kinsey_sku.ilike.%${q}%`)
      .limit(8)
    setProductResults(data || [])
  }

  function selectProduct(p: any) {
    setAddForm(f => ({ ...f, product_name: p.name, brand: p.brand || '', kinsey_sku: p.kinsey_sku || '' }))
    setProductSearch(p.name)
    setProductResults([])
  }

  async function addItem() {
    if (!addForm.product_name) return
    setSaving(true)
    await supabase.from('restock_list').insert({
      ...addForm,
      status: 'pending',
      added_by: 'manual',
    })
    setSaving(false)
    setShowAddModal(false)
    setAddForm({ product_name: '', brand: '', kinsey_sku: '', quantity_needed: 1, notes: '', fulfillment_type: 'store_order' })
    setProductSearch('')
    loadItems()
  }

  const counts = {
    pending: items.filter(i => i.status === 'pending').length,
    ordered: items.filter(i => i.status === 'ordered').length,
    received: items.filter(i => i.status === 'received').length,
    cancelled: items.filter(i => i.status === 'cancelled').length,
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>Restock List</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track items that need to be ordered or dropshipped</p>
        </div>
        <button onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-lg font-bold text-sm text-white"
          style={{ backgroundColor: 'var(--primary)' }}>
          + Add Item
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: 'all', label: 'All' },
          { key: 'pending', label: `Pending${counts.pending > 0 ? ` (${counts.pending})` : ''}` },
          { key: 'ordered', label: `Ordered${counts.ordered > 0 ? ` (${counts.ordered})` : ''}` },
          { key: 'received', label: `Received` },
          { key: 'cancelled', label: `Cancelled` },
        ].map(tab => (
          <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
            className="px-4 py-2 rounded-lg text-sm font-semibold border transition-colors"
            style={{
              backgroundColor: statusFilter === tab.key ? 'var(--primary)' : 'white',
              color: statusFilter === tab.key ? 'white' : '#555',
              borderColor: statusFilter === tab.key ? 'var(--primary)' : '#ddd',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4">
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--primary)' }}>Add Restock Item</h2>

            {/* Product search */}
            <div className="relative mb-3">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Search Product</label>
              <input type="text" placeholder="Search by name, brand, or SKU..."
                value={productSearch} onChange={e => searchProducts(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
              {productResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-xl z-20 mt-1 max-h-40 overflow-y-auto">
                  {productResults.map(p => (
                    <button key={p.id} onClick={() => selectProduct(p)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm border-b last:border-0">
                      <span className="font-semibold">{p.name}</span>
                      {p.brand && <span className="text-gray-400 ml-2">{p.brand}</span>}
                      {p.kinsey_sku && <span className="text-gray-400 ml-2 text-xs">#{p.kinsey_sku}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Product Name *</label>
                <input type="text" value={addForm.product_name}
                  onChange={e => setAddForm(f => ({ ...f, product_name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Brand</label>
                <input type="text" value={addForm.brand}
                  onChange={e => setAddForm(f => ({ ...f, brand: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">SKU / Part #</label>
                <input type="text" value={addForm.kinsey_sku}
                  onChange={e => setAddForm(f => ({ ...f, kinsey_sku: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Qty Needed</label>
                <input type="number" min="1" value={addForm.quantity_needed}
                  onChange={e => setAddForm(f => ({ ...f, quantity_needed: parseInt(e.target.value) || 1 }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Fulfillment</label>
                <select value={addForm.fulfillment_type}
                  onChange={e => setAddForm(f => ({ ...f, fulfillment_type: e.target.value as any }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="store_order">Order / Pickup</option>
                  <option value="dropship">Dropship</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Notes / Customer Info</label>
                <textarea rows={2} value={addForm.notes}
                  onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={addItem} disabled={saving || !addForm.product_name}
                className="flex-1 py-3 rounded-xl font-bold text-white text-sm disabled:opacity-50"
                style={{ backgroundColor: 'var(--primary)' }}>
                {saving ? 'Adding...' : 'Add to Restock List'}
              </button>
              <button onClick={() => { setShowAddModal(false); setProductSearch(''); setProductResults([]) }}
                className="px-5 py-3 rounded-xl font-semibold text-sm border" style={{ borderColor: '#ddd', color: '#666' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Items list */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 rounded-xl border-2 border-dashed" style={{ borderColor: '#e5e7eb' }}>
          <p className="text-lg font-semibold text-gray-400 mb-1">No items</p>
          <p className="text-sm text-gray-400">
            {statusFilter === 'pending' ? 'No items need to be ordered right now.' : `No ${statusFilter} items.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.pending
            const isEditing = editingId === item.id
            return (
              <div key={item.id} className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Status badge */}
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}>
                      {statusStyle.label}
                    </span>

                    {/* Item details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">{item.product_name}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                            {item.brand && <span className="text-xs text-gray-400">{item.brand}</span>}
                            {item.kinsey_sku && <span className="text-xs text-gray-400">SKU: {item.kinsey_sku}</span>}
                            <span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>Qty: {item.quantity_needed}</span>
                            {item.fulfillment_type && item.fulfillment_type !== 'in_store' && (
                              <span className="text-xs text-gray-500">{FULFILLMENT_LABELS[item.fulfillment_type]}</span>
                            )}
                          </div>
                          {item.customer_name && (
                            <p className="text-xs text-blue-600 mt-1">👤 {item.customer_name}{item.customer_phone ? ` · ${item.customer_phone}` : ''}</p>
                          )}
                          {item.notes && !isEditing && (
                            <p className="text-xs text-gray-500 mt-1 italic">{item.notes}</p>
                          )}
                          {item.po_number && !isEditing && (
                            <p className="text-xs text-gray-500 mt-0.5">PO: {item.po_number}</p>
                          )}
                          <p className="text-xs text-gray-300 mt-1">
                            Added {new Date(item.created_at).toLocaleDateString()} · {item.added_by || 'system'}
                            {item.ordered_at && ` · Ordered ${new Date(item.ordered_at).toLocaleDateString()}`}
                            {item.received_at && ` · Received ${new Date(item.received_at).toLocaleDateString()}`}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          {item.status === 'pending' && (
                            <>
                              <button onClick={() => { setEditingId(item.id); setEditNotes(item.notes || ''); setEditPO(item.po_number || '') }}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border hover:bg-gray-50"
                                style={{ borderColor: '#ddd' }}>
                                Edit
                              </button>
                              <button onClick={() => updateStatus(item.id, 'ordered')}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                                style={{ backgroundColor: '#1d4ed8' }}>
                                Mark Ordered
                              </button>
                              <button onClick={() => updateStatus(item.id, 'cancelled')}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 border hover:bg-red-50 hover:text-red-500 hover:border-red-200"
                                style={{ borderColor: '#ddd' }}>
                                Cancel
                              </button>
                            </>
                          )}
                          {item.status === 'ordered' && (
                            <>
                              <button onClick={() => { setEditingId(item.id); setEditNotes(item.notes || ''); setEditPO(item.po_number || '') }}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border hover:bg-gray-50"
                                style={{ borderColor: '#ddd' }}>
                                Edit
                              </button>
                              <button onClick={() => updateStatus(item.id, 'received')}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                                style={{ backgroundColor: '#16a34a' }}>
                                Mark Received
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Inline edit form */}
                      {isEditing && (
                        <div className="mt-3 p-3 rounded-lg bg-gray-50 space-y-2">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">PO Number / Order Reference</label>
                            <input type="text" value={editPO} onChange={e => setEditPO(e.target.value)}
                              placeholder="e.g. PO-12345 or Kinsey's order #"
                              className="w-full border rounded px-2 py-1.5 text-xs" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label>
                            <textarea rows={2} value={editNotes} onChange={e => setEditNotes(e.target.value)}
                              className="w-full border rounded px-2 py-1.5 text-xs resize-none" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => saveEdit(item.id)}
                              className="px-3 py-1.5 rounded text-xs font-bold text-white" style={{ backgroundColor: 'var(--primary)' }}>
                              Save
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="px-3 py-1.5 rounded text-xs font-semibold border text-gray-500" style={{ borderColor: '#ddd' }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
