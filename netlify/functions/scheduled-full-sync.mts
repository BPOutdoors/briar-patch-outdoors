import { schedule } from '@netlify/functions'

// Runs every Wednesday at 2:00 AM Eastern
const handler = schedule('0 6 * * 3', async () => {
  const siteUrl = process.env.URL || process.env.DEPLOY_URL
  const syncKey = process.env.SYNC_SECRET_KEY

  if (!siteUrl || !syncKey) {
    console.error('Missing URL or SYNC_SECRET_KEY environment variable')
    return { statusCode: 500 }
  }

  console.log(`[${new Date().toISOString()}] Running scheduled full product sync...`)

  try {
    const response = await fetch(`${siteUrl}/api/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${syncKey}`,
        'Content-Type': 'application/json',
      },
    })

    const result = await response.json()
    console.log('Full sync result:', JSON.stringify(result))

    if (!result.success) {
      console.error('Full sync failed:', result.error)
    }

    return { statusCode: 200 }
  } catch (error) {
    console.error('Scheduled full sync error:', error)
    return { statusCode: 500 }
  }
})

export { handler }
