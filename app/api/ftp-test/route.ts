import { NextResponse } from 'next/server'
import * as ftp from 'basic-ftp'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.SYNC_SECRET_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const client = new ftp.Client()
  client.ftp.verbose = false

  try {
    await client.access({
      host: process.env.KINSEYS_FTP_HOST!,
      port: parseInt(process.env.KINSEYS_FTP_PORT || '21'),
      user: process.env.KINSEYS_FTP_USER!,
      password: process.env.KINSEYS_FTP_PASSWORD!,
      secure: false,
    })

    // Find the image folder (type 3 = symlink) and drill into 1024x1024 Item Images
    const rootList = await client.list()

    // List the 1024x1024 subfolder
    let imageFiles: any[] = []
    let imageFolderPath = ''
    for (const item of rootList) {
      try {
        const level1 = await client.list(`/${item.name}`)
        const imgFolder = level1.find(f => f.name.includes('1024'))
        if (imgFolder) {
          imageFolderPath = `/${item.name}/${imgFolder.name}`
          const files = await client.list(imageFolderPath)
          imageFiles = files.slice(0, 20).map(f => ({ name: f.name, type: f.type, size: f.size }))
          break
        }
      } catch {}
    }

    client.close()

    return NextResponse.json({
      success: true,
      imageFolderPath,
      totalShown: imageFiles.length,
      imageFiles,
    })

  } catch (error: any) {
    client.close()
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code || null,
      host: process.env.KINSEYS_FTP_HOST || 'NOT SET',
      port: process.env.KINSEYS_FTP_PORT || 'NOT SET',
      userSet: !!process.env.KINSEYS_FTP_USER,
      passwordSet: !!process.env.KINSEYS_FTP_PASSWORD,
    }, { status: 200 }) // Return 200 so PowerShell shows the body
  }
}
