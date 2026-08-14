import {
  Check,
  CircleAlert,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequest,
  Rocket,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const checks = [
  { label: 'All open PRs merged', status: 'ready' },
  { label: 'CI checks passing', status: 'blocked' },
]

const timeline = [
  {
    icon: GitMerge,
    title: 'PR #482 merged',
    detail: 'fix: race condition in webhook queue',
    time: '2m ago',
  },
  {
    icon: Check,
    title: 'CI check passed',
    detail: 'build / lint / test',
    time: '14m ago',
  },
  {
    icon: GitCommitHorizontal,
    title: 'Commit pushed',
    detail: 'release/v2.14.0',
    time: '1h ago',
  },
  {
    icon: GitPullRequest,
    title: 'PR #479 opened',
    detail: 'chore: bump SDK to 4.2.1',
    time: '3h ago',
  },
]

function StatusPill({ status }: { status: 'ready' | 'blocked' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        status === 'ready' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning',
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          status === 'ready' ? 'bg-success' : 'bg-warning',
        )}
      />
      {status === 'ready' ? 'Ready' : 'Blocked'}
    </span>
  )
}

export function ProductMockup() {
  return (
    <div
      role="img"
      aria-label="Conductor Labs dashboard showing release readiness checks and repository status for the v2.14.0 release"
      className="relative overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/40"
    >
      {/* Window chrome */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-muted" />
            <span className="size-2.5 rounded-full bg-muted" />
            <span className="size-2.5 rounded-full bg-muted" />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <GitBranch className="size-3.5" />
            <span className="font-mono">acme/platform</span>
            <span className="text-border">/</span>
            <span className="font-mono">release/v2.14.0</span>
          </div>
        </div>
        <StatusPill status="blocked" />
      </div>

      <div className="grid gap-px bg-border md:grid-cols-5">
        {/* Release readiness card */}
        <div className="bg-card p-5 md:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium">Release Readiness</h3>
            <span className="font-mono text-xs text-muted-foreground">v2.14.0</span>
          </div>

          <ul className="flex flex-col gap-3">
            {checks.map((check) => (
              <li key={check.label} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {check.status === 'ready' ? (
                    <span className="flex size-5 items-center justify-center rounded-full bg-success/10">
                      <Check className="size-3 text-success" />
                    </span>
                  ) : (
                    <span className="flex size-5 items-center justify-center rounded-full bg-warning/10">
                      <CircleAlert className="size-3 text-warning" />
                    </span>
                  )}
                  <span className="text-sm text-card-foreground">{check.label}</span>
                </div>
                <StatusPill status={check.status as 'ready' | 'blocked'} />
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-lg border border-border bg-muted/40 p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Readiness score</span>
              <span className="font-mono font-medium text-card-foreground">1 / 2</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/2 rounded-full bg-success" />
            </div>
          </div>

          <button
            type="button"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground opacity-60"
            disabled
          >
            <Rocket className="size-3.5" />
            Deploy to production
          </button>
        </div>

        {/* Timeline */}
        <div className="bg-card p-5 md:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium">Recent Activity</h3>
            <span className="text-xs text-muted-foreground">GitHub</span>
          </div>

          <ol className="relative flex flex-col gap-5 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-border">
            {timeline.map((event) => (
              <li key={event.title} className="relative flex items-start gap-3 pl-0.5">
                <span className="relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-card">
                  <event.icon className="size-3 text-muted-foreground" />
                </span>
                <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-card-foreground">{event.title}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {event.detail}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{event.time}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
