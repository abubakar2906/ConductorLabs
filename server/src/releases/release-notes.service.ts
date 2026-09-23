import {
    BadRequestException,
    Injectable,
    NotFoundException,
    ServiceUnavailableException,
    UnauthorizedException,
} from '@nestjs/common'
import { GithubTokenService } from '../auth/github-token.service'
import { GithubService, type CommitContext, type RangeContext } from '../github/github.service'
import { supabase } from '../supabase/supabase.client'
import { ReleasesService, type Release } from './releases.service'

const DEFAULT_API_URL = 'https://api.groq.com/openai/v1'
const DEFAULT_MODEL = 'llama-3.3-70b-versatile'
const MAX_CONTEXT_COMMITS = 50

export type GenerateResult = {
    release: Release
    // True when stored notes were returned instead of calling the LLM.
    cached: boolean
    commitCount: number
}

@Injectable()
export class ReleaseNotesService {
    constructor(
        private readonly releases: ReleasesService,
        private readonly github: GithubService,
        private readonly tokens: GithubTokenService,
    ) { }

    // Generate (or return cached) AI release notes for a release.
    async generate(userId: string, releaseId: string, force = false): Promise<GenerateResult> {
        const release = await this.releases.getByIdForUser(userId, releaseId)
        if (!release) throw new NotFoundException('Release not found')

        const token = await this.tokens.getAccessToken(userId)
        if (!token) throw new UnauthorizedException('No GitHub connection for this user')

        const [owner, repo] = (release.repo_full_name ?? '').split('/')
        if (!owner || !repo) {
            throw new BadRequestException(`repo must be "owner/name", got "${release.repo_full_name}"`)
        }

        const tipSha = await this.github.getRefTipSha(token, owner, repo, release.target_branch)

        // Same tip as last time and notes exist → nothing new to summarize.
        if (
            !force &&
            release.release_notes &&
            release.notes_tip_sha &&
            release.notes_tip_sha === tipSha
        ) {
            return { release, cached: true, commitCount: 0 }
        }

        const context = await this.buildContext(token, owner, repo, release, tipSha)
        if (context.commits.length === 0 && release.release_notes) {
            // No commits to summarize and we already have notes — reuse them.
            return { release, cached: true, commitCount: 0 }
        }

        const markdown = await this.callLlm(context, release)

        const updated = await this.saveGenerated(userId, releaseId, markdown, tipSha)
        return { release: updated, cached: false, commitCount: context.commits.length }
    }

    // Persist a user's manual edit of the notes.
    async saveEdited(userId: string, releaseId: string, markdown: string): Promise<Release> {
        const trimmed = (markdown ?? '').trim()
        if (!trimmed) throw new BadRequestException('markdown must not be empty')
        const release = await this.releases.getByIdForUser(userId, releaseId)
        if (!release) throw new NotFoundException('Release not found')
        return this.persist(releaseId, { release_notes: trimmed, notes_edited: true })
    }

    // Diff from the last-noted tip (or the recent history on first run).
    private async buildContext(
        token: string,
        owner: string,
        repo: string,
        release: Release,
        tipSha: string,
    ): Promise<RangeContext> {
        if (release.notes_tip_sha && release.notes_tip_sha !== tipSha) {
            const range = await this.github.getRangeContext(
                token,
                owner,
                repo,
                release.notes_tip_sha,
                tipSha,
            )
            if (range.aheadBy > 0) return range
            // Nothing new since the last notes — fall through to recent history
            // so an explicit regenerate still rewrites the notes.
        }

        const commits = await this.github.getRecentCommitsContext(
            token,
            owner,
            repo,
            release.target_branch,
            MAX_CONTEXT_COMMITS,
        )
        return {
            aheadBy: commits.length,
            totalCommits: commits.length,
            commits,
            files: [],
            additions: 0,
            deletions: 0,
        }
    }

    // Send the git context to the configured LLM and return Markdown.
    private async callLlm(context: RangeContext, release: Release): Promise<string> {
        const apiKey = process.env.AI_API_KEY
        if (!apiKey) {
            throw new ServiceUnavailableException(
                'AI_API_KEY is not configured on the server — set AI_API_URL, AI_API_KEY and AI_MODEL in server/.env',
            )
        }
        const apiUrl = (process.env.AI_API_URL ?? DEFAULT_API_URL).replace(/\/$/, '')
        const model = process.env.AI_MODEL ?? DEFAULT_MODEL

        const res = await fetch(`${apiUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                temperature: 0.3,
                max_tokens: 1024,
                messages: [
                    {
                        role: 'system',
                        content:
                            'You write concise, accurate release notes in Markdown for a software team. ' +
                            'Only use facts present in the provided git context — never invent features or fixes. ' +
                            'Use these sections when they apply: "## Added", "## Changed", "## Fixed", "## Breaking changes". ' +
                            'Omit empty sections. One bullet per item, plain language, start with a verb. ' +
                            'Reference PR numbers like (#42) when present. No preamble, no closing summary — Markdown only.',
                    },
                    {
                        role: 'user',
                        content: JSON.stringify({
                            releaseName: release.name,
                            branch: release.target_branch,
                            repo: release.repo_full_name,
                            commits: context.commits,
                            files: context.files,
                            additions: context.additions,
                            deletions: context.deletions,
                            instruction:
                                'Write the release notes for these changes. Summary of the branch changes only.',
                        }),
                    },
                ],
            }),
        })

        if (!res.ok) {
            const body = await res.text()
            throw new ServiceUnavailableException(
                `AI API responded ${res.status}: ${body.slice(0, 300)}`,
            )
        }
        const data: any = await res.json()
        const content: string = data?.choices?.[0]?.message?.content ?? ''
        const markdown = stripFences(content).trim()
        if (!markdown) {
            throw new ServiceUnavailableException('AI API returned an empty response')
        }
        return markdown
    }

    // Write generated notes back to the release row.
    private saveGenerated(userId: string, releaseId: string, markdown: string, tipSha: string): Promise<Release> {
        void userId // ownership already checked by the caller via getByIdForUser
        return this.persist(releaseId, {
            release_notes: markdown,
            notes_generated_at: new Date().toISOString(),
            notes_edited: false,
            notes_tip_sha: tipSha,
        })
    }

    private async persist(releaseId: string, patch: Partial<Release>): Promise<Release> {
        const { data, error } = await supabase()
            .from('releases')
            .update(patch)
            .eq('id', releaseId)
            .select()
            .single()
        if (error) throw error
        return data as Release
    }
}

// Models sometimes wrap the answer in ```markdown fences — strip them.
function stripFences(text: string): string {
    const fenced = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/)
    return fenced ? fenced[1]! : text
}
