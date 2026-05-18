'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireProfile } from '@/lib/auth'
import { adminCreateCognitoUser } from '@/lib/aws/cognito'
import { findProfileByEmail, upsertProfile } from '@/lib/db/profiles'
import {
  findActiveMembershipsForProfileFromPostgres,
  countActiveAdditionalNeighborsInPostgres,
  findPrincipalMembershipForProfileFromPostgres,
  findUnitProfileMembershipFromPostgres,
  upsertUnitProfileMembershipInPostgres,
} from '@/lib/db/iadmin-writes'
import type { UnitProfileMembership } from '@/lib/types'

function avatarFromName(fullName: string) {
  return (
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'VN'
  )
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
  const currentMemberships = await findActiveMembershipsForProfileFromPostgres(profile.id)
  const currentMembershipForUnit = currentMemberships.find((membership) => membership.unit_id === parsed.unitId)

  if (!currentMembershipForUnit) {
    throw new Error('La unidad seleccionada no coincide con tu perfil actual.')
  }

  const principal = await findPrincipalMembershipForProfileFromPostgres({
    unitId: parsed.unitId,
    profileId: profile.id,
  })
  if (!principal) {
    throw new Error('Solo el vecino principal puede agregar familiares a esta unidad.')
  }

  const additionalCount = await countActiveAdditionalNeighborsInPostgres(parsed.unitId)
  if (additionalCount >= 4) {
    throw new Error('La unidad ya tiene 4 vecinos adicionales activos.')
  }

  const normalizedEmail = parsed.email.toLowerCase()
  const existingProfile = await findProfileByEmail(normalizedEmail)
  const existingMemberships = existingProfile
    ? await findActiveMembershipsForProfileFromPostgres(existingProfile.id)
    : []

  if (existingProfile) {
    if (existingProfile.role !== 'vecino') {
      throw new Error('Ese email ya pertenece a un usuario que no es vecino.')
    }
    const belongsToOtherBuilding =
      (existingProfile.buildingId && existingProfile.buildingId !== principal.building_id) ||
      existingMemberships.some((membership) => membership.building_id !== principal.building_id)

    if (belongsToOtherBuilding) {
      throw new Error('Ese email ya pertenece a otro edificio.')
    }

    if (existingMemberships.some((membership) => membership.unit_id !== parsed.unitId)) {
      throw new Error('Ese email ya está vinculado a otra unidad de este edificio.')
    }

    const alreadyLinkedToThisUnit = existingMemberships.some((membership) => membership.unit_id === parsed.unitId)
    const alreadyAdditionalInThisUnit = existingMemberships.some(
      (membership) => membership.unit_id === parsed.unitId && membership.relationship_type === 'vecino_adicional',
    )

    if (alreadyLinkedToThisUnit && !alreadyAdditionalInThisUnit) {
      throw new Error('Ese email ya está vinculado a esta unidad.')
    }
  }

  let profileId = existingProfile?.id
  let createdInCognito = false

  try {
    if (!profileId) {
      const { sub } = await adminCreateCognitoUser({
        email: normalizedEmail,
        password: parsed.password,
        fullName: parsed.fullName,
      })
      profileId = sub
      createdInCognito = true
    }

    const savedProfile = await upsertProfile({
      id: profileId,
      email: normalizedEmail,
      fullName: parsed.fullName,
      avatarText: avatarFromName(parsed.fullName),
      phone: parsed.phone ?? null,
      role: 'vecino',
      buildingId: principal.building_id,
      businessId: null,
    })

    const existingMembership = await findUnitProfileMembershipFromPostgres({
      unitId: parsed.unitId,
      profileId,
      relationshipType: 'vecino_adicional',
    })

    await upsertUnitProfileMembershipInPostgres({
      membershipId: existingMembership?.id ?? null,
      unitId: parsed.unitId,
      buildingId: principal.building_id,
      profileId,
      relationshipType: 'vecino_adicional',
      isPrimary: false,
      createdByProfileId: profile.id,
    })

    revalidatePath('/usuario')

    return {
      profileId,
      membership: {
        id: existingMembership?.id ?? profileId,
        unitId: parsed.unitId,
        buildingId: principal.building_id,
        profileId,
        relationshipType: 'vecino_adicional',
        isPrimary: false,
        active: true,
        createdByProfileId: profile.id,
        createdAt: new Date().toISOString(),
        unitCode: profile.unit,
        unitFloor: profile.floor,
        buildingName: null,
        profile: savedProfile,
      } satisfies UnitProfileMembership,
    }
  } catch (error) {
    console.error('createHouseholdNeighbor failed', {
      actorProfileId: profile.id,
      unitId: parsed.unitId,
      email: normalizedEmail,
      profileId,
      createdInCognito,
      error,
    })
    if (createdInCognito) {
      throw new Error(
        'Creamos la cuenta de acceso, pero no pudimos vincularla correctamente a la unidad. Avísale al equipo para revisar el alta antes de reintentar.',
      )
    }
    throw error instanceof Error
      ? error
      : new Error('No pudimos completar el alta del vecino adicional. Revisa los datos e inténtalo nuevamente.')
  }
}
