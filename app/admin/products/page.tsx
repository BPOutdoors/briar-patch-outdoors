'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ProductsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(() => searchParams.get('q') || '')
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get('cat') || 'all')
  const [storeFilter, setStoreFilter] = useState(() => searchParams.get('store') || 'all')
  const [visibilityFilter, setVisibilityFilter] = useState(() => searchParams.get('vis') || 'all')
  const [fflFilter, setFflFilter] = useState(() => searchParams.get('ffl') || 'all')
  const [categories, setCategories] = useState<string[]>([])
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [typeFilter, setTypeFilter] = useState(() => searchParams.get('type') || 'all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    product_type: 'manual' as 'manual' | 'labor',
    name: '',
    brand: '',
    description: '',
    display_price: '',
    cost: '',
    quantity: '0',
    broad_category: 'accessories',
    category_name: '',
    visible: true,
    in_store: true,
  })
  const [currentPage, setCurrentPage] = useState(() => parseInt(searchParams.get('page') || '0'))
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize, setPageSize] = useState(50)

  function pushParams(overrides: Record<string, string | number> = {}) {
    const state: Record<string, string | number> = {
      q: search, cat: categoryFilter, store: storeFilter,
      vis: visibilityFilter, ffl: fflFilter, type: typeFilter, page: currentPage,
      ...overrides,
    }
    const params = new URLSearchParams()
    Object.entries(state).forEach(([k, v]) => {
      if (v !== '' && v !== 'all' && v !== 0) params.set(k, String(v))
    })
    const qs = params.toString()
    router.replace(`/admin/products${qs ? '?' + qs : ''}`, { scroll: false })
  }

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
        `name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%,kinsey_sku.ilike.%${searchTerm}%,category_name.ilike.%${searchTerm}%`
      )
    }
    if (categoryFilter !== 'all') query = query.eq('category_name', categoryFilter)
    if (storeFilter === 'instore') query = query.eq('in_store', true)
    if (storeFilter === 'online') query = query.eq('in_store', false)
    if (visibilityFilter === 'visible') query = query.eq('visible', true)
    if (visibilityFilter === 'hidden') query = query.eq('visible', false)
    if (fflFilter === 'ffl') query = query.eq('requires_ffl', true)
    if (fflFilter === 'no_ffl') query = query.eq('requires_ffl', false)
    if (typeFilter === 'manual') query = query.eq('product_type', 'manual')
    else if (typeFilter === 'labor') query = query.eq('product_type', 'labor')
    else if (typeFilter === 'distributor') query = query.eq('product_type', 'distributor')

    const { data, count } = await query

    if (data) {
      setProducts(data)
      setTotalCount(count || 0)

      if (pageNum === 0 && categoryFilter === 'all' && !searchTerm) {
        const { data: catData } = await supabase
          .from('products')
          .select('category_name')
          .not('category_name', 'is', null)
        if (catData) {
          const cats = [...new Set(catData.map((p: any) => p.category_name))] as string[]
          setCategories(cats.sort())
        }
      }
    }
    setLoading(false)
  }, [categoryFilter, storeFilter, visibilityFilter, fflFilter, typeFilter, pageSize])

  // Live search — fires 400ms after typing stops, requires 0 or 3+ chars
  useEffect(() => {
    if (search.length === 0 || search.length >= 3) {
      const timer = setTimeout(() => {
        setCurrentPage(0)
        fetchProducts(0, pageSize, search)
        pushParams({ q: search, page: 0 })
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [search])

  useEffect(() => {
    fetchProducts(currentPage, pageSize, search)
  }, [currentPage, categoryFilter, storeFilter, visibilityFilter, fflFilter, typeFilter, pageSize])

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

  async function createProduct() {
    if (!createForm.name || !createForm.display_price) {
      alert('Name and price are required'); return
    }
    setCreating(true)
    const payload: any = {
      product_type: createForm.product_type,
      name: createForm.name.trim(),
      brand: createForm.brand.trim() || null,
      description: createForm.description.trim() || null,
      display_price: parseFloat(createForm.display_price),
      cost: createForm.cost ? parseFloat(createForm.cost) : null,
      visible: createForm.visible,
      in_store: createForm.product_type === 'manual' ? createForm.in_store : false,
      requires_ffl: false,
      in_stock: createForm.product_type === 'manual' ? parseInt(createForm.quantity) > 0 : true,
      quantity: createForm.product_type === 'manual' ? parseInt(createForm.quantity) : null,
      broad_category: createForm.product_type === 'manual' ? createForm.broad_category : 'services',
      category_name: createForm.category_name.trim() || (createForm.product_type === 'labor' ? 'Services' : null),
    }
    const { error } = await supabase.from('products').insert(payload)
    if (error) {
      alert('Error creating product: ' + error.message)
    } else {
      setMessage(`${createForm.product_type === 'labor' ? 'Service' : 'Product'} "${createForm.name}" created!`)
      setTimeout(() => setMessage(''), 4000)
      setShowCreateModal(false)
      setCreateForm({ product_type: 'manual', name: '', brand: '', description: '', display_price: '', cost: '', quantity: '0', broad_category: 'accessories', category_name: '', visible: true, in_store: true })
      fetchProducts(0, pageSize, search)
    }
    setCreating(false)
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
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 rounded text-sm font-bold text-white ml-auto"
          style={{ backgroundColor: 'var(--secondary)' }}
        >
          + New Product
        </button>
        <select
          value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value); setCurrentPage(0); pushParams({ cat: e.target.value, page: 0 }) }}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="all">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          value={storeFilter}
          onChange={e => { setStoreFilter(e.target.value); setCurrentPage(0); pushParams({ store: e.target.value, page: 0 }) }}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="all">All Products</option>
          <option value="instore">In-Store Only</option>
          <option value="online">Online Only</option>
        </select>
        <select
          value={visibilityFilter}
          onChange={e => { setVisibilityFilter(e.target.value); setCurrentPage(0); pushParams({ vis: e.target.value, page: 0 }) }}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="all">All Visibility</option>
          <option value="visible">Visible</option>
          <option value="hidden">Hidden</option>
        </select>
        <select
          value={fflFilter}
          onChange={e => { setFflFilter(e.target.value); setCurrentPage(0); pushParams({ ffl: e.target.value, page: 0 }) }}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="all">All Items</option>
          <option value="no_ffl">Non-FFL Only</option>
          <option value="ffl">FFL Required</option>
        </select>
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setCurrentPage(0); pushParams({ type: e.target.value, page: 0 }) }}
          className="border rounded px-3 py-2 text-sm font-semibold"
          style={{ borderColor: typeFilter !== 'all' ? 'var(--primary)' : undefined }}
        >
          <option value="all">All Types</option>
          <option value="distributor">Distributor (Kinsey's)</option>
          <option value="manual">Manual Products</option>
          <option value="labor">Services / Labor</option>
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
                      {product.image_url && product.image_url !== 'none' && (
                        <img src={product.image_url} alt={product.name} className="w-10 h-10 object-cover rounded" />
                      )}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{product.name}</p>
                          {product.requires_ffl && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>FFL</span>
                          )}
                          {product.product_type === 'manual' && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>Manual</span>
                          )}
                          {product.product_type === 'labor' && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>Service</span>
                          )}
                        </div>
                        <p className="text-gray-400 text-xs">{product.brand}</p>
                        {product.category_name && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--secondary)' }}>{product.category_name}{product.product_group_name ? ` › ${product.product_group_name}` : ''}</p>
                        )}
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
                      onClick={() => router.push(`/admin/products/${product.id}`)}
                      className="px-3 py-1 rounded text-xs font-semibold text-white"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      View
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
              onClick={() => { setCurrentPage(0); pushParams({ page: 0 }) }}
              disabled={currentPage === 0}
              className="px-3 py-1 rounded text-sm font-semibold border disabled:opacity-40"
              style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
            >
              «
            </button>
            <button
              onClick={() => { const p = Math.max(0, currentPage - 1); setCurrentPage(p); pushParams({ page: p }) }}
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
              onClick={() => { const p = Math.min(totalPages - 1, currentPage + 1); setCurrentPage(p); pushParams({ page: p }) }}
              disabled={currentPage >= totalPages - 1}
              className="px-3 py-1 rounded text-sm font-semibold border disabled:opacity-40"
              style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
            >
              Next →
            </button>
            <button
              onClick={() => { const p = totalPages - 1; setCurrentPage(p); pushParams({ page: p }) }}
              disabled={currentPage >= totalPages - 1}
              className="px-3 py-1 rounded text-sm font-semibold border disabled:opacity-40"
              style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
            >
              »
            </button>
          </div>
        </div>
      )}

      {/* Create Product Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold" style={{ color: 'var(--primary)' }}>New Product</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 text-2xl leading-none">×</button>
              </div>

              {/* Type toggle */}
              <div className="grid grid-cols-2 gap-2 mb-5">
                {[
                  { value: 'manual', label: '📦 Manual Product', sub: 'Physical item with inventory' },
                  { value: 'labor', label: '🔧 Service / Labor', sub: 'Bow work, arrow building, etc.' },
                ].map(opt => (
                  <button key={opt.value}
                    onClick={() => setCreateForm(f => ({ ...f, product_type: opt.value as any }))}
                    className="p-3 rounded-lg border text-left transition-all"
                    style={{
                      borderColor: createForm.product_type === opt.value ? 'var(--primary)' : '#ddd',
                      backgroundColor: createForm.product_type === opt.value ? '#f0f4ea' : 'white',
                    }}>
                    <p className="text-sm font-bold">{opt.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{opt.sub}</p>
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    {createForm.product_type === 'labor' ? 'Service Name' : 'Product Name'} *
                  </label>
                  <input type="text" value={createForm.name}
                    onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                    placeholder={createForm.product_type === 'labor' ? 'e.g. Bow Press Service, Arrow Building' : 'Product name'}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm" />
                </div>

                {createForm.product_type === 'manual' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Brand</label>
                    <input type="text" value={createForm.brand}
                      onChange={e => setCreateForm(f => ({ ...f, brand: e.target.value }))}
                      placeholder="Brand name"
                      className="w-full border rounded-lg px-3 py-2.5 text-sm" />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
                  <textarea value={createForm.description}
                    onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Optional description"
                    rows={2}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm resize-none" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      {createForm.product_type === 'labor' ? 'Rate / Price' : 'Sell Price'} *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <input type="number" min="0" step="0.01" value={createForm.display_price}
                        onChange={e => setCreateForm(f => ({ ...f, display_price: e.target.value }))}
                        placeholder="0.00"
                        className="w-full border rounded-lg pl-7 pr-3 py-2.5 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Cost (optional)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <input type="number" min="0" step="0.01" value={createForm.cost}
                        onChange={e => setCreateForm(f => ({ ...f, cost: e.target.value }))}
                        placeholder="0.00"
                        className="w-full border rounded-lg pl-7 pr-3 py-2.5 text-sm" />
                    </div>
                  </div>
                </div>

                {createForm.product_type === 'manual' && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Starting Quantity</label>
                      <input type="number" min="0" value={createForm.quantity}
                        onChange={e => setCreateForm(f => ({ ...f, quantity: e.target.value }))}
                        className="w-full border rounded-lg px-3 py-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Shop Category</label>
                      <select value={createForm.broad_category}
                        onChange={e => setCreateForm(f => ({ ...f, broad_category: e.target.value }))}
                        className="w-full border rounded-lg px-3 py-2.5 text-sm">
                        <option value="hunting">Hunting</option>
                        <option value="archery">Archery</option>
                        <option value="fishing">Fishing</option>
                        <option value="camping">Camping & Outdoors</option>
                        <option value="firearms">Firearms & Ammo</option>
                        <option value="marine">Marine</option>
                        <option value="optics">Optics & Electronics</option>
                        <option value="wildlife-feeders">Wildlife & Feeders</option>
                        <option value="accessories">Other / Accessories</option>
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    {createForm.product_type === 'labor' ? 'Service Type / Label' : 'Sub-Category'} (optional)
                  </label>
                  <input type="text" value={createForm.category_name}
                    onChange={e => setCreateForm(f => ({ ...f, category_name: e.target.value }))}
                    placeholder={createForm.product_type === 'labor' ? 'e.g. Bow Tuning, Arrow Services' : 'e.g. Broadheads, Crossbow Accessories'}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm" />
                </div>

                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={createForm.visible}
                      onChange={e => setCreateForm(f => ({ ...f, visible: e.target.checked }))}
                      className="w-4 h-4 rounded" />
                    <span className="text-sm font-semibold text-gray-600">Visible on website</span>
                  </label>
                  {createForm.product_type === 'manual' && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={createForm.in_store}
                        onChange={e => setCreateForm(f => ({ ...f, in_store: e.target.checked }))}
                        className="w-4 h-4 rounded" />
                      <span className="text-sm font-semibold text-gray-600">Available in store</span>
                    </label>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={createProduct} disabled={creating}
                  className="flex-1 py-3 rounded-lg font-bold text-white text-sm"
                  style={{ backgroundColor: creating ? '#9ca3af' : 'var(--primary)' }}>
                  {creating ? 'Creating...' : `Create ${createForm.product_type === 'labor' ? 'Service' : 'Product'}`}
                </button>
                <button onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 rounded-lg font-bold text-sm border"
                  style={{ borderColor: '#ddd', color: '#666' }}>Cancel</button>
              </div>
            </div>
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
