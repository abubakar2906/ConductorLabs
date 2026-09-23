import {
    Controller,
    Headers,
    Post,
    Req,
    ServiceUnavailableException,
    UnauthorizedException,
} from '@nestjs/common'
import type { Request } from 'express'
import { WebhooksService, type PushEventPayload } from './webhooks.service'

// Public route — GitHub cannot send a Clerk JWT, so there is no ClerkGuard.
// The HMAC signature in X-Hub-Signature-256 is the credential; everything
// else here is just routing.
@Controller('webhooks')
export class WebhooksController {
    constructor(private readonly webhooks: WebhooksService) { }

    // POST /webhooks/github
    @Post('github')
    async github(
        @Req() req: Request,
        @Headers('x-hub-signature-256') signature?: string,
        @Headers('x-github-event') event?: string,
    ) {
        // Fail closed: a server that can't verify signatures should advertise
        // that it isn't ready for webhooks (503), not pretend to accept
        // unsigned traffic.
        if (!this.webhooks.secretConfigured()) {
            throw new ServiceUnavailableException('Webhook secret not configured')
        }

        const rawBody = (req as Request & { rawBody?: Buffer }).rawBody
        if (!rawBody || !signature || !this.webhooks.verifySignature(rawBody, signature)) {
            throw new UnauthorizedException('Invalid signature')
        }

        const eventName = event ?? 'unknown'

        if (eventName === 'ping') {
            return { received: true, event: 'ping' }
        }

        if (eventName === 'push') {
            const matchedReleases = await this.webhooks.recordPush(req.body as PushEventPayload)
            return { received: true, event: 'push', matchedReleases }
        }

        // check_run / pull_request / workflow_run etc.: acknowledged, no side
        // effects this pass.
        return { received: true, event: eventName }
    }
}