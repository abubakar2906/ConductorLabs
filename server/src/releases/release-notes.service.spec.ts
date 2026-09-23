import {
    BadRequestException,
    NotFoundException,
    ServiceUnavailableException,
    UnauthorizedException,
} from '@nestjs/common'
import { GithubService, type CommitContext, type RangeContext } from '../github/github.service'
import { supabase } from '../supabase/supabase.client'
import { ReleaseNotesService } from './release-notes.service'
import type { Release } from './releases.service'

jest.mock('../supabase/supabase.client', () => ({ supabase: jest.fn() }))

const USER = 'user-1'
const REL = 'rel-1'
const TIP = 'tipsha00000000000000000000000000000001'

function makeRelease(overrides: Partial<Release> = {}): Release {
    return {
        id: REL,
        user_id: USER,
        name: 'v1.2',
        repo_full_name: 'acme/shop',
        target_branch: 'release/1.2',
        created_at: '2026-01-01T00:00:00.000Z',
        last_push_at: null,
        release_notes: null,
        notes_generated_at: null,
        notes_edited: false,
        notes_tip_sha: null,
        ...overrides,
    }
}

function makeCommit(sha: string, message: string): CommitContext {
    return {
        sha,
        shortSha: sha.slice(0, 7),
        message,
        author: 'Abu',
        committedAt: '2026-01-02T00:00:00.000Z',
        prNumber: null,
    }
}

function makeRange(commits: CommitContext[], aheadBy: number): RangeContext {
    return {
        aheadBy,
        totalCommits: commits.length,
        commits,
        files: [{ filename: 'src/a.ts', status: 'modified', additions: 3, deletions: 1 }],
        additions: 3,
        deletions: 1,
    }
}

