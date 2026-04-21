'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireProfile } from '@/lib/auth'
import type { UserRole } from '@/lib/types'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

function avatarFromName(fullName: string) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U'
}

const createPlatformUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).nullable().optional(),
  password: z.string().min(8).max(72),
  role: z.enum(['super_admin', 'negocio_admin', 'consorcio_admin', 'propietario', 'vecino']),
  buildingId: z.string().uuid().nullable().optional(),
  businessId: z.string().uuid().nullable().optional(),
})

type ImportRelationship = 'propietario' | 'vecino_principal' | 'vecino_adicional'

function relationshipRole(relationship: ImportRelationship): UserRole {
  return relationship === 'propietario' ? 'propietario' : 'vecino'
}

function parseBoolean(value: string | undefined) {
  return ['1', 'true', 'si', 'yes', 'x'].includes((value ?? '').trim().toLowerCase())
}

function parseImportCsv(raw: string) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) {
    throw new Error('La importacion necesita encabezado y al menos una fila.')
  }

  const delimiter = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(delimiter).map((header) => header.trim())

  return lines.slice(1).map((line, index) => {
    const values = line.split(delimiter).map((value) => value.trim())
    const row = Object.fromEntries(headers.map((header, columnIndex) => [header, values[columnIndex] ?? '']))
    return { row, line: index + 2 }
  })
}

async function findOrCreatePlatformProfile(input: {
  fullName: string
  email: string
  phone: string | null
  password: string
  role: UserRole
  buildingId: string | null
  businessId?: string | null
}) {
  const admin = getSupabaseAdminClient()
  if (!admin) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY para crear usuarios desde superadmin.')
  }

  const normalizedEmail = input.email.toLowerCase()
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle()

  let profileId = existingProfile?.id as string | undefined
  if (!profileId) {
    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.fullName },
    })
    if (createError || !createdUser.user) {
      throw new Error(createError?.message ?? 'No se pudo crear el usuario.')
    }
    profileId = createdUser.user.id
  }

  const { error } = await admin.from('profiles').upsert({
    id: profileId,
    email: normalizedEmail,
    full_name: input.fullName,
    avatar_text: avatarFromName(input.fullName),
    role: input.role,
    phone: input.phone,
    building_id: input.buildingId,
    business_id: input.businessId ?? null,
  })
  if (error) throw new Error(error.message)

  return profileId
}

export async function createPlatformUser(input: z.input<typeof createPlatformUserSchema>) {
  const parsed = createPlatformUserSchema.parse(input)
  await requireProfile(['super_admin'])

  const admin = getSupabaseAdminClient()
  if (!admin) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY para crear usuarios desde superadmin.')
  }

  const role = parsed.role as UserRole
  const profileId = await findOrCreatePlatformProfile({
    fullName: parsed.fullName,
    email: parsed.email,
    phone: parsed.phone ?? null,
    password: parsed.password,
    role,
    buildingId: parsed.buildingId ?? null,
    businessId: parsed.businessId ?? null,
  })

  if (role === 'negocio_admin' && parsed.businessId) {
    await admin.from('businesses').update({ owner_profile_id: profileId }).eq('id', parsed.businessId)
  }

  if (role === 'consorcio_admin' && parsed.buildingId) {
    await admin.from('building_admin_assignments').upsert(
      {
        profile_id: profileId,
        building_id: parsed.buildingId,
        is_primary: true,
      },
      { onConflict: 'profile_id,building_id' },
    )

    const { data: property } = await admin
      .from('iadmin_managed_properties')
      .select('administration_id')
      .eq('building_id', parsed.buildingId)
      .limit(1)
      .maybeSingle()

    if (property?.administration_id) {
      await admin.from('iadmin_role_grants').upsert(
        {
          administration_id: property.administration_id,
          profile_id: profileId,
          operational_role: 'titular',
          is_primary: true,
        },
        { onConflict: 'administration_id,profile_id' },
      )
    }
  }

  revalidatePath('/superadmin')
  return { profileId }
}

const bulkImportInitialOccupancySchema = z.object({
  csv: z.string().trim().min(10),
})

