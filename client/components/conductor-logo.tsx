// Brand mark, ported from the landing site (landing/components/conductor-logo.tsx)
// so the dashboard shares one source of truth for the logo.
export function ConductorLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Conductor Labs"
      className={className}
    >
      <rect width="100" height="100" rx="25" className="fill-foreground" />
      <path
        d="M74 27.5C68.4 21.6 60.9 18 52 18C33.2 18 20 31.4 20 50S33.2 82 52 82C60.9 82 68.4 78.4 74 72.5"
        fill="none"
        stroke="var(--background)"
        strokeLinecap="square"
        strokeWidth="14"
      />
      <path d="M73 41H85V59H73" fill="var(--background)" />
    </svg>
  );
}
