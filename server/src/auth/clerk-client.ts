import { createClerkClient } from '@clerk/backend'

// Built lazily (on first use), NOT at import time.
//
// Why: if we called createClerkClient() at the top of this file, it would read
// CLERK_SECRET_KEY the moment this file is imported — which happens during
// startup, BEFORE Nest's ConfigModule has loaded the .env file. The key would
// be undefined and every Clerk call would fail with "Missing Clerk Secret Key".
// By waiting until the first call, .env is already loaded and the key is there.
let client: ReturnType<typeof createClerkClient> | null = null

export function clerkClient(): ReturnType<typeof createClerkClient> {
    if (!client) {
        client = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
    }
    return client
}
