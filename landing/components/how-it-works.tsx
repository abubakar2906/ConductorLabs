import { Check } from 'lucide-react'

const steps = [
  {
    number: '01',
    command: 'Sign in with GitHub',
    title: 'Connect your account',
    description:
      'One click to authorize. Conductor Labs loads your repos and branches automatically. Nothing to configure.',
    output: ['github authorized', 'repos loaded'],
  },
  {
    number: '02',
    command: 'Create a release',
    title: 'Pick a repo and branch',
    description:
      'Give your release a name, select a repo from the dropdown, pick your target branch. Conductor Labs immediately checks the current state.',
    output: ['release created', 'checking status ...'],
  },
  {
    number: '03',
    command: 'See your status',
    title: 'Ready or blocked',
    description:
      'If all PRs are merged and CI is passing, you are ready to ship. If not, you see exactly what is blocking you.',
    output: ['status: ready', '0 items blocking'],
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="mb-14">
          <p className="mb-4 font-mono text-xs tracking-widest text-success">
            {'[ HOW IT WORKS ]'}
          </p>
          <h2 className="max-w-xl text-balance text-3xl font-semibold tracking-tight md:text-5xl">
            Three steps to knowing.
          </h2>
        </div>

        <ol className="grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <li key={step.number} className="flex flex-col">
              <div className="flex items-center gap-3">
                <span className="font-mono text-4xl font-semibold text-success/30 md:text-5xl">
                  {step.number}
                </span>
                <span aria-hidden="true" className="h-px flex-1 bg-border" />
              </div>

              <div className="mt-5 rounded-lg border border-border bg-background p-4">
                <p className="font-mono text-xs text-foreground">{step.command}</p>
                <div className="mt-2 flex flex-col gap-1">
                  {step.output.map((line) => (
                    <p key={line} className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                      <Check className="size-3 text-success" aria-hidden="true" />
                      {line}
                    </p>
                  ))}
                </div>
              </div>

              <h3 className="mt-5 text-base font-medium">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
