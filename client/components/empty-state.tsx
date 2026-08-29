import { Rocket } from "lucide-react";

export function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-20 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-secondary">
        <Rocket className="size-5 text-muted-foreground" />
      </span>
      <p className="mt-4 text-sm text-muted-foreground">
        No releases yet. Create one to start tracking readiness.
      </p>
      <button
        type="button"
        onClick={onNew}
        className="mt-5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 active:translate-y-px"
      >
        New Release
      </button>
    </div>
  );
}
