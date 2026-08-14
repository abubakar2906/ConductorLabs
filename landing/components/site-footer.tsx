import Link from 'next/link'
import { ConductorLogo } from '@/components/conductor-logo'

const footerColumns = [
  {
    heading: 'PRODUCT',
    links: ['Features', 'Integrations', 'Changelog', 'Pricing'],
  },
  {
    heading: 'COMPANY',
    links: ['About', 'Blog', 'Careers', 'Contact'],
  },
  {
    heading: 'RESOURCES',
    links: ['Docs', 'API Reference', 'Status', 'Security'],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div className="flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <ConductorLogo className="size-5" />
              <span className="font-mono text-sm font-semibold tracking-tight">CONDUCTOR LABS</span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Deployment readiness for small engineering teams. Know before you ship.
            </p>
            <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span className="size-1.5 animate-pulse-dot rounded-full bg-success" aria-hidden="true" />
              ALL SYSTEMS OPERATIONAL
            </p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {footerColumns.map((column) => (
              <div key={column.heading} className="flex flex-col gap-3">
                <h3 className="font-mono text-xs tracking-widest text-muted-foreground">
                  {column.heading}
                </h3>
                <ul className="flex flex-col gap-2.5">
                  {column.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="font-mono text-xs text-muted-foreground">
            © 2026 CONDUCTOR LABS, INC.
          </p>
          <div className="flex gap-5">
            <a href="#" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              Privacy
            </a>
            <a href="#" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
