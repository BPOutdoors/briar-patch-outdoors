'use client'

import { useState } from 'react'

export default function IntegrationsPage() {
  const [syncingFull, setSyncingFull] = useState(false)
  const [syncingInventory, setSyncingInventory] = useState(false)
  const [fullResult, setFullResult] = useState<any>(null)
  const [inventoryResult, setInventoryResult] = useState<any>(null)
  const [lastFullSync, setLastFullSync] = useState<string | null>(null)
  const [lastInventorySync, setLastInventorySync] = useState<string | null>(null)

  async function triggerFullSync() {
    setSyncingFull(true)
    setFullResult(null)
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SYNC_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      })
      const result = await response.json()
      setFullResult(result)
      setLastFullSync(new Date().toLocaleString())
    } catch (error: any) {
      setFullResult({ success: false, error: error.message })
    }
    setSyncingFull(false)
  }

  async function triggerInventorySync() {
    setSyncingInventory(true)
    setInventoryResult(null)
    try {
      const response = await fetch('/api/sync/inventory', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SYNC_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      })
      const result = await response.json()
      setInventoryResult(result)
      setLastInventorySync(new Date().toLocaleString())
    } catch (error: any) {
      setInventoryResult({ success: false, error: error.message })
    }
    setSyncingInventory(false)
  }

  return (
    <div className="max-w-4xl space-y-6">

      {/* Kinsey's — Quick Inventory Sync */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
              Kinsey&apos;s — Inventory &amp; Price Sync
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Updates stock levels and pricing only. Fast — runs in under a minute.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold"
            style={{ backgroundColor: '#e6f4ea', color: '#2e7d32' }}>
            ✓ Connected
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5 p-4 rounded-lg"
          style={{ backgroundColor: 'var(--cream-dark)' }}>
          <div>
            <p className="text-xs text-gray-500 mb-1">Auto Schedule</p>
            <p className="text-sm font-semibold">Daily at 6 AM &amp; 6 PM</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">What it updates</p>
            <p className="text-sm font-semibold">Stock qty, cost, MAP price</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Last Manual Sync</p>
            <p className="text-sm font-semibold">{lastInventorySync || 'Auto-managed'}</p>
          </div>
        </div>

        <button
          onClick={triggerInventorySync}
          disabled={syncingInventory}
          className="px-6 py-3 rounded font-bold text-white transition-colors"
          style={{ backgroundColor: syncingInventory ? '#9ca3af' : 'var(--secondary)' }}
        >
          {syncingInventory ? '⏳ Syncing...' : '🔄 Run Inventory Sync Now'}
        </button>

        {inventoryResult && (
          <div className={`mt-4 p-4 rounded-lg ${inventoryResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {inventoryResult.success ? (
              <div>
                <p className="font-bold text-green-800 mb-2">✓ Inventory Sync Complete!</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Items Checked</p>
                    <p className="font-bold text-green-700">{inventoryResult.totalItems?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Updated</p>
                    <p className="font-bold text-green-700">{inventoryResult.updated?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Errors</p>
                    <p className="font-bold" style={{ color: inventoryResult.errors > 0 ? '#dc2626' : '#2e7d32' }}>
                      {inventoryResult.errors}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Completed at {new Date(inventoryResult.syncedAt).toLocaleString()}
                </p>
              </div>
            ) : (
              <div>
                <p className="font-bold text-red-800 mb-1">✗ Sync Failed</p>
                <p className="text-sm text-red-600">{inventoryResult.error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Kinsey's — Full Product Sync */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
              Kinsey&apos;s — Full Product Sync
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Imports the complete product catalog including new items, descriptions, and images. Takes a few minutes.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold"
            style={{ backgroundColor: '#e6f4ea', color: '#2e7d32' }}>
            ✓ Connected
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 rounded-lg"
          style={{ backgroundColor: 'var(--cream-dark)' }}>
          <div>
            <p className="text-xs text-gray-500 mb-1">Dealer Account</p>
            <p className="text-sm font-semibold">1004474</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Auto Schedule</p>
            <p className="text-sm font-semibold">Every Wednesday at 2 AM</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Last Manual Sync</p>
            <p className="text-sm font-semibold">{lastFullSync || 'Auto-managed'}</p>
          </div>
        </div>

        <div className="mb-5 p-4 rounded-lg border" style={{ borderColor: '#C4A882' }}>
          <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--primary)' }}>
            What this sync does:
          </h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>✓ Imports all products you are authorized to sell</li>
            <li>✓ Pulls your dealer cost, MSRP, and MAP pricing</li>
            <li>✓ Updates inventory levels from all warehouses</li>
            <li>✓ Marks which products are available for dropshipping</li>
            <li>✓ Skips inactive and blocked products</li>
          </ul>
        </div>

        <button
          onClick={triggerFullSync}
          disabled={syncingFull}
          className="px-6 py-3 rounded font-bold text-white transition-colors"
          style={{ backgroundColor: syncingFull ? '#9ca3af' : 'var(--primary)' }}
        >
          {syncingFull ? '⏳ Syncing... This may take a few minutes' : '🔄 Run Full Sync Now'}
        </button>

        {fullResult && (
          <div className={`mt-4 p-4 rounded-lg ${fullResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {fullResult.success ? (
              <div>
                <p className="font-bold text-green-800 mb-2">✓ Full Sync Completed!</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">From Kinsey&apos;s</p>
                    <p className="font-bold text-green-700">{fullResult.totalFromKinseys?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Active Products</p>
                    <p className="font-bold text-green-700">{fullResult.activeProducts?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Synced</p>
                    <p className="font-bold text-green-700">{fullResult.productsAdded?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Errors</p>
                    <p className="font-bold" style={{ color: fullResult.errors > 0 ? '#dc2626' : '#2e7d32' }}>
                      {fullResult.errors}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Completed at {new Date(fullResult.syncedAt).toLocaleString()}
                </p>
              </div>
            ) : (
              <div>
                <p className="font-bold text-red-800 mb-1">✗ Sync Failed</p>
                <p className="text-sm text-red-600">{fullResult.error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Future Distributors */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--primary)' }}>
          Additional Distributors
        </h2>
        <div className="space-y-3">
          {['Distributor 2', 'Distributor 3'].map((name) => (
            <div key={name} className="flex items-center justify-between p-4 rounded-lg"
              style={{ backgroundColor: 'var(--cream-dark)' }}>
              <div>
                <p className="font-semibold text-sm">{name}</p>
                <p className="text-xs text-gray-400">Pending API credentials</p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold"
                style={{ backgroundColor: '#fff3e0', color: '#e65100' }}>
                Not Connected
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4">
          Additional distributors can be connected once API credentials are received.
        </p>
      </div>

      {/* QuickBooks */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
              QuickBooks Integration
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Auto-sync daily sales and payouts to QuickBooks
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold"
            style={{ backgroundColor: '#fff3e0', color: '#e65100' }}>
            Not Connected
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Connect your QuickBooks account to automatically sync daily sales summaries and Stripe payouts.
          Once connected, you&apos;ll never have to manually enter sales data again.
        </p>
        <button
          className="px-6 py-3 rounded font-bold text-white"
          style={{ backgroundColor: '#2CA01C' }}
          onClick={() => alert('QuickBooks integration coming soon!')}
        >
          Connect QuickBooks
        </button>
      </div>

    </div>
  )
}