describe('ReleaseNotesService', () => {
    let service: ReleaseNotesService
    let releases: { getByIdForUser: jest.Mock }
    let github: {
        getRefTipSha: jest.Mock
        getRangeContext: jest.Mock
        getRecentCommitsContext: jest.Mock
    }
    let tokens: { getAccessToken: jest.Mock }
    let fetchMock: jest.Mock

    const savedEnv = {
        AI_API_KEY: process.env.AI_API_KEY,
        AI_API_URL: process.env.AI_API_URL,
        AI_MODEL: process.env.AI_MODEL,
    }

    // What supabase().from('releases').update(...).eq().select().single() resolves with.
    // Returned chain records the patch so tests can assert what was persisted.
    function mockPersist(data: unknown, error: unknown = null) {
        const chain: any = {
            patch: null as unknown,
            update: jest.fn((patch: unknown) => {
                chain.patch = patch
                return chain
            }),
            eq: jest.fn(() => chain),
            select: jest.fn(() => chain),
            single: jest.fn(async () => ({ data, error })),
        }
        ;(supabase as unknown as jest.Mock).mockReturnValue({ from: jest.fn(() => chain) })
        return chain
    }

    // Successful AI response: OpenAI-compatible chat completion payload.
    function aiOk(content: string) {
        return {
            ok: true,
            status: 200,
            json: async () => ({ choices: [{ message: { content } }] }),
            text: async () => '',
        }
    }

    beforeEach(() => {
        process.env.AI_API_KEY = 'gsk_test-key'
        process.env.AI_API_URL = 'https://ai.test/v1/'
        process.env.AI_MODEL = 'test-model'

        releases = { getByIdForUser: jest.fn().mockResolvedValue(makeRelease()) }
        github = {
            getRefTipSha: jest.fn().mockResolvedValue(TIP),
            getRangeContext: jest.fn(),
            getRecentCommitsContext: jest.fn().mockResolvedValue([
                makeCommit('a'.repeat(40), 'Add one-click checkout'),
            ]),
        }
        tokens = { getAccessToken: jest.fn().mockResolvedValue('gh-token') }
        fetchMock = jest.fn().mockResolvedValue(aiOk('## Added\n- ship faster'))
        ;(global as any).fetch = fetchMock
        ;(supabase as unknown as jest.Mock).mockReset()

        service = new ReleaseNotesService(
            releases as any,
            github as unknown as GithubService,
            tokens as any,
        )
    })

    afterEach(() => {
        for (const [key, value] of Object.entries(savedEnv)) {
            if (value === undefined) delete process.env[key]
            else process.env[key] = value
        }
    })

    it('generates notes on first run from recent commits and persists Markdown', async () => {
        const updated = makeRelease({
            release_notes: '## Added\n- ship faster',
            notes_tip_sha: TIP,
        })
        const chain = mockPersist(updated)

        const result = await service.generate(USER, REL)

        expect(result.cached).toBe(false)
        expect(result.commitCount).toBe(1)
        expect(result.release.release_notes).toBe('## Added\n- ship faster')
        expect(github.getRecentCommitsContext).toHaveBeenCalledWith(
            'gh-token',
            'acme',
            'shop',
            'release/1.2',
            50,
        )
        expect(github.getRangeContext).not.toHaveBeenCalled()

        // LLM call: URL, auth header, model, and the git context in the payload.
        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('https://ai.test/v1/chat/completions')
        expect(init.headers.Authorization).toBe('Bearer gsk_test-key')
        const body = JSON.parse(init.body)
        expect(body.model).toBe('test-model')
        expect(body.messages[1].content).toContain('Add one-click checkout')

        // Persisted patch: notes plus the tip so the next call can hit the cache.
        expect(chain.patch).toMatchObject({
            release_notes: '## Added\n- ship faster',
            notes_edited: false,
            notes_tip_sha: TIP,
        })
        expect(typeof (chain.patch as any).notes_generated_at).toBe('string')
    })

    it('returns cached notes without calling GitHub or the LLM when the tip has not moved', async () => {
        releases.getByIdForUser.mockResolvedValue(
            makeRelease({ release_notes: '## Fixed\n- old', notes_tip_sha: TIP }),
        )
        const chain = mockPersist(null)

        const result = await service.generate(USER, REL)

        expect(result.cached).toBe(true)
        expect(result.release.release_notes).toBe('## Fixed\n- old')
        expect(github.getRangeContext).not.toHaveBeenCalled()
        expect(github.getRecentCommitsContext).not.toHaveBeenCalled()
        expect(fetchMock).not.toHaveBeenCalled()
        expect(chain.update).not.toHaveBeenCalled()
    })

    it('force=true skips the tip cache and regenerates', async () => {
        releases.getByIdForUser.mockResolvedValue(
            makeRelease({ release_notes: '## Fixed\n- old', notes_tip_sha: TIP }),
        )
        const chain = mockPersist(
            makeRelease({ release_notes: '## Added\n- new', notes_tip_sha: TIP }),
        )

        fetchMock.mockResolvedValueOnce(aiOk('## Added\n- new'))

        const result = await service.generate(USER, REL, true)

        expect(result.cached).toBe(false)
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(chain.patch).toMatchObject({ release_notes: '## Added\n- new' })
    })

    it('uses the incremental range from the last-noted tip when the branch moved', async () => {
        const oldSha = 'b'.repeat(40)
        releases.getByIdForUser.mockResolvedValue(
            makeRelease({ release_notes: '## Added\n- old', notes_tip_sha: oldSha }),
        )
        const range = makeRange(
            [makeCommit('c'.repeat(40), 'Fix tax rounding'), makeCommit('d'.repeat(40), 'Bump deps')],
            2,
        )
        github.getRangeContext.mockResolvedValue(range)
        mockPersist(makeRelease({ release_notes: '## Fixed\n- tax', notes_tip_sha: TIP }))

        const result = await service.generate(USER, REL)

        expect(github.getRangeContext).toHaveBeenCalledWith(
            'gh-token',
            'acme',
            'shop',
            oldSha,
            TIP,
        )
        expect(github.getRecentCommitsContext).not.toHaveBeenCalled()
        expect(result.cached).toBe(false)
        expect(result.commitCount).toBe(2)
        const body = JSON.parse(fetchMock.mock.calls[0][1].body)
        expect(body.messages[1].content).toContain('Fix tax rounding')
    })

    it('falls back to recent commits when the range is empty but still regenerates', async () => {
        const oldSha = 'b'.repeat(40)
        releases.getByIdForUser.mockResolvedValue(
            makeRelease({ release_notes: '## Added\n- old', notes_tip_sha: oldSha }),
        )
        github.getRangeContext.mockResolvedValue(makeRange([], 0))
        github.getRecentCommitsContext.mockResolvedValue([makeCommit(TIP, 'Rewrite history')])
        mockPersist(makeRelease({ release_notes: '## Changed\n- rewritten', notes_tip_sha: TIP }))

        const result = await service.generate(USER, REL)

        expect(github.getRangeContext).toHaveBeenCalledWith('gh-token', 'acme', 'shop', oldSha, TIP)
        expect(github.getRecentCommitsContext).toHaveBeenCalledWith(
            'gh-token', 'acme', 'shop', 'release/1.2', 50,
        )
        expect(result.cached).toBe(false)
        expect(result.commitCount).toBe(1)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('reuses stored notes when there are no commits to summarize', async () => {
        releases.getByIdForUser.mockResolvedValue(
            makeRelease({ release_notes: '## Added\n- old', notes_tip_sha: 'e'.repeat(40) }),
        )
        github.getRangeContext.mockResolvedValue(makeRange([], 0))
        github.getRecentCommitsContext.mockResolvedValue([])
        const chain = mockPersist(null)

        const result = await service.generate(USER, REL)

        expect(result.cached).toBe(true)
        expect(result.release.release_notes).toBe('## Added\n- old')
        expect(fetchMock).not.toHaveBeenCalled()
        expect(chain.update).not.toHaveBeenCalled()
    })

    it('refuses to call the AI provider when AI_API_KEY is missing', async () => {
        releases.getByIdForUser.mockResolvedValue(makeRelease())
        delete process.env.AI_API_KEY
        const chain = mockPersist(null)

        await expect(service.generate(USER, REL)).rejects.toThrow(ServiceUnavailableException)
        await expect(service.generate(USER, REL)).rejects.toThrow(/AI_API_KEY/)

        expect(fetchMock).not.toHaveBeenCalled()
        expect(chain.update).not.toHaveBeenCalled()
    })

    it('surfaces a provider failure as 503 and does not persist partial notes', async () => {
        releases.getByIdForUser.mockResolvedValue(makeRelease())
        const chain = mockPersist(null)
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 503,
            text: async () => 'model overloaded',
        })

        await expect(service.generate(USER, REL)).rejects.toThrow(/503: model overloaded/)
        expect(chain.update).not.toHaveBeenCalled()
    })

    it('strips markdown fences the model wraps around its answer', async () => {
        releases.getByIdForUser.mockResolvedValue(makeRelease())
        mockPersist(makeRelease({ release_notes: '## Added\n- clean', notes_tip_sha: TIP }))
        fetchMock.mockResolvedValueOnce(
            aiOk('```markdown\n## Added\n- clean\n```'),
        )

        const result = await service.generate(USER, REL)

        expect(result.release.release_notes).toBe('## Added\n- clean')
    })

    it('rejects ownership, connection, and repo-shape errors before touching the LLM', async () => {
        releases.getByIdForUser.mockResolvedValue(null)
        await expect(service.generate(USER, REL)).rejects.toThrow(NotFoundException)

        releases.getByIdForUser.mockResolvedValue(makeRelease())
        tokens.getAccessToken.mockResolvedValueOnce(null)
        await expect(service.generate(USER, REL)).rejects.toThrow(UnauthorizedException)

        releases.getByIdForUser.mockResolvedValue(makeRelease({ repo_full_name: 'not-a-repo' }))
        await expect(service.generate(USER, REL)).rejects.toThrow(BadRequestException)

        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('persists a hand edit as trimmed markdown flagged notes_edited', async () => {
        releases.getByIdForUser.mockResolvedValue(makeRelease())
        const chain = mockPersist(
            makeRelease({ release_notes: '## Fixed\n- edited', notes_edited: true }),
        )

        const result = await service.saveEdited(USER, REL, '  ## Fixed\n- edited  ')

        expect(chain.patch).toEqual({ release_notes: '## Fixed\n- edited', notes_edited: true })
        expect(result.release_notes).toBe('## Fixed\n- edited')
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('rejects an empty hand edit and an unknown release', async () => {
        await expect(service.saveEdited(USER, REL, '   ')).rejects.toThrow(BadRequestException)

        releases.getByIdForUser.mockResolvedValue(null)
        await expect(service.saveEdited(USER, 'rel-x', '## Added\n- x')).rejects.toThrow(
            NotFoundException,
        )
    })
})
