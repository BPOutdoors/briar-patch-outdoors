import { schedule } from '@netlify/functions'

// Runs every day at 6:00 AM and 6:00 PM Eastern
const handler = schedule('0 10,22 * * *', async () => {
  const siteUrl = process.env.URL || process.env.DEPLOY_URL
  const syncKey = process.env.SYNC_SECRET_KEY

  if (!siteUrl || !syncKey) {
    console.error('Missing URL or SYNC_SECRET_KEY environment variable')
    return { statusCode: 500 }
  }

  console.log(`[${new Date().toISOString()}] Running scheduled inventory sync...`)

  try {
    const response = await fetch(`${siteUrl}/api/sync/inventory`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${syncKey}`,
        'Content-Type': 'application/json',
      },
    })

    const result = await response.json()
    console.log('Inventory sync result:', JSON.stringify(result))

    if (!result.success) {
      console.error('Inventory sync failed:', result.error)
    }

    return { statusCode: 200 }
  } catch (error) {
    console.error('Scheduled inventory sync error:', error)
    return { statusCode: 500 }
  }
})

export { handler }
