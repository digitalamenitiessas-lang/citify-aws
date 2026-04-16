import { redirect } from 'next/navigation'
import type { Profile, UserRole } from '@/lib/types'
import { getSupabaseServerClient } from '@/lib/supabase/server'

function mapProfileRow(row: any): Profile {
  return {
    id: row.id,
    email: row.email ?? '',
    fullName: row.full_name ?? 'Usuario',
    role: row.role,
    avatarText: row.avatar_text ?? (row.full_name?.slice(0, 2)?.toUpperCase() || 'U'),
    businessId: row.business_id ?? null,
    buildingId: row.building_id ?? null,
    floor: row.floor ?? null,
    unit: row.unit ?? null,
    phone: row.phone ?? null,
    createdAt: row.created_at,
  }
}

export async function getCurrentProfile() {
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return null
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (!data) {
    return null
  }

  return mapProfileRow(data)
}

export async function requireProfile(allowedRoles?: UserRole[]) {
  const profile = await getCurrentProfile()

  if (!profile) {
    redirect('/login')
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    redirect('/')
  }

  return { profile }
}
