'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ProductDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<any>(null)
  const [distributors, setDistributors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  // Editable fields
  const [displayPrice, setDisplayPrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [visible, setVisible] = useState(false)
  const [inStore, setInStore] = useState(false)
  const [requiresFfl, setRequiresFfl] = useState(false)
  const [lowStockThreshold, setLowStockThreshold] = useState(5)
  const [websiteCategory, setWebsiteCategory] = useState('')
  const [websiteSubcategory, setWebsiteSubcategory] = useState('')
  const [websiteCategories, setWebsiteCategories] = useState<string[]>([])

  useEffect(() => {
    fetchProduct()
    fetchWebsiteCategories()
  }, [id])

  async function fetchProduct() {
    setLoading(true)

    const { data: prod } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()

    if (prod) {
      setProduct(prod)
      setDisplayPrice(prod.display_price?.toString() || '')
      setSalePrice(prod.sale_price?.toString() || '')
      setVisible(prod.visible ?? true)
      setInStore(prod.in_store ?? false)
      setRequiresFfl(prod.requires_ffl ?? false)
      setLowStockThreshold(prod.low_stock_threshold ?? 5)
      setWebsiteCategory(prod.website_category || '')
      setWebsiteSubcategory(prod.website_subcategory || '')
    }

    // Fetch distributor info for this product
    const { data: distData } = await supabase
      .from('product_distributors')
      .select('*, distributors(name, code)')
      .eq('product_id', id)
      .order('cost', { ascending: true })

    if (distData) setDistributors(distData)

    setLoading(false)
  }

  async function fetchWebsiteCategories() {
    const { data } = await supabase
      .from('products')
      .select('website_category')
      .not('website_category', 'is', null)
      .neq('website_category', '')
    if (data) {
      const cats = [...new Set(data.map((p: any) => p.website_category))] as string[]
      setWebsiteCategories(cats.sort())
    }
  }

  async function saveProduct() {
    setSaving(true)
    const { error } = await supabase
      .from('products')
      .update({
        display_price: displayPrice ? parseFloat(displayPrice) : null,
        sale_price: salePrice ? parseFloat(salePrice) : null,
        visible,
        in_store: inStore,
        requires_ffl: requiresFfl,
        low_stock_threshold: lowStockThreshold,
        website_category: websiteCategory || null,
        website_subcategory: websiteSubcategory || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      showMessage('Error saving product', 'error')
    } else {
      showMessage('Product saved successfully!', 'success')
      fetchProduct()
    }
    setSaving(false)
  }

  function showMessage(msg: string, type: 'success' | 'error' = 'success') {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(''), 4000)
  }

  // Find the best (lowest cost) distributor
  const bestDistributor = distributors.length > 0 ? distributors[0] : null

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading product...</div>
  }

  if (!product) {
    return <div className="p-8 text-center text-gray-400">Product not found.</div>
  }

  const effectivePrice = product.display_price || product.map_price || product.msrp

  return (
    <div className="max-w-5xl">

      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm font-semibold mb-6 hover:opacity-70 transition-opacity"
        style={{ color: 'var(--primary)' }}
      >
        ← Back to Products
      </button>

      {message && (
        <div className={`mb-5 p-3 rounded text-sm font-semibold text-white`}
          style={{ backgroundColor: messageType === 'success' ? 'var(--secondary)' : '#dc2626' }}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT — Image + Quick Stats */}
        <div className="space-y-4">

          {/* Product Image */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full object-contain p-4"
                style={{ maxHeight: '280px' }}
              />
            ) : (
              <div className="flex items-center justify-center h-56 text-gray-300"
                style={{ backgroundColor: 'var(--cream-dark)' }}>
                <div className="text-center">
                  <div className="text-5xl mb-2">📦</div>
                  <p className="text-xs text-gray-400">No image yet</p>
                  <p className="text-xs text-gray-300 mt-1">Images sync from Kinsey&apos;s FTP</p>
                </div>
              </div>
            )}
          </div>

          {/* Status Badges */}
          <div className="bg-white rounded-lg shadow p-4 space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Status</h3>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 rounded text-xs font-bold"
                style={{ backgroundColor: product.in_stock ? '#e6f4ea' : '#fee2e2', color: product.in_stock ? '#2e7d32' : '#dc2626' }}>
                {product.in_stock ? '✓ In Stock' : '✗ Out of Stock'}
              </span>
              <span className="px-2 py-1 rounded text-xs font-bold"
                style={{ backgroundColor: product.visible ? '#e6f4ea' : '#f3f4f6', color: product.visible ? '#2e7d32' : '#6b7280' }}>
                {product.visible ? '✓ Visible' : 'Hidden'}
              </span>
              {product.requires_ffl && (
                <span className="px-2 py-1 rounded text-xs font-bold"
                  style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
                  FFL Required
                </span>
              )}
              {product.in_store && (
                <span className="px-2 py-1 rounded text-xs font-bold"
                  style={{ backgroundColor: '#e3f2fd', color: '#1565c0' }}>
                  🏪 In Store
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500">
              <span className="font-semibold">{product.quantity ?? 0}</span> units in stock
            </div>
          </div>

          {/* Kinsey's Codes */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Kinsey&apos;s Classification</h3>
            <div className="space-y-2.5 text-sm">
              <div>
                <p className="text-xs text-gray-400">Category</p>
                <p className="font-semibold">{product.category_name || '—'}</p>
                {product.category && <p className="text-xs font-mono text-gray-400">Code: {product.category}</p>}
              </div>
              <div>
                <p className="text-xs text-gray-400">Group</p>
                <p className="font-semibold">{product.product_group_name || '—'}</p>
                {product.product_group_code && <p className="text-xs font-mono text-gray-400">Code: {product.product_group_code}</p>}
              </div>
              <div>
                <p className="text-xs text-gray-400">Sub Group 1</p>
                <p className="font-semibold">{product.sub_group_1_name || '—'}</p>
                {product.product_sub_group_1 && <p className="text-xs font-mono text-gray-400">Code: {product.product_sub_group_1}</p>}
              </div>
              <div>
                <p className="text-xs text-gray-400">Sub Group 2</p>
                <p className="font-semibold">{product.sub_group_2_name || '—'}</p>
                {product.product_sub_group_2 && <p className="text-xs font-mono text-gray-400">Code: {product.product_sub_group_2}</p>}
              </div>
              <div className="pt-1 border-t">
                <div className="flex justify-between">
                  <span className="text-gray-400">SKU</span>
                  <span className="font-mono font-semibold">{product.kinsey_sku || '—'}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-400">UPC</span>
                  <span className="font-mono font-semibold">{product.upc || '—'}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT — Main Info */}
        <div className="lg:col-span-2 space-y-5">

          {/* Product Header */}
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--accent)' }}>{product.brand}</p>
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--primary)' }}>{product.name}</h1>
            {(product.category_name || product.product_group_name) && (
              <p className="text-xs text-gray-400 mb-3">
                {[product.category_name, product.product_group_name, product.sub_group_1_name]
                  .filter(Boolean).join(' › ')}
              </p>
            )}
            {product.description && (
              <p className="text-gray-600 text-sm leading-relaxed">{product.description}</p>
            )}
          </div>

          {/* Distributor Comparison */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--primary)' }}>
              Distributor Pricing
            </h2>
            {distributors.length === 0 ? (
              <p className="text-sm text-gray-400">No distributor data yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="pb-2 font-semibold text-gray-500">Distributor</th>
                    <th className="pb-2 font-semibold text-gray-500">Your Cost</th>
                    <th className="pb-2 font-semibold text-gray-500">Stock</th>
                    <th className="pb-2 font-semibold text-gray-500">Dropship</th>
                    <th className="pb-2 font-semibold text-gray-500">Last Synced</th>
                  </tr>
                </thead>
                <tbody>
                  {distributors.map((d, idx) => (
                    <tr key={d.id} className="border-b last:border-0">
                      <td className="py-2.5 font-semibold">
                        <div className="flex items-center gap-2">
                          {d.distributors?.name || 'Unknown'}
                          {idx === 0 && distributors.length > 1 && (
                            <span className="text-xs px-1.5 py-0.5 rounded font-bold"
                              style={{ backgroundColor: '#e6f4ea', color: '#2e7d32' }}>
                              Best Price
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 font-bold" style={{ color: idx === 0 ? 'var(--secondary)' : 'inherit' }}>
                        {d.cost ? `$${d.cost.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold"
                          style={{ backgroundColor: d.in_stock ? '#e6f4ea' : '#fee2e2', color: d.in_stock ? '#2e7d32' : '#dc2626' }}>
                          {d.stock_quantity ?? 0} units
                        </span>
                      </td>
                      <td className="py-2.5">
                        {d.dropship_available ? (
                          <span className="text-xs font-semibold text-blue-600">✓ Available</span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 text-xs text-gray-400">
                        {d.last_synced_at ? new Date(d.last_synced_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {bestDistributor && (
              <p className="text-xs text-gray-400 mt-3">
                ✓ Your price is automatically sourced from the lowest-cost distributor ({bestDistributor.distributors?.name})
              </p>
            )}
          </div>

          {/* Pricing */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--primary)' }}>Pricing</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5 p-4 rounded-lg"
              style={{ backgroundColor: 'var(--cream-dark)' }}>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Your Cost</p>
                <p className="font-bold text-sm">{product.cost ? `$${product.cost.toFixed(2)}` : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">MAP Price</p>
                <p className="font-bold text-sm">{product.map_price ? `$${product.map_price.toFixed(2)}` : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">MSRP</p>
                <p className="font-bold text-sm">{product.msrp ? `$${product.msrp.toFixed(2)}` : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Margin</p>
                <p className="font-bold text-sm" style={{ color: 'var(--secondary)' }}>
                  {product.cost && effectivePrice
                    ? `${(((effectivePrice - product.cost) / effectivePrice) * 100).toFixed(0)}%`
                    : '—'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Your Selling Price
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={displayPrice}
                  onChange={e => setDisplayPrice(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder={`Default: MAP $${product.map_price?.toFixed(2) || product.msrp?.toFixed(2) || '—'}`}
                />
                <p className="text-xs text-gray-400 mt-1">Leave blank to use MAP price automatically</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Sale Price <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={salePrice}
                  onChange={e => setSalePrice(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="Leave blank if not on sale"
                />
              </div>
            </div>
          </div>

          {/* Website Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--primary)' }}>Website Settings</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Website Category</label>
                <input
                  type="text"
                  value={websiteCategory}
                  onChange={e => setWebsiteCategory(e.target.value)}
                  list="website-categories"
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="e.g. Archery, Hunting, Camping..."
                />
                <datalist id="website-categories">
                  {websiteCategories.map(c => <option key={c} value={c} />)}
                </datalist>
                <p className="text-xs text-gray-400 mt-1">Controls which section of the shop this appears in</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Website Subcategory</label>
                <input
                  type="text"
                  value={websiteSubcategory}
                  onChange={e => setWebsiteSubcategory(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="e.g. Bow Sights, Broadheads..."
                />
                <p className="text-xs text-gray-400 mt-1">Optional finer grouping within the category</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)}
                    className="w-4 h-4" />
                  <div>
                    <p className="text-sm font-semibold">Visible on website</p>
                    <p className="text-xs text-gray-400">Customers can see and buy this product</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={inStore} onChange={e => setInStore(e.target.checked)}
                    className="w-4 h-4" />
                  <div>
                    <p className="text-sm font-semibold">Available in store</p>
                    <p className="text-xs text-gray-400">Enables low stock alerts for this item</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={requiresFfl} onChange={e => setRequiresFfl(e.target.checked)}
                    className="w-4 h-4" />
                  <div>
                    <p className="text-sm font-semibold text-red-600">Requires FFL</p>
                    <p className="text-xs text-gray-400">Hides product and marks as FFL-required</p>
                  </div>
                </label>
              </div>
              {inStore && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Low Stock Alert Threshold</label>
                  <input
                    type="number"
                    min="1"
                    value={lowStockThreshold}
                    onChange={e => setLowStockThreshold(parseInt(e.target.value))}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">Alert when qty drops to or below this number</p>
                </div>
              )}
            </div>

            <button
              onClick={saveProduct}
              disabled={saving}
              className="w-full py-3 rounded font-bold text-white transition-colors"
              style={{ backgroundColor: saving ? '#9ca3af' : 'var(--primary)' }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
