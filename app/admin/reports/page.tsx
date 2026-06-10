'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

type Tab = 'margins' | 'sales' | 'topProducts' | 'inventory' | 'review'

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('margins')

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'margins',     label: 'Low Margin Products', icon: '📉' },
    { id: 'sales',       label: 'Sales Summary',       icon: '💰' },
    { id: 'topProducts', label: 'Top Products',        icon: '🏆' },
    { id: 'inventory',   label: 'Inventory Value',     icon: '📦' },
    { id: 'review',      label: 'Needs Review',        icon: '🔍' },
  ]

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2 rounded text-sm font-semibold transition-colors border"
            style={{
              backgroundColor: activeTab === tab.id ? 'var(--primary)' : 'white',
              color: activeTab === tab.id ? 'white' : 'var(--primary)',
              borderColor: 'var(--primary)',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'margins'     && <LowMarginReport />}
      {activeTab === 'sales'       && <SalesSummaryReport />}
      {activeTab === 'topProducts' && <TopProductsReport />}
      {activeTab === 'inventory'   && <InventoryValueReport />}
      {activeTab === 'review'      && <NeedsReviewReport />}
    </div>
  )
}

// ─── LOW MARGIN PRODUCTS ─────────────────────────────────────────────────────

function LowMarginReport() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [threshold, setThreshold] = useState(30)
  const [filter, setFilter] = useState<'all' | 'visible' | 'instore'>('all')
  const [search, setSearch] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState<{ id: string; value: string } | null>(null)
  const [message, setMessage] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('products')
      .select('id, name, brand, category, kinsey_sku, cost, map_price, msrp, display_price, visible, in_store')
      .eq('requires_ffl', false)
      .not('cost', 'is', null)
      .gt('cost', 0)
      .order('name')

    if (filter === 'visible') query = query.eq('visible', true)
    if (filter === 'instore') query = query.eq('in_store', true)
    if (search) query = query.ilike('name', `%${search}%`)

    const { data } = await query
    if (data) {
      const withMargin = data
        .map((p: any) => {
          const price = p.display_price || p.map_price || p.msrp
          if (!price || price <= 0) return null
          const margin = ((price - p.cost) / price) * 100
          return { ...p, effective_price: price, margin_pct: Math.round(margin * 10) / 10 }
        })
        .filter((p: any) => p !== null && p.margin_pct < threshold)
        .sort((a: any, b: any) => a.margin_pct - b.margin_pct)
      setProducts(withMargin)
    }
    setLoading(false)
  }, [threshold, filter, search])

  useEffect(() => {
    const timer = setTimeout(fetchData, 300)
    return () => clearTimeout(timer)
  }, [fetchData])

  async function savePrice(productId: string, newPrice: string) {
    setUpdating(productId)
    const parsed = parseFloat(newPrice)
    if (isNaN(parsed) || parsed <= 0) { setUpdating(null); return }
    const { error } = await supabase
      .from('products')
      .update({ display_price: parsed, updated_at: new Date().toISOString() })
      .eq('id', productId)
    if (!error) {
      setMessage('Price updated')
      setTimeout(() => setMessage(''), 3000)
      setEditPrice(null)
      fetchData()
    }
    setUpdating(null)
  }

  function getMarginColor(margin: number) {
    if (margin < 10) return { bg: '#fee2e2', color: '#dc2626' }
    if (margin < 20) return { bg: '#fff3e0', color: '#e65100' }
    return { bg: '#fffde7', color: '#f57f17' }
  }

  return (
    <div>
      <div className="bg-white rounded-lg shadow p-5 mb-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Margin Threshold</label>
            <div className="flex items-center gap-2">
              <input type="range" min="5" max="50" value={threshold}
                onChange={e => setThreshold(parseInt(e.target.value))} className="w-32" />
              <span className="font-bold text-sm w-12" style={{ color: 'var(--primary)' }}>&lt; {threshold}%</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Filter</label>
            <select value={filter} onChange={e => setFilter(e.target.value as any)}
              className="border rounded px-3 py-2 text-sm">
              <option value="all">All Products</option>
              <option value="visible">Visible on Website</option>
              <option value="instore">In-Store Products</option>
            </select>
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Search</label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name..." className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div className="text-sm text-gray-500 pb-2">
            <span className="font-bold" style={{ color: 'var(--primary)' }}>{products.length}</span> products below {threshold}% margin
          </div>
        </div>
      </div>

      {message && (
        <div className="mb-4 p-3 rounded text-sm font-semibold text-white" style={{ backgroundColor: 'var(--secondary)' }}>
          {message}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading margin report...</div>
        ) : products.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-semibold text-gray-600">All products are above {threshold}% margin</p>
            <p className="text-sm text-gray-400 mt-1">Lower the threshold slider to see more products</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: 'var(--cream-dark)' }}>
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">Product</th>
                <th className="px-4 py-3 font-semibold text-gray-600">SKU</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Cost</th>
                <th className="px-4 py-3 font-semibold text-gray-600">MAP</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Your Price</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Margin</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const marginStyle = getMarginColor(product.margin_pct)
                const isEditing = editPrice?.id === product.id
                return (
                  <tr key={product.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-gray-400">{product.brand}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{product.kinsey_sku}</td>
                    <td className="px-4 py-3">${product.cost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {product.map_price ? `$${product.map_price.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input type="number" step="0.01" value={editPrice?.value ?? ''} autoFocus
                            onChange={e => setEditPrice({ id: product.id, value: e.target.value })}
                            className="border rounded px-2 py-1 text-xs w-20" />
                          <button onClick={() => savePrice(product.id, editPrice?.value ?? '')}
                            disabled={updating === product.id}
                            className="px-2 py-1 rounded text-xs font-bold text-white"
                            style={{ backgroundColor: 'var(--secondary)' }}>
                            {updating === product.id ? '...' : '✓'}
                          </button>
                          <button onClick={() => setEditPrice(null)}
                            className="px-2 py-1 rounded text-xs text-gray-400">✕</button>
                        </div>
                      ) : (
                        <span className="cursor-pointer hover:underline" style={{ color: 'var(--primary)' }}
                          onClick={() => setEditPrice({ id: product.id, value: product.effective_price.toFixed(2) })}
                          title="Click to edit price">
                          ${product.effective_price.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded text-xs font-bold"
                        style={{ backgroundColor: marginStyle.bg, color: marginStyle.color }}>
                        {product.margin_pct}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {product.visible && <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: '#e6f4ea', color: '#2e7d32' }}>Live</span>}
                        {product.in_store && <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: '#e3f2fd', color: '#1565c0' }}>In Store</span>}
                        {!product.visible && <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-400">Hidden</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <a href={`/admin/products/${product.id}`}
                        className="px-3 py-1 rounded text-xs font-semibold text-white"
                        style={{ backgroundColor: 'var(--primary)' }}>
                        Edit
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── SALES SUMMARY ────────────────────────────────────────────────────────────

function SalesSummaryReport() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<'week' | 'month' | 'year'>('month')

  useEffect(() => { fetchSales() }, [range])

  async function fetchSales() {
    setLoading(true)
    const now = new Date()
    const start = new Date()
    if (range === 'week') start.setDate(now.getDate() - 7)
    else if (range === 'month') start.setDate(1)
    else start.setMonth(0, 1)
    const { data } = await supabase.from('orders').select('*')
      .gte('created_at', start.toISOString()).order('created_at', { ascending: false })
    if (data) setOrders(data)
    setLoading(false)
  }

  const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0)
  const totalRefunds = orders.reduce((s, o) => s + (o.refund_amount || 0), 0)
  const netRevenue = totalRevenue - totalRefunds
  const avgOrder = orders.length > 0 ? totalRevenue / orders.length : 0
  const byStatus = orders.reduce((acc: any, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc }, {})

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {(['week', 'month', 'year'] as const).map(r => (
          <button key={r} onClick={() => setRange(r)}
            className="px-4 py-2 rounded text-sm font-semibold border"
            style={{ backgroundColor: range === r ? 'var(--primary)' : 'white', color: range === r ? 'white' : 'var(--primary)', borderColor: 'var(--primary)' }}>
            {r === 'week' ? 'Last 7 Days' : r === 'month' ? 'This Month' : 'This Year'}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="p-8 text-center text-gray-400">Loading sales data...</div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-10 text-center">
          <div className="text-4xl mb-3">🛒</div>
          <p className="text-gray-500">No orders in this period yet — data will appear once orders come in</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Orders',  value: orders.length.toString(),      icon: '🛒', color: 'var(--primary)' },
              { label: 'Gross Revenue', value: `$${totalRevenue.toFixed(2)}`, icon: '💰', color: 'var(--secondary)' },
              { label: 'Net Revenue',   value: `$${netRevenue.toFixed(2)}`,   icon: '📊', color: 'var(--accent)' },
              { label: 'Avg Order',     value: `$${avgOrder.toFixed(2)}`,     icon: '🧾', color: '#1565c0' },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-lg shadow p-5 flex items-center gap-3">
                <div className="text-3xl">{card.icon}</div>
                <div>
                  <p className="text-xs text-gray-400">{card.label}</p>
                  <p className="text-xl font-bold" style={{ color: card.color }}>{card.value}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="font-bold mb-4" style={{ color: 'var(--primary)' }}>Orders by Status</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(byStatus).map(([status, count]: any) => (
                <div key={status} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: 'var(--cream-dark)' }}>
                  <span className="capitalize">{status}</span>
                  <span className="ml-2 font-bold" style={{ color: 'var(--primary)' }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── TOP PRODUCTS ─────────────────────────────────────────────────────────────

function TopProductsReport() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<'month' | 'year' | 'all'>('month')

  useEffect(() => { fetchOrders() }, [range])

  async function fetchOrders() {
    setLoading(true)
    let query = supabase.from('orders').select('items')
    if (range !== 'all') {
      const start = new Date()
      if (range === 'month') start.setDate(1)
      else start.setMonth(0, 1)
      query = query.gte('created_at', start.toISOString())
    }
    const { data } = await query
    if (data) setOrders(data)
    setLoading(false)
  }

  const productMap: Record<string, { name: string; qty: number; revenue: number }> = {}
  orders.forEach(order => {
    if (!Array.isArray(order.items)) return
    order.items.forEach((item: any) => {
      const key = item.sku || item.name
      if (!productMap[key]) productMap[key] = { name: item.name, qty: 0, revenue: 0 }
      productMap[key].qty += item.quantity || 1
      productMap[key].revenue += (item.price || 0) * (item.quantity || 1)
    })
  })
  const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 25)

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {(['month', 'year', 'all'] as const).map(r => (
          <button key={r} onClick={() => setRange(r)}
            className="px-4 py-2 rounded text-sm font-semibold border"
            style={{ backgroundColor: range === r ? 'var(--primary)' : 'white', color: range === r ? 'white' : 'var(--primary)', borderColor: 'var(--primary)' }}>
            {r === 'month' ? 'This Month' : r === 'year' ? 'This Year' : 'All Time'}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : topProducts.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-4xl mb-3">🏆</div>
            <p className="text-gray-500">No order data yet — top products will appear here once orders come in</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: 'var(--cream-dark)' }}>
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">#</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Product</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Units Sold</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p, idx) => (
                <tr key={p.name} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-bold text-gray-300">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">{p.qty}</td>
                  <td className="px-4 py-3 font-bold" style={{ color: 'var(--secondary)' }}>${p.revenue.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── INVENTORY VALUE ──────────────────────────────────────────────────────────

function InventoryValueReport() {
  const [stats, setStats] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchInventory() }, [])

  async function fetchInventory() {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('cost, display_price, map_price, msrp, quantity, category')
      .eq('requires_ffl', false)
      .gt('quantity', 0)

    if (data) {
      let totalCostValue = 0, totalRetailValue = 0, totalUnits = 0
      const catMap: Record<string, { units: number; costValue: number; retailValue: number }> = {}

      data.forEach((p: any) => {
        const qty = p.quantity || 0
        const cost = p.cost || 0
        const price = p.display_price || p.map_price || p.msrp || 0
        totalCostValue += cost * qty
        totalRetailValue += price * qty
        totalUnits += qty
        const cat = p.category || 'Uncategorized'
        if (!catMap[cat]) catMap[cat] = { units: 0, costValue: 0, retailValue: 0 }
        catMap[cat].units += qty
        catMap[cat].costValue += cost * qty
        catMap[cat].retailValue += price * qty
      })

      setStats({ totalCostValue, totalRetailValue, totalUnits, productCount: data.length })
      setCategories(Object.entries(catMap).map(([cat, vals]) => ({ cat, ...vals }))
        .sort((a, b) => b.retailValue - a.retailValue).slice(0, 20))
    }
    setLoading(false)
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Calculating inventory value...</div>
  if (!stats) return null

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Units in Stock', value: stats.totalUnits.toLocaleString(),  icon: '📦', color: 'var(--primary)' },
          { label: 'Products with Stock',  value: stats.productCount.toLocaleString(), icon: '🏷️', color: 'var(--accent)' },
          { label: 'Cost Value',           value: `$${fmt(stats.totalCostValue)}`,    icon: '🏭', color: '#1565c0' },
          { label: 'Retail Value',         value: `$${fmt(stats.totalRetailValue)}`,  icon: '💰', color: 'var(--secondary)' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-lg shadow p-5 flex items-center gap-3">
            <div className="text-3xl">{card.icon}</div>
            <div>
              <p className="text-xs text-gray-400">{card.label}</p>
              <p className="text-lg font-bold" style={{ color: card.color }}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ backgroundColor: 'var(--cream-dark)' }}>
          <h3 className="font-bold" style={{ color: 'var(--primary)' }}>Inventory Value by Category (Top 20)</h3>
          <p className="text-xs text-gray-400 mt-0.5">Category codes — names will appear once mapped</p>
        </div>
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: 'var(--cream-dark)' }}>
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold text-gray-600">Category</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Units</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Cost Value</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Retail Value</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Potential Profit</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.cat} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-semibold">{c.cat}</td>
                <td className="px-4 py-3">{c.units.toLocaleString()}</td>
                <td className="px-4 py-3">${fmt(c.costValue)}</td>
                <td className="px-4 py-3 font-semibold" style={{ color: 'var(--secondary)' }}>${fmt(c.retailValue)}</td>
                <td className="px-4 py-3 font-semibold" style={{ color: 'var(--accent)' }}>${fmt(c.retailValue - c.costValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── NEEDS REVIEW ─────────────────────────────────────────────────────────────

function NeedsReviewReport() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => { fetchProducts() }, [])

  async function fetchProducts() {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('id, name, brand, category, kinsey_sku, cost, map_price, msrp, display_price, visible, requires_ffl')
      .eq('visible', false)
      .eq('requires_ffl', false)
      .is('display_price', null)
      .order('brand', { ascending: true })

    if (data) setProducts(data)
    setLoading(false)
  }

  async function markAsFfl(productId: string) {
    setSaving(productId)
    const { error } = await supabase
      .from('products')
      .update({ requires_ffl: true, updated_at: new Date().toISOString() })
      .eq('id', productId)
    if (!error) {
      setMessage('Marked as FFL — product moved to FFL list')
      setTimeout(() => setMessage(''), 3000)
      setProducts(products.filter(p => p.id !== productId))
    }
    setSaving(null)
  }

  async function makeVisible(productId: string) {
    setSaving(productId)
    const { error } = await supabase
      .from('products')
      .update({ visible: true, updated_at: new Date().toISOString() })
      .eq('id', productId)
    if (!error) {
      setMessage('Product is now visible on the website')
      setTimeout(() => setMessage(''), 3000)
      setProducts(products.filter(p => p.id !== productId))
    }
    setSaving(null)
  }

  return (
    <div>
      <div className="bg-white rounded-lg shadow p-5 mb-5 flex items-start gap-4">
        <div className="text-3xl">🔍</div>
        <div>
          <h3 className="font-bold" style={{ color: 'var(--primary)' }}>Products Needing Review</h3>
          <p className="text-sm text-gray-500 mt-1">
            These products are hidden because they have no pricing data from Kinsey&apos;s.
            Review each one — mark it as FFL if it requires a license, make it visible if it&apos;s safe to sell,
            or visit the product detail page to set a manual price.
          </p>
        </div>
      </div>

      {message && (
        <div className="mb-4 p-3 rounded text-sm font-semibold text-white" style={{ backgroundColor: 'var(--secondary)' }}>
          {message}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : products.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-semibold text-gray-600">No products need review</p>
            <p className="text-sm text-gray-400 mt-1">All hidden products have been reviewed</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b text-sm text-gray-500" style={{ backgroundColor: 'var(--cream-dark)' }}>
              <span className="font-bold" style={{ color: 'var(--primary)' }}>{products.length}</span> products awaiting review
            </div>
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: 'var(--cream-dark)' }}>
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold text-gray-600">Product</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">SKU</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Cost</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">MAP</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">MSRP</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-gray-400">{product.brand}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{product.kinsey_sku}</td>
                    <td className="px-4 py-3 text-gray-400">{product.cost ? `$${product.cost.toFixed(2)}` : '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{product.map_price ? `$${product.map_price.toFixed(2)}` : '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{product.msrp ? `$${product.msrp.toFixed(2)}` : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => markAsFfl(product.id)}
                          disabled={saving === product.id}
                          className="px-2 py-1 rounded text-xs font-bold"
                          style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}
                        >
                          Mark FFL
                        </button>
                        <a
                          href={`/admin/products/${product.id}`}
                          className="px-2 py-1 rounded text-xs font-bold"
                          style={{ backgroundColor: 'var(--cream-dark)', color: 'var(--primary)' }}
                        >
                          Set Price
                        </a>
                        <button
                          onClick={() => makeVisible(product.id)}
                          disabled={saving === product.id}
                          className="px-2 py-1 rounded text-xs font-bold text-white"
                          style={{ backgroundColor: 'var(--secondary)' }}
                        >
                          Make Visible
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}
