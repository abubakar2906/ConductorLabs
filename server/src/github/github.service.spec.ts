import { BadRequestException } from '@nestjs/common'
import { GithubService } from './github.service'

// The service talks to the GitHub REST API through the global fetch.
// We mock fetch per-URL so each test controls what GitHub "returns".
const OPEN_PR = {
    number: 12,
    title: 'feat: add checkout flow',
    html_url: 'https://github.com/acme/app/pull/12',
    user: { login: 'jane' },
    created_at: '2026-01-02T09:00:00Z',
}

const CHECK_RUNS = [
    {
        id: 101,
        name: 'lint',
        status: 'completed',
        conclusion: 'success',
        details_url: 'https://github.com/acme/app/actions/runs/101',
        started_at: '2026-01-02T09:01:00Z',
        completed_at: '2026-01-02T09:02:00Z',
    },
    {
        id: 102,
        name: 'test',
        status: 'in_progress',
        conclusion: null,
        details_url: 'https://github.com/acme/app/actions/runs/102',
        started_at: '2026-01-02T09:01:05Z',
        completed_at: null,
    },
    {
        id: 103,
        name: 'e2e',
        status: 'queued',
        conclusion: null,
        details_url: null,
        started_at: null,
        completed_at: null,
    },
    {
        id: 104,
        name: 'deploy',
        status: 'completed',
        conclusion: 'failure',
        details_url: 'https://github.com/acme/app/actions/runs/104',
        started_at: '2026-01-02T09:01:10Z',
        completed_at: '2026-01-02T09:03:00Z',
    },
]

const TIP_COMMIT = {
    sha: 'abc1234def5678',
    html_url: 'https://github.com/acme/app/commit/abc1234def5678',
    commit: {
        message: 'fix: handle empty cart\n\nLonger body that should be dropped.',
        author: { name: 'Jane Doe', date: '2026-01-02T08:59:00Z' },
    },
    author: { login: 'jane' },
}

