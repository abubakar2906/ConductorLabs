import { BadRequestException, Injectable } from '@nestjs/common'

// One "check" that feeds the readiness decision. Same shape the client's
// mock-data.ts already uses, so real data drops straight into the existing
// Ready/Blocked engine. `url`/`author`/`createdAt` and the CI timing fields
// are optional — older servers (or older mock data) simply omit them and the
// client falls back gracefully.
export type ReleaseCheck =
    | {
          id: string
          type: 'PR'
          externalId: string
          title: string
          status: 'open' | 'merged'
          url?: string | null
          author?: string | null
          createdAt?: string | null
      }
    | {
          id: string
          type: 'CI'
          externalId: string
          title: string
          status: 'passing' | 'failing' | 'pending'
          url?: string | null
          queued?: boolean
          startedAt?: string | null
          completedAt?: string | null
      }

// The latest commit on the branch — "what are we actually about to ship".
// Shipped alongside the checks so the detail page can show it without a
// second round-trip. `author`/`committedAt`/`url` may be null for repos
// where GitHub omits them.
export type BranchTip = {
    sha: string
    shortSha: string
    message: string
    author?: string | null
    committedAt?: string | null
    url?: string | null
}

// The full answer for a repo+branch: the checks that drive Ready/Blocked,
// plus the branch tip as nice-to-have context.
export type ReleaseStatus = {
    checks: ReleaseCheck[]
    branchTip: BranchTip | null
}

// One commit, flattened for a release-notes prompt.
export type CommitContext = {
    sha: string
    shortSha: string
    message: string
    author: string | null
    committedAt: string | null
    prNumber: number | null
}

// Normalized git metadata for a ref range — the "release context" the
// release-notes generator turns into Markdown via the LLM.
export type RangeContext = {
    aheadBy: number
    totalCommits: number
    commits: CommitContext[]
    files: { filename: string; status: string; additions: number; deletions: number }[]
    additions: number
    deletions: number
}

// Flatten a GitHub commit object (list or compare shape) into CommitContext.
function normalizeCommit(c: any): CommitContext {
    const message = String(c.commit?.message ?? '').split('\n')[0]
    const prNumber = c.pull_request?.url
        ? Number(String(c.pull_request.url).split('/').pop()) || null
        : null
    return {
        sha: String(c.sha ?? ''),
        shortSha: String(c.sha ?? '').slice(0, 7),
        message,
        author: c.commit?.author?.name ?? c.author?.login ?? null,
        committedAt: c.commit?.author?.date ?? null,
        prNumber,
    }
}

const GITHUB_API = 'https://api.github.com'

@Injectable()
export class GithubService {
    // The two readiness questions for a repo+branch, answered from real GitHub
    // data and returned as one flat list of checks, plus the branch tip.
    async getReleaseChecks(
        token: string,
        repoFullName: string,
        branch: string,
    ): Promise<ReleaseStatus> {
        const [owner, repo] = (repoFullName ?? '').split('/')
        if (!owner || !repo) {
            throw new BadRequestException(`repo must be "owner/name", got "${repoFullName}"`)
        }
        if (!branch) {
            throw new BadRequestException('branch is required')
        }

        // All three calls are independent, so fetch in parallel.
        // The branch tip is context, not a readiness input: if just that
        // call fails (e.g. branch renamed between requests) we return null
        // instead of failing the whole status check.
        const [prs, ci, tip] = await Promise.all([
            this.getOpenPullRequests(token, owner, repo, branch),
            this.getCiChecks(token, owner, repo, branch),
            this.getBranchTip(token, owner, repo, branch).catch(() => null),
        ])
        return { checks: [...prs, ...ci], branchTip: tip }
    }

    // The repos this user can access, most recently updated first.
    // Powers the repo picker in the New Release wizard.
    async getRepos(token: string): Promise<{ fullName: string; defaultBranch: string }[]> {
        const repos = await this.gh(
            token,
            '/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member',
        )
        return repos.map((r: any) => ({
            fullName: r.full_name,
            defaultBranch: r.default_branch,
        }))
    }

    // The branch names for one repo. Powers the branch picker.
    async getBranches(token: string, repoFullName: string): Promise<string[]> {
        const [owner, repo] = (repoFullName ?? '').split('/')
        if (!owner || !repo) {
            throw new BadRequestException(`repo must be "owner/name", got "${repoFullName}"`)
        }
        const branches = await this.gh(token, `/repos/${owner}/${repo}/branches?per_page=100`)
        return branches.map((b: any) => b.name)
    }

