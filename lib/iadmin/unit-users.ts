// Lógica compartida para crear/vincular un usuario vecino a una unidad, con
// credenciales temporales. La usan tanto el alta individual (createUnitUser en
// app/iadmin/consorcios/[id]/actions.ts) como la carga masiva
// (vecinos-masivo/actions.ts). NO lleva 'use server': es un módulo normal para
// poder compartir helpers entre múltiples server actions sin las restricciones
// de export de Next.js.

import type { UnitProfileRelationship } from '@/lib/types'
import { adminCreateCognitoUser, generateTempPassword } from '@/lib/aws/cognito'
import { findProfileByEmail, upsertProfile } from '@/lib/db/profiles'
import { insertIAdminAuditLogInPostgres } from '@/lib/db/iadmin-core'
import {
  deactivateActivePrincipalMembershipsInPostgres,
  findUnitProfileMembershipFromPostgres,
  upsertUnitProfileMembershipInPostgres,
} from '@/lib/db/iadmin-writes'

export function avatarFromName(fullName: string): string {
  return (
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U'
  )
}

export interface EnsureUnitUserScope {
  unitId: string
  unitCode: string
  buildingId: string
  administrationId: string
}

export interface EnsureUnitUserInput {
  scope: EnsureUnitUserScope
  fullName: string
  email: string
  phone: string | null
  relationshipType: UnitProfileRelationship
  actorProfileId: string
  // Contraseña explícita (form individual); si falta se genera una temporal.
  password?: string
  // Para distinguir el origen en el audit log.
  via: 'individual' | 'bulk'
}

export interface EnsureUnitUserResult {
  profileId: string
  created: boolean
  // Sólo se devuelve la contraseña cuando se creó el usuario (para mandarla por
  // mail). Si el perfil ya existía, sólo se vincula y no se re-credencializa.
  temporaryPassword: string | null
}

// Crea (o reutiliza) el perfil del vecino y lo asocia a la unidad. Si el email
// no existía, crea el usuario en Cognito con una contraseña temporal y marca
// password_must_change para forzar el cambio en el primer login. Si ya existía,
// sólo lo vincula a la unidad (sin tocar su contraseña).
export async function ensureUnitUserWithCredentials(
  input: EnsureUnitUserInput,
): Promise<EnsureUnitUserResult> {
  const { scope } = input
  const normalizedEmail = input.email.trim().toLowerCase()
  const existing = await findProfileByEmail(normalizedEmail)
  const created = !existing

  const tempPassword = input.password ?? generateTempPassword()

  let profileId = existing?.id
  if (!profileId) {
    const { sub } = await adminCreateCognitoUser({
      email: normalizedEmail,
      password: tempPassword,
      fullName: input.fullName,
    })
    profileId = sub
  }

  await upsertProfile({
    id: profileId,
    email: normalizedEmail,
    fullName: input.fullName,
    avatarText: avatarFromName(input.fullName),
    role: 'vecino',
    phone: input.phone,
    buildingId: scope.buildingId,
    businessId: null,
    // Sólo se honra en INSERT, así que reutilizar un perfil no lo resetea.
    passwordMustChangeOnCreate: true,
  })

  if (input.relationshipType === 'vecino_principal') {
    await deactivateActivePrincipalMembershipsInPostgres(scope.unitId)
  }

  const existingMembership = await findUnitProfileMembershipFromPostgres({
    unitId: scope.unitId,
    profileId,
    relationshipType: input.relationshipType,
  })

  await upsertUnitProfileMembershipInPostgres({
    membershipId: existingMembership?.id ?? null,
    unitId: scope.unitId,
    buildingId: scope.buildingId,
    profileId,
    relationshipType: input.relationshipType,
    isPrimary: false,
    createdByProfileId: input.actorProfileId,
  })

  await insertIAdminAuditLogInPostgres({
    administrationId: scope.administrationId,
    actorProfileId: input.actorProfileId,
    entityType: 'unit_profile_memberships',
    entityId: scope.unitId,
    action: 'unit_user.created',
    metadata: {
      unit_code: scope.unitCode,
      profile_id: profileId,
      relationship_type: input.relationshipType,
      via: input.via,
    },
  })

  return {
    profileId,
    created,
    temporaryPassword: created ? tempPassword : null,
  }
}
