const metrics = [
  { value: '1', label: 'Screen to check' },
  { value: '2', label: 'Rules evaluated' },
  { value: '0', label: 'Tabs to open' },
  { value: '30s', label: 'Refresh cycle' },
]

const quotes = [
  {
    body: 'We used to check GitHub, CI, and Slack before every deploy. Now we check one screen. That is the whole workflow.',
    name: 'Mara Chen',
    role: 'Engineering Lead, Fathom Analytics',
  },
  {
    body: 'The first time it told us we were blocked, it caught a PR we completely missed. That would have shipped broken.',
    name: 'Diego Alvarez',
    role: 'VP Engineering, Northbeam',
  },
]

export function Metrics() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <p className="mb-4 font-mono text-xs tracking-widest text-success">
          {'[ AT A GLANCE ]'}
        </p>
        <h2 className="max-w-xl text-balance text-3xl font-semibold tracking-tight md:text-5xl">
          Built to be simple.
        </h2>

        <dl className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="flex flex-col gap-2 bg-background p-8">
              <dd className="order-1 font-mono text-3xl font-semibold tracking-tight text-success md:text-4xl">
                {metric.value}
              </dd>
              <dt className="order-2 text-sm text-muted-foreground">{metric.label}</dt>
            </div>
          ))}
        </dl>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {quotes.map((quote) => (
            <figure
              key={quote.name}
              className="flex flex-col justify-between gap-6 rounded-xl border border-border bg-card p-8"
            >
              <blockquote className="text-pretty text-lg font-medium leading-relaxed">
                &ldquo;{quote.body}&rdquo;
              </blockquote>
              <figcaption className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-9 items-center justify-center rounded-full bg-success/10 font-mono text-xs font-semibold text-success"
                >
                  {quote.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </span>
                <div>
                  <p className="text-sm font-medium">{quote.name}</p>
                  <p className="text-xs text-muted-foreground">{quote.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
