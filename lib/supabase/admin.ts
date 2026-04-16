import { createClient } from '@supabase/supabase-js'
import { getSupabaseEnv, isSupabaseConfigured } from '@/lib/supabase/env'

export function getSupabaseAdminClient() {
  if (!isSupabaseConfigured()) {
    return null
  }

  const { url, serviceRoleKey } = getSupabaseEnv()
  if (!serviceRoleKey) {
    return null
  }

  return createClient(url!, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

