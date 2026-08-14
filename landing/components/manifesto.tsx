const problems = [
  {
    tag: 'THE PR CHECK',
    title: 'Are all the PRs merged?',
    body: 'You open GitHub, scan the list, try to remember which PRs target the release branch. You miss one. It ships half-finished.',
  },
  {
    tag: 'THE CI CHECK',
    title: 'Is everything passing?',
    body: 'You click into the latest commit, look at the status checks, wait for the one still running. Then you check again five minutes later.',
  },
  {
    tag: 'THE DEPLOY',
    title: 'You press the button anyway.',
    body: 'You have checked everything you can think of. You deploy. You find out what you missed when a user reports it.',
  },
]

export function Manifesto() {
  return (
    <section id="manifesto" className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <p className="mb-6 font-mono text-xs tracking-widest text-warning">
          {'[ THE PROBLEM ]'}
        </p>
        <h2 className="max-w-3xl text-balance text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
          You check four tabs before<br className="hidden md:block" /> every deploy.
        </h2>
        <p className="mt-6 max-w-xl text-pretty leading-relaxed text-muted-foreground">
          Before shipping, you open GitHub to check PRs. Then CI. Then Slack.
          Then your memory. Something falls through. A broken release ships.
        </p>

        <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
          {problems.map((problem) => (
            <div key={problem.tag} className="bg-background p-7">
              <p className="font-mono text-xs tracking-widest text-warning">{problem.tag}</p>
              <h3 className="mt-4 text-lg font-medium">{problem.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {problem.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
          <p className="font-mono text-xs tracking-widest text-success">{'[ THE FIX ]'}</p>
          <p className="max-w-2xl text-balance text-xl font-medium leading-snug md:text-2xl">
            Readiness should be a yes or no your tools compute for you, not a
            checklist you run from memory.
          </p>
        </div>
      </div>
    </section>
  )
}
