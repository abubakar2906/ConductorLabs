import { cn } from "@/lib/utils";

export type ReleaseStatus = "ready" | "running" | "blocked";

const PILL: Record<ReleaseStatus, { pill: string; dot: string; label: string }> = {
  ready: { pill: "bg-success/10 text-success", dot: "bg-success", label: "Ready" },
  running: {
    pill: "bg-running/10 text-running",
    dot: "bg-running animate-pulse-dot",
    label: "Running",
  },
  blocked: { pill: "bg-warning/10 text-warning", dot: "bg-warning", label: "Blocked" },
};

export function StatusPill({
  status,
  className,
}: {
  status: ReleaseStatus;
  className?: string;
}) {
  const { pill, dot, label } = PILL[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        pill,
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", dot)} />
      {label}
    </span>
  );
}