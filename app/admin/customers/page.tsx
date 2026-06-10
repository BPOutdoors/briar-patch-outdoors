'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

const emptyForm = {
  first_name: '', last_name: '', email: '', phone: '',
  address: '', city: '', state: 'GA', zip: '',
  customer_group_id: '', notes: '',
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const pageSize = 50

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [customerOrders, setCustomerOrders] = useState<any[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)

  const [showGroupsManager, setShowGroupsManager] = useState(false)
  const [groupForm, setGroupForm] = useState({ name: '', discount_percentage: 0, description: '' })
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)

  useEffect(() => { loadGroups() }, [])
  useEffect(() => { fetchCustomers() }, [currentPage, groupFilter])

  async function loadGroups() {
    const { data } = await supabase.from('customer_groups').select('*').order('name')
    if (data) {
      setGroups(data)
      // Set default store group in form
      const storeDefault = data.find((g: any) => g.is_default_store)
      if (storeDefault) setForm(f => ({ ...f, customer_group_id: storeDefault.id }))
    }
  }

  async function fetchCustomers(q = search) {
    setLoading(true)
    const from = currentPage * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('customers')
      .select('*, customer_groups(name, discount_percentage)', { count: 'exact' })
      .order('last_name')
      .range(from, to)

    if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
    if (groupFilter !== 'all') query = query.eq('customer_group_id', groupFilter)

    const { data, count } = await query
    if (data) { setCustomers(data); setTotalCount(count || 0) }
    setLoading(false)
  }

  function openNew() {
    const storeDefault = groups.find(g => g.is_default_store)
    setForm({ ...emptyForm, customer_group_id: storeDefault?.id || '' })
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(c: any) {
    setForm({
      first_name: c.first_name || '',
      last_name: c.last_name || '',
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      city: c.city || '',
      state: c.state || 'GA',
      zip: c.zip || '',
      customer_group_id: c.customer_group_id || '',
      notes: c.notes || '',
    })
    setEditingId(c.id)
    setShowForm(true)
  }

  async function saveCustomer() {
    if (!form.first_name || !form.last_name) { showMsg('First and last name are required', 'error'); return }
    setSaving(true)
    const payload = { ...form, updated_at: new Date().toISOString() }
    if (editingId) {
      const { error } = await supabase.from('customers').update(payload).eq('id', editingId)
      if (error) showMsg(error.message, 'error')
      else { showMsg('Customer updated!', 'success'); setShowForm(false); fetchCustomers() }
    } else {
      const { error } = await supabase.from('customers').insert({ ...payload, created_source: 'store' })
      if (error) showMsg(error.message, 'error')
      else { showMsg('Customer added!', 'success'); setShowForm(false); fetchCustomers() }
    }
    setSaving(false)
  }

  async function viewCustomer(c: any) {
    setSelectedCustomer(c)
    setLoadingOrders(true)
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(product_name, quantity, unit_price, line_total)')
      .eq('customer_id', c.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setCustomerOrders(data || [])
    setLoadingOrders(false)
  }

  async function saveGroup() {
    if (!groupForm.name) return
    if (editingGroupId) {
      await supabase.from('customer_groups').update(groupForm).eq('id', editingGroupId)
    } else {
      await supabase.from('customer_groups').insert(groupForm)
    }
    setGroupForm({ name: '', discount_percentage: 0, description: '' })
    setEditingGroupId(null)
    loadGroups()
  }

  async function deleteGroup(id: string) {
    const inUse = customers.some(c => c.customer_group_id === id)
    if (inUse) { showMsg('Cannot delete — customers are assigned to this group', 'error'); return }
    if (!confirm('Delete this group?')) return
    await supabase.from('customer_groups').delete().eq('id', id)
    loadGroups()
  }

  function showMsg(msg: string, type: 'success' | 'error') {
    setMessage(msg); setMessageType(type)
    setTimeout(() => setMessage(''), 4000)
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="max-w-7xl">
      {message && (
        <div className="mb-4 p-3 rounded text-sm font-semibold text-white"
          style={{ backgroundColor: messageType === 'success' ? 'var(--secondary)' : '#dc2626' }}>
          {message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input type="text" placeholder="Search by name, email, phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { setCurrentPage(0); fetchCustomers(search) } }}
          className="border rounded-lg px-4 py-2.5 text-sm flex-1 min-w-56" />
        <select value={groupFilter} onChange={e => { setGroupFilter(e.target.value); setCurrentPage(0) }}
          className="border rounded-lg px-3 py-2.5 text-sm">
          <option value="all">All Groups</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <button onClick={() => setShowGroupsManager(true)}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold border transition-colors hover:bg-gray-50"
          style={{ borderColor: '#ddd', color: '#666' }}>
          Manage Groups
        </button>
        <button onClick={openNew}
          className="px-5 py-2.5 rounded-lg text-sm font-bold text-white"
          style={{ backgroundColor: 'var(--primary)' }}>
          + Add Customer
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {groups.map(g => {
          const count = customers.filter(c => c.customer_group_id === g.id).length
          return (
            <div key={g.id} className="bg-white border rounded-lg p-4 cursor-pointer hover:border-gray-400 transition-colors"
              onClick={() => setGroupFilter(groupFilter === g.id ? 'all' : g.id)}
              style={{ borderColor: groupFilter === g.id ? 'var(--primary)' : '#e5e7eb' }}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{g.name}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--primary)' }}>{count}</p>
              {g.discount_percentage > 0 && (
                <p className="text-xs text-green-600 font-semibold mt-0.5">{g.discount_percentage}% discount</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Customer Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ backgroundColor: '#fafafa' }}>
          <p className="text-sm text-gray-500">{totalCount.toLocaleString()} customers</p>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No customers found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: '#fafafa' }}>
              <tr className="text-left border-b">
                <th className="px-4 py-3 font-semibold text-gray-500">Name</th>
                <th className="px-4 py-3 font-semibold text-gray-500">Contact</th>
                <th className="px-4 py-3 font-semibold text-gray-500">Group</th>
                <th className="px-4 py-3 font-semibold text-gray-500">Lifetime Spend</th>
                <th className="px-4 py-3 font-semibold text-gray-500">Visits</th>
                <th className="px-4 py-3 font-semibold text-gray-500">Since</th>
                <th className="px-4 py-3 font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => viewCustomer(c)}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{c.first_name} {c.last_name}</p>
                    {c.notes && <p className="text-xs text-gray-400 truncate max-w-xs">{c.notes}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-700">{c.email || '—'}</p>
                    <p className="text-xs text-gray-400">{c.phone || ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: 'var(--cream-dark)', color: 'var(--primary)' }}>
                      {c.customer_groups?.name || '—'}
                    </span>
                    {c.customer_groups?.discount_percentage > 0 && (
                      <span className="ml-1 text-xs text-green-600 font-semibold">
                        -{c.customer_groups.discount_percentage}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--secondary)' }}>
                    ${(c.lifetime_spend || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">{c.visit_count || 0}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEdit(c)}
                      className="text-xs font-semibold px-3 py-1.5 rounded border transition-colors hover:bg-gray-50"
                      style={{ borderColor: '#ddd', color: 'var(--primary)' }}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-gray-500">
              Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, totalCount)} of {totalCount.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}
                className="px-3 py-1.5 rounded border text-sm disabled:opacity-40">← Prev</button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1}
                className="px-3 py-1.5 rounded border text-sm disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Customer Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
                  {editingId ? 'Edit Customer' : 'New Customer'}
                </h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 text-2xl">×</button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">First Name *</label>
                    <input type="text" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Last Name *</label>
                    <input type="text" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Phone</label>
                    <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Address</label>
                  <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Street address" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">City</label>
                    <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">State</label>
                    <select value={form.state} onChange={e => setForm({ ...form, state: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm">
                      {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">ZIP</label>
                    <input type="text" value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Customer Group</label>
                  <select value={form.customer_group_id} onChange={e => setForm({ ...form, customer_group_id: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">No group</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name}{g.discount_percentage > 0 ? ` (${g.discount_percentage}% off)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={saveCustomer} disabled={saving}
                  className="flex-1 py-2.5 rounded-lg font-bold text-white text-sm"
                  style={{ backgroundColor: saving ? '#9ca3af' : 'var(--primary)' }}>
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Customer'}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-lg font-bold text-sm border"
                  style={{ borderColor: '#ddd', color: '#666' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Detail Panel */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--primary)' }}>
                    {selectedCustomer.first_name} {selectedCustomer.last_name}
                  </h2>
                  <p className="text-sm text-gray-500">{selectedCustomer.email} {selectedCustomer.phone && `· ${selectedCustomer.phone}`}</p>
                  {selectedCustomer.address && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {selectedCustomer.address}, {selectedCustomer.city}, {selectedCustomer.state} {selectedCustomer.zip}
                    </p>
                  )}
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="text-gray-400 text-2xl">×</button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-5 p-4 rounded-lg" style={{ backgroundColor: 'var(--cream-dark)' }}>
                <div>
                  <p className="text-xs text-gray-500">Group</p>
                  <p className="font-bold text-sm">{selectedCustomer.customer_groups?.name || '—'}</p>
                  {selectedCustomer.customer_groups?.discount_percentage > 0 && (
                    <p className="text-xs text-green-600">{selectedCustomer.customer_groups.discount_percentage}% discount</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500">Lifetime Spend</p>
                  <p className="font-bold text-sm" style={{ color: 'var(--secondary)' }}>${(selectedCustomer.lifetime_spend || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Visits</p>
                  <p className="font-bold text-sm">{selectedCustomer.visit_count || 0}</p>
                </div>
              </div>

              {selectedCustomer.notes && (
                <div className="mb-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                  <p className="text-xs font-semibold text-yellow-700 mb-1">Notes</p>
                  <p className="text-sm text-yellow-800">{selectedCustomer.notes}</p>
                </div>
              )}

              {/* Order History */}
              <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--primary)' }}>Purchase History</h3>
              {loadingOrders ? (
                <p className="text-sm text-gray-400">Loading orders...</p>
              ) : customerOrders.length === 0 ? (
                <p className="text-sm text-gray-400">No orders yet.</p>
              ) : (
                <div className="space-y-2">
                  {customerOrders.map(order => (
                    <div key={order.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded"
                            style={{ backgroundColor: order.source === 'pos' ? '#e3f2fd' : '#e8f5e9', color: order.source === 'pos' ? '#1565c0' : '#2e7d32' }}>
                            {order.order_number}
                          </span>
                          <span className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString()}</span>
                        </div>
                        <span className="font-bold text-sm" style={{ color: 'var(--primary)' }}>${order.total?.toFixed(2)}</span>
                      </div>
                      {order.order_items?.slice(0, 3).map((item: any, i: number) => (
                        <p key={i} className="text-xs text-gray-500">{item.quantity}× {item.product_name}</p>
                      ))}
                      {order.order_items?.length > 3 && (
                        <p className="text-xs text-gray-400">+{order.order_items.length - 3} more items</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 mt-5">
                <button onClick={() => { openEdit(selectedCustomer); setSelectedCustomer(null) }}
                  className="flex-1 py-2 rounded-lg font-semibold text-sm border"
                  style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                  Edit Customer
                </button>
                <button onClick={() => setSelectedCustomer(null)}
                  className="flex-1 py-2 rounded-lg font-semibold text-sm border"
                  style={{ borderColor: '#ddd', color: '#666' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Groups Manager */}
      {showGroupsManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold" style={{ color: 'var(--primary)' }}>Customer Groups</h2>
                <button onClick={() => setShowGroupsManager(false)} className="text-gray-400 text-2xl">×</button>
              </div>

              {/* Existing groups */}
              <div className="space-y-2 mb-5">
                {groups.map(g => (
                  <div key={g.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{g.name}</p>
                        {g.is_default_store && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Store Default</span>}
                        {g.is_default_web && <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">Web Default</span>}
                      </div>
                      <p className="text-xs text-gray-400">
                        {g.discount_percentage > 0 ? `${g.discount_percentage}% discount` : 'No discount'}
                        {g.description && ` · ${g.description}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => {
                        setGroupForm({ name: g.name, discount_percentage: g.discount_percentage, description: g.description || '' })
                        setEditingGroupId(g.id)
                      }}
                        className="text-xs px-2 py-1 rounded border"
                        style={{ borderColor: '#ddd', color: 'var(--primary)' }}>Edit</button>
                      {!g.is_default_store && !g.is_default_web && (
                        <button onClick={() => deleteGroup(g.id)}
                          className="text-xs px-2 py-1 rounded border border-red-200 text-red-500">Delete</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add/edit group form */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--primary)' }}>
                  {editingGroupId ? 'Edit Group' : 'Add New Group'}
                </h3>
                <div className="space-y-3">
                  <input type="text" placeholder="Group name" value={groupForm.name}
                    onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Discount %</label>
                    <input type="number" min="0" max="100" step="0.5" value={groupForm.discount_percentage}
                      onChange={e => setGroupForm({ ...groupForm, discount_percentage: parseFloat(e.target.value) || 0 })}
                      className="w-24 border rounded-lg px-3 py-2 text-sm" />
                    <input type="text" placeholder="Description (optional)" value={groupForm.description}
                      onChange={e => setGroupForm({ ...groupForm, description: e.target.value })}
                      className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveGroup}
                      className="px-4 py-2 rounded-lg text-sm font-bold text-white"
                      style={{ backgroundColor: 'var(--primary)' }}>
                      {editingGroupId ? 'Save Changes' : 'Add Group'}
                    </button>
                    {editingGroupId && (
                      <button onClick={() => { setEditingGroupId(null); setGroupForm({ name: '', discount_percentage: 0, description: '' }) }}
                        className="px-4 py-2 rounded-lg text-sm font-semibold border"
                        style={{ borderColor: '#ddd', color: '#666' }}>Cancel</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
