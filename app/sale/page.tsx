'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

export default function SalePage() {
  const router = useRouter()
  const [products, setProducts] = useState<any[]>([])
  const [promos, setPromos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activePromo, setActivePromo] = useState<string>('all')
  const [sortBy, setSortBy] = useState('savings')

  useEffect(() => {
    loadSaleProducts()
  }, [])

  async function loadSaleProducts() {
    setLoading(true)
    const now = new Date().toISOString()

    // Fetch active promotions
    const { data: saleData } = await supabase
      .from('sales')
      .select('*')
      .eq('is_active', true)
      .or(`start_date.is.null,start_date.lte.${now}`)
      .or(`end_date.is.null,end_date.gte.${now}`)

    if (!saleData || saleData.length === 0) {
      setLoading(false)
      return
    }

    setPromos(saleData)

    // Collect all product IDs we need to fetch
    const allProductIds: string[] = []
    const categoryPromos = saleData.filter((p: any) => p.applies_to === 'category')
    const specificPromos = saleData.filter((p: any) => p.applies_to === 'products')
    const allPromos = saleData.filter((p: any) => p.applies_to === 'all')

    // For specific product promos — we know the IDs
    specificPromos.forEach((p: any) => {
      if (p.product_ids) allProductIds.push(...p.product_ids)
    })

    // Fetch products
    let productQuery = supabase
      .from('products')
      .select('id, name, brand, display_price, map_price, msrp, image_url, in_stock, quantity, broad_category, website_category, category_name')
      .eq('visible', true)
      .eq('requires_ffl', false)

    if (allPromos.length === 0) {
      // No "all products" promos — filter to only affected categories + specific products
      const categorySlugs = categoryPromos.flatMap((p: any) => p.category_slugs || [])
      const conditions: string[] = []
      if (categorySlugs.length > 0) conditions.push(`broad_category.in.(${categorySlugs.join(',')})`)
      if (allProductIds.length > 0) conditions.push(`id.in.(${allProductIds.join(',')})`)
      if (conditions.length === 0) { setLoading(false); return }
      productQuery = productQuery.or(conditions.join(','))
    }
    // else: "all products" promo covers everything — fetch all visible products (paginated below)
    // For performance, limit to 200 on sale page
    productQuery = productQuery.limit(200).order('name')

    const { data: productData } = await productQuery
    if (!productData) { setLoading(false); return }

    // Compute sale price for each product
    const withSale = productData.map((p: any) => {
      const basePrice = p.display_price || p.map_price || p.msrp
      let bestDiscount = 0
      let bestPromo: any = null
      for (const promo of saleData) {
        const applies =
          promo.applies_to === 'all' ||
          (promo.applies_to === 'products' && promo.product_ids?.includes(p.id)) ||
          (promo.applies_to === 'category' && promo.category_slugs?.includes(p.broad_category))
        if (!applies || !basePrice) continue
        const discount = promo.discount_type === 'percent'
          ? basePrice * (promo.discount_value / 100)
          : promo.discount_value
        if (discount > bestDiscount) { bestDiscount = discount; bestPromo = promo }
      }
      if (!bestPromo || bestDiscount <= 0) return null
      return {
        ...p,
        basePrice,
        salePrice: Math.max(0, basePrice - bestDiscount),
        savings: bestDiscount,
        savingsPct: basePrice ? Math.round((bestDiscount / basePrice) * 100) : 0,
        promoName: bestPromo.name,
        promoId: bestPromo.id,
      }
    }).filter(Boolean)

    setProducts(withSale)
    setLoading(false)
  }

  const filtered = activePromo === 'all'
    ? products
    : products.filter(p => p.promoId === activePromo)

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'savings') return b.savingsPct - a.savingsPct
    if (sortBy === 'price_asc') return a.salePrice - b.salePrice
    if (sortBy === 'price_desc') return b.salePrice - a.salePrice
    return a.name.localeCompare(b.name)
  })

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-white">

        {/* Sale Header */}
        <div className="py-10 px-6 text-center" style={{ backgroundColor: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-2">Limited Time</p>
            <h1 className="text-4xl font-bold mb-2" style={{ color: '#7f1d1d' }}>Sale</h1>
            <p className="text-gray-500 text-sm">
              {loading ? 'Loading...' : `${products.length} item${products.length !== 1 ? 's' : ''} on sale now`}
            </p>
            {/* Active promo pills */}
            {promos.length > 1 && !loading && (
              <div className="flex flex-wrap justify-center gap-2 mt-5">
                <button
                  onClick={() => setActivePromo('all')}
                  className="px-4 py-1.5 rounded-full text-xs font-bold border transition-all"
                  style={{
                    backgroundColor: activePromo === 'all' ? '#b91c1c' : 'white',
                    color: activePromo === 'all' ? 'white' : '#b91c1c',
                    borderColor: '#b91c1c',
                  }}>
                  All Sales
                </button>
                {promos.map(promo => (
                  <button key={promo.id}
                    onClick={() => setActivePromo(promo.id)}
                    className="px-4 py-1.5 rounded-full text-xs font-bold border transition-all"
                    style={{
                      backgroundColor: activePromo === promo.id ? '#b91c1c' : 'white',
                      color: activePromo === promo.id ? 'white' : '#b91c1c',
                      borderColor: '#b91c1c',
                    }}>
                    {promo.name}
                    {promo.discount_type === 'percent'
                      ? ` — ${promo.discount_value}% off`
                      : ` — $${promo.discount_value} off`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-gray-200 rounded-lg overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white animate-pulse">
                  <div className="h-52 bg-gray-100" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-1/3" />
                    <div className="h-4 bg-gray-100 rounded w-full" />
                    <div className="h-5 bg-gray-100 rounded w-1/4 mt-3" />
                  </div>
                </div>
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-2xl font-bold text-gray-300 mb-3">No active sales right now</p>
              <p className="text-sm text-gray-400 mb-6">Check back soon or browse our full shop</p>
              <button onClick={() => router.push('/shop')}
                className="px-8 py-3 rounded-xl font-bold text-white"
                style={{ backgroundColor: 'var(--primary)' }}>
                Browse All Products
              </button>
            </div>
          ) : (
            <>
              {/* Sort */}
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm text-gray-500">
                  <span className="font-semibold text-gray-800">{sorted.length}</span> item{sorted.length !== 1 ? 's' : ''}
                </p>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm bg-white"
                  style={{ borderColor: '#ddd' }}>
                  <option value="savings">Best Savings First</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="name">A – Z</option>
                </select>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                {sorted.map(product => (
                  <div key={product.id} onClick={() => router.push(`/shop/${product.id}`)}
                    className="bg-white cursor-pointer group hover:z-10 hover:shadow-lg transition-shadow relative">
                    {/* Image */}
                    <div className="relative overflow-hidden bg-gray-50" style={{ height: '200px' }}>
                      {product.image_url && product.image_url !== 'none' ? (
                        <img src={product.image_url} alt={product.name}
                          className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-xs uppercase tracking-widest text-gray-300">No Image</span>
                        </div>
                      )}
                      {/* Sale badge */}
                      <div className="absolute top-3 left-3 flex flex-col gap-1">
                        <span className="text-xs px-2 py-1 font-bold bg-red-600 text-white rounded">
                          {product.savingsPct}% OFF
                        </span>
                        {!product.in_stock && (
                          <span className="text-xs px-2 py-1 font-semibold bg-gray-800 text-white rounded">Out of Stock</span>
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
                      <p className="text-sm font-semibold text-gray-900 leading-snug mb-2 line-clamp-2">{product.name}</p>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-bold text-base text-red-600">${product.salePrice.toFixed(2)}</span>
                        <span className="text-sm text-gray-400 line-through">${product.basePrice.toFixed(2)}</span>
                      </div>
                      <p className="text-xs font-semibold text-red-500 mt-1">
                        Save ${product.savings.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
