'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import { BROAD_CATEGORIES } from '@/lib/categories'
import { useCart } from '@/lib/cart-context'

export default function ProductDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { addItem } = useCart()
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState<string | null>(null)
  const [addedToCart, setAddedToCart] = useState(false)
  const [activePromos, setActivePromos] = useState<any[]>([])

  useEffect(() => {
    async function fetchProduct() {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('visible', true)
        .single()

      if (data) {
        setProduct(data)
        setActiveImage(data.image_url && data.image_url !== 'none' ? data.image_url : null)
        // Load active promotions
        const now = new Date().toISOString()
        const { data: promos } = await supabase.from('sales').select('*')
          .eq('is_active', true)
          .or(`start_date.is.null,start_date.lte.${now}`)
          .or(`end_date.is.null,end_date.gte.${now}`)
        setActivePromos(promos || [])
      }
      setLoading(false)
    }
    fetchProduct()
  }, [id])

  function getSalePrice(p: any, basePrice: number): { salePrice: number | null; promoName: string } {
    if (!basePrice || activePromos.length === 0) return { salePrice: null, promoName: '' }
    let bestDiscount = 0
    let promoName = ''
    for (const promo of activePromos) {
      const applies =
        promo.applies_to === 'all' ||
        (promo.applies_to === 'products' && promo.product_ids?.includes(p.id)) ||
        (promo.applies_to === 'category' && promo.category_slugs?.includes(p.broad_category))
      if (!applies) continue
      const discount = promo.discount_type === 'percent'
        ? basePrice * (promo.discount_value / 100)
        : promo.discount_value
      if (discount > bestDiscount) { bestDiscount = discount; promoName = promo.name }
    }
    if (bestDiscount <= 0) return { salePrice: null, promoName: '' }
    return { salePrice: Math.max(0, basePrice - bestDiscount), promoName }
  }

  function getPrice(p: any) {
    return p.display_price || p.map_price || p.msrp
  }

  function getBroadCat(p: any) {
    return BROAD_CATEGORIES.find(c => c.slug === p.broad_category) || null
  }

  if (loading) {
    return (
      <>
        <Nav />
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="animate-pulse text-gray-300 text-sm">Loading product...</div>
        </div>
        <Footer />
      </>
    )
  }

  if (!product) {
    return (
      <>
        <Nav />
        <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
          <p className="text-gray-500 font-semibold">Product not found.</p>
          <button onClick={() => router.back()}
            className="text-sm font-semibold px-4 py-2 rounded border"
            style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>
            ← Back to Shop
          </button>
        </div>
        <Footer />
      </>
    )
  }

  const price = getPrice(product)
  const broadCat = getBroadCat(product)
  const hasImage = activeImage && activeImage !== 'none'
  const { salePrice, promoName } = getSalePrice(product, price)
  const onSale = salePrice !== null && price && salePrice < price
  const effectivePrice = onSale ? salePrice! : price

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-white">

        {/* Announcement bar */}
        <div className="text-center py-2 text-xs font-semibold tracking-wide text-white"
          style={{ backgroundColor: 'var(--primary)' }}>
          Free local pickup available · Call ahead: 706-749-6994
        </div>

        <div className="max-w-6xl mx-auto px-4 py-8">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-gray-400 mb-6 flex-wrap">
            <button onClick={() => router.push('/shop')} className="hover:text-gray-600 transition-colors">
              Shop
            </button>
            {broadCat && (
              <>
                <span>/</span>
                <button onClick={() => router.push(`/shop?cat=${broadCat.slug}`)}
                  className="hover:text-gray-600 transition-colors">
                  {broadCat.name}
                </button>
              </>
            )}
            {product.category_name && (
              <>
                <span>/</span>
                <span className="text-gray-500">{product.category_name}</span>
              </>
            )}
            <span>/</span>
            <span className="text-gray-700 font-medium truncate max-w-xs">{product.name}</span>
          </nav>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16">

            {/* LEFT — Image */}
            <div>
              <div className="rounded-xl overflow-hidden border bg-gray-50 flex items-center justify-center"
                style={{ height: '420px', borderColor: '#e8e8e8' }}>
                {hasImage ? (
                  <img src={activeImage!} alt={product.name}
                    className="w-full h-full object-contain p-6" />
                ) : (
                  <span className="text-xs uppercase tracking-widest text-gray-300">No Image Available</span>
                )}
              </div>
            </div>

            {/* RIGHT — Info */}
            <div className="flex flex-col">

              {/* Brand */}
              {product.brand && (
                <p className="text-xs font-bold uppercase tracking-widest mb-2"
                  style={{ color: broadCat?.color || 'var(--primary)' }}>
                  {product.brand}
                </p>
              )}

              {/* Name */}
              <h1 className="text-2xl font-bold leading-snug mb-3" style={{ color: '#1a1a1a' }}>
                {product.name}
              </h1>

              {/* Category tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {broadCat && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: broadCat.color + '18', color: broadCat.color }}>
                    {broadCat.name}
                  </span>
                )}
                {product.category_name && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                    {product.category_name}
                  </span>
                )}
                {product.product_group_name && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                    {product.product_group_name}
                  </span>
                )}
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-3 mb-4 flex-wrap">
                {price ? (
                  onSale ? (
                    <>
                      <span className="text-3xl font-bold text-red-600">${salePrice!.toFixed(2)}</span>
                      <span className="text-xl text-gray-400 line-through">${price.toFixed(2)}</span>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">{promoName}</span>
                    </>
                  ) : (
                    <span className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>
                      ${price.toFixed(2)}
                    </span>
                  )
                ) : (
                  <span className="text-lg text-gray-400 font-medium">Call for Price</span>
                )}
              </div>

              {/* Stock status — check in-store qty first, then distributor */}
              {(() => {
                const inStore = (product.quantity ?? 0) > 0
                const atDistributor = !inStore && product.in_stock
                const outOfStock = !inStore && !product.in_stock
                return (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: inStore ? '#22c55e' : atDistributor ? '#3b82f6' : '#ef4444' }} />
                      <span className="text-sm font-semibold"
                        style={{ color: inStore ? '#16a34a' : atDistributor ? '#1d4ed8' : '#dc2626' }}>
                        {inStore
                          ? product.quantity <= 5
                            ? `Only ${product.quantity} left in store`
                            : 'In Stock — Available In Store'
                          : atDistributor
                            ? 'Available — Ships from Distributor'
                            : 'Out of Stock'}
                      </span>
                    </div>
                    {atDistributor && (
                      <div className="mb-4 p-3 rounded-lg border text-sm" style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe', color: '#1e3a8a' }}>
                        This item ships directly from our distributor. Place your order and we'll confirm shipment details with you.
                      </div>
                    )}
                    {outOfStock && (
                      <div className="mb-4 p-3 rounded-lg border text-sm" style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
                        Our distributor is currently out of stock on this item. You can still place your order — we will confirm and notify you once the item ships.
                      </div>
                    )}
                  </>
                )
              })()}

              {/* SKU */}
              {product.kinsey_sku && (
                <p className="text-xs text-gray-400 mb-5">SKU: {product.kinsey_sku}</p>
              )}

              {/* Divider */}
              <div className="border-t mb-5" style={{ borderColor: '#f0f0f0' }} />

              {/* Add to cart / contact section */}
              {effectivePrice ? (
                <div className="space-y-3">
                  {/* Qty selector */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-600">Quantity</span>
                    <div className="flex items-center border rounded-lg overflow-hidden" style={{ borderColor: '#ddd' }}>
                      <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                        className="px-3 py-2 text-gray-500 hover:bg-gray-50 font-bold text-lg leading-none">−</button>
                      <span className="px-4 py-2 text-sm font-semibold min-w-[2.5rem] text-center">{quantity}</span>
                      <button onClick={() => setQuantity(q => q + 1)}
                        className="px-3 py-2 text-gray-500 hover:bg-gray-50 font-bold text-lg leading-none">+</button>
                    </div>
                  </div>

                  {/* CTA buttons */}
                  <button
                    className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all"
                    style={{ backgroundColor: addedToCart ? 'var(--secondary)' : 'var(--primary)' }}
                    onClick={() => {
                      for (let i = 0; i < quantity; i++) {
                        addItem({
                          id: product.id,
                          kinsey_sku: product.kinsey_sku,
                          name: product.name,
                          brand: product.brand || '',
                          price: effectivePrice,
                          image_url: product.image_url,
                          in_stock: (product.quantity ?? 0) > 0,
                        })
                      }
                      setAddedToCart(true)
                      setTimeout(() => setAddedToCart(false), 2000)
                    }}>
                    {addedToCart ? '✓ Added to Cart' : 'Add to Cart'}
                  </button>
                </div>
              ) : (
                <button
                  className="w-full py-3.5 rounded-xl font-bold text-white text-sm"
                  style={{ backgroundColor: 'var(--primary)' }}
                  onClick={() => window.location.href = 'tel:7067496994'}>
                  Call for Price · (706) 749-6994
                </button>
              )}

              {/* Store pickup note */}
              <div className="mt-4 p-3 rounded-lg flex items-start gap-2.5"
                style={{ backgroundColor: 'var(--cream-dark)' }}>
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  style={{ color: 'var(--primary)' }} strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-xs text-gray-600 leading-relaxed">
                  <span className="font-semibold" style={{ color: 'var(--primary)' }}>Free local pickup</span> available in Eatonton, GA.
                  Online checkout coming soon — call or visit us in store.
                </p>
              </div>
            </div>
          </div>

          {/* Product details section */}
          {(product.description || product.upc || product.map_price || product.msrp) && (
            <div className="mt-12 border-t pt-8" style={{ borderColor: '#f0f0f0' }}>
              <h2 className="text-lg font-bold mb-5" style={{ color: 'var(--primary)' }}>Product Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {product.description && (
                  <div>
                    <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>
                  </div>
                )}
                <div className="space-y-2">
                  {product.upc && (
                    <div className="flex justify-between text-sm border-b pb-2" style={{ borderColor: '#f0f0f0' }}>
                      <span className="text-gray-400">UPC</span>
                      <span className="font-medium">{product.upc}</span>
                    </div>
                  )}
                  {product.kinsey_sku && (
                    <div className="flex justify-between text-sm border-b pb-2" style={{ borderColor: '#f0f0f0' }}>
                      <span className="text-gray-400">Item #</span>
                      <span className="font-medium">{product.kinsey_sku}</span>
                    </div>
                  )}
                  {product.msrp && (
                    <div className="flex justify-between text-sm border-b pb-2" style={{ borderColor: '#f0f0f0' }}>
                      <span className="text-gray-400">MSRP</span>
                      <span className="font-medium">${product.msrp.toFixed(2)}</span>
                    </div>
                  )}
                  {product.category_name && (
                    <div className="flex justify-between text-sm border-b pb-2" style={{ borderColor: '#f0f0f0' }}>
                      <span className="text-gray-400">Category</span>
                      <span className="font-medium">{product.category_name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Back button */}
          <div className="mt-10">
            <button onClick={() => router.back()}
              className="flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-70"
              style={{ color: 'var(--primary)' }}>
              ← Back to Products
            </button>
          </div>

        </div>
      </main>
      <Footer />
    </>
  )
}
