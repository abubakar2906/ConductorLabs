import { Injectable } from '@nestjs/common'
import { clerkClient } from './clerk-client'

@Injectable()
export class GithubTokenService {
    // Returns the user's GitHub OAuth access token, or null if they haven't
    // connected GitHub through Clerk. Used by the GitHub API integration to
    // call the GitHub REST API on the user's behalf — never returned to the client.
    async getAccessToken(userId: string): Promise<string | null> {
        const { data } = await clerkClient().users.getUserOauthAccessToken(userId, 'github')
        return data[0]?.token ?? null
    }
}
