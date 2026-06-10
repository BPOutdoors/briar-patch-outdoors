'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:    { bg: '#fff3e0', color: '#e65100' },
  processing: { bg: '#e3f2fd', color: '#1565c0' },
  shipped:    { bg: '#e8f5e9', color: '#2e7d32' },
  delivered:  { bg: '#e6f4ea', color: '#1b5e20' },
  cancelled:  { bg: '#fce4ec', color: '#880e4f' },
  refunded:   { bg: '#f3e5f5', color: '#6a1b9a' },
}

const ALL_STATUSES = ['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [trackingInput, setTrackingInput] = useState('')
  const [message, setMessage] = useState('')
  const pageSize = 25

  const fetchOrders = useCallback(async (pageNum = 0, searchTerm = search) => {
    setLoading(true)
    const from = pageNum * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (searchTerm) {
      query = query.or(`customer_name.ilike.%${searchTerm}%,customer_email.ilike.%${searchTerm}%,order_number.ilike.%${searchTerm}%`)
    }
    if (statusFilter !== 'all') query = query.eq('status', statusFilter)

    if (dateFilter !== 'all') {
      const now = new Date()
      const start = new Date()
      if (dateFilter === 'today') start.setHours(0, 0, 0, 0)
      else if (dateFilter === 'week') start.setDate(now.getDate() - 7)
      else if (dateFilter === 'month') start.setDate(1)
      query = query.gte('created_at', start.toISOString())
    }

    const { data, count } = await query
    if (data) setOrders(data)
    setTotalCount(count || 0)
    setLoading(false)
  }, [statusFilter, dateFilter, pageSize])

  // Live search
  useEffect(() => {
    if (search.length === 0 || search.length >= 3) {
      const timer = setTimeout(() => {
        setCurrentPage(0)
        fetchOrders(0, search)
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [search])

  useEffect(() => {
    fetchOrders(currentPage)
  }, [currentPage, statusFilter, dateFilter])

  async function updateStatus(orderId: string, newStatus: string) {
    setUpdatingStatus(true)
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId)
    if (!error) {
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
      if (selectedOrder?.id === orderId) setSelectedOrder({ ...selectedOrder, status: newStatus })
      showMessage('Status updated')
    }
    setUpdatingStatus(false)
  }

  async function saveTracking(orderId: string) {
    const { error } = await supabase
      .from('orders')
      .update({ tracking_number: trackingInput, updated_at: new Date().toISOString() })
      .eq('id', orderId)
    if (!error) {
      setOrders(orders.map(o => o.id === orderId ? { ...o, tracking_number: trackingInput } : o))
      if (selectedOrder?.id === orderId) setSelectedOrder({ ...selectedOrder, tracking_number: trackingInput })
      showMessage('Tracking number saved')
    }
  }

  async function saveNote(orderId: string) {
    setSavingNote(true)
    const { error } = await supabase
      .from('orders')
      .update({ notes: noteText, updated_at: new Date().toISOString() })
      .eq('id', orderId)
    if (!error) {
      setOrders(orders.map(o => o.id === orderId ? { ...o, notes: noteText } : o))
      if (selectedOrder?.id === orderId) setSelectedOrder({ ...selectedOrder, notes: noteText })
      showMessage('Note saved')
    }
    setSavingNote(false)
  }

  function openOrder(order: any) {
    setSelectedOrder(order)
    setNoteText(order.notes || '')
    setTrackingInput(order.tracking_number || '')
  }

  function showMessage(msg: string) {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  const totalPages = Math.ceil(totalCount / pageSize)
  const items = selectedOrder?.items || []
  const address = selectedOrder?.shipping_address || {}

  return (
    <div>
      {message && (
        <div className="mb-4 p-3 rounded text-sm font-semibold text-white" style={{ backgroundColor: 'var(--secondary)' }}>
          {message}
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {ALL_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setCurrentPage(0) }}
            className="px-3 py-1.5 rounded text-xs font-bold capitalize transition-colors border"
            style={{
              backgroundColor: statusFilter === s ? 'var(--primary)' : 'white',
              color: statusFilter === s ? 'white' : 'var(--primary)',
              borderColor: 'var(--primary)',
            }}
          >
            {s === 'all' ? 'All Orders' : s}
          </button>
        ))}
      </div>

      {/* Search + Date Filter */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by customer name, email, or order #..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded px-4 py-2 text-sm flex-1 min-w-56"
        />
        <select
          value={dateFilter}
          onChange={e => { setDateFilter(e.target.value); setCurrentPage(0) }}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">Last 7 Days</option>
          <option value="month">This Month</option>
        </select>
        <div className="flex items-center text-sm text-gray-500 px-2">
          {totalCount.toLocaleString()} order{totalCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-4">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-5xl mb-4">🛒</div>
            <p className="text-gray-500 font-medium">No orders yet</p>
            <p className="text-gray-400 text-sm mt-1">Orders will appear here once customers start purchasing</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: 'var(--cream-dark)' }}>
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">Order #</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Customer</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Items</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Total</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Fulfillment</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Date</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const statusStyle = STATUS_COLORS[order.status] || STATUS_COLORS.pending
                const itemCount = Array.isArray(order.items) ? order.items.length : 0
                return (
                  <tr key={order.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-semibold text-xs" style={{ color: 'var(--primary)' }}>
                      {order.order_number || `#${order.id.slice(0, 8).toUpperCase()}`}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{order.customer_name || 'Guest'}</p>
                      <p className="text-xs text-gray-400">{order.customer_email || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {itemCount} item{itemCount !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3 font-bold">${(order.total || 0).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      {order.fulfillment_type === 'dropship' ? (
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-50 text-blue-700">
                          🚚 Dropship
                        </span>
                      ) : order.fulfillment_type === 'pickup' ? (
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-amber-50 text-amber-700">
                          🏪 In-Store Pickup
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-500">
                          📦 Ship
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded text-xs font-bold capitalize"
                        style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}>
                        {order.status || 'pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(order.created_at).toLocaleDateString()}<br />
                      {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openOrder(order)}
                        className="px-3 py-1 rounded text-xs font-semibold text-white"
                        style={{ backgroundColor: 'var(--primary)' }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalCount > pageSize && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, totalCount)} of {totalCount.toLocaleString()} orders
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="px-3 py-1 rounded text-sm font-semibold border disabled:opacity-40"
              style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
            >
              ← Prev
            </button>
            <span className="px-3 py-1 text-sm text-gray-500">
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="px-3 py-1 rounded text-sm font-semibold border disabled:opacity-40"
              style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ backgroundColor: 'var(--cream-dark)' }}>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
                  Order {selectedOrder.order_number || `#${selectedOrder.id.slice(0, 8).toUpperCase()}`}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Placed {new Date(selectedOrder.created_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-light leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">

              {/* Status Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-gray-600">Status:</span>
                {Object.keys(STATUS_COLORS).map(s => (
                  <button
                    key={s}
                    onClick={() => updateStatus(selectedOrder.id, s)}
                    disabled={updatingStatus}
                    className="px-3 py-1 rounded text-xs font-bold capitalize transition-all border-2"
                    style={{
                      backgroundColor: selectedOrder.status === s ? STATUS_COLORS[s].bg : 'white',
                      color: STATUS_COLORS[s].color,
                      borderColor: STATUS_COLORS[s].color,
                      opacity: updatingStatus ? 0.6 : 1,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Customer + Shipping */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--cream-dark)' }}>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Customer</h3>
                  <p className="font-semibold">{selectedOrder.customer_name || 'Guest'}</p>
                  <p className="text-sm text-gray-500">{selectedOrder.customer_email || '—'}</p>
                  <p className="text-sm text-gray-500">{selectedOrder.customer_phone || '—'}</p>
                </div>
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--cream-dark)' }}>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Ship To</h3>
                  {address.line1 ? (
                    <>
                      <p className="font-semibold">{address.name || selectedOrder.customer_name}</p>
                      <p className="text-sm text-gray-500">{address.line1}</p>
                      {address.line2 && <p className="text-sm text-gray-500">{address.line2}</p>}
                      <p className="text-sm text-gray-500">{address.city}, {address.state} {address.postal_code}</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">No shipping address</p>
                  )}
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Items Ordered</h3>
                <div className="border rounded-lg overflow-hidden">
                  {items.length === 0 ? (
                    <p className="p-4 text-sm text-gray-400">No item details available</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead style={{ backgroundColor: 'var(--cream-dark)' }}>
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold text-gray-600">Product</th>
                          <th className="px-4 py-2 text-center font-semibold text-gray-600">Qty</th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600">Price</th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600">Line Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item: any, idx: number) => (
                          <tr key={idx} className="border-t">
                            <td className="px-4 py-3">
                              <p className="font-medium">{item.name}</p>
                              <p className="text-xs text-gray-400">{item.sku || ''}</p>
                            </td>
                            <td className="px-4 py-3 text-center">{item.quantity}</td>
                            <td className="px-4 py-3 text-right">${(item.price || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-semibold">
                              ${((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Order Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal</span>
                    <span>${(selectedOrder.subtotal || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Shipping</span>
                    <span>{selectedOrder.shipping_cost === 0 ? 'Free' : `$${(selectedOrder.shipping_cost || 0).toFixed(2)}`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tax</span>
                    <span>${(selectedOrder.tax || 0).toFixed(2)}</span>
                  </div>
                  {selectedOrder.refund_amount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Refunded</span>
                      <span>−${selectedOrder.refund_amount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base border-t pt-1">
                    <span>Total</span>
                    <span style={{ color: 'var(--primary)' }}>${(selectedOrder.total || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Dropship Alert */}
              {selectedOrder.fulfillment_type === 'dropship' && (
                <div className="p-4 rounded-lg border-2 border-blue-200 bg-blue-50">
                  <h3 className="font-bold text-blue-800 mb-2">🚚 Dropship Order — Action Required</h3>
                  <p className="text-sm text-blue-700 mb-3">
                    This order needs to be placed with Kinsey&apos;s for dropship fulfillment. Once you place it through their portal, update the status to <strong>Processing</strong> and add the tracking number when it ships.
                  </p>
                  <a
                    href="https://www.kinseysinc.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-4 py-2 rounded text-sm font-bold text-white"
                    style={{ backgroundColor: '#1565c0' }}
                  >
                    Open Kinsey&apos;s Portal →
                  </a>
                </div>
              )}

              {/* Tracking Number */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Tracking Number</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={trackingInput}
                    onChange={e => setTrackingInput(e.target.value)}
                    placeholder="Enter tracking number..."
                    className="border rounded px-3 py-2 text-sm flex-1"
                  />
                  <button
                    onClick={() => saveTracking(selectedOrder.id)}
                    className="px-4 py-2 rounded text-sm font-bold text-white"
                    style={{ backgroundColor: 'var(--secondary)' }}
                  >
                    Save
                  </button>
                  {trackingInput && (
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(trackingInput)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded text-sm font-bold border"
                      style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
                    >
                      Track →
                    </a>
                  )}
                </div>
              </div>

              {/* Internal Notes */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Internal Notes</h3>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Add notes about this order (not visible to customer)..."
                  rows={3}
                  className="w-full border rounded px-3 py-2 text-sm resize-none"
                />
                <button
                  onClick={() => saveNote(selectedOrder.id)}
                  disabled={savingNote}
                  className="mt-2 px-4 py-2 rounded text-sm font-bold text-white"
                  style={{ backgroundColor: savingNote ? '#9ca3af' : 'var(--primary)' }}
                >
                  {savingNote ? 'Saving...' : 'Save Note'}
                </button>
              </div>

              {/* Stripe Reference */}
              {selectedOrder.stripe_payment_intent && (
                <div className="p-3 rounded text-xs text-gray-400 bg-gray-50 border">
                  <span className="font-semibold">Stripe Payment ID:</span> {selectedOrder.stripe_payment_intent}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
