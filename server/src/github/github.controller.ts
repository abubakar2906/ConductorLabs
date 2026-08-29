import {
    Controller,
    Get,
    Query,
    Req,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common'
import { ClerkGuard } from '../auth/clerk.guard'
import { GithubTokenService } from '../auth/github-token.service'
import { GithubService } from './github.service'

// Every route here requires a logged-in user.
@Controller('github')
@UseGuards(ClerkGuard)
export class GithubController {
    constructor(
        private readonly tokens: GithubTokenService,
        private readonly github: GithubService,
    ) { }

    // Grab this user's GitHub token, or reject if they have no connection.
    private async tokenFor(req: any): Promise<string> {
        const token = await this.tokens.getAccessToken(req.auth.sub)
        if (!token) {
            throw new UnauthorizedException('No GitHub connection for this user')
        }
        return token
    }

    // GET /github/repos → the repos this user can pick from.
    @Get('repos')
    async repos(@Req() req: any) {
        return this.github.getRepos(await this.tokenFor(req))
    }

    // GET /github/branches?repo=owner/name → that repo's branches.
    @Get('branches')
    async branches(@Req() req: any, @Query('repo') repo: string) {
        return this.github.getBranches(await this.tokenFor(req), repo)
    }

    // GET /github/release-status?repo=owner/name&branch=main
    // Returns the real open PRs + CI checks for that repo/branch.
    @Get('release-status')
    async releaseStatus(
        @Req() req: any,
        @Query('repo') repo: string,
        @Query('branch') branch: string,
    ) {
        const checks = await this.github.getReleaseChecks(await this.tokenFor(req), repo, branch)
        return { repo, branch, checks }
    }
}
