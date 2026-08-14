import { Activity, Eye, GitPullRequest, Workflow } from 'lucide-react'

const features = [
  {
    index: 'CHK-01',
    icon: GitPullRequest,
    title: 'PR Status',
    description:
      'See every open pull request targeting your release branch. If any are still open, you are blocked. No scanning through GitHub.',
    detail: 'OPEN PRS · RELEASE BRANCH',
  },
  {
    index: 'CHK-02',
    icon: Activity,
    title: 'CI Status',
    description:
      'See every check run on the latest commit of your branch. If any are failing or still running, you are blocked. No clicking into commits.',
    detail: 'PASSING · FAILING · PENDING',
  },
  {
    index: 'CHK-03',
    icon: Workflow,
    title: 'GitHub Connected',
    description:
      'Sign in with GitHub, pick a repo, pick a branch. Conductor Labs watches it and keeps your status current automatically.',
    detail: 'ONE-CLICK SETUP',
  },
  {
    index: 'CHK-04',
    icon: Eye,
    title: 'Blocking Items Listed',
    description:
      'When something is blocking your release, you see exactly what: the PR number, the CI check name, and the current status. Nothing hidden.',
    detail: 'PR NUMBER · CHECK NAME · STATUS',
  },
]

export function Features() {
  return (
    <section id="features" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="mb-14 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-4 font-mono text-xs tracking-widest text-success">
              {'[ WHAT YOU GET ]'}
            </p>
            <h2 className="max-w-xl text-balance text-3xl font-semibold tracking-tight md:text-5xl">
              One screen. One answer.
            </h2>
          </div>
          <p className="max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
            Conductor Labs checks two things and gives you a clear status:
            ready or blocked.
          </p>
        </div>

        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.index}
              className="group bg-background p-8 transition-colors hover:bg-card"
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="font-mono text-xs tracking-widest text-muted-foreground">
                  {feature.index}
                </span>
                <feature.icon
                  className="size-4 text-muted-foreground transition-colors group-hover:text-success"
                  aria-hidden="true"
                />
              </div>
              <h3 className="text-lg font-medium">{feature.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
              <p className="mt-6 font-mono text-xs tracking-widest text-success/70">
                {feature.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
