import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Built lazily on first use — same reason as clerk-client.ts: reading the env
// vars at import time would run before Nest loads .env, so the keys would be
// undefined. Waiting until first use means .env is ready.
let client: SupabaseClient | null = null

export function supabase(): SupabaseClient {
    if (!client) {
        const url = process.env.SUPABASE_URL
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!url || !key) {
            throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env')
        }
        // service_role key: server-side only, bypasses row-level security.
        // Never expose this key to the browser.
        client = createClient(url, key)
    }
    return client
}