    // The latest commit on a branch — "what exactly are we about to ship".
    // Used as context next to the checks; never a readiness input itself.
    async getBranchTip(
        token: string,
        owner: string,
        repo: string,
        branch: string,
    ): Promise<BranchTip> {
        const commit = await this.gh(token, `/repos/${owner}/${repo}/commits/${encodeURIComponent(branch)}`)
        return {
            sha: commit.sha,
            shortSha: String(commit.sha).slice(0, 7),
            message: String(commit.commit?.message ?? '').split('\n')[0],
            author: commit.commit?.author?.name ?? commit.author?.login ?? null,
            committedAt: commit.commit?.author?.date ?? null,
            url: commit.html_url,
        }
    }

    // ---- Release-notes context --------------------------------------------
    // Normalized git metadata for a ref range, shaped for an LLM prompt.

    // The tip commit of a branch — used to decide whether stored notes are
    // still current (cache check) and as the head of a compare range.
    async getRefTipSha(token: string, owner: string, repo: string, ref: string): Promise<string> {
        const commit = await this.gh(token, `/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`)
        return String(commit.sha)
    }

    // Commits + file stats between two refs, normalized for prompt building.
    // `files`/`commits` are capped so a huge range can't blow up the prompt.
    async getRangeContext(
        token: string,
        owner: string,
        repo: string,
        base: string,
        head: string,
    ): Promise<RangeContext> {
        const range = await this.gh(
            token,
            `/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
        )
        return {
            aheadBy: range.ahead_by ?? 0,
            totalCommits: range.total_commits ?? 0,
            commits: (range.commits ?? []).slice(0, 50).map(normalizeCommit),
            files: (range.files ?? []).slice(0, 50).map((f: any) => ({
                filename: String(f.filename ?? ''),
                status: String(f.status ?? 'modified'),
                additions: Number(f.additions ?? 0),
                deletions: Number(f.deletions ?? 0),
            })),
            additions: (range.files ?? []).reduce((n: number, f: any) => n + (f.additions ?? 0), 0),
            deletions: (range.files ?? []).reduce((n: number, f: any) => n + (f.deletions ?? 0), 0),
        }
    }

    // The most recent commits on a ref — the fallback when there's no
    // previous notes tip to diff against (first generation for a release).
    async getRecentCommitsContext(
        token: string,
        owner: string,
        repo: string,
        ref: string,
        limit = 50,
    ): Promise<CommitContext[]> {
        const commits = await this.gh(
            token,
            `/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(ref)}&per_page=${limit}`,
        )
        return (commits ?? []).slice(0, limit).map(normalizeCommit)
    }

    // Small helper: call the GitHub REST API with the user's token attached.
    private async gh(token: string, path: string): Promise<any> {
        const res = await fetch(`${GITHUB_API}${path}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'ConductorLabs', // GitHub requires a User-Agent
            },
        })
        if (!res.ok) {
            const body = await res.text()
            throw new BadRequestException(`GitHub ${path} → ${res.status}: ${body.slice(0, 200)}`)
        }
        return res.json()
    }

    // Rule 1: any open PR whose target (base) is this branch blocks the release.
    private async getOpenPullRequests(
        token: string,
        owner: string,
        repo: string,
        branch: string,
    ): Promise<ReleaseCheck[]> {
        const prs = await this.gh(
            token,
            `/repos/${owner}/${repo}/pulls?state=open&base=${encodeURIComponent(branch)}&per_page=100`,
        )
        return prs.map((pr: any) => ({
            id: `pr-${pr.number}`,
            type: 'PR' as const,
            externalId: String(pr.number),
            title: pr.title,
            status: 'open' as const,
            url: pr.html_url,
            author: pr.user?.login ?? null,
            createdAt: pr.created_at ?? null,
        }))
    }

    // Rule 2: any failing/pending CI check on the branch's latest commit blocks it.
    private async getCiChecks(
        token: string,
        owner: string,
        repo: string,
        branch: string,
    ): Promise<ReleaseCheck[]> {
        const data = await this.gh(
            token,
            `/repos/${owner}/${repo}/commits/${encodeURIComponent(branch)}/check-runs?per_page=100`,
        )
        return (data.check_runs ?? []).map((run: any) => ({
            id: `ci-${run.id}`,
            type: 'CI' as const,
            externalId: run.name,
            title: run.name,
            status: this.ciStatus(run),
            url: run.details_url ?? null,
            startedAt: run.started_at ?? null,
            completedAt: run.completed_at ?? null,
            queued: run.status === 'queued' || run.status === 'waiting',
        }))
    }

    // Translate GitHub's check-run states into our three: passing/failing/pending.
    private ciStatus(run: any): 'passing' | 'failing' | 'pending' {
        if (run.status !== 'completed') return 'pending' // queued or in progress
        const nonBlocking = ['success', 'neutral', 'skipped']
        return nonBlocking.includes(run.conclusion) ? 'passing' : 'failing'
    }
}
