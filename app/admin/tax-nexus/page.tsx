'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const TRANSACTION_THRESHOLD = 200
const REVENUE_THRESHOLD = 100000
const WARNING_PCT = 0.75

const STATE_NAMES: Record<string, string> = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',
  DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',
  KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',
  MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',
  NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',
  OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',
  TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',
  WI:'Wisconsin',WY:'Wyoming',
}

export default function TaxNexusPage() {
  const [stateData, setStateData] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [gaStats, setGaStats] = useState({ count: 0, revenue: 0 })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    const [{ data: orders }, { data: nexusAlerts }] = await Promise.all([
      supabase
        .from('orders')
        .select('shipping_state, subtotal, total')
        .eq('source', 'web')
        .eq('fulfillment_type', 'shipping')
        .not('shipping_state', 'is', null),
      supabase
        .from('nexus_alerts')
        .select('*')
        .order('sent_at', { ascending: false }),
    ])

    if (orders) {
      // GA stats
      const gaOrders = orders.filter((o: any) => o.shipping_state === 'GA')
      setGaStats({
        count: gaOrders.length,
        revenue: gaOrders.reduce((s: number, o: any) => s + (o.subtotal || 0), 0),
      })

      // Out-of-state aggregation
      const byState: Record<string, { count: number; revenue: number }> = {}
      orders
        .filter((o: any) => o.shipping_state !== 'GA')
        .forEach((o: any) => {
          const st = o.shipping_state
          if (!byState[st]) byState[st] = { count: 0, revenue: 0 }
          byState[st].count++
          byState[st].revenue += o.subtotal || 0
        })

      const rows = Object.entries(byState).map(([state, data]) => ({
        state,
        stateName: STATE_NAMES[state] || state,
        ...data,
        txPct: Math.min(100, (data.count / TRANSACTION_THRESHOLD) * 100),
        revPct: Math.min(100, (data.revenue / REVENUE_THRESHOLD) * 100),
        maxPct: Math.min(100, Math.max(
          (data.count / TRANSACTION_THRESHOLD) * 100,
          (data.revenue / REVENUE_THRESHOLD) * 100,
        )),
      }))
      .sort((a, b) => b.maxPct - a.maxPct)

      setStateData(rows)
    }

    setAlerts(nexusAlerts || [])
    setLoading(false)
  }

  function getStatusColor(pct: number) {
    if (pct >= 100) return { bar: '#dc2626', badge: '#fef2f2', text: '#dc2626', label: 'Action Required' }
    if (pct >= WARNING_PCT * 100) return { bar: '#f59e0b', badge: '#fffbeb', text: '#92400e', label: 'Warning' }
    return { bar: '#22c55e', badge: '#f0fdf4', text: '#15803d', label: 'Safe' }
  }

  const atRiskStates = stateData.filter(s => s.maxPct >= WARNING_PCT * 100)

  return (
    <div className="max-w-4xl">

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded-xl p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">GA Orders (Ship)</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{gaStats.count}</p>
          <p className="text-sm text-gray-500">${gaStats.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} revenue · Tax collected</p>
        </div>
        <div className="bg-white border rounded-xl p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Out-of-State Orders</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
            {stateData.reduce((s, r) => s + r.count, 0)}
          </p>
          <p className="text-sm text-gray-500">Across {stateData.length} states · No tax collected</p>
        </div>
        <div className="bg-white border rounded-xl p-5" style={{ borderColor: atRiskStates.length > 0 ? '#fbbf24' : '#e5e7eb' }}>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">States to Watch</p>
          <p className="text-2xl font-bold" style={{ color: atRiskStates.length > 0 ? '#92400e' : 'var(--primary)' }}>
            {atRiskStates.length}
          </p>
          <p className="text-sm text-gray-500">
            {atRiskStates.length === 0 ? 'No states near threshold' : `Approaching or over nexus threshold`}
          </p>
        </div>
      </div>

      {/* Threshold explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
        <p className="font-bold mb-1">How nexus thresholds work</p>
        <p>Most states require you to collect sales tax once you reach <strong>{TRANSACTION_THRESHOLD} transactions</strong> OR <strong>${REVENUE_THRESHOLD.toLocaleString()}</strong> in sales to that state in a calendar year. You'll receive an email alert at 75% of either threshold, and again when you cross it. Always confirm with your accountant.</p>
      </div>

      {/* Alerts history */}
      {alerts.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-amber-200 bg-amber-50">
            <h2 className="font-bold text-sm text-amber-800">Recent Nexus Alerts Sent</h2>
          </div>
          <div className="divide-y">
            {alerts.map(a => (
              <div key={a.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div>
                  <span className="font-semibold">{STATE_NAMES[a.state] || a.state}</span>
                  <span className="text-gray-400 ml-2">— {a.alert_type.replace(/_/g, ' ')}</span>
                </div>
                <div className="text-right text-xs text-gray-400">
                  <p>{a.transaction_count} txns · ${a.total_revenue?.toFixed(0)}</p>
                  <p>{new Date(a.sent_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* State breakdown */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="font-bold text-sm" style={{ color: 'var(--primary)' }}>Out-of-State Sales by State</h2>
          <button onClick={loadData} className="text-xs font-semibold px-3 py-1.5 rounded border hover:bg-gray-100"
            style={{ borderColor: '#ddd', color: '#666' }}>↻ Refresh</button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : stateData.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No out-of-state shipping orders yet</div>
        ) : (
          <div className="divide-y">
            {stateData.map(row => {
              const txStatus = getStatusColor(row.txPct)
              const revStatus = getStatusColor(row.revPct)
              const overallStatus = getStatusColor(row.maxPct)
              return (
                <div key={row.state} className="px-5 py-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{row.stateName}</span>
                        <span className="text-xs text-gray-400">{row.state}</span>
                        {row.maxPct >= WARNING_PCT * 100 && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                            style={{ backgroundColor: overallStatus.badge, color: overallStatus.text }}>
                            {overallStatus.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {row.count} order{row.count !== 1 ? 's' : ''} · ${row.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} in sales
                      </p>
                    </div>
                  </div>
                  {/* Progress bars */}
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Transactions</span>
                        <span className="font-semibold" style={{ color: txStatus.text }}>
                          {row.count} / {TRANSACTION_THRESHOLD}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${row.txPct}%`, backgroundColor: txStatus.bar }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Revenue</span>
                        <span className="font-semibold" style={{ color: revStatus.text }}>
                          ${row.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} / ${REVENUE_THRESHOLD.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${row.revPct}%`, backgroundColor: revStatus.bar }} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
