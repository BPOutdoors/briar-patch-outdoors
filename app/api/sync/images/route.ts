import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as ftp from 'basic-ftp'
import { Writable } from 'stream'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FTP_IMAGE_PATH = '/images/1024x1024 Item Images'
const BUCKET = 'product-images'
const BATCH_SIZE = 50

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.SYNC_SECRET_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const client = new ftp.Client()
  client.ftp.verbose = false

  try {
    // Connect to FTP
    await client.access({
      host: process.env.KINSEYS_FTP_HOST!,
      port: parseInt(process.env.KINSEYS_FTP_PORT || '21'),
      user: process.env.KINSEYS_FTP_USER!,
      password: process.env.KINSEYS_FTP_PASSWORD!,
      secure: false,
    })

    // Get products that don't have an image yet, in batches
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, kinsey_sku')
      .is('image_url', null)
      .not('kinsey_sku', 'is', null)
      .limit(BATCH_SIZE)

    if (fetchError) throw fetchError
    if (!products || products.length === 0) {
      client.close()
      return NextResponse.json({ success: true, message: 'All products already have images', processed: 0 })
    }

    let downloaded = 0
    let notFound = 0
    let errors = 0

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

    for (const product of products) {
      const filename = `${product.kinsey_sku}_1.jpg`
      const remotePath = `${FTP_IMAGE_PATH}/${filename}`
      const storagePath = `kinseys/${filename}`

      try {
        // Download from FTP into buffer
        const chunks: Buffer[] = []
        const writable = new Writable({
          write(chunk, _enc, cb) { chunks.push(chunk); cb() }
        })

        await client.downloadTo(writable, remotePath)
        const buffer = Buffer.concat(chunks)

        if (buffer.length === 0) {
          // Mark as checked so we don't retry endlessly
          await supabase.from('products').update({ image_url: 'none' }).eq('id', product.id)
          notFound++
          continue
        }

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, buffer, {
            contentType: 'image/jpeg',
            upsert: true,
          })

        if (uploadError) {
          console.error(`Upload error for ${filename}:`, uploadError.message)
          errors++
          continue
        }

        // Build public URL
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`

        // Update product image_url
        await supabase
          .from('products')
          .update({ image_url: publicUrl })
          .eq('id', product.id)

        downloaded++
      } catch (err: any) {
        // File not found on FTP = normal, mark so we don't retry endlessly
        if (err.code === 550 || err.message?.includes('550') || err.message?.includes('No such file')) {
          await supabase.from('products').update({ image_url: 'none' }).eq('id', product.id)
          notFound++
        } else {
          console.error(`Error processing ${product.kinsey_sku}:`, err.message)
          errors++
        }
      }
    }

    client.close()

    // Check how many still need images (null = not yet attempted)
    const { count: remaining } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .is('image_url', null)
      .not('kinsey_sku', 'is', null)

    return NextResponse.json({
      success: true,
      batchSize: products.length,
      downloaded,
      notFound,
      errors,
      remainingWithoutImages: remaining || 0,
      keepRunning: (remaining || 0) > 0,
    })

  } catch (error: any) {
    try { client.close() } catch {}
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function GET() {
  // Status check — how many products have real images, none-marked, or not yet attempted
  const { count: withImages } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .not('image_url', 'is', null)
    .neq('image_url', 'none')
    .eq('visible', true)

  const { count: notOnFtp } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('image_url', 'none')
    .eq('visible', true)

  const { count: notYetAttempted } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .is('image_url', null)
    .eq('visible', true)

  return NextResponse.json({ withImages, notOnFtp, notYetAttempted })
}
