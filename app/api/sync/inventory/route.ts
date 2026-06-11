import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getInventory } from '@/lib/kinseys'

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

    console.log('Starting inventory sync...')

    const inventoryResponse = await getInventory()
    if (!inventoryResponse?.Products) {
      return NextResponse.json({ error: 'No inventory data returned from Kinsey\'s' }, { status: 500 })
    }

    const items = inventoryResponse.Products
    let updated = 0
    let errors = 0

    // Process in batches of 100
    const batchSize = 100
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)

      for (const item of batch) {
        try {
          const sku = item.productId
          if (!sku) continue

          const { error } = await supabase
            .from('products')
            .update({
              quantity: item.quantityOnHand ? Math.floor(item.quantityOnHand) : 0,
              in_stock: item.quantityOnHand ? item.quantityOnHand > 0 : false,
              cost: item.price ? parseFloat(item.price) : null,
              map_price: item.map ? parseFloat(item.map) : null,
              updated_at: new Date().toISOString(),
            })
            .eq('kinsey_sku', sku)

          if (error) {
            errors++
          } else {
            updated++
          }

          // Also update product_distributors table
          await supabase
            .from('product_distributors')
            .update({
              cost: item.price ? parseFloat(item.price) : null,
              in_stock: item.quantityOnHand ? item.quantityOnHand > 0 : false,
              stock_quantity: item.quantityOnHand ? Math.floor(item.quantityOnHand) : 0,
              last_synced_at: new Date().toISOString(),
            })
            .eq('distributor_sku', sku)

        } catch (err) {
          errors++
        }
      }
    }

    const summary = {
      success: true,
      type: 'inventory',
      totalItems: items.length,
      updated,
      errors,
      syncedAt: new Date().toISOString(),
    }

    console.log('Inventory sync complete:', summary)
    return NextResponse.json(summary)

  } catch (error: any) {
    console.error('Inventory sync failed:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Use POST to trigger inventory sync' })
}
