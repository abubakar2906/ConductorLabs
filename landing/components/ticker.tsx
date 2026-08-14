const events = [
  { text: 'PR #482 MERGED', tone: 'ok' },
  { text: 'CI CHECKS PASSING', tone: 'ok' },
  { text: 'PR #478 STILL OPEN', tone: 'warn' },
  { text: 'RELEASE v2.14.0 READY', tone: 'ok' },
  { text: 'CI CHECK PENDING', tone: 'warn' },
  { text: 'PR #479 MERGED', tone: 'ok' },
  { text: 'ALL PRS MERGED', tone: 'ok' },
  { text: 'READINESS 2/2', tone: 'ok' },
] as const

function TickerRow() {
  return (
    <>
      {events.map((event, i) => (
        <span key={i} className="flex shrink-0 items-center gap-3 px-6">
          <span
            aria-hidden="true"
            className={
              event.tone === 'ok'
                ? 'size-1.5 rounded-full bg-success'
                : 'size-1.5 rounded-full bg-warning'
            }
          />
          <span
            className={
              event.tone === 'ok'
                ? 'font-mono text-xs tracking-widest text-muted-foreground'
                : 'font-mono text-xs tracking-widest text-warning'
            }
          >
            {event.text}
          </span>
        </span>
      ))}
    </>
  )
}

export function Ticker() {
  return (
    <div
      aria-label="Live release event feed"
      className="relative overflow-hidden border-y border-border bg-card py-3"
    >
      <div className="flex w-max animate-marquee">
        <TickerRow />
        <TickerRow />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent"
      />
    </div>
  )
}
