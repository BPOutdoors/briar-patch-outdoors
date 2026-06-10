import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return NextResponse.json({ ok: false, reason: 'no resend key' })

  try {
    const { name, email, phone, topic, message } = await request.json()

    if (!name || !email || !topic || !message) {
      return NextResponse.json({ ok: false, reason: 'missing fields' }, { status: 400 })
    }

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#4A5E2F;padding:24px 28px;border-radius:12px 12px 0 0">
      <h1 style="margin:0;color:white;font-size:18px;font-weight:700">New Contact Form Submission</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:13px">Briar Patch Outdoors Website</p>
    </div>
    <div style="background:white;padding:28px;border-radius:0 0 12px 12px">

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;width:120px">
            <span style="font-size:12px;font-weight:700;text-transform:uppercase;color:#999;letter-spacing:.05em">Topic</span>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f0">
            <span style="font-size:14px;font-weight:700;color:#4A5E2F">${topic}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f0">
            <span style="font-size:12px;font-weight:700;text-transform:uppercase;color:#999;letter-spacing:.05em">Name</span>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f0">
            <span style="font-size:14px;color:#1a1a1a">${name}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f0">
            <span style="font-size:12px;font-weight:700;text-transform:uppercase;color:#999;letter-spacing:.05em">Email</span>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f0">
            <a href="mailto:${email}" style="font-size:14px;color:#4A5E2F">${email}</a>
          </td>
        </tr>
        ${phone ? `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f0">
            <span style="font-size:12px;font-weight:700;text-transform:uppercase;color:#999;letter-spacing:.05em">Phone</span>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f0">
            <a href="tel:${phone.replace(/\D/g, '')}" style="font-size:14px;color:#4A5E2F">${phone}</a>
          </td>
        </tr>` : ''}
      </table>

      <div style="background:#f8f8f6;border-radius:8px;padding:16px">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;color:#999;letter-spacing:.05em">Message</p>
        <p style="margin:0;font-size:14px;color:#333;line-height:1.6;white-space:pre-wrap">${message}</p>
      </div>

      <div style="margin-top:20px;padding-top:16px;border-top:1px solid #f0f0f0;text-align:center">
        <a href="mailto:${email}" style="display:inline-block;background:#4A5E2F;color:white;font-weight:700;font-size:13px;padding:10px 24px;border-radius:8px;text-decoration:none">
          Reply to ${name}
        </a>
      </div>

    </div>
  </div>
</body>
</html>`

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Briar Patch Outdoors <noreply@briarpatchoutdoors.com>',
        to: 'services@briarpatchoutdoors.com',
        reply_to: email,
        subject: `[${topic}] Message from ${name}`,
        html,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Resend error:', err)
      return NextResponse.json({ ok: false, error: err }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Contact form error:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
