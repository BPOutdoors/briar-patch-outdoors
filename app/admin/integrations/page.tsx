'use client'

import { useState } from 'react'

export default function IntegrationsPage() {
  const [syncingFull, setSyncingFull] = useState(false)
  const [syncingInventory, setSyncingInventory] = useState(false)
  const [syncingCategories, setSyncingCategories] = useState(false)
  const [syncingImages, setSyncingImages] = useState(false)
  const [fullResult, setFullResult] = useState<any>(null)
  const [inventoryResult, setInventoryResult] = useState<any>(null)
  const [categoriesResult, setCategoriesResult] = useState<any>(null)
  const [imagesResult, setImagesResult] = useState<any>(null)
  const [imageStatus, setImageStatus] = useState<any>(null)
  const [lastFullSync, setLastFullSync] = useState<string | null>(null)
  const [lastInventorySync, setLastInventorySync] = useState<string | null>(null)
  const [lastCategoriesSync, setLastCategoriesSync] = useState<string | null>(null)

  // All sync calls go through /api/admin/sync-trigger — keeps secret key server-side only
  async function triggerSync(action: string) {
    const response = await fetch('/api/admin/sync-trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    return response.json()
  }

  async function triggerFullSync() {
    setSyncingFull(true)
    setFullResult(null)
    try {
      const result = await triggerSync('full')
      setFullResult(result)
      setLastFullSync(new Date().toLocaleString())
    } catch (error: any) {
      setFullResult({ success: false, error: error.message })
    }
    setSyncingFull(false)
  }

  async function checkImageStatus() {
    const response = await fetch('/api/admin/sync-trigger', { method: 'GET' })
    const result = await response.json()
    setImageStatus(result)
  }

  async function triggerImageSync() {
    setSyncingImages(true)
    setImagesResult(null)
    try {
      const result = await triggerSync('images')
      setImagesResult(result)
      checkImageStatus()
    } catch (error: any) {
      setImagesResult({ success: false, error: error.message })
    }
    setSyncingImages(false)
  }

  async function triggerAutoImageSync() {
    setSyncingImages(true)
    setImagesResult(null)
    let totalDownloaded = 0
    let totalNotFound = 0
    let totalErrors = 0
    let remaining = 0
    let batches = 0

    try {
      while (true) {
        const result = await triggerSync('images')
        if (!result.success) throw new Error(result.error)

        totalDownloaded += result.downloaded
        totalNotFound += result.notFound
        totalErrors += result.errors
        remaining = result.remainingWithoutImages
        batches++

        setImagesResult({
          success: true,
          downloaded: totalDownloaded,
          notFound: totalNotFound,
          errors: totalErrors,
          remainingWithoutImages: remaining,
          batches,
          keepRunning: result.keepRunning,
          autoRunning: result.keepRunning,
        })

        if (!result.keepRunning) break
        await new Promise(r => setTimeout(r, 1000))
      }
    } catch (error: any) {
      setImagesResult((prev: any) => ({ ...prev, error: error.message, autoRunning: false }))
    }

    checkImageStatus()
    setSyncingImages(false)
  }

  async function triggerCategoriesSync() {
    setSyncingCategories(true)
    setCategoriesResult(null)
    try {
      const result = await triggerSync('categories')
      setCategoriesResult(result)
      setLastCategoriesSync(new Date().toLocaleString())
    } catch (error: any) {
      setCategoriesResult({ success: false, error: error.message })
    }
    setSyncingCategories(false)
  }

  async function triggerInventorySync() {
    setSyncingInventory(true)
    setInventoryResult(null)
    try {
      const result = await triggerSync('inventory')
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
            <p className="text-sm font-semibold">****474</p>
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

      {/* Kinsey's — Category Names Sync */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
              Kinsey&apos;s — Category Names Sync
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Downloads the category lookup file from Kinsey&apos;s FTP and maps all products to human-readable category names.
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
            <p className="text-xs text-gray-500 mb-1">Source</p>
            <p className="text-sm font-semibold">Kinsey&apos;s FTP</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">What it updates</p>
            <p className="text-sm font-semibold">Category &amp; group names on all products</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Last Run</p>
            <p className="text-sm font-semibold">{lastCategoriesSync || 'Run manually as needed'}</p>
          </div>
        </div>

        <button
          onClick={triggerCategoriesSync}
          disabled={syncingCategories}
          className="px-6 py-3 rounded font-bold text-white transition-colors"
          style={{ backgroundColor: syncingCategories ? '#9ca3af' : '#5c6bc0' }}
        >
          {syncingCategories ? '⏳ Syncing Categories...' : '🏷️ Sync Category Names Now'}
        </button>

        {categoriesResult && (
          <div className={`mt-4 p-4 rounded-lg ${categoriesResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {categoriesResult.success ? (
              <div>
                <p className="font-bold text-green-800 mb-2">✓ Categories Synced!</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Categories</p>
                    <p className="font-bold text-green-700">{categoriesResult.categoriesFound}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Groups</p>
                    <p className="font-bold text-green-700">{categoriesResult.groupsFound}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Products Updated</p>
                    <p className="font-bold text-green-700">{categoriesResult.productsUpdated?.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <p className="font-bold text-red-800 mb-1">✗ Sync Failed</p>
                <p className="text-sm text-red-600">{categoriesResult.error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Kinsey's — Image Sync */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
              Kinsey&apos;s — Product Image Sync
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Downloads product images from Kinsey&apos;s FTP and stores them in Supabase. Runs in batches of 50 — click multiple times to continue syncing.
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
            <p className="text-xs text-gray-500 mb-1">Source</p>
            <p className="text-sm font-semibold">Kinsey&apos;s FTP · 1024×1024 Images</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">With Images</p>
            <p className="text-sm font-semibold text-green-700">{imageStatus ? imageStatus.withImages?.toLocaleString() : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Still Needed</p>
            <p className="text-sm font-semibold text-orange-600">{imageStatus ? imageStatus.withoutImages?.toLocaleString() : '—'}</p>
          </div>
        </div>

        <div className="flex gap-3 mb-4 flex-wrap">
          <button
            onClick={triggerAutoImageSync}
            disabled={syncingImages}
            className="px-6 py-3 rounded font-bold text-white transition-colors"
            style={{ backgroundColor: syncingImages ? '#9ca3af' : '#b45309' }}
          >
            {syncingImages ? '⏳ Auto-Syncing All Images...' : '🖼️ Auto-Sync All Images'}
          </button>
          <button
            onClick={triggerImageSync}
            disabled={syncingImages}
            className="px-4 py-3 rounded font-semibold border text-sm transition-colors hover:bg-gray-50"
            style={{ borderColor: '#b45309', color: '#b45309' }}
          >
            Sync Next 50 Only
          </button>
          <button
            onClick={checkImageStatus}
            className="px-4 py-3 rounded font-semibold border text-sm transition-colors hover:bg-gray-50"
            style={{ borderColor: '#ddd', color: '#666' }}
          >
            Check Status
          </button>
        </div>

        {imagesResult && (
          <div className={`p-4 rounded-lg ${imagesResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {imagesResult.success ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <p className="font-bold text-green-800">
                    {imagesResult.autoRunning ? '⏳ Auto-sync in progress...' : '✓ Sync Complete'}
                  </p>
                  {imagesResult.batches > 1 && (
                    <span className="text-xs text-gray-500">{imagesResult.batches} batches run</span>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><p className="text-gray-500">Downloaded</p><p className="font-bold text-green-700">{imagesResult.downloaded?.toLocaleString()}</p></div>
                  <div><p className="text-gray-500">Not on FTP</p><p className="font-bold text-gray-600">{imagesResult.notFound?.toLocaleString()}</p></div>
                  <div><p className="text-gray-500">Errors</p><p className="font-bold" style={{ color: imagesResult.errors > 0 ? '#dc2626' : '#2e7d32' }}>{imagesResult.errors}</p></div>
                  <div><p className="text-gray-500">Still Remaining</p><p className="font-bold text-orange-600">{imagesResult.remainingWithoutImages?.toLocaleString()}</p></div>
                </div>
                {!imagesResult.autoRunning && !imagesResult.keepRunning && (
                  <p className="text-xs text-green-600 mt-2 font-semibold">
                    ✓ All available images have been synced!
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p className="font-bold text-red-800 mb-1">✗ Sync Failed</p>
                <p className="text-sm text-red-600">{imagesResult.error}</p>
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