export async function bulkImportInitialOccupancy(input: z.input<typeof bulkImportInitialOccupancySchema>) {
  const parsed = bulkImportInitialOccupancySchema.parse(input)
  await requireProfile(['super_admin'])

  const admin = getSupabaseAdminClient()
  if (!admin) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY para importar usuarios desde superadmin.')
  }

  const rows = parseImportCsv(parsed.csv)
  let createdUnits = 0
  let linkedUsers = 0
  const errors: string[] = []

  for (const { row, line } of rows) {
    try {
      const buildingId = row.building_id || row.buildingId
      const unitCode = row.unit_code || row.unitCode || row.unidad
      const relationship = (row.relationship_type || row.relationshipType || row.relacion) as ImportRelationship
      const fullName = row.full_name || row.fullName || row.nombre
      const email = row.email
      const phone = row.phone || row.telefono || null
      const password = row.password || 'Citify2026!'
      const floor = row.floor || row.piso || null
      const kind = row.unit_kind || row.unitKind || 'departamento'

      if (!buildingId || !unitCode || !relationship || !fullName || !email) {
        throw new Error('Faltan columnas obligatorias: building_id, unit_code, relationship_type, full_name, email.')
      }

      if (!['propietario', 'vecino_principal', 'vecino_adicional'].includes(relationship)) {
        throw new Error(`relationship_type invalido: ${relationship}.`)
      }

      const { data: property } = await admin
        .from('iadmin_managed_properties')
        .select('id')
        .eq('building_id', buildingId)
        .limit(1)
        .maybeSingle()

      if (!property?.id) {
        throw new Error(`No existe una propiedad IAdmin para building_id ${buildingId}.`)
      }

      const { data: existingUnit } = await admin
        .from('iadmin_units')
        .select('id')
        .eq('managed_property_id', property.id)
        .ilike('code', unitCode)
        .limit(1)
        .maybeSingle()

      let unitId = existingUnit?.id as string | undefined
      if (!unitId) {
        const { data: createdUnit, error: unitError } = await admin
          .from('iadmin_units')
          .insert({
            managed_property_id: property.id,
            code: unitCode,
            floor,
            kind,
            is_active: true,
          })
          .select('id')
          .single()
        if (unitError || !createdUnit) throw new Error(unitError?.message ?? 'No se pudo crear la unidad.')
        unitId = createdUnit.id as string
        createdUnits += 1
      }

      const profileId = await findOrCreatePlatformProfile({
        fullName,
        email,
        phone,
        password,
        role: relationshipRole(relationship),
        buildingId,
      })

      if (relationship === 'vecino_principal') {
        await admin
          .from('unit_profile_memberships')
          .update({ active: false })
          .eq('unit_id', unitId)
          .eq('relationship_type', 'vecino_principal')
          .eq('active', true)
      }

      const { data: existingMembership } = await admin
        .from('unit_profile_memberships')
        .select('id')
        .eq('unit_id', unitId)
        .eq('profile_id', profileId)
        .eq('relationship_type', relationship)
        .maybeSingle()

      const membershipPayload = {
        unit_id: unitId,
        building_id: buildingId,
        profile_id: profileId,
        relationship_type: relationship,
        is_primary: relationship === 'propietario' ? parseBoolean(row.is_primary || row.principal) : false,
        active: true,
      }

      const { error: membershipError } = existingMembership
        ? await admin.from('unit_profile_memberships').update(membershipPayload).eq('id', existingMembership.id)
        : await admin.from('unit_profile_memberships').insert(membershipPayload)
      if (membershipError) throw new Error(membershipError.message)

      if (relationship === 'propietario') {
        const { data: existingHolder } = await admin
          .from('iadmin_unit_holders')
          .select('id')
          .eq('unit_id', unitId)
          .eq('profile_id', profileId)
          .eq('holder_kind', 'propietario')
          .maybeSingle()

        if (!existingHolder) {
          await admin.from('iadmin_unit_holders').insert({
            unit_id: unitId,
            profile_id: profileId,
            full_name: fullName,
            holder_kind: 'propietario',
            email: email.toLowerCase(),
            phone,
            is_active: true,
          })
        }
      }

      linkedUsers += 1
    } catch (error) {
      errors.push(`Linea ${line}: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    }
  }

  revalidatePath('/superadmin')
  revalidatePath('/iadmin')
  return { createdUnits, linkedUsers, errors }
}

const createBusinessWithAdminSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  address: z.string().trim().max(200).nullable().optional(),
  adminFullName: z.string().trim().min(2).max(120),
  adminEmail: z.string().trim().email().max(160),
  adminPhone: z.string().trim().max(40).nullable().optional(),
  adminPassword: z.string().min(8).max(72),
})

export async function createBusinessWithAdmin(input: z.input<typeof createBusinessWithAdminSchema>) {
  const parsed = createBusinessWithAdminSchema.parse(input)
  await requireProfile(['super_admin'])

  const admin = getSupabaseAdminClient()
  if (!admin) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY para crear negocios desde superadmin.')
  }

  const { data: business, error: businessError } = await admin
    .from('businesses')
    .insert({
      name: parsed.businessName,
      category: parsed.category,
      description: parsed.description ?? '',
      address: parsed.address ?? null,
    })
    .select('id')
    .single()

  if (businessError || !business) {
    throw new Error(businessError?.message ?? 'No se pudo crear el negocio.')
  }

  const profileId = await findOrCreatePlatformProfile({
    fullName: parsed.adminFullName,
    email: parsed.adminEmail,
    phone: parsed.adminPhone ?? null,
    password: parsed.adminPassword,
    role: 'negocio_admin',
    buildingId: null,
    businessId: business.id,
  })

  await admin.from('businesses').update({ owner_profile_id: profileId }).eq('id', business.id)

  revalidatePath('/superadmin')
  return { businessId: business.id as string, profileId }
}
