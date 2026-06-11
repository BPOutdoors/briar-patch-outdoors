import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  try {
    const { order_id, email } = await request.json()

    // Fetch order with items and customer
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, order_items(*), customers(first_name, last_name, email)')
      .eq('id', order_id)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const itemRows = order.order_items.map((item: any) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${item.quantity}× ${item.product_name}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">$${item.line_total?.toFixed(2)}</td>
      </tr>
    `).join('')

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your Receipt</title></head>
<body style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;color:#333;">
  <div style="text-align:center;margin-bottom:24px;">
    <h1 style="color:#4A5E2F;margin:0;font-size:22px;">Briar Patch Outdoors</h1>
    <p style="color:#888;margin:4px 0;font-size:13px;">Eatonton, GA · briarpatchoutdoors.com</p>
  </div>

  <div style="background:#f9f9f9;border-radius:8px;padding:16px;margin-bottom:20px;">
    <p style="margin:2px 0;font-size:13px;color:#666;"><strong>Order:</strong> ${order.order_number}</p>
    <p style="margin:2px 0;font-size:13px;color:#666;"><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
    ${order.customers ? `<p style="margin:2px 0;font-size:13px;color:#666;"><strong>Customer:</strong> ${order.customers.first_name} ${order.customers.last_name}</p>` : ''}
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <thead>
      <tr style="background:#f0f0f0;">
        <th style="padding:8px;text-align:left;font-size:12px;font-weight:600;color:#555;">Item</th>
        <th style="padding:8px;text-align:right;font-size:12px;font-weight:600;color:#555;">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <table style="width:100%;margin-bottom:24px;">
    <tr>
      <td style="padding:4px 8px;font-size:13px;color:#666;">Subtotal</td>
      <td style="padding:4px 8px;font-size:13px;color:#666;text-align:right;">$${order.subtotal?.toFixed(2)}</td>
    </tr>
    ${order.discount_amount > 0 ? `
    <tr>
      <td style="padding:4px 8px;font-size:13px;color:#2e7d32;">Discount (${order.discount_percentage}%)</td>
      <td style="padding:4px 8px;font-size:13px;color:#2e7d32;text-align:right;">-$${order.discount_amount?.toFixed(2)}</td>
    </tr>` : ''}
    <tr>
      <td style="padding:4px 8px;font-size:13px;color:#666;">Tax (8%)</td>
      <td style="padding:4px 8px;font-size:13px;color:#666;text-align:right;">$${order.tax?.toFixed(2)}</td>
    </tr>
    <tr style="border-top:2px solid #4A5E2F;">
      <td style="padding:8px;font-size:15px;font-weight:bold;color:#4A5E2F;">Total</td>
      <td style="padding:8px;font-size:15px;font-weight:bold;color:#4A5E2F;text-align:right;">$${order.total?.toFixed(2)}</td>
    </tr>
  </table>

  <p style="text-align:center;color:#888;font-size:12px;">Thank you for shopping with us!<br>Questions? Call us or visit briarpatchoutdoors.com</p>
</body>
</html>
    `

    // Use Resend if configured, otherwise log
    const RESEND_API_KEY = process.env.RESEND_API_KEY

    if (RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Briar Patch Outdoors <receipts@briarpatchoutdoors.com>',
          to: email,
          subject: `Your Receipt – ${order.order_number}`,
          html: htmlBody,
        }),
      })
      if (!res.ok) {
        const err = await res.text()
        return NextResponse.json({ error: err }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    } else {
      // No email provider configured — log for now
      console.log('Receipt email (no provider configured):')
      console.log('To:', email)
      console.log('Order:', order.order_number)
      return NextResponse.json({ success: true, note: 'Email logged (no provider configured)' })
    }

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
