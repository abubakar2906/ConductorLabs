import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { ReleasesController } from './releases.controller'
import { ReleasesService, type Release } from './releases.service'

// The real ReleasesService talks to Supabase over the network, so this spec
// swaps it for a double at the DI boundary (the standard NestJS controller
// test pattern). What is under test is the real controller: its routing
// params, the caller id it forwards, and its 404 mapping.
describe('ReleasesController', () => {
    let controller: ReleasesController
    let service: { deleteByIdForUser: jest.SpyInstance }

    const deleted: Release = {
        id: 'rel-1',
        user_id: 'user-123',
        name: 'v2.1.0',
        repo_full_name: 'conductor-labs/web',
        target_branch: 'main',
        created_at: '2026-01-01T00:00:00.000Z',
    }

    // What ClerkGuard puts on the request after token verification.
    const req = { auth: { sub: 'user-123' } }

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ReleasesController],
            providers: [
                {
                    provide: ReleasesService,
                    useValue: { deleteByIdForUser: jest.fn() },
                },
            ],
        }).compile()

        controller = module.get<ReleasesController>(ReleasesController)
        service = module.get(ReleasesService) as unknown as {
            deleteByIdForUser: jest.SpyInstance
        }
    })

    describe('DELETE /releases/:id', () => {
        it('forwards the caller id and the path param, and returns the deleted row', async () => {
            service.deleteByIdForUser.mockResolvedValue(deleted)

            const result = await controller.delete(req, 'rel-1')

            expect(service.deleteByIdForUser).toHaveBeenCalledWith('user-123', 'rel-1')
            expect(result).toEqual(deleted)
        })

        it('throws 404 when the id does not exist or belongs to someone else', async () => {
            // The service answers null for both "no such id" and "not yours".
            service.deleteByIdForUser.mockResolvedValue(null)

            await expect(controller.delete(req, 'rel-missing')).rejects.toThrow(NotFoundException)
        })

        it('propagates the path param exactly, so a different id hits a different row', async () => {
            service.deleteByIdForUser.mockResolvedValue(null)

            await controller.delete(req, 'some-other-id').catch(() => null)

            expect(service.deleteByIdForUser).toHaveBeenCalledWith('user-123', 'some-other-id')
        })
    })
})