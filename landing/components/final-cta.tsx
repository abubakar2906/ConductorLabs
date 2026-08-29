import { ArrowRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { SIGN_UP_URL } from '@/lib/app-url'
import { cn } from '@/lib/utils'

export function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-border">
      <div aria-hidden="true" className="absolute inset-0 bg-grid-faint" />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-background"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 py-24 md:py-36">
        <p className="mb-6 flex items-center gap-2 font-mono text-xs tracking-widest text-success">
          <span className="size-1.5 animate-pulse-dot rounded-full bg-success" aria-hidden="true" />
          ALL CHECKS PASSING
        </p>
        <h2 className="max-w-3xl text-balance text-center text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
          Stop checking tabs.
          <br />
          Start <span className="text-success text-glow-primary">shipping</span>.
        </h2>
        <p className="mt-6 max-w-md text-center text-pretty leading-relaxed text-muted-foreground">
          Connect your GitHub repo, create a release, and know whether you are
          safe to deploy. One screen. One answer.
        </p>
        <div className="mt-10 flex w-full max-w-md flex-col items-center gap-2">
          <a
            href={SIGN_UP_URL}
            className={cn(buttonVariants({ size: 'lg' }), 'font-mono text-xs uppercase tracking-wider hover:bg-primary/80')}
          >
            Get Started
            <ArrowRight className="size-3.5" />
          </a>
          <p className="font-mono text-[11px] text-muted-foreground">
            Free while in beta · Takes 30 seconds
          </p>
        </div>
      </div>
    </section>
  )
}
