import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return NextResponse.json({ ok: false, reason: 'no resend key' })

  try {
    const { order_number, customer, items, subtotal, tax, shipping_cost, total, fulfillment, shipping_address, has_out_of_stock } = await request.json()

    const isGa = fulfillment === 'pickup' || shipping_address?.state === 'GA'
    const itemRows = items.map((item: any) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0">
          <div style="font-weight:600;font-size:14px">${item.name}</div>
          <div style="font-size:12px;color:#888">${item.brand || ''}</div>
          ${!item.in_stock ? '<div style="font-size:12px;color:#92400e;font-weight:600">Ships when available</div>' : ''}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:center;color:#666;font-size:14px">${item.quantity}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#4A5E2F">$${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `).join('')

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:24px">

    <!-- Header -->
    <div style="background:#4A5E2F;padding:28px 32px;border-radius:12px 12px 0 0;text-align:center">
      <h1 style="margin:0;color:white;font-size:22px;font-weight:700">Briar Patch Outdoors</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px">Order Confirmed</p>
    </div>

    <!-- Body -->
    <div style="background:white;padding:32px;border-radius:0 0 12px 12px">

      <div style="text-align:center;margin-bottom:28px">
        <div style="display:inline-block;background:#d4edda;border-radius:50%;width:56px;height:56px;line-height:56px;text-align:center;font-size:26px;margin-bottom:12px">✓</div>
        <h2 style="margin:0;color:#1a1a1a;font-size:20px">Thank you, ${customer.first_name}!</h2>
        <p style="margin:8px 0 0;color:#666;font-size:14px">Your order <strong style="color:#4A5E2F">${order_number}</strong> has been received.</p>
      </div>

      ${has_out_of_stock ? `
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;margin-bottom:24px;font-size:13px;color:#92400e">
        <strong>Note:</strong> One or more items in your order are out of stock with our distributor. We'll confirm availability and contact you once your items ship.
      </div>` : ''}

      <!-- Fulfillment -->
      <div style="background:#f8f4ef;border-radius:8px;padding:16px;margin-bottom:24px">
        ${fulfillment === 'pickup' ? `
        <p style="margin:0;font-size:14px;font-weight:700;color:#4A5E2F">📍 Local Pickup — Eatonton, GA</p>
        <p style="margin:6px 0 0;font-size:13px;color:#666">We'll contact you at ${customer.email} when your order is ready.</p>
        <p style="margin:4px 0 0;font-size:12px;color:#888">1015 N Jefferson Ave, Eatonton, GA 31024 · (706) 749-6994</p>
        ` : `
        <p style="margin:0;font-size:14px;font-weight:700;color:#4A5E2F">📦 Shipping to:</p>
        <p style="margin:6px 0 0;font-size:13px;color:#666">
          ${shipping_address?.address}<br/>
          ${shipping_address?.city}, ${shipping_address?.state} ${shipping_address?.zip}
        </p>
        `}
      </div>

      <!-- Items -->
      <h3 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#1a1a1a;text-transform:uppercase;letter-spacing:.05em">Your Items</h3>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:2px solid #f0f0f0">
            <th style="text-align:left;font-size:12px;color:#888;padding-bottom:8px;font-weight:600;text-transform:uppercase">Item</th>
            <th style="text-align:center;font-size:12px;color:#888;padding-bottom:8px;font-weight:600;text-transform:uppercase">Qty</th>
            <th style="text-align:right;font-size:12px;color:#888;padding-bottom:8px;font-weight:600;text-transform:uppercase">Price</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <!-- Totals -->
      <div style="margin-top:20px;border-top:2px solid #f0f0f0;padding-top:16px">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="font-size:13px;color:#666;padding:3px 0">Subtotal</td>
            <td style="font-size:13px;color:#666;padding:3px 0;text-align:right">$${subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#666;padding:3px 0">Shipping</td>
            <td style="font-size:13px;color:#666;padding:3px 0;text-align:right">${shipping_cost === 0 ? 'Free' : `$${shipping_cost.toFixed(2)}`}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#666;padding:3px 0">Tax${isGa ? ' (GA 8%)' : ''}</td>
            <td style="font-size:13px;color:#666;padding:3px 0;text-align:right">${isGa ? `$${tax.toFixed(2)}` : 'Not collected'}</td>
          </tr>
          <tr style="border-top:1px solid #f0f0f0">
            <td style="font-size:16px;font-weight:700;color:#4A5E2F;padding:10px 0 0">Total</td>
            <td style="font-size:16px;font-weight:700;color:#4A5E2F;padding:10px 0 0;text-align:right">$${total.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-top:28px">
        <a href="https://briarpatchoutdoors.com/account/orders"
          style="display:inline-block;background:#4A5E2F;color:white;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none">
          View Order Status
        </a>
      </div>

      <!-- Footer -->
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid #f0f0f0;text-align:center">
        <p style="font-size:12px;color:#aaa;margin:0">Questions? Reply to this email or call us at <a href="tel:7067496994" style="color:#4A5E2F">(706) 749-6994</a></p>
        <p style="font-size:12px;color:#aaa;margin:6px 0 0">1015 N Jefferson Ave, Eatonton, GA 31024</p>
      </div>

    </div>
  </div>
</body>
</html>`

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Briar Patch Outdoors <orders@briarpatchoutdoors.com>',
        to: customer.email,
        subject: `Order Confirmed — ${order_number} | Briar Patch Outdoors`,
        html,
      }),
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Order confirmation email error:', e)
    return NextResponse.json({ ok: false, error: e.message })
  }
}
