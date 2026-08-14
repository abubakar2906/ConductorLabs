const entries = [
  {
    version: 'v0.3.0',
    date: 'AUG 01, 2026',
    title: 'GitHub OAuth login',
    description:
      'Sign in with your GitHub account. Your workspace is created on first login. One provider, no configuration.',
  },
  {
    version: 'v0.2.0',
    date: 'JUL 18, 2026',
    title: 'PR and CI readiness checks',
    description:
      'Two rules evaluated on every release: all open PRs targeting the branch are merged, and all CI checks on the latest commit are passing.',
  },
  {
    version: 'v0.1.0',
    date: 'JUL 02, 2026',
    title: 'Release creation',
    description:
      'Create a release with a name, a GitHub repo, and a target branch. Status is calculated immediately and updates when your repo changes.',
  },
]

export function Changelog() {
  return (
    <section id="changelog" className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="mb-14 flex items-end justify-between">
          <div>
            <p className="mb-4 font-mono text-xs tracking-widest text-success">
              {'[ SHIPPING LOG ]'}
            </p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
              We ship too.
            </h2>
          </div>
          <a
            href="#"
            className="hidden font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground md:block"
          >
            Full changelog →
          </a>
        </div>

        <ol className="flex flex-col">
          {entries.map((entry) => (
            <li
              key={entry.version}
              className="grid gap-3 border-t border-border py-7 last:border-b md:grid-cols-[8rem_10rem_1fr] md:gap-6"
            >
              <span className="font-mono text-sm text-success">{entry.version}</span>
              <span className="font-mono text-xs tracking-widest text-muted-foreground md:pt-0.5">
                {entry.date}
              </span>
              <div>
                <h3 className="text-base font-medium">{entry.title}</h3>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {entry.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
