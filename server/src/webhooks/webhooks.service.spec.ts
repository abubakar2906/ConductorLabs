import * as crypto from 'crypto'
import { WebhooksService } from './webhooks.service'
import { supabase } from '../supabase/supabase.client'

jest.mock('../supabase/supabase.client', () => ({
    supabase: jest.fn(),
}))

// Builds the supabase() query-builder chain:
// from('releases').update({...}).eq(...).eq(...).select('id')
function mockQueryChain(result: { data?: unknown[] | null; error?: unknown }) {
    const selectMock = jest.fn().mockResolvedValue(result)
    const secondEqMock = jest.fn().mockReturnValue({ select: selectMock })
    const firstEqMock = jest.fn().mockReturnValue({ eq: secondEqMock })
    const updateMock = jest.fn().mockReturnValue({ eq: firstEqMock })
    const fromMock = jest.fn().mockReturnValue({ update: updateMock })
    ;(supabase as jest.Mock).mockReturnValue({ from: fromMock })
    return { fromMock, firstEqMock, secondEqMock, updateMock, selectMock }
}

describe('WebhooksService', () => {
    let service: WebhooksService
    let savedSecret: string | undefined

    beforeEach(() => {
        service = new WebhooksService()
        savedSecret = process.env.GITHUB_WEBHOOK_SECRET
        delete process.env.GITHUB_WEBHOOK_SECRET
    })

    afterEach(() => {
        if (savedSecret === undefined) {
            delete process.env.GITHUB_WEBHOOK_SECRET
        } else {
            process.env.GITHUB_WEBHOOK_SECRET = savedSecret
        }
        jest.clearAllMocks()
    })

    describe('secretConfigured', () => {
        it('is false when the env var is absent', () => {
            expect(service.secretConfigured()).toBe(false)
        })

        it('is true when the env var is set', () => {
            process.env.GITHUB_WEBHOOK_SECRET = 'whsec_test'
            expect(service.secretConfigured()).toBe(true)
        })
    })

    describe('verifySignature', () => {
        const secret = 'whsec_test'
        const rawBody = '{"repository":{"full_name":"owner/repo"},"ref":"refs/heads/main"}'

        function expectedSignature(body: string, sig = secret): string {
            return crypto.createHmac('sha256', sig).update(body).digest('hex')
        }

        beforeEach(() => {
            process.env.GITHUB_WEBHOOK_SECRET = secret
        })

        it('accepts a valid signature with the sha256= prefix', () => {
            expect(service.verifySignature(rawBody, `sha256=${expectedSignature(rawBody)}`)).toBe(true)
        })

        it('accepts a valid signature without the prefix', () => {
            expect(service.verifySignature(rawBody, expectedSignature(rawBody))).toBe(true)
        })

        it('rejects a signature computed with a different secret', () => {
            const forged = expectedSignature(rawBody, 'attacker-secret')
            expect(service.verifySignature(rawBody, `sha256=${forged}`)).toBe(false)
        })

        it('rejects a tampered body', () => {
            const good = expectedSignature(rawBody)
            const tampered = rawBody.replace('main', 'master')
            expect(service.verifySignature(tampered, `sha256=${good}`)).toBe(false)
        })

        it('returns false instead of throwing on a length-mismatched signature', () => {
            expect(service.verifySignature(rawBody, 'sha256=deadbeef')).toBe(false)
        })

        it('returns false when no secret is configured', () => {
            delete process.env.GITHUB_WEBHOOK_SECRET
            expect(service.verifySignature(rawBody, expectedSignature(rawBody))).toBe(false)
        })
    })

    describe('extractBranch', () => {
        it('strips refs/heads/', () => {
            expect(service.extractBranch('refs/heads/main')).toBe('main')
        })

        it('strips refs/heads/ from nested branch names', () => {
            expect(service.extractBranch('refs/heads/feature/x')).toBe('feature/x')
        })

        it('passes tags through untouched', () => {
            expect(service.extractBranch('refs/tags/v1.0.0')).toBe('refs/tags/v1.0.0')
        })

        it('passes PR refs through untouched', () => {
            expect(service.extractBranch('refs/pull/42/merge')).toBe('refs/pull/42/merge')
        })
    })

    describe('recordPush', () => {
        it('returns 0 and skips the DB when repo or ref is missing', async () => {
            ;(supabase as jest.Mock).mockImplementation(() => {
                throw new Error('supabase() should not be called')
            })
            await expect(service.recordPush(undefined)).resolves.toBe(0)
            await expect(service.recordPush({ ref: 'refs/heads/main' })).resolves.toBe(0)
            await expect(service.recordPush({ repository: { full_name: 'owner/repo' } })).resolves.toBe(0)
        })

        it('updates matching releases and returns the row count', async () => {
            const chain = mockQueryChain({ data: [{ id: 1 }, { id: 2 }], error: null })

            const matched = await service.recordPush({
                repository: { full_name: 'owner/repo' },
                ref: 'refs/heads/main',
            })

            expect(matched).toBe(2)
            expect(chain.fromMock).toHaveBeenCalledWith('releases')
            expect(chain.firstEqMock).toHaveBeenCalledWith('repo_full_name', 'owner/repo')
            expect(chain.secondEqMock).toHaveBeenCalledWith('target_branch', 'main')
            expect(chain.updateMock).toHaveBeenCalledWith(expect.objectContaining({ last_push_at: expect.any(String) }))
            expect(chain.selectMock).toHaveBeenCalledWith('id')
        })

        it('returns 0 when no release matches', async () => {
            mockQueryChain({ data: [], error: null })
            const matched = await service.recordPush({
                repository: { full_name: 'owner/repo' },
                ref: 'refs/heads/nope',
            })
            expect(matched).toBe(0)
        })

        it('swallows the 42703 missing-column error (migration pending)', async () => {
            mockQueryChain({ data: null, error: { code: '42703', message: 'column last_push_at does not exist' } })
            const matched = await service.recordPush({
                repository: { full_name: 'owner/repo' },
                ref: 'refs/heads/main',
            })
            expect(matched).toBe(0)
        })

        it('swallows other errors so GitHub does not retry forever', async () => {
            mockQueryChain({ data: null, error: { code: 'XX000', message: 'boom' } })
            const matched = await service.recordPush({
                repository: { full_name: 'owner/repo' },
                ref: 'refs/heads/main',
            })
            expect(matched).toBe(0)
        })
    })
})