'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireProfile } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { adminCreateCognitoUser } from '@/lib/aws/cognito'
import { findProfileByEmail, upsertProfile } from '@/lib/db/profiles'

function avatarFromName(fullName: string) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'VN'
}

const householdNeighborSchema = z.object({
  unitId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).nullable().optional(),
  password: z.string().min(8).max(72),
})

export async function createHouseholdNeighbor(input: z.input<typeof householdNeighborSchema>) {
  const parsed = householdNeighborSchema.parse(input)
  const { profile } = await requireProfile(['vecino'])
  const supabase = await getSupabaseServerClient()
  if (!supabase) throw new Error('Supabase no configurado')

  const { data: principal } = await supabase
    .from('unit_profile_memberships')
    .select('id, unit_id, building_id')
    .eq('unit_id', parsed.unitId)
    .eq('profile_id', profile.id)
    .eq('relationship_type', 'vecino_principal')
    .eq('active', true)
    .maybeSingle()

  if (!principal) {
    throw new Error('Solo el vecino principal puede agregar familiares a esta unidad.')
  }

  const { count } = await supabase
    .from('unit_profile_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('unit_id', parsed.unitId)
    .eq('relationship_type', 'vecino_adicional')
    .eq('active', true)

  if ((count ?? 0) >= 4) {
    throw new Error('La unidad ya tiene 4 vecinos adicionales activos.')
  }

  const normalizedEmail = parsed.email.toLowerCase()
  const existingProfile = await findProfileByEmail(normalizedEmail)

  if (existingProfile) {
    if (existingProfile.role !== 'vecino') {
      throw new Error('Ese email ya pertenece a un usuario que no es vecino.')
    }
    if (existingProfile.buildingId && existingProfile.buildingId !== principal.building_id) {
      throw new Error('Ese email ya pertenece a otro edificio.')
    }
  }

  let profileId = existingProfile?.id
  if (!profileId) {
    const { sub } = await adminCreateCognitoUser({
      email: normalizedEmail,
      password: parsed.password,
      fullName: parsed.fullName,
    })
    profileId = sub
  }

  await upsertProfile({
    id: profileId,
    email: normalizedEmail,
    fullName: parsed.fullName,
    avatarText: avatarFromName(parsed.fullName),
    phone: parsed.phone ?? null,
    role: 'vecino',
    buildingId: principal.building_id,
    businessId: null,
  })

  const { data: existingMembership } = await supabase
    .from('unit_profile_memberships')
    .select('id')
    .eq('unit_id', parsed.unitId)
    .eq('profile_id', profileId)
    .eq('relationship_type', 'vecino_adicional')
    .maybeSingle()

  const membershipPayload = {
    unit_id: parsed.unitId,
    building_id: principal.building_id,
    profile_id: profileId,
    relationship_type: 'vecino_adicional',
    active: true,
    created_by_profile_id: profile.id,
  }

  const { error } = existingMembership
    ? await supabase.from('unit_profile_memberships').update(membershipPayload).eq('id', existingMembership.id)
    : await supabase.from('unit_profile_memberships').insert(membershipPayload)

  if (error) throw new Error(error.message)

  revalidatePath('/usuario')
  return { profileId }
}
