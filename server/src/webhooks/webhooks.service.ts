import { Injectable, Logger } from '@nestjs/common'
import * as crypto from 'crypto'
import { supabase } from '../supabase/supabase.client'

// Shape of the payload fields we actually use from a GitHub `push` event.
// See https://docs.github.com/webhooks/event-payloads#push
export interface PushEventPayload {
    ref?: string
    repository?: {
        full_name?: string
    }
}

@Injectable()
export class WebhooksService {
    private readonly logger = new Logger(WebhooksService.name)

    // Lets the controller answer 503 without the service leaking the secret.
    // Read on every call so env changes (tests, reloads) are seen.
    secretConfigured(): boolean {
        return Boolean(process.env.GITHUB_WEBHOOK_SECRET)
    }

    // HMAC-SHA256 over the raw request body, compared in constant time.
    // GitHub sends the signature as hex with a `sha256=` prefix.
    verifySignature(rawBody: string | Buffer, signature: string): boolean {
        const secret = process.env.GITHUB_WEBHOOK_SECRET
        if (!secret) return false

        const provided = signature.startsWith('sha256=')
            ? signature.slice('sha256='.length)
            : signature

        const expected = crypto
            .createHmac('sha256', secret)
            .update(rawBody)
            .digest('hex')

        const expectedBuf = Buffer.from(expected, 'hex')
        const providedBuf = Buffer.from(provided, 'hex')

        // timingSafeEqual throws on a length mismatch — guard it instead.
        if (expectedBuf.length !== providedBuf.length) return false
        return crypto.timingSafeEqual(expectedBuf, providedBuf)
    }

    // `refs/heads/main` → `main`. Non-branch refs (tags, PR refs) pass
    // through untouched; they match no release and count as zero.
    extractBranch(ref: string): string {
        const prefix = 'refs/heads/'
        return ref.startsWith(prefix) ? ref.slice(prefix.length) : ref
    }

    // Stamp last_push_at on every release tracking this repo + branch.
    // Returns the number of matched rows. If the column doesn't exist yet
    // (migration not applied) the update fails with 42703 — we log and
    // swallow it so GitHub doesn't retry the delivery forever.
    async recordPush(payload: PushEventPayload | undefined): Promise<number> {
        const repoFullName = payload?.repository?.full_name
        const ref = payload?.ref
        if (!repoFullName || !ref) return 0

        const branch = this.extractBranch(ref)

        const { data, error } = await supabase()
            .from('releases')
            .update({ last_push_at: new Date().toISOString() })
            .eq('repo_full_name', repoFullName)
            .eq('target_branch', branch)
            .select('id')

        if (error) {
            if (error.code === '42703') {
                this.logger.warn(
                    `releases.last_push_at is missing — apply server/supabase/migrations/0001_add_release_last_push_at.sql. Push for ${repoFullName}@${branch} not recorded.`,
                )
            } else {
                this.logger.error(
                    `Failed to record push for ${repoFullName}@${branch}: ${error.message}`,
                )
            }
            return 0
        }

        return data?.length ?? 0
    }
}