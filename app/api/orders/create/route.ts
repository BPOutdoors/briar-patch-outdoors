import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GA_TAX_RATE = 0.08

// Nexus thresholds — most states use these standard limits
const NEXUS_TRANSACTION_THRESHOLD = 200
const NEXUS_REVENUE_THRESHOLD = 100000
const WARNING_PCT = 0.75 // alert at 75% of either threshold

async function checkNexus(state: string, subtotal: number) {
  if (!state || state.toUpperCase() === 'GA') return // skip home state

  try {
    // Get current totals for this state
    const { data } = await supabase
      .from('orders')
      .select('id, subtotal')
      .eq('source', 'web')
      .eq('fulfillment_type', 'shipping')
      .eq('shipping_state', state.toUpperCase())

    const txCount = (data?.length || 0)
    const totalRevenue = (data?.reduce((s: number, o: any) => s + (o.subtotal || 0), 0) || 0)

    const alertEmail = process.env.STORE_ALERT_EMAIL || 'services@briarpatchoutdoors.com'
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) return

    const alerts: { type: string; subject: string; message: string }[] = []

    // Check transaction thresholds
    const txWarning = Math.floor(NEXUS_TRANSACTION_THRESHOLD * WARNING_PCT)
    const revWarning = NEXUS_REVENUE_THRESHOLD * WARNING_PCT

    if (txCount >= NEXUS_TRANSACTION_THRESHOLD) {
      alerts.push({
        type: 'threshold_transactions',
        subject: `⚠️ Sales Tax Nexus Alert — ${state}`,
        message: `You have reached <strong>${txCount} transactions</strong> in <strong>${state}</strong> (threshold: ${NEXUS_TRANSACTION_THRESHOLD}). You may now be required to collect and remit sales tax in this state. Please consult your accountant.`,
      })
    } else if (txCount >= txWarning) {
      alerts.push({
        type: 'warning_transactions',
        subject: `Sales Tax Nexus Warning — ${state} (${txCount}/${NEXUS_TRANSACTION_THRESHOLD} transactions)`,
        message: `You are approaching the transaction nexus threshold in <strong>${state}</strong>: <strong>${txCount} of ${NEXUS_TRANSACTION_THRESHOLD} transactions</strong>. Review your obligations with your accountant soon.`,
      })
    }

    if (totalRevenue >= NEXUS_REVENUE_THRESHOLD) {
      alerts.push({
        type: 'threshold_revenue',
        subject: `⚠️ Sales Tax Nexus Alert — ${state} (Revenue)`,
        message: `Your sales to <strong>${state}</strong> have reached <strong>$${totalRevenue.toFixed(2)}</strong> (threshold: $${NEXUS_REVENUE_THRESHOLD.toLocaleString()}). You may now be required to collect and remit sales tax in this state. Please consult your accountant.`,
      })
    } else if (totalRevenue >= revWarning) {
      alerts.push({
        type: 'warning_revenue',
        subject: `Sales Tax Nexus Warning — ${state} ($${totalRevenue.toFixed(0)} / $${NEXUS_REVENUE_THRESHOLD.toLocaleString()})`,
        message: `Your sales to <strong>${state}</strong> are approaching the revenue nexus threshold: <strong>$${totalRevenue.toFixed(2)} of $${NEXUS_REVENUE_THRESHOLD.toLocaleString()}</strong>. Review your obligations with your accountant.`,
      })
    }

    for (const alert of alerts) {
      // Check if we already sent this alert (avoid duplicate emails)
      const { data: existing } = await supabase
        .from('nexus_alerts')
        .select('id')
        .eq('state', state.toUpperCase())
        .eq('alert_type', alert.type)
        .single()

      if (existing) continue // already sent

      // Record it
      await supabase.from('nexus_alerts').insert({
        state: state.toUpperCase(),
        alert_type: alert.type,
        transaction_count: txCount,
        total_revenue: totalRevenue,
      })

      // Send email via Resend
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Briar Patch Outdoors <noreply@briarpatchoutdoors.com>',
          to: alertEmail,
          subject: alert.subject,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
              <h2 style="color:#4A5E2F">Sales Tax Nexus Notice</h2>
              <p>${alert.message}</p>
              <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
              <p style="font-size:13px;color:#666">
                This is an automated notice from your Briar Patch Outdoors store system.<br/>
                Log in to <a href="https://briarpatchoutdoors.com/admin/tax-nexus">Admin → Tax Nexus</a> to see full state-by-state tracking.
              </p>
            </div>
          `,
        }),
      })
    }
  } catch (e) {
    // Non-critical — don't let nexus check failure break the order
    console.error('Nexus check error:', e)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      items,
      customer,
      fulfillment,
      shipping_address,
      payment_intent_id,
      notes,
    } = body

    const shippingState = shipping_address?.state?.toUpperCase() || null

    // Tax: only charge GA rate for GA orders
    const subtotal = items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0)
    const isGa = fulfillment === 'pickup' || shippingState === 'GA'
    const tax = isGa ? subtotal * GA_TAX_RATE : 0

    // Read shipping settings from store_settings
    const { data: shippingSettings } = await supabase
      .from('store_settings')
      .select('key,value')
      .in('key', ['free_shipping_threshold', 'flat_shipping_rate'])
    const freeThreshold = parseFloat(shippingSettings?.find((s: any) => s.key === 'free_shipping_threshold')?.value || '350')
    const flatRate = parseFloat(shippingSettings?.find((s: any) => s.key === 'flat_shipping_rate')?.value || '9.99')
    const shipping_cost = fulfillment === 'shipping' ? (subtotal >= freeThreshold ? 0 : flatRate) : 0
    const total = subtotal + tax + shipping_cost

    const hasDropship = items.some((item: any) => !item.in_stock)

    // Create or find customer
    let customer_id = null
    if (customer.email) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id, lifetime_spend, visit_count')
        .eq('email', customer.email)
        .single()

      if (existing) {
        customer_id = existing.id
        await supabase.from('customers').update({
          lifetime_spend: (existing.lifetime_spend || 0) + total,
          visit_count: (existing.visit_count || 0) + 1,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id)
      } else {
        const { data: newCustomer } = await supabase
          .from('customers')
          .insert({
            first_name: customer.first_name,
            last_name: customer.last_name,
            email: customer.email,
            phone: customer.phone || null,
            address: shipping_address?.address || null,
            city: shipping_address?.city || null,
            state: shippingState || 'GA',
            zip: shipping_address?.zip || null,
            created_source: 'web',
            lifetime_spend: total,
            visit_count: 1,
          })
          .select()
          .single()
        if (newCustomer) customer_id = newCustomer.id
      }
    }

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id,
        source: 'web',
        status: hasDropship ? 'pending' : 'processing',
        payment_method: 'card',
        payment_status: 'paid',
        payment_intent_id,
        subtotal,
        tax,
        shipping_cost,
        total,
        fulfillment_type: fulfillment,
        shipping_address: shipping_address ? JSON.stringify(shipping_address) : null,
        shipping_state: shippingState,
        customer_name: `${customer.first_name} ${customer.last_name}`,
        customer_email: customer.email,
        customer_phone: customer.phone || null,
        requires_dropship: hasDropship,
        dropship_status: hasDropship ? 'pending' : null,
        notes: notes || null,
      })
      .select()
      .single()

    if (orderError) throw new Error(orderError.message)

    // Create order items
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      product_id: item.id,
      kinsey_sku: item.kinsey_sku,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.price,
      discount_percentage: 0,
      line_total: item.price * item.quantity,
      is_dropship: !item.in_stock,
    }))
    await supabase.from('order_items').insert(orderItems)

    // Decrement inventory for in-stock items only
    for (const item of items.filter((i: any) => i.in_stock)) {
      const { data: prod } = await supabase
        .from('products')
        .select('quantity')
        .eq('id', item.id)
        .single()
      if (prod) {
        await supabase.from('products')
          .update({ quantity: Math.max(0, (prod.quantity || 0) - item.quantity) })
          .eq('id', item.id)
      }
    }

    // Check nexus thresholds for out-of-state shipping orders (non-blocking)
    if (fulfillment === 'shipping' && shippingState && shippingState !== 'GA') {
      checkNexus(shippingState, subtotal)
    }

    return NextResponse.json({ success: true, order_number: order.order_number, order_id: order.id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