describe('GithubService', () => {
    let service: GithubService
    let fetchMock: jest.Mock
    let originalFetch: typeof fetch

    // route entries are [url-fragment, response-body] — order matters,
    // first match wins. 'check-runs' must come before 'commits/' because
    // the check-runs URL also contains 'commits/'.
    function setRoutes(routes: Array<[string, unknown]>) {
        fetchMock.mockImplementation(async (url: string) => {
            for (const [match, body] of routes) {
                if (url.includes(match)) {
                    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }
                }
            }
            return { ok: false, status: 404, text: async () => 'Not Found' }
        })
    }

    function standardRoutes(overrides: Partial<Record<'prs' | 'runs' | 'tip', unknown>> = {}) {
        return [
            ['check-runs', { check_runs: CHECK_RUNS }],
            ['pulls?state=open', [OPEN_PR]],
            ['commits/main', TIP_COMMIT],
        ].map(([match, body]) => [match, body] as [string, unknown]).concat([])
    }

    beforeEach(() => {
        service = new GithubService()
        originalFetch = global.fetch
        fetchMock = jest.fn()
        global.fetch = fetchMock as unknown as typeof fetch
    })

    afterEach(() => {
        global.fetch = originalFetch
        jest.clearAllMocks()
    })

    describe('getReleaseChecks — validation', () => {
        it('rejects a repo that is not owner/name', async () => {
            setRoutes([])
            await expect(service.getReleaseChecks('t', 'no-slash-here', 'main')).rejects.toThrow(BadRequestException)
        })

        it('rejects an empty branch', async () => {
            setRoutes([])
            await expect(service.getReleaseChecks('t', 'acme/app', '')).rejects.toThrow(BadRequestException)
        })
    })

    describe('getReleaseChecks — happy path', () => {
        it('returns PR and CI checks plus the branch tip', async () => {
            setRoutes([
                ['check-runs', { check_runs: CHECK_RUNS }],
                ['pulls?state=open', [OPEN_PR]],
                ['commits/main', TIP_COMMIT],
            ])

            const { checks, branchTip } = await service.getReleaseChecks('t', 'acme/app', 'main')

            // 1 PR + 4 CI runs
            expect(checks).toHaveLength(5)

            const pr = checks.find((c) => c.type === 'PR')
            expect(pr).toMatchObject({
                id: 'pr-12',
                externalId: '12',
                title: 'feat: add checkout flow',
                status: 'open',
                url: 'https://github.com/acme/app/pull/12',
                author: 'jane',
                createdAt: '2026-01-02T09:00:00Z',
            })

            expect(branchTip).toEqual({
                sha: 'abc1234def5678',
                shortSha: 'abc1234',
                message: 'fix: handle empty cart',
                author: 'Jane Doe',
                committedAt: '2026-01-02T08:59:00Z',
                url: 'https://github.com/acme/app/commit/abc1234def5678',
            })
        })

        it('maps CI check-run states to passing/failing/pending with timing + queued', async () => {
            setRoutes([
                ['check-runs', { check_runs: CHECK_RUNS }],
                ['pulls?state=open', []],
                ['commits/main', TIP_COMMIT],
            ])

            const { checks } = await service.getReleaseChecks('t', 'acme/app', 'main')
            const ci = checks.filter((c) => c.type === 'CI')

            expect(ci).toEqual(
                expect.arrayContaining([
                    {
                        id: 'ci-101',
                        type: 'CI',
                        externalId: 'lint',
                        title: 'lint',
                        status: 'passing',
                        url: 'https://github.com/acme/app/actions/runs/101',
                        startedAt: '2026-01-02T09:01:00Z',
                        completedAt: '2026-01-02T09:02:00Z',
                        queued: false,
                    },
                    {
                        id: 'ci-102',
                        type: 'CI',
                        externalId: 'test',
                        title: 'test',
                        status: 'pending',
                        url: 'https://github.com/acme/app/actions/runs/102',
                        startedAt: '2026-01-02T09:01:05Z',
                        completedAt: null,
                        queued: false,
                    },
                    {
                        id: 'ci-103',
                        type: 'CI',
                        externalId: 'e2e',
                        title: 'e2e',
                        status: 'pending',
                        url: null,
                        startedAt: null,
                        completedAt: null,
                        queued: true,
                    },
                    {
                        id: 'ci-104',
                        type: 'CI',
                        externalId: 'deploy',
                        title: 'deploy',
                        status: 'failing',
                        url: 'https://github.com/acme/app/actions/runs/104',
                        startedAt: '2026-01-02T09:01:10Z',
                        completedAt: '2026-01-02T09:03:00Z',
                        queued: false,
                    },
                ]),
            )
        })

        it('treats neutral/skipped conclusions as passing', async () => {
            setRoutes([
                [
                    'check-runs',
                    {
                        check_runs: [
                            { id: 1, name: 'a', status: 'completed', conclusion: 'neutral', details_url: null, started_at: null, completed_at: null },
                            { id: 2, name: 'b', status: 'completed', conclusion: 'skipped', details_url: null, started_at: null, completed_at: null },
                        ],
                    },
                ],
                ['pulls?state=open', []],
                ['commits/main', TIP_COMMIT],
            ])

            const { checks } = await service.getReleaseChecks('t', 'acme/app', 'main')
            expect(checks.filter((c) => c.type === 'CI').every((c) => c.status === 'passing')).toBe(true)
        })
    })

    describe('getReleaseChecks — branch tip is context only', () => {
        it('returns branchTip: null and still returns checks when the commit lookup fails', async () => {
            setRoutes([
                ['check-runs', { check_runs: CHECK_RUNS }],
                ['pulls?state=open', [OPEN_PR]],
            ])
            // no 'commits/main' route → fetch returns 404 → getBranchTip rejects → caught

            const { checks, branchTip } = await service.getReleaseChecks('t', 'acme/app', 'main')
            expect(branchTip).toBeNull()
            expect(checks).toHaveLength(5)
        })

        it('still surfaces the checks when GitHub fails the PR and CI calls', async () => {
            setRoutes([]) // every call 404s
            await expect(service.getReleaseChecks('t', 'acme/app', 'main')).rejects.toThrow(BadRequestException)
        })
    })

    describe('getBranches', () => {
        it('returns branch names', async () => {
            setRoutes([
                ['/branches?per_page=100', [{ name: 'main' }, { name: 'release/1.0' }]],
            ])
            await expect(service.getBranches('t', 'acme/app')).resolves.toEqual(['main', 'release/1.0'])
        })

        it('rejects a repo that is not owner/name', async () => {
            setRoutes([])
            await expect(service.getBranches('t', 'bad')).rejects.toThrow(BadRequestException)
        })
    })

    describe('getRepos', () => {
        it('maps full_name and default_branch', async () => {
            setRoutes([
                ['/user/repos?per_page=100', [
                    { full_name: 'acme/app', default_branch: 'main' },
                    { full_name: 'acme/other', default_branch: 'trunk' },
                ]],
            ])
            await expect(service.getRepos('t')).resolves.toEqual([
                { fullName: 'acme/app', defaultBranch: 'main' },
                { fullName: 'acme/other', defaultBranch: 'trunk' },
            ])
        })
    })
})