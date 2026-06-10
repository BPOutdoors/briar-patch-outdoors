'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [storeFilter, setStoreFilter] = useState('all')
  const [visibilityFilter, setVisibilityFilter] = useState('all')
  const [categories, setCategories] = useState<string[]>([])
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize, setPageSize] = useState(50)

  const fetchProducts = useCallback(async (pageNum = 0, size = pageSize, searchTerm = search) => {
    setLoading(true)
    const from = pageNum * size
    const to = from + size - 1

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .order('name')
      .range(from, to)

    if (searchTerm) {
      query = query.or(
        `name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%,kinsey_sku.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%`
      )
    }
    if (categoryFilter !== 'all') query = query.eq('category', categoryFilter)
    if (storeFilter === 'instore') query = query.eq('in_store', true)
    if (storeFilter === 'online') query = query.eq('in_store', false)
    if (visibilityFilter === 'visible') query = query.eq('visible', true)
    if (visibilityFilter === 'hidden') query = query.eq('visible', false)

    const { data, count } = await query

    if (data) {
      setProducts(data)
      setTotalCount(count || 0)

      if (pageNum === 0 && categoryFilter === 'all' && !searchTerm) {
        const { data: catData } = await supabase
          .from('products')
          .select('category')
          .not('category', 'is', null)
        if (catData) {
          const cats = [...new Set(catData.map((p: any) => p.category))] as string[]
          setCategories(cats.sort())
        }
      }
    }
    setLoading(false)
  }, [categoryFilter, storeFilter, visibilityFilter, pageSize])

  // Live search — fires 400ms after typing stops, requires 0 or 3+ chars
  useEffect(() => {
    if (search.length === 0 || search.length >= 3) {
      const timer = setTimeout(() => {
        setCurrentPage(0)
        fetchProducts(0, pageSize, search)
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [search])

  useEffect(() => {
    fetchProducts(currentPage, pageSize, search)
  }, [currentPage, categoryFilter, storeFilter, visibilityFilter, pageSize])

  function handleSearch() {
    setCurrentPage(0)
    fetchProducts(0, pageSize, search)
  }

  function handlePageSizeChange(newSize: number) {
    setPageSize(newSize)
    setCurrentPage(0)
  }

  async function toggleVisibility(product: any) {
    const { error } = await supabase
      .from('products')
      .update({ visible: !product.visible })
      .eq('id', product.id)
    if (!error) {
      setProducts(products.map(p => p.id === product.id ? { ...p, visible: !p.visible } : p))
    }
  }

  async function toggleInStore(product: any) {
    const { error } = await supabase
      .from('products')
      .update({ in_store: !product.in_store })
      .eq('id', product.id)
    if (!error) {
      setProducts(products.map(p => p.id === product.id ? { ...p, in_store: !p.in_store } : p))
    }
  }

  async function saveProduct() {
    if (!editingProduct) return
    setSaving(true)
    const { error } = await supabase
      .from('products')
      .update({
        display_price: editingProduct.display_price,
        sale_price: editingProduct.sale_price,
        visible: editingProduct.visible,
        in_store: editingProduct.in_store,
        low_stock_threshold: editingProduct.low_stock_threshold,
      })
      .eq('id', editingProduct.id)
    if (!error) {
      setProducts(products.map(p => p.id === editingProduct.id ? editingProduct : p))
      setMessage('Product saved!')
      setTimeout(() => setMessage(''), 3000)
      setEditingProduct(null)
    }
    setSaving(false)
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div>
      {message && (
        <div className="mb-4 p-3 rounded text-sm font-semibold text-white" style={{ backgroundColor: 'var(--secondary)' }}>
          {message}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search products, brands, SKUs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className="border rounded px-4 py-2 text-sm flex-1 min-w-56"
        />
        <button
          onClick={handleSearch}
          className="px-4 py-2 rounded text-sm font-semibold text-white"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          Search
        </button>
        <select
          value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value); setCurrentPage(0) }}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="all">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          value={storeFilter}
          onChange={e => { setStoreFilter(e.target.value); setCurrentPage(0) }}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="all">All Products</option>
          <option value="instore">In-Store Only</option>
          <option value="online">Online Only</option>
        </select>
        <select
          value={visibilityFilter}
          onChange={e => { setVisibilityFilter(e.target.value); setCurrentPage(0) }}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="all">All Visibility</option>
          <option value="visible">Visible</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>

      {/* Legend + Count */}
      <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
        <div className="flex gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#4A5E2F' }}></span>
            In-Store = low stock alerts active
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#C4842A' }}></span>
            Online Only = no low stock alerts
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{totalCount.toLocaleString()} products total</span>
          <span>|</span>
          <span>Show:</span>
          {[20, 50, 75, 100].map(size => (
            <button
              key={size}
              onClick={() => handlePageSizeChange(size)}
              className="px-2 py-1 rounded text-xs font-semibold border transition-colors"
              style={{
                backgroundColor: pageSize === size ? 'var(--primary)' : 'white',
                color: pageSize === size ? 'white' : 'var(--primary)',
                borderColor: 'var(--primary)',
              }}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No products found. Products will appear here after Kinsey&apos;s sync.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: 'var(--cream-dark)' }}>
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">Product</th>
                <th className="px-4 py-3 font-semibold text-gray-600">SKU</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Cost</th>
                <th className="px-4 py-3 font-semibold text-gray-600">MSRP</th>
                <th className="px-4 py-3 font-semibold text-gray-600">MAP</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Your Price</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Stock</th>
                <th className="px-4 py-3 font-semibold text-gray-600">In Store</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Visible</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.image_url && (
                        <img src={product.image_url} alt={product.name} className="w-10 h-10 object-cover rounded" />
                      )}
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-gray-400 text-xs">{product.brand}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{product.kinsey_sku}</td>
                  <td className="px-4 py-3">${(product.cost || 0).toFixed(2)}</td>
                  <td className="px-4 py-3">${(product.msrp || 0).toFixed(2)}</td>
                  <td className="px-4 py-3">${(product.map_price || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--primary)' }}>
                    ${(product.display_price || product.msrp || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded text-xs font-semibold"
                      style={{
                        backgroundColor: product.quantity > 5 ? '#e6f4ea' : product.in_store ? '#fee2e2' : '#f3f4f6',
                        color: product.quantity > 5 ? '#2e7d32' : product.in_store ? '#dc2626' : '#6b7280'
                      }}>
                      {product.quantity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleInStore(product)}
                      className="px-3 py-1 rounded text-xs font-semibold transition-colors"
                      style={{
                        backgroundColor: product.in_store ? '#e6f4ea' : '#f3f4f6',
                        color: product.in_store ? '#2e7d32' : '#6b7280'
                      }}
                    >
                      {product.in_store ? '✓ In Store' : 'Online Only'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleVisibility(product)}
                      className="px-3 py-1 rounded text-xs font-semibold transition-colors"
                      style={{
                        backgroundColor: product.visible ? '#e6f4ea' : '#fee2e2',
                        color: product.visible ? '#2e7d32' : '#dc2626'
                      }}
                    >
                      {product.visible ? 'Visible' : 'Hidden'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setEditingProduct({ ...product })}
                      className="px-3 py-1 rounded text-xs font-semibold text-white"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, totalCount)} of {totalCount.toLocaleString()} products
          </p>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setCurrentPage(0)}
              disabled={currentPage === 0}
              className="px-3 py-1 rounded text-sm font-semibold border disabled:opacity-40"
              style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
            >
              «
            </button>
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
            <button
              onClick={() => setCurrentPage(totalPages - 1)}
              disabled={currentPage >= totalPages - 1}
              className="px-3 py-1 rounded text-sm font-semibold border disabled:opacity-40"
              style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
            >
              »
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--primary)' }}>
              Edit Product
            </h2>
            <p className="text-sm text-gray-500 mb-4">{editingProduct.name}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">
                  Display Price (shown on website)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editingProduct.display_price || ''}
                  onChange={e => setEditingProduct({ ...editingProduct, display_price: parseFloat(e.target.value) })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder={`MAP: $${editingProduct.map_price} | MSRP: $${editingProduct.msrp}`}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Cost: ${editingProduct.cost} | MAP: ${editingProduct.map_price} | MSRP: ${editingProduct.msrp}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">
                  Sale Price (optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editingProduct.sale_price || ''}
                  onChange={e => setEditingProduct({ ...editingProduct, sale_price: parseFloat(e.target.value) })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="Leave blank if not on sale"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingProduct.in_store || false}
                  onChange={e => setEditingProduct({ ...editingProduct, in_store: e.target.checked })}
                  id="in_store"
                />
                <label htmlFor="in_store" className="text-sm font-semibold text-gray-600">
                  Available In Store (enables low stock alerts)
                </label>
              </div>

              {editingProduct.in_store && (
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">
                    Low Stock Alert Threshold
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingProduct.low_stock_threshold || 5}
                    onChange={e => setEditingProduct({ ...editingProduct, low_stock_threshold: parseInt(e.target.value) })}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Alert when quantity drops to or below this number
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingProduct.visible}
                  onChange={e => setEditingProduct({ ...editingProduct, visible: e.target.checked })}
                  id="visible"
                />
                <label htmlFor="visible" className="text-sm font-semibold text-gray-600">
                  Visible on website
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={saveProduct}
                disabled={saving}
                className="flex-1 py-2 rounded font-bold text-white text-sm"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditingProduct(null)}
                className="flex-1 py-2 rounded font-bold text-sm"
                style={{ backgroundColor: 'var(--cream-dark)', color: 'var(--primary)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
