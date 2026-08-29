import { BadRequestException, Injectable } from '@nestjs/common'

// One "check" that feeds the readiness decision. Same shape the client's
// mock-data.ts already uses, so real data drops straight into the existing
// Ready/Blocked engine.
export type ReleaseCheck =
    | { id: string; type: 'PR'; externalId: string; title: string; status: 'open' | 'merged' }
    | { id: string; type: 'CI'; externalId: string; title: string; status: 'passing' | 'failing' | 'pending' }

const GITHUB_API = 'https://api.github.com'

@Injectable()
export class GithubService {
    // The two readiness questions for a repo+branch, answered from real GitHub
    // data and returned as one flat list of checks.
    async getReleaseChecks(
        token: string,
        repoFullName: string,
        branch: string,
    ): Promise<ReleaseCheck[]> {
        const [owner, repo] = (repoFullName ?? '').split('/')
        if (!owner || !repo) {
            throw new BadRequestException(`repo must be "owner/name", got "${repoFullName}"`)
        }
        if (!branch) {
            throw new BadRequestException('branch is required')
        }

        // Fetch both at once — they don't depend on each other.
        const [prs, ci] = await Promise.all([
            this.getOpenPullRequests(token, owner, repo, branch),
            this.getCiChecks(token, owner, repo, branch),
        ])
        return [...prs, ...ci]
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
        }))
    }

    // Translate GitHub's check-run states into our three: passing/failing/pending.
    private ciStatus(run: any): 'passing' | 'failing' | 'pending' {
        if (run.status !== 'completed') return 'pending' // queued or in progress
        const nonBlocking = ['success', 'neutral', 'skipped']
        return nonBlocking.includes(run.conclusion) ? 'passing' : 'failing'
    }
}
