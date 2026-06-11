import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getProducts, getInventory } from '@/lib/kinseys'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.SYNC_SECRET_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Starting full product sync...')
    let productsAdded = 0
    let productsUpdated = 0
    let errors = 0

    // Step 1: Fetch product catalog
    console.log('Fetching product catalog from Kinsey\'s...')
    const products = await getProducts()
    if (!products || products.length === 0) {
      return NextResponse.json({ error: 'No products returned from Kinsey\'s' }, { status: 500 })
    }
    console.log(`Fetched ${products.length} products from Kinsey\'s`)

    // Step 2: Fetch inventory
    console.log('Fetching inventory data...')
    const inventoryResponse = await getInventory()
    const inventoryMap = new Map()
    if (inventoryResponse?.Products) {
      inventoryResponse.Products.forEach((item: any) => {
        inventoryMap.set(item.productId, item)
      })
      console.log(`Fetched inventory for ${inventoryMap.size} products`)
    }

    // Step 3: Get Kinsey's distributor ID
    const { data: distributor } = await supabase
      .from('distributors')
      .select('id')
      .eq('code', 'KINSEYS')
      .single()

    if (!distributor) {
      return NextResponse.json({ error: 'Kinsey\'s distributor not found in database' }, { status: 500 })
    }

    // Step 4: Filter out inactive/blocked products upfront
    const activeProducts = products.filter((p: any) =>
      p.Inactive !== 'Yes' && p.Blocked !== 'Yes' &&
      (p.NorthItemNumber || p.SouthItemNumber)
    )
    console.log(`Processing ${activeProducts.length} active products...`)

    // Step 5: Process in batches of 100
    const batchSize = 100
    for (let i = 0; i < activeProducts.length; i += batchSize) {
      const batch = activeProducts.slice(i, i + batchSize)

      // Build all upsert records for this batch at once
      const productRecords = batch.map((product: any) => {
        const sku = product.NorthItemNumber || product.SouthItemNumber
        const inv = inventoryMap.get(sku)
        const name = (product.Name || `${product.Description1 || ''} ${product.Description2 || ''}`.trim()).toLowerCase()

        // Auto-detect FFL-required items
        // Ammo check runs FIRST — ammo never requires FFL even if name contains firearm words
        const isAmmo = ['ammunition', 'ammo', ' rounds', 'centerfire', 'rimfire'].some(k => name.includes(k))
        const isFirearm = !isAmmo && [
          'firearm', 'pistol', 'revolver', 'rifle', 'shotgun', 'handgun',
          'carbine', 'muzzleloader', 'suppressor', 'silencer',
        ].some(keyword => name.includes(keyword))
        const requiresFfl = isFirearm

        return {
          kinsey_sku: sku,
          name: product.Name || `${product.Description1 || ''} ${product.Description2 || ''}`.trim(),
          description: product.ExtendedText || product.BulletFeatures || null,
          brand: product.Brand || null,
          category: product.ItemCategoryCode || null,
          product_group_code: product.ProductGroupCode || null,
          product_sub_group_1: product.ProductSubGroup1 || null,
          product_sub_group_2: product.ProductSubGroup2 || null,
          image_url: product.ImageURL || product.ImageUrl || product.Image || null,
          upc: product.BarCode || null,
          cost: inv?.price ? parseFloat(inv.price) : null,
          msrp: product.MSRP ? parseFloat(product.MSRP) : null,
          map_price: product.MAPPrice ? parseFloat(product.MAPPrice) : (inv?.map ? parseFloat(inv.map) : null),
          quantity: inv?.quantityOnHand ? Math.floor(inv.quantityOnHand) : 0,
          in_stock: inv?.quantityOnHand ? inv.quantityOnHand > 0 : false,
          requires_ffl: requiresFfl,
          // Only set visible=false for FFL items — don't override manual visibility changes on existing products
          ...(requiresFfl ? { visible: false } : {}),
          updated_at: new Date().toISOString(),
        }
      })

      // Bulk upsert the entire batch at once (much faster than one-by-one)
      const { data: savedProducts, error: batchError } = await supabase
        .from('products')
        .upsert(productRecords, { onConflict: 'kinsey_sku' })
        .select('id, kinsey_sku')

      if (batchError) {
        console.error(`Batch error at ${i}:`, batchError)
        errors += batch.length
        continue
      }

      if (savedProducts) {
        // Build distributor records for this batch
        const skuToId = new Map(savedProducts.map((p: any) => [p.kinsey_sku, p.id]))

        const distributorRecords = batch.map((product: any) => {
          const sku = product.NorthItemNumber || product.SouthItemNumber
          const inv = inventoryMap.get(sku)
          const productId = skuToId.get(sku)
          if (!productId) return null

          return {
            product_id: productId,
            distributor_id: distributor.id,
            distributor_sku: sku,
            cost: inv?.price ? parseFloat(inv.price) : null,
            in_stock: inv?.quantityOnHand ? inv.quantityOnHand > 0 : false,
            stock_quantity: inv?.quantityOnHand ? Math.floor(inv.quantityOnHand) : 0,
            dropship_available: product.CanBeDropShipped === 'Yes',
            last_synced_at: new Date().toISOString(),
          }
        }).filter(Boolean)

        if (distributorRecords.length > 0) {
          await supabase
            .from('product_distributors')
            .upsert(distributorRecords, { onConflict: 'product_id,distributor_id' })
        }

        productsAdded += savedProducts.length
      }

      console.log(`Processed ${Math.min(i + batchSize, activeProducts.length)} of ${activeProducts.length} products`)
    }

    const summary = {
      success: true,
      type: 'full',
      totalFromKinseys: products.length,
      activeProducts: activeProducts.length,
      productsAdded,
      errors,
      syncedAt: new Date().toISOString(),
    }

    console.log('Full sync complete:', summary)
    return NextResponse.json(summary)

  } catch (error: any) {
    console.error('Full sync failed:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Use POST to trigger full sync' })
}
