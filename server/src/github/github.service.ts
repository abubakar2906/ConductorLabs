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
