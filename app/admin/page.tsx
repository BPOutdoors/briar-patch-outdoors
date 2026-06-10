'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type StatCard = {
  label: string
  value: string
  sub: string
  icon: string
  color: string
}

type DateFilter = 'today' | 'week' | 'month' | 'year' | 'custom'

export default function AdminDashboard() {
  const [filter, setFilter] = useState<DateFilter>('today')
  const [stats, setStats] = useState({
    totalSales: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    totalRefunds: 0,
  })
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [lowStock, setLowStock] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [filter])

  function getDateRange() {
    const now = new Date()
    const start = new Date()
    if (filter === 'today') start.setHours(0, 0, 0, 0)
    else if (filter === 'week') start.setDate(now.getDate() - 7)
    else if (filter === 'month') start.setDate(1)
    else if (filter === 'year') start.setMonth(0, 1)
    return { start: start.toISOString(), end: now.toISOString() }
  }

  async function fetchDashboardData() {
    setLoading(true)
    const { start, end } = getDateRange()

    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', start)
      .lte('created_at', end)

    const { data: recentOrdersData } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)

    const { data: lowStockData } = await supabase
      .from('products')
      .select('*')
      .eq('in_store', true)
      .limit(100)


    if (orders) {
      const totalSales = orders.reduce((sum, o) => sum + (o.total || 0), 0)
      const totalRefunds = orders.reduce((sum, o) => sum + (o.refund_amount || 0), 0)
      setStats({
        totalSales,
        totalOrders: orders.length,
        avgOrderValue: orders.length > 0 ? totalSales / orders.length : 0,
        totalRefunds,
      })
    }

    if (recentOrdersData) setRecentOrders(recentOrdersData)
    if (lowStockData) {
        const alerts = lowStockData.filter(p => p.quantity <= (p.low_stock_threshold || 5))
        setLowStock(alerts)
      }
    setLoading(false)
  }

  const filterLabels: Record<DateFilter, string> = {
    today: 'Today',
    week: 'This Week',
    month: 'This Month',
    year: 'This Year',
    custom: 'Custom',
  }

  const statCards: StatCard[] = [
    {
      label: 'Total Sales',
      value: `$${stats.totalSales.toFixed(2)}`,
      sub: filterLabels[filter],
      icon: '💰',
      color: '#4A5E2F',
    },
    {
      label: 'Total Orders',
      value: stats.totalOrders.toString(),
      sub: filterLabels[filter],
      icon: '🛒',
      color: '#8B4513',
    },
    {
      label: 'Avg Order Value',
      value: `$${stats.avgOrderValue.toFixed(2)}`,
      sub: filterLabels[filter],
      icon: '📊',
      color: '#C4842A',
    },
    {
      label: 'Refunds',
      value: `$${stats.totalRefunds.toFixed(2)}`,
      sub: filterLabels[filter],
      icon: '↩️',
      color: '#8B0000',
    },
  ]

  return (
    <div>
      {/* Filter Buttons */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {(Object.keys(filterLabels) as DateFilter[]).filter(f => f !== 'custom').map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-2 rounded font-semibold text-sm transition-colors"
            style={{
              backgroundColor: filter === f ? 'var(--primary)' : 'white',
              color: filter === f ? 'white' : 'var(--primary)',
              border: '2px solid var(--primary)',
            }}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading dashboard...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statCards.map((card) => (
              <div key={card.label} className="bg-white rounded-lg shadow p-6 flex items-center gap-4">
                <div className="text-4xl">{card.icon}</div>
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
                  <p className="text-xs text-gray-400">{card.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Recent Orders */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--primary)' }}>Recent Orders</h2>
              {recentOrders.length === 0 ? (
                <p className="text-gray-400 text-sm">No orders yet</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b">
                      <th className="pb-2">Customer</th>
                      <th className="pb-2">Total</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr key={order.id} className="border-b last:border-0">
                        <td className="py-2">{order.customer_name || 'Guest'}</td>
                        <td className="py-2">${(order.total || 0).toFixed(2)}</td>
                        <td className="py-2">
                          <span className="px-2 py-1 rounded text-xs font-semibold"
                            style={{
                              backgroundColor: order.status === 'completed' ? '#e6f4ea' : '#fff3e0',
                              color: order.status === 'completed' ? '#2e7d32' : '#e65100'
                            }}>
                            {order.status}
                          </span>
                        </td>
                        <td className="py-2 text-gray-400">{new Date(order.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Low Stock Alerts */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--primary)' }}>⚠️ Low Stock Alerts</h2>
              {lowStock.length === 0 ? (
                <p className="text-gray-400 text-sm">No low stock items</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b">
                      <th className="pb-2">Product</th>
                      <th className="pb-2">Brand</th>
                      <th className="pb-2">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.map((product) => (
                      <tr key={product.id} className="border-b last:border-0">
                        <td className="py-2">{product.name}</td>
                        <td className="py-2 text-gray-400">{product.brand}</td>
                        <td className="py-2">
                          <span className="px-2 py-1 rounded text-xs font-semibold"
                            style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
                            {product.quantity} left
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        </>
      )}
    </div>
  )
}