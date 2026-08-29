import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { ClerkGuard } from './clerk.guard'
import { clerkClient } from './clerk-client'

@Controller('auth')

export class AuthController {
    @Get('me')
    @UseGuards(ClerkGuard)
    getMe(@Req() req: any) {
        return req.auth
    }

    // Powers the Settings page's GitHub connection card. Tells the client
    // whether GitHub is connected and with what scopes, without ever handing
    // the actual access token to the browser.
    @Get('github/status')
    @UseGuards(ClerkGuard)
    async getGithubStatus(@Req() req: any) {
        const user = await clerkClient().users.getUser(req.auth.sub)
        const account = user.externalAccounts.find(
            (a) => a.provider === 'github' || a.provider === 'oauth_github',
        )

        if (!account) return { connected: false }

        return {
            connected: true,
            username: account.username,
            scopes: account.approvedScopes ? account.approvedScopes.split(' ') : [],
        }
    }
}
