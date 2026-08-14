import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Email address is required.' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const trimmedEmail = email.trim().toLowerCase()

    if (!emailRegex.test(trimmedEmail)) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid email address.' },
        { status: 400 }
      )
    }

    const dataDir = path.join(process.cwd(), 'data')
    const filePath = path.join(dataDir, 'waitlist.json')

    try {
      await fs.mkdir(dataDir, { recursive: true })
    } catch {
      // Directory exists or created
    }

    let waitlist: Array<{ email: string; createdAt: string }> = []
    try {
      const fileData = await fs.readFile(filePath, 'utf-8')
      waitlist = JSON.parse(fileData)
    } catch {
      waitlist = []
    }

    const existingIndex = waitlist.findIndex((entry) => entry.email === trimmedEmail)
    if (existingIndex !== -1) {
      return NextResponse.json({
        success: true,
        alreadyRegistered: true,
        message: "You're already on the waitlist! We'll reach out soon.",
      })
    }

    waitlist.push({
      email: trimmedEmail,
      createdAt: new Date().toISOString(),
    })

    await fs.writeFile(filePath, JSON.stringify(waitlist, null, 2), 'utf-8')

    return NextResponse.json({
      success: true,
      message: "You're on the list! We'll notify you as soon as early access opens.",
    })
  } catch (error) {
    console.error('Waitlist submission error:', error)
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again later.' },
      { status: 500 }
    )
  }
}
