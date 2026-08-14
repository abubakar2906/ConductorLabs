import { NextResponse } from 'next/server'
import { sendWaitlistWelcomeEmail } from '@/lib/resend'

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

    // Send confirmation email via Resend and add to Audience (handled in lib/resend.ts)
    await sendWaitlistWelcomeEmail(trimmedEmail)

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
