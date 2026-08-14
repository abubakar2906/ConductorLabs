import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const _geistSans = Geist({ subsets: ['latin'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Conductor Labs — Know when you’re safe to ship',
  description:
    'Conductor Labs connects to your GitHub repo, watches your branch, and tells you whether you are safe to deploy. One screen. One answer.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/conductor-mark-dark.svg',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/conductor-mark-light.svg',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/conductor-mark-dark.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/conductor-app-icon-dark-1024.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#141517',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
