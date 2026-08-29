import { cn } from "@/lib/utils";

export type ReleaseStatus = "ready" | "blocked";

export function StatusPill({
  status,
  className,
}: {
  status: ReleaseStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        status === "ready" ? "bg-success/10 text-success" : "bg-warning/10 text-warning",
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          status === "ready" ? "bg-success" : "bg-warning",
        )}
      />
      {status === "ready" ? "Ready" : "Blocked"}
    </span>
  );
}
