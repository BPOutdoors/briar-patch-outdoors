'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import { BROAD_CATEGORIES } from '@/lib/categories'

function ShopContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [subCategories, setSubCategories] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [banner, setBanner] = useState<any>(null)
  const [enabledCategories, setEnabledCategories] = useState<Set<string>>(new Set(BROAD_CATEGORIES.map(c => c.slug)))
  const [activePromos, setActivePromos] = useState<any[]>([])
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 2000])
  const [maxPrice, setMaxPrice] = useState(2000)

  // Initialize all filter state from URL params so Back button restores them
  const [activeBroad, setActiveBroad] = useState(() => searchParams.get('cat') || 'all')
  const [selectedSub, setSelectedSub] = useState(() => searchParams.get('sub') || 'all')
  const [selectedBrand, setSelectedBrand] = useState(() => searchParams.get('brand') || 'all')
  const [inStockOnly, setInStockOnly] = useState(() => searchParams.get('stock') === '1')
  const [sortBy, setSortBy] = useState(() => searchParams.get('sort') || 'name')
  const [searchInput, setSearchInput] = useState(() => searchParams.get('q') || '')
  const [search, setSearch] = useState(() => searchParams.get('q') || '')
  const [currentPage, setCurrentPage] = useState(() => parseInt(searchParams.get('page') || '0'))
  const [totalCount, setTotalCount] = useState(0)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const pageSize = 24

  // Sync filter state to URL whenever any filter changes
  function pushParams(overrides: Record<string, string | number | null> = {}) {
    const state: Record<string, string | number | null> = {
      cat: activeBroad,
      sub: selectedSub,
      brand: selectedBrand,
      stock: inStockOnly ? '1' : '',
      sort: sortBy,
      q: search,
      page: currentPage,
      ...overrides,
    }
    const params = new URLSearchParams()
    Object.entries(state).forEach(([k, v]) => {
      if (v !== null && v !== '' && v !== 'all' && v !== 0 && v !== 'name') {
        params.set(k, String(v))
      }
    })
    const qs = params.toString()
    router.replace(`/shop${qs ? '?' + qs : ''}`, { scroll: false })
  }

  const activeBroadObj = BROAD_CATEGORIES.find(c => c.slug === activeBroad) || null

  // Load hero banner + category visibility
  useEffect(() => {
    supabase.from('hero_banners').select('*').eq('is_active', true).order('sort_order').limit(1).single()
      .then(({ data }) => { if (data) setBanner(data) })
    supabase.from('category_visibility').select('slug, enabled')
      .then(({ data }) => {
        if (data && data.length > 0) {
          const enabled = new Set(data.filter((r: any) => r.enabled).map((r: any) => r.slug))
          setEnabledCategories(enabled)
        }
        // If table is empty or missing, keep default (all categories enabled)
      })
    // Load active promotions
    const now = new Date().toISOString()
    supabase.from('sales').select('*')
      .eq('is_active', true)
      .or(`start_date.is.null,start_date.lte.${now}`)
      .or(`end_date.is.null,end_date.gte.${now}`)
      .then(({ data }) => { if (data) setActivePromos(data) })
  }, [])

  // Load sub-categories, brands, price range when broad category changes
  useEffect(() => {
    async function loadFilters() {
      let query = supabase
        .from('products')
        .select('website_category, category_name, brand, display_price, map_price, msrp')
        .eq('visible', true)
        .or('requires_ffl.is.null,requires_ffl.eq.false')
      if (activeBroad !== 'all') query = query.eq('broad_category', activeBroad)
      const { data } = await query
      if (data) {
        const subs = [...new Set(data.map((p: any) => p.website_category || p.category_name).filter(Boolean))] as string[]
        setSubCategories(subs.sort())
        const bs = [...new Set(data.map((p: any) => p.brand).filter(Boolean))] as string[]
        setBrands(bs.sort())
        const prices = data.map((p: any) => p.display_price || p.map_price || p.msrp).filter(Boolean) as number[]
        const max = prices.length ? Math.ceil(Math.max(...prices) / 100) * 100 : 2000
        setMaxPrice(max)
        setPriceRange([0, max])
      }
    }
    loadFilters()
  }, [activeBroad])

  const fetchProducts = useCallback(async (
    page = 0,
    broad = activeBroad,
    sub = selectedSub,
    brand = selectedBrand,
    stockOnly = inStockOnly,
    sort = sortBy,
    q = search,
    pRange = priceRange
  ) => {
    setLoading(true)
    const from = page * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('products')
      .select('id, name, brand, display_price, map_price, msrp, image_url, in_stock, quantity, broad_category, website_category, website_subcategory, category_name, product_group_name, product_type', { count: 'exact' })
      .eq('visible', true)
      .or('requires_ffl.is.null,requires_ffl.eq.false')
      .range(from, to)

    // Always put out-of-stock items last, then apply user's chosen sort
    query = query.order('in_stock', { ascending: false })
    if (sort === 'price_asc') query = query.order('display_price', { ascending: true, nullsFirst: false })
    else if (sort === 'price_desc') query = query.order('display_price', { ascending: false, nullsFirst: false })
    else query = query.order('name')

    if (broad !== 'all') {
      query = query.eq('broad_category', broad)
    } else if (enabledCategories.size < BROAD_CATEGORIES.length) {
      // Only show products from enabled categories
      const slugs = [...enabledCategories]
      query = query.in('broad_category', slugs)
    }
    if (q) query = query.or(`name.ilike.%${q}%,brand.ilike.%${q}%,category_name.ilike.%${q}%`)
    if (sub !== 'all') query = query.or(`website_category.eq.${sub},and(website_category.is.null,category_name.eq.${sub})`)
    if (brand !== 'all') query = query.eq('brand', brand)
    if (stockOnly) query = query.eq('in_stock', true)
    if (pRange[1] < maxPrice) query = query.lte('display_price', pRange[1])
    if (pRange[0] > 0) query = query.gte('display_price', pRange[0])

    const { data, count } = await query
    if (data) { setProducts(data); setTotalCount(count || 0) }
    setLoading(false)
  }, [activeBroad, selectedSub, selectedBrand, inStockOnly, sortBy, search, priceRange, maxPrice])

  useEffect(() => {
    fetchProducts(currentPage)
  }, [currentPage, activeBroad, selectedSub, selectedBrand, inStockOnly, sortBy, search])

  // Debounced search
  useEffect(() => {
    if (searchInput.length === 0 || searchInput.length >= 2) {
      const timer = setTimeout(() => {
        setSearch(searchInput)
        setCurrentPage(0)
        pushParams({ q: searchInput, page: 0 })
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [searchInput])

  function selectBroad(slug: string) {
    setActiveBroad(slug)
    setSelectedSub('all')
    setSelectedBrand('all')
    setCurrentPage(0)
    pushParams({ cat: slug, sub: '', brand: '', page: 0 })
  }

  function clearFilters() {
    setSelectedSub('all')
    setSelectedBrand('all')
    setInStockOnly(false)
    setSearchInput('')
    setSearch('')
    setPriceRange([0, maxPrice])
    setCurrentPage(0)
    pushParams({ sub: '', brand: '', stock: '', q: '', page: 0 })
  }

  function getDisplayPrice(p: any) { return p.display_price || p.map_price || p.msrp }
  function getDisplayCategory(p: any) { return p.website_category || p.category_name || '' }
  function getDisplaySubcategory(p: any) { return p.website_subcategory || p.product_group_name || '' }

  function getSalePrice(product: any): { salePrice: number | null; promoName: string } {
    const basePrice = getDisplayPrice(product)
    if (!basePrice || activePromos.length === 0) return { salePrice: null, promoName: '' }
    let bestDiscount = 0
    let promoName = ''
    for (const promo of activePromos) {
      const applies =
        promo.applies_to === 'all' ||
        (promo.applies_to === 'products' && promo.product_ids?.includes(product.id)) ||
        (promo.applies_to === 'category' && promo.category_slugs?.includes(product.broad_category))
      if (!applies) continue
      const discount = promo.discount_type === 'percent'
        ? basePrice * (promo.discount_value / 100)
        : promo.discount_value
      if (discount > bestDiscount) { bestDiscount = discount; promoName = promo.name }
    }
    if (bestDiscount <= 0) return { salePrice: null, promoName: '' }
    return { salePrice: Math.max(0, basePrice - bestDiscount), promoName }
  }

  const totalPages = Math.ceil(totalCount / pageSize)
  const hasActiveFilters = selectedSub !== 'all' || selectedBrand !== 'all' || inStockOnly || !!search || priceRange[0] > 0 || priceRange[1] < maxPrice

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-white">

        {/* Announcement bar */}
        <div className="text-center py-2 text-xs font-semibold tracking-wide text-white"
          style={{ backgroundColor: 'var(--primary)' }}>
          Free local pickup available · Call ahead: 706-749-6994
        </div>

        {/* Hero Banner */}
        {banner && (
          <div className="px-6 py-12" style={{ backgroundColor: banner.bg_color, color: banner.text_color }}>
            <div className="max-w-7xl mx-auto">
              <h1 className="text-3xl sm:text-4xl font-bold mb-2 tracking-tight">{banner.heading}</h1>
              {banner.subheading && <p className="text-base opacity-80 mb-5 max-w-xl">{banner.subheading}</p>}
              {banner.button_text && (
                <button
                  onClick={() => router.push(banner.button_link || '/shop')}
                  className="px-6 py-2.5 rounded font-bold text-sm border-2 border-white/60 hover:bg-white/10 transition-colors"
                  style={{ color: banner.text_color }}
                >
                  {banner.button_text} →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Category Tab Bar */}
        <div className="border-b" style={{ backgroundColor: '#fafafa' }}>
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-wrap">
              <button
                onClick={() => selectBroad('all')}
                className="px-4 py-3 text-sm font-semibold border-b-2 transition-colors"
                style={{
                  borderColor: activeBroad === 'all' ? 'var(--primary)' : 'transparent',
                  color: activeBroad === 'all' ? 'var(--primary)' : '#666',
                }}
              >
                All Products
              </button>
              {BROAD_CATEGORIES.filter(cat => enabledCategories.has(cat.slug)).map(cat => (
                <button
                  key={cat.slug}
                  onClick={() => selectBroad(cat.slug)}
                  className="px-4 py-3 text-sm font-semibold border-b-2 transition-colors"
                  style={{
                    borderColor: activeBroad === cat.slug ? cat.color : 'transparent',
                    color: activeBroad === cat.slug ? cat.color : '#666',
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6 flex gap-8">

          {/* LEFT SIDEBAR */}
          <aside className="hidden md:block w-56 flex-shrink-0">
            <div className="sticky top-4 space-y-6">

              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  className="w-full border rounded-lg px-4 py-2.5 text-sm pl-9"
                  style={{ borderColor: '#ddd' }}
                />
                <svg className="absolute left-3 top-3 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchInput && (
                  <button onClick={() => { setSearchInput(''); setSearch(''); pushParams({ q: '', page: 0 }) }}
                    className="absolute right-3 top-2 text-gray-400 hover:text-gray-600 text-lg">×</button>
                )}
              </div>

              {/* Availability */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Availability</h3>
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <input type="checkbox" checked={inStockOnly}
                    onChange={e => { setInStockOnly(e.target.checked); setCurrentPage(0); pushParams({ stock: e.target.checked ? '1' : '', page: 0 }) }}
                    className="w-4 h-4 rounded" />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">In Stock Only</span>
                </label>
              </div>

              {/* Price Range */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Price Range</h3>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-gray-600">${priceRange[0]}</span>
                  <span className="text-gray-300">–</span>
                  <span className="text-sm text-gray-600">${priceRange[1]}</span>
                </div>
                <input type="range" min={0} max={maxPrice} step={10}
                  value={priceRange[1]}
                  onChange={e => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                  onMouseUp={() => fetchProducts(0)}
                  onTouchEnd={() => fetchProducts(0)}
                  className="w-full accent-current"
                  style={{ accentColor: 'var(--primary)' }}
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>$0</span>
                  <span>${maxPrice.toLocaleString()}</span>
                </div>
              </div>

              {/* Sub-categories */}
              {subCategories.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                    {activeBroadObj ? activeBroadObj.name : 'Category'}
                  </h3>
                  <div className="space-y-0.5 max-h-64 overflow-y-auto">
                    <button
                      onClick={() => { setSelectedSub('all'); setCurrentPage(0); pushParams({ sub: '', page: 0 }) }}
                      className="w-full text-left px-2 py-1.5 rounded text-sm transition-colors"
                      style={{ fontWeight: selectedSub === 'all' ? '600' : '400', color: selectedSub === 'all' ? 'var(--primary)' : '#555' }}
                    >
                      All
                    </button>
                    {subCategories.map(sub => (
                      <button key={sub}
                        onClick={() => { setSelectedSub(sub); setCurrentPage(0); pushParams({ sub, page: 0 }) }}
                        className="w-full text-left px-2 py-1.5 rounded text-sm transition-colors hover:bg-gray-50"
                        style={{ fontWeight: selectedSub === sub ? '600' : '400', color: selectedSub === sub ? 'var(--primary)' : '#555' }}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Brand */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Brand</h3>
                <select value={selectedBrand}
                  onChange={e => { setSelectedBrand(e.target.value); setCurrentPage(0); pushParams({ brand: e.target.value, page: 0 }) }}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  style={{ borderColor: '#ddd' }}
                >
                  <option value="all">All Brands</option>
                  {brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              {/* Clear filters */}
              {hasActiveFilters && (
                <button onClick={clearFilters}
                  className="w-full py-2 rounded-lg text-xs font-semibold border transition-colors hover:bg-gray-50"
                  style={{ borderColor: '#ddd', color: '#888' }}>
                  Clear All Filters
                </button>
              )}
            </div>
          </aside>

          {/* MAIN CONTENT */}
          <div className="flex-1 min-w-0">

            {/* Top bar */}
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm text-gray-500">
                {loading ? 'Loading...' : (
                  <>
                    <span className="font-semibold text-gray-800">{totalCount.toLocaleString()}</span> product{totalCount !== 1 ? 's' : ''}
                    {search ? ` matching "${search}"` : activeBroad !== 'all' && activeBroadObj ? ` in ${activeBroadObj.name}` : ''}
                  </>
                )}
              </p>
              <div className="flex items-center gap-3">
                <select value={sortBy} onChange={e => { setSortBy(e.target.value); setCurrentPage(0); pushParams({ sort: e.target.value, page: 0 }) }}
                  className="border rounded-lg px-3 py-2 text-sm bg-white"
                  style={{ borderColor: '#ddd' }}>
                  <option value="name">A – Z</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
                <button onClick={() => setMobileFiltersOpen(true)}
                  className="md:hidden flex items-center gap-2 border rounded-lg px-4 py-2 text-sm font-semibold"
                  style={{ borderColor: '#ddd', color: 'var(--primary)' }}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                  </svg>
                  Filters
                </button>
              </div>
            </div>

            {/* Active filter chips */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedSub !== 'all' && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                    {selectedSub}
                    <button onClick={() => { setSelectedSub('all'); setCurrentPage(0); pushParams({ sub: '', page: 0 }) }} className="ml-1 hover:text-gray-900">×</button>
                  </span>
                )}
                {selectedBrand !== 'all' && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                    {selectedBrand}
                    <button onClick={() => { setSelectedBrand('all'); setCurrentPage(0); pushParams({ brand: '', page: 0 }) }} className="ml-1 hover:text-gray-900">×</button>
                  </span>
                )}
                {inStockOnly && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                    In Stock Only
                    <button onClick={() => { setInStockOnly(false); setCurrentPage(0); pushParams({ stock: '', page: 0 }) }} className="ml-1 hover:text-gray-900">×</button>
                  </span>
                )}
              </div>
            )}

            {/* Product Grid */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-gray-200">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="bg-white animate-pulse">
                    <div className="h-52 bg-gray-100" />
                    <div className="p-4 space-y-2">
                      <div className="h-3 bg-gray-100 rounded w-1/3" />
                      <div className="h-4 bg-gray-100 rounded w-full" />
                      <div className="h-4 bg-gray-100 rounded w-3/4" />
                      <div className="h-5 bg-gray-100 rounded w-1/4 mt-3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-24 border rounded-lg">
                <p className="font-bold text-xl text-gray-700 mb-2">No products found</p>
                <p className="text-sm text-gray-400 mb-5">Try adjusting your filters or search term</p>
                <button onClick={clearFilters}
                  className="px-6 py-2.5 rounded font-semibold text-white text-sm"
                  style={{ backgroundColor: 'var(--primary)' }}>
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                {products.map(product => {
                  const price = getDisplayPrice(product)
                  const category = getDisplayCategory(product)
                  const subcategory = getDisplaySubcategory(product)
                  const { salePrice, promoName } = getSalePrice(product)
                  const onSale = salePrice !== null && price && salePrice < price
                  return (
                    <div key={product.id} onClick={() => router.push(`/shop/${product.id}`)}
                      className="bg-white cursor-pointer group hover:z-10 hover:shadow-lg transition-shadow relative">
                      {/* Image */}
                      <div className="relative overflow-hidden bg-gray-50" style={{ height: '220px' }}>
                        {product.image_url && product.image_url !== 'none' ? (
                          <img src={product.image_url} alt={product.name}
                            className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-xs uppercase tracking-widest text-gray-300">No Image</span>
                          </div>
                        )}
                        <div className="absolute top-3 left-3 flex flex-col gap-1">
                          {onSale && (
                            <span className="text-xs px-2 py-1 font-bold bg-red-600 text-white rounded uppercase tracking-wide">
                              Sale — {Math.round(((price - salePrice!) / price) * 100)}% off
                            </span>
                          )}
                          {product.product_type === 'manual' ? (
                            // Manual products: track local quantity
                            (product.quantity ?? 0) <= 0 ? (
                              <span className="text-xs px-2 py-1 font-semibold bg-gray-800 text-white rounded">Out of Stock</span>
                            ) : null
                          ) : (
                            // Distributor products: use in_stock flag
                            product.in_stock ? (
                              <span className="text-xs px-2 py-1 font-semibold bg-blue-700 text-white rounded">Ships from Distributor</span>
                            ) : (
                              <span className="text-xs px-2 py-1 font-semibold bg-gray-800 text-white rounded">Out of Stock</span>
                            )
                          )}
                        </div>
                        <div className="absolute inset-x-0 bottom-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                          <div className="w-full py-2 text-center text-xs font-bold text-white rounded"
                            style={{ backgroundColor: 'var(--primary)' }}>
                            View Product
                          </div>
                        </div>
                      </div>
                      {/* Info */}
                      <div className="p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1 truncate">{product.brand}</p>
                        <p className="text-sm font-semibold text-gray-900 leading-snug mb-1 line-clamp-2">{product.name}</p>
                        {category && (
                          <p className="text-xs text-gray-400 truncate mb-2">
                            {subcategory ? `${category} › ${subcategory}` : category}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <div>
                            {onSale ? (
                              <div className="flex items-baseline gap-1.5">
                                <p className="font-bold text-base text-red-600">${salePrice!.toFixed(2)}</p>
                                <p className="text-sm text-gray-400 line-through">${price!.toFixed(2)}</p>
                              </div>
                            ) : (
                              <p className="font-bold text-base" style={{ color: 'var(--primary)' }}>
                                {price ? `$${price.toFixed(2)}` : <span className="text-sm text-gray-400 font-normal">Call for Price</span>}
                              </p>
                            )}
                          </div>
                          {product.product_type === 'manual' && product.quantity > 0 && product.quantity <= 5 && (
                            <span className="text-xs font-semibold text-red-500">Only {product.quantity} left</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-10">
                <button onClick={() => { setCurrentPage(0); pushParams({ page: 0 }) }} disabled={currentPage === 0}
                  className="px-3 py-2 rounded text-sm font-semibold border bg-white disabled:opacity-30 hover:bg-gray-50"
                  style={{ borderColor: '#ddd' }}>«</button>
                <button onClick={() => { const p = Math.max(0, currentPage - 1); setCurrentPage(p); pushParams({ page: p }) }} disabled={currentPage === 0}
                  className="px-4 py-2 rounded text-sm font-semibold border bg-white disabled:opacity-30 hover:bg-gray-50"
                  style={{ borderColor: '#ddd' }}>← Prev</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const startPage = Math.max(0, Math.min(currentPage - 2, totalPages - 5))
                  const pageNum = startPage + i
                  return (
                    <button key={pageNum} onClick={() => { setCurrentPage(pageNum); pushParams({ page: pageNum }) }}
                      className="w-10 h-10 rounded text-sm font-semibold border transition-colors"
                      style={{ backgroundColor: currentPage === pageNum ? 'var(--primary)' : 'white', color: currentPage === pageNum ? 'white' : '#555', borderColor: currentPage === pageNum ? 'var(--primary)' : '#ddd' }}>
                      {pageNum + 1}
                    </button>
                  )
                })}
                <button onClick={() => { const p = Math.min(totalPages - 1, currentPage + 1); setCurrentPage(p); pushParams({ page: p }) }} disabled={currentPage >= totalPages - 1}
                  className="px-4 py-2 rounded text-sm font-semibold border bg-white disabled:opacity-30 hover:bg-gray-50"
                  style={{ borderColor: '#ddd' }}>Next →</button>
                <button onClick={() => { const p = totalPages - 1; setCurrentPage(p); pushParams({ page: p }) }} disabled={currentPage >= totalPages - 1}
                  className="px-3 py-2 rounded text-sm font-semibold border bg-white disabled:opacity-30 hover:bg-gray-50"
                  style={{ borderColor: '#ddd' }}>»</button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile filter drawer */}
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileFiltersOpen(false)} />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-5">
                <h2 className="font-bold text-lg" style={{ color: 'var(--primary)' }}>Filters</h2>
                <button onClick={() => setMobileFiltersOpen(false)} className="text-2xl text-gray-400">×</button>
              </div>
              <div className="space-y-5">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={inStockOnly} onChange={e => { setInStockOnly(e.target.checked); setCurrentPage(0) }} className="w-5 h-5" />
                  <span className="text-sm font-semibold">In Stock Only</span>
                </label>
                {subCategories.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Category</h3>
                    <div className="flex flex-wrap gap-2">
                      {['all', ...subCategories].map(sub => (
                        <button key={sub} onClick={() => { setSelectedSub(sub); setCurrentPage(0) }}
                          className="px-3 py-1.5 rounded-full text-sm font-semibold border"
                          style={{ backgroundColor: selectedSub === sub ? 'var(--primary)' : 'white', color: selectedSub === sub ? 'white' : '#444', borderColor: selectedSub === sub ? 'var(--primary)' : '#ddd' }}>
                          {sub === 'all' ? 'All' : sub}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Brand</h3>
                  <select value={selectedBrand} onChange={e => { setSelectedBrand(e.target.value); setCurrentPage(0) }}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="all">All Brands</option>
                    {brands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={() => setMobileFiltersOpen(false)}
                className="w-full mt-6 py-3 rounded-xl font-bold text-white"
                style={{ backgroundColor: 'var(--primary)' }}>
                Show {totalCount.toLocaleString()} Results
              </button>
            </div>
          </div>
        )}

      </main>
      <Footer />
    </>
  )
}

export default function ShopPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-400">Loading...</p>
      </div>
    }>
      <ShopContent />
    </Suspense>
  )
}
