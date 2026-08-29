import Link from 'next/link'
import { ConductorLogo } from '@/components/conductor-logo'
import { SIGN_UP_URL } from '@/lib/app-url'

const navLinks = [
  { label: 'Product', href: '#product' },
  { label: 'Manifesto', href: '#manifesto' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Changelog', href: '#changelog' },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <ConductorLogo className="size-5" />
          <span className="font-mono text-sm font-semibold tracking-tight">CONDUCTOR LABS</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 font-mono text-xs text-muted-foreground lg:flex">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-success" aria-hidden="true" />
            ALL SYSTEMS GO
          </span>
          <a
            href={SIGN_UP_URL}
            className="inline-flex h-7 items-center justify-center rounded-lg bg-primary px-2.5 font-mono text-[0.8rem] font-medium uppercase tracking-wider text-primary-foreground transition-all hover:bg-primary/80"
          >
            Get Started
          </a>
        </div>
      </div>
    </header>
  )
}
