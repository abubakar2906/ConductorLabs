import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
        <div className="mt-10 flex items-center gap-3">
          <Button size="lg" className="font-mono text-xs uppercase tracking-wider">
            Get Started
            <ArrowRight className="size-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-border bg-transparent font-mono text-xs uppercase tracking-wider text-foreground hover:bg-secondary"
          >
            Talk to us
          </Button>
        </div>
      </div>
    </section>
  )
}
