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
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium sm:px-2.5 sm:text-xs',
        status === 'ready' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning',
      )}
    >
      <span
        className={cn(
          'size-1.5 shrink-0 rounded-full',
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
      className="relative w-full overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/40"
    >
      {/* Window chrome */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="flex shrink-0 gap-1.5" aria-hidden="true">
            <span className="size-2 rounded-full bg-muted sm:size-2.5" />
            <span className="size-2 rounded-full bg-muted sm:size-2.5" />
            <span className="size-2 rounded-full bg-muted sm:size-2.5" />
          </div>
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
            <GitBranch className="size-3 shrink-0 sm:size-3.5" />
            <span className="truncate font-mono">acme/platform</span>
            <span className="shrink-0 text-border">/</span>
            <span className="truncate font-mono">release/v2.14.0</span>
          </div>
        </div>
        <StatusPill status="blocked" />
      </div>

      <div className="grid gap-px bg-border md:grid-cols-5">
        {/* Release readiness card */}
        <div className="bg-card p-4 sm:p-5 md:col-span-2">
          <div className="mb-3 flex items-center justify-between sm:mb-4">
            <h3 className="text-xs font-medium sm:text-sm">Release Readiness</h3>
            <span className="font-mono text-[11px] text-muted-foreground sm:text-xs">v2.14.0</span>
          </div>

          <ul className="flex flex-col gap-2.5 sm:gap-3">
            {checks.map((check) => (
              <li key={check.label} className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
                  {check.status === 'ready' ? (
                    <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-success/10 sm:size-5">
                      <Check className="size-2.5 text-success sm:size-3" />
                    </span>
                  ) : (
                    <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-warning/10 sm:size-5">
                      <CircleAlert className="size-2.5 text-warning sm:size-3" />
                    </span>
                  )}
                  <span className="truncate text-xs text-card-foreground sm:text-sm">{check.label}</span>
                </div>
                <StatusPill status={check.status as 'ready' | 'blocked'} />
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-2.5 sm:mt-5 sm:p-3">
            <div className="mb-1.5 flex items-center justify-between text-[11px] sm:mb-2 sm:text-xs">
              <span className="text-muted-foreground">Readiness score</span>
              <span className="font-mono font-medium text-card-foreground">1 / 2</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/2 rounded-full bg-success" />
            </div>
          </div>

          <button
            type="button"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground opacity-60 sm:mt-5 sm:text-sm"
            disabled
          >
            <Rocket className="size-3 sm:size-3.5" />
            Deploy to production
          </button>
        </div>

        {/* Timeline */}
        <div className="bg-card p-4 sm:p-5 md:col-span-3">
          <div className="mb-3 flex items-center justify-between sm:mb-4">
            <h3 className="text-xs font-medium sm:text-sm">Recent Activity</h3>
            <span className="text-[11px] text-muted-foreground sm:text-xs">GitHub</span>
          </div>

          <ol className="relative flex flex-col gap-4 before:absolute before:top-2 before:bottom-2 before:left-[9px] before:w-px before:bg-border sm:gap-5 sm:before:left-[11px]">
            {timeline.map((event) => (
              <li key={event.title} className="relative flex items-start gap-2.5 pl-0.5 sm:gap-3">
                <span className="relative z-10 flex size-4.5 shrink-0 items-center justify-center rounded-full border border-border bg-card sm:size-5">
                  <event.icon className="size-2.5 text-muted-foreground sm:size-3" />
                </span>
                <div className="flex min-w-0 flex-1 items-start justify-between gap-2 sm:gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-card-foreground sm:text-sm">{event.title}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground sm:text-xs">
                      {event.detail}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground sm:text-xs">{event.time}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
