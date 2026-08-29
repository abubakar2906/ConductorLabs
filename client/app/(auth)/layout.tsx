import { ConductorLogo } from "@/components/conductor-logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="flex items-center gap-2.5">
        <ConductorLogo className="size-6" />
        <span className="font-mono text-sm font-semibold tracking-tight uppercase">
          Conductor Labs
        </span>
      </div>
      {children}
      <p className="font-mono text-xs text-muted-foreground">Ready or blocked. That&apos;s it.</p>
    </div>
  );
}
