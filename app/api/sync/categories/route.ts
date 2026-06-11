import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as ftp from 'basic-ftp'
import { Writable } from 'stream'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

    // Find and download the categories CSV
    const rootList = await client.list()
    const csvFile = rootList.find(f => f.name.includes('New Item Categories') && f.name.endsWith('.csv'))
    if (!csvFile) {
      client.close()
      return NextResponse.json({ error: 'Category CSV file not found on FTP' }, { status: 404 })
    }

    const chunks: Buffer[] = []
    const writable = new Writable({
      write(chunk, _enc, cb) { chunks.push(chunk); cb() }
    })
    await client.downloadTo(writable, csvFile.name)
    client.close()

    const text = Buffer.concat(chunks).toString('utf8')
    const lines = text.split('\n').map(l => l.replace(/\r/g, '').trim()).filter(Boolean)

    // Skip header row if present (check if first column is non-numeric)
    const dataLines = lines.filter(l => {
      const firstCol = l.split(',')[0].trim()
      return /^\d+$/.test(firstCol)
    })

    // Build lookup maps from the CSV
    // Format: category_code, category_name, group_code, group_name, subgroup1_code, subgroup1_name, subgroup2_code, subgroup2_name
    const categoryMap = new Map<string, string>()      // code -> name
    const groupMap = new Map<string, string>()          // code -> name
    const subGroup1Map = new Map<string, string>()      // code -> name
    const subGroup2Map = new Map<string, string>()      // code -> name

    for (const line of dataLines) {
      // Handle CSV with possible quoted fields
      const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim())
      const [catCode, catName, grpCode, grpName, sub1Code, sub1Name, sub2Code, sub2Name] = cols

      if (catCode && catName) categoryMap.set(catCode, catName)
      if (grpCode && grpName) groupMap.set(grpCode, grpName)
      if (sub1Code && sub1Name) subGroup1Map.set(sub1Code, sub1Name)
      if (sub2Code && sub2Name) subGroup2Map.set(sub2Code, sub2Name)
    }

    console.log(`Parsed ${categoryMap.size} categories, ${groupMap.size} groups, ${subGroup1Map.size} sub-groups`)

    // Fetch all products with their category codes
    let updatedCount = 0
    let offset = 0
    const pageSize = 500

    while (true) {
      const { data: products, error } = await supabase
        .from('products')
        .select('id, kinsey_sku, name, category, product_group_code, product_sub_group_1, product_sub_group_2')
        .range(offset, offset + pageSize - 1)

      if (error) throw error
      if (!products || products.length === 0) break

      // Build update records — include kinsey_sku so upsert doesn't violate not-null
      const updates = products
        .map((p: any) => ({
          id: p.id,
          kinsey_sku: p.kinsey_sku,
          name: p.name,
          category_name: p.category ? (categoryMap.get(String(p.category)) || null) : null,
          product_group_name: p.product_group_code ? (groupMap.get(p.product_group_code) || null) : null,
          sub_group_1_name: p.product_sub_group_1 ? (subGroup1Map.get(p.product_sub_group_1) || null) : null,
          sub_group_2_name: p.product_sub_group_2 ? (subGroup2Map.get(p.product_sub_group_2) || null) : null,
        }))

      if (updates.length > 0) {
        const { error: updateError } = await supabase
          .from('products')
          .upsert(updates, { onConflict: 'id' })

        if (updateError) throw updateError
        updatedCount += updates.length
      }

      if (products.length < pageSize) break
      offset += pageSize
    }

    return NextResponse.json({
      success: true,
      csvFile: csvFile.name,
      categoriesFound: categoryMap.size,
      groupsFound: groupMap.size,
      productsUpdated: updatedCount,
    })

  } catch (error: any) {
    try { client.close() } catch {}
    return NextResponse.json({ success: false, error: error.message, stack: error.stack }, { status: 200 })
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Use POST to trigger category sync' })
}
