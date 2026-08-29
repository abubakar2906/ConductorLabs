import { Injectable } from '@nestjs/common'
import { supabase } from '../supabase/supabase.client'

// One row in the `releases` table.
export type Release = {
    id: string
    user_id: string
    name: string
    repo_full_name: string
    target_branch: string
    created_at: string
}

export type CreateReleaseInput = {
    name: string
    repoFullName: string
    targetBranch: string
}

@Injectable()
export class ReleasesService {
    // A single release by id — but only if it belongs to this user.
    async getByIdForUser(userId: string, id: string): Promise<Release | null> {
        const { data, error } = await supabase()
            .from('releases')
            .select('*')
            .eq('user_id', userId)
            .eq('id', id)
            .maybeSingle()
        if (error) throw error
        return data ?? null
    }

    // All releases owned by this user, newest first.
    async listForUser(userId: string): Promise<Release[]> {
        const { data, error } = await supabase()
            .from('releases')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
        if (error) throw error
        return data ?? []
    }

    // Save a new release for this user and return the created row.
    async create(userId: string, input: CreateReleaseInput): Promise<Release> {
        const { data, error } = await supabase()
            .from('releases')
            .insert({
                user_id: userId,
                name: input.name,
                repo_full_name: input.repoFullName,
                target_branch: input.targetBranch,
            })
            .select()
            .single()
        if (error) throw error
        return data
    }
}
