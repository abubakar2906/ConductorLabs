import { ProductMockup } from '@/components/product-mockup'
import { WaitlistForm } from '@/components/waitlist-form'

export function Hero() {
  return (
    <section id="product" className="relative overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 bg-grid-faint" />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background"
      />

      <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-14 sm:px-6 sm:pt-20 sm:pb-16 md:pt-28">
        <div className="mb-8 flex items-center gap-3 font-mono text-xs tracking-widest text-muted-foreground">
          <span className="text-success">{'[ RELEASE CONTROL ]'}</span>
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
          <span className="hidden sm:inline">READY OR BLOCKED. THAT&apos;S IT.</span>
        </div>

        <h1 className="max-w-4xl text-balance text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl lg:text-8xl">
          Know when you&apos;re{' '}
          <span className="text-success text-glow-primary">safe</span> to ship.
        </h1>

        <div className="mt-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <p className="max-w-md text-pretty leading-relaxed text-muted-foreground">
            Conductor Labs connects to your GitHub repo, watches your branch,
            and tells you one thing: whether you are safe to deploy.
          </p>

          <div className="flex w-full flex-col gap-2 md:w-auto">
            <WaitlistForm inputId="hero-waitlist-email" />
            <p className="font-mono text-[11px] text-muted-foreground">
              Request early access · Instant GitHub onboarding
            </p>
          </div>
        </div>

        <div className="relative mt-16">
          <div
            aria-hidden="true"
            className="absolute -inset-x-8 -top-8 h-40 rounded-full bg-success/5 blur-3xl"
          />
          <ProductMockup />
        </div>
      </div>
    </section>
  )
}
