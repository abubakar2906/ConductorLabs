import { Test, TestingModule } from '@nestjs/testing'
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import type { Request } from 'express'
import { WebhooksController } from './webhooks.controller'
import { WebhooksService } from './webhooks.service'

// Raw bytes GitHub would have signed.
const rawBody = Buffer.from(
    JSON.stringify({ repository: { full_name: 'owner/repo' }, ref: 'refs/heads/main' }),
)

function makeReq(raw: Buffer): Request {
    return { rawBody: raw, body: JSON.parse(raw.toString('utf8')) } as unknown as Request
}

describe('WebhooksController', () => {
    let controller: WebhooksController
    let service: {
        secretConfigured: jest.Mock
        verifySignature: jest.Mock
        recordPush: jest.Mock
    }

    beforeEach(async () => {
        service = {
            secretConfigured: jest.fn(),
            verifySignature: jest.fn(),
            recordPush: jest.fn().mockResolvedValue(2),
        }
        const app: TestingModule = await Test.createTestingModule({
            controllers: [WebhooksController],
            providers: [
                {
                    provide: WebhooksService,
                    useValue: service,
                },
            ],
        }).compile()

        controller = app.get<WebhooksController>(WebhooksController)
    })

    it('rejects with 503 when no secret is configured', async () => {
        service.secretConfigured.mockReturnValue(false)
        await expect(controller.github(makeReq(rawBody), 'sha256=abc', 'ping')).rejects.toThrow(
            ServiceUnavailableException,
        )
        expect(service.verifySignature).not.toHaveBeenCalled()
    })

    it('rejects with 401 when the signature header is missing', async () => {
        service.secretConfigured.mockReturnValue(true)
        await expect(controller.github(makeReq(rawBody), undefined, 'push')).rejects.toThrow(
            UnauthorizedException,
        )
        expect(service.recordPush).not.toHaveBeenCalled()
    })

    it('rejects with 401 when the raw body is missing', async () => {
        service.secretConfigured.mockReturnValue(true)
        service.verifySignature.mockReturnValue(true)
        const req = {} as unknown as Request
        await expect(controller.github(req, 'sha256=abc', 'push')).rejects.toThrow(
            UnauthorizedException,
        )
    })

    it('rejects with 401 when the signature does not verify', async () => {
        service.secretConfigured.mockReturnValue(true)
        service.verifySignature.mockReturnValue(false)
        await expect(controller.github(makeReq(rawBody), 'sha256=bad', 'push')).rejects.toThrow(
            UnauthorizedException,
        )
        expect(service.recordPush).not.toHaveBeenCalled()
    })

    it('answers ping with 200 and no side effects', async () => {
        service.secretConfigured.mockReturnValue(true)
        service.verifySignature.mockReturnValue(true)
        const res = await controller.github(makeReq(rawBody), 'sha256=ok', 'ping')
        expect(res).toEqual({ received: true, event: 'ping' })
        expect(service.recordPush).not.toHaveBeenCalled()
    })

    it('records a push and reports how many releases matched', async () => {
        service.secretConfigured.mockReturnValue(true)
        service.verifySignature.mockReturnValue(true)
        const res = await controller.github(makeReq(rawBody), 'sha256=ok', 'push')
        expect(res).toEqual({ received: true, event: 'push', matchedReleases: 2 })
        expect(service.recordPush).toHaveBeenCalledTimes(1)
        expect(service.recordPush).toHaveBeenCalledWith({
            repository: { full_name: 'owner/repo' },
            ref: 'refs/heads/main',
        })
    })

    it('acknowledges unknown events without side effects', async () => {
        service.secretConfigured.mockReturnValue(true)
        service.verifySignature.mockReturnValue(true)
        const res = await controller.github(makeReq(rawBody), 'sha256=ok', 'check_run')
        expect(res).toEqual({ received: true, event: 'check_run' })
        expect(service.recordPush).not.toHaveBeenCalled()
    })

    it('treats a missing event header as unknown', async () => {
        service.secretConfigured.mockReturnValue(true)
        service.verifySignature.mockReturnValue(true)
        const res = await controller.github(makeReq(rawBody), 'sha256=ok', undefined)
        expect(res).toEqual({ received: true, event: 'unknown' })
    })
})