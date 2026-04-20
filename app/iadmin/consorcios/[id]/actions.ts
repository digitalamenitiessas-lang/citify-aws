'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireIAdmin } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase/server'

async function getPropertyAdminId(propertyId: string) {
  const supabase = await getSupabaseServerClient()
  if (!supabase) throw new Error('Supabase no configurado')
  const { data } = await supabase
    .from('iadmin_managed_properties')
    .select('id, administration_id')
    .eq('id', propertyId)
    .maybeSingle()
  if (!data) throw new Error('Consorcio no encontrado')
  return { supabase, administrationId: data.administration_id as string }
}

// ----------------------------------------------------------------------------
// Managed property (edicion datos del consorcio)
// ----------------------------------------------------------------------------

const updatePropertySchema = z.object({
  propertyId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(120).nullable().optional(),
  taxId: z.string().trim().max(20).nullable().optional(),
  managementFeePct: z.number().min(0).max(100).nullable().optional(),
  managedSince: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  propertyKind: z.enum(['consorcio', 'barrio_privado', 'edificio', 'mixto']).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
})

export async function updateManagedProperty(input: z.input<typeof updatePropertySchema>) {
  const parsed = updatePropertySchema.parse(input)
  const { supabase, administrationId } = await getPropertyAdminId(parsed.propertyId)
  const { profile } = await requireIAdmin({
    capability: 'consorcio.edit',
    administrationId,
  })

  const patch: Record<string, unknown> = {}
  if (parsed.displayName !== undefined) patch.display_name = parsed.displayName
  if (parsed.taxId !== undefined) patch.tax_id = parsed.taxId
  if (parsed.managementFeePct !== undefined) patch.management_fee_pct = parsed.managementFeePct
  if (parsed.managedSince !== undefined) patch.managed_since = parsed.managedSince
  if (parsed.propertyKind !== undefined) patch.property_kind = parsed.propertyKind
  if (parsed.notes !== undefined) patch.notes = parsed.notes

  if (Object.keys(patch).length === 0) return

  const { error } = await supabase.from('iadmin_managed_properties').update(patch).eq('id', parsed.propertyId)
  if (error) throw new Error(error.message)

  await supabase.from('iadmin_audit_logs').insert({
    administration_id: administrationId,
    actor_profile_id: profile.id,
    entity_type: 'iadmin_managed_properties',
    entity_id: parsed.propertyId,
    action: 'property.updated',
    metadata: patch,
  })

  revalidatePath(`/iadmin/consorcios/${parsed.propertyId}`)
  revalidatePath('/iadmin/cartera')
}

// ----------------------------------------------------------------------------
// Datos legales del consorcio (banco, seguros, horarios, amenities, notas)
// ----------------------------------------------------------------------------

const legalInfoSchema = z.object({
  bank: z
    .object({
      name: z.string().trim().max(80).optional(),
      cbu: z.string().trim().max(32).optional(),
      alias: z.string().trim().max(40).optional(),
      account: z.string().trim().max(40).optional(),
    })
    .optional(),
  accountantName: z.string().trim().max(120).optional(),
  accountantPhone: z.string().trim().max(40).optional(),
  accountantEmail: z.string().trim().email().max(120).optional().or(z.literal('').transform(() => undefined)),
  insurance: z
    .array(
      z.object({
        company: z.string().trim().max(80).optional(),
        policy: z.string().trim().max(60).optional(),
        coverage: z.string().trim().max(500).optional(),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
      }),
    )
    .max(10)
    .optional(),
  amenities: z
    .array(
      z.object({
        name: z.string().trim().max(80).optional(),
        price: z.string().trim().max(40).optional(),
        deposit: z.string().trim().max(40).optional(),
      }),
    )
    .max(20)
    .optional(),
  collectionSchedule: z.string().trim().max(300).optional(),
  footerNotes: z.string().trim().max(2000).optional(),
})

const updatePropertyLegalSchema = z.object({
  propertyId: z.string().uuid(),
  legalInfo: legalInfoSchema,
})

export async function updatePropertyLegalInfo(input: z.input<typeof updatePropertyLegalSchema>) {
  const parsed = updatePropertyLegalSchema.parse(input)
  const { supabase, administrationId } = await getPropertyAdminId(parsed.propertyId)
  const { profile } = await requireIAdmin({
    capability: 'consorcio.legal.edit',
    administrationId,
  })

  const { error } = await supabase
    .from('iadmin_managed_properties')
    .update({ legal_info: parsed.legalInfo })
    .eq('id', parsed.propertyId)

  if (error) throw new Error(error.message)

  await supabase.from('iadmin_audit_logs').insert({
    administration_id: administrationId,
    actor_profile_id: profile.id,
    entity_type: 'iadmin_managed_properties',
    entity_id: parsed.propertyId,
    action: 'property.legal_updated',
  })

  revalidatePath(`/iadmin/consorcios/${parsed.propertyId}`)
}

// ----------------------------------------------------------------------------
// Unidades
// ----------------------------------------------------------------------------

const unitFields = z.object({
  code: z.string().trim().min(1).max(30),
  kind: z.enum(['departamento', 'casa', 'local', 'cochera', 'baulera', 'otro']),
  floor: z.string().trim().max(20).nullable().optional(),
  surfaceM2: z.number().nonnegative().nullable().optional(),
  prorataCoefficient: z.number().min(0).max(1).nullable().optional(),
})

const createUnitSchema = unitFields.extend({
  propertyId: z.string().uuid(),
})

export async function createUnit(input: z.input<typeof createUnitSchema>) {
  const parsed = createUnitSchema.parse(input)
  const { supabase, administrationId } = await getPropertyAdminId(parsed.propertyId)
  const { profile } = await requireIAdmin({
    capability: 'units.manage',
    administrationId,
  })

  const { data, error } = await supabase
    .from('iadmin_units')
    .insert({
      managed_property_id: parsed.propertyId,
      code: parsed.code,
      kind: parsed.kind,
      floor: parsed.floor ?? null,
      surface_m2: parsed.surfaceM2 ?? null,
      prorata_coefficient: parsed.prorataCoefficient ?? null,
      is_active: true,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  await supabase.from('iadmin_audit_logs').insert({
    administration_id: administrationId,
    actor_profile_id: profile.id,
    entity_type: 'iadmin_units',
    entity_id: data.id,
    action: 'unit.created',
    metadata: { code: parsed.code },
  })

  revalidatePath(`/iadmin/consorcios/${parsed.propertyId}`)
  return { id: data.id as string }
}

const updateUnitSchema = unitFields.partial().extend({
  unitId: z.string().uuid(),
})

export async function updateUnit(input: z.input<typeof updateUnitSchema>) {
  const parsed = updateUnitSchema.parse(input)
  const supabase = await getSupabaseServerClient()
  if (!supabase) throw new Error('Supabase no configurado')

  const { data: unit } = await supabase
    .from('iadmin_units')
    .select('id, managed_property_id, iadmin_managed_properties!inner(administration_id)')
    .eq('id', parsed.unitId)
    .maybeSingle()
  if (!unit) throw new Error('Unidad no encontrada')

  const propertyRel = Array.isArray(unit.iadmin_managed_properties)
    ? unit.iadmin_managed_properties[0]
    : unit.iadmin_managed_properties
  const administrationId = propertyRel?.administration_id as string

  const { profile } = await requireIAdmin({ capability: 'units.manage', administrationId })

  const patch: Record<string, unknown> = {}
  if (parsed.code !== undefined) patch.code = parsed.code
  if (parsed.kind !== undefined) patch.kind = parsed.kind
  if (parsed.floor !== undefined) patch.floor = parsed.floor
  if (parsed.surfaceM2 !== undefined) patch.surface_m2 = parsed.surfaceM2
  if (parsed.prorataCoefficient !== undefined) patch.prorata_coefficient = parsed.prorataCoefficient
  if (Object.keys(patch).length === 0) return

  const { error } = await supabase.from('iadmin_units').update(patch).eq('id', parsed.unitId)
  if (error) throw new Error(error.message)

  await supabase.from('iadmin_audit_logs').insert({
    administration_id: administrationId,
    actor_profile_id: profile.id,
    entity_type: 'iadmin_units',
    entity_id: parsed.unitId,
    action: 'unit.updated',
    metadata: patch,
  })

  revalidatePath(`/iadmin/consorcios/${unit.managed_property_id}`)
}

const deactivateUnitSchema = z.object({ unitId: z.string().uuid() })

export async function deactivateUnit(input: z.input<typeof deactivateUnitSchema>) {
  const parsed = deactivateUnitSchema.parse(input)
  const supabase = await getSupabaseServerClient()
  if (!supabase) throw new Error('Supabase no configurado')

  const { data: unit } = await supabase
    .from('iadmin_units')
    .select('id, managed_property_id, iadmin_managed_properties!inner(administration_id)')
    .eq('id', parsed.unitId)
    .maybeSingle()
  if (!unit) throw new Error('Unidad no encontrada')

  const propertyRel = Array.isArray(unit.iadmin_managed_properties)
    ? unit.iadmin_managed_properties[0]
    : unit.iadmin_managed_properties
  const administrationId = propertyRel?.administration_id as string

  const { profile } = await requireIAdmin({ capability: 'units.manage', administrationId })

  const { error } = await supabase.from('iadmin_units').update({ is_active: false }).eq('id', parsed.unitId)
  if (error) throw new Error(error.message)

  await supabase.from('iadmin_audit_logs').insert({
    administration_id: administrationId,
    actor_profile_id: profile.id,
    entity_type: 'iadmin_units',
    entity_id: parsed.unitId,
    action: 'unit.deactivated',
  })

  revalidatePath(`/iadmin/consorcios/${unit.managed_property_id}`)
}

// ----------------------------------------------------------------------------
// Titulares
// ----------------------------------------------------------------------------

const createHolderSchema = z.object({
  unitId: z.string().uuid(),
  fullName: z.string().trim().min(1).max(120),
  holderKind: z.enum(['propietario', 'inquilino', 'apoderado', 'otro']),
  taxId: z.string().trim().max(20).nullable().optional(),
  email: z.string().trim().email().max(120).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  replaceActive: z.boolean().optional().default(false),
})

export async function createUnitHolder(input: z.input<typeof createHolderSchema>) {
  const parsed = createHolderSchema.parse(input)
  const supabase = await getSupabaseServerClient()
  if (!supabase) throw new Error('Supabase no configurado')

  const { data: unit } = await supabase
    .from('iadmin_units')
    .select('id, managed_property_id, iadmin_managed_properties!inner(administration_id)')
    .eq('id', parsed.unitId)
    .maybeSingle()
  if (!unit) throw new Error('Unidad no encontrada')

  const propertyRel = Array.isArray(unit.iadmin_managed_properties)
    ? unit.iadmin_managed_properties[0]
    : unit.iadmin_managed_properties
  const administrationId = propertyRel?.administration_id as string

  const { profile } = await requireIAdmin({ capability: 'holders.manage', administrationId })

  // Si pidio reemplazar al activo del mismo kind, lo cerramos primero
  if (parsed.replaceActive) {
    await supabase
      .from('iadmin_unit_holders')
      .update({ is_active: false, end_date: new Date().toISOString().slice(0, 10) })
      .eq('unit_id', parsed.unitId)
      .eq('holder_kind', parsed.holderKind)
      .eq('is_active', true)
  }

  const { data, error } = await supabase
    .from('iadmin_unit_holders')
    .insert({
      unit_id: parsed.unitId,
      full_name: parsed.fullName,
      holder_kind: parsed.holderKind,
      tax_id: parsed.taxId ?? null,
      email: parsed.email ?? null,
      phone: parsed.phone ?? null,
      start_date: parsed.startDate ?? null,
      is_active: true,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  await supabase.from('iadmin_audit_logs').insert({
    administration_id: administrationId,
    actor_profile_id: profile.id,
    entity_type: 'iadmin_unit_holders',
    entity_id: data.id,
    action: 'holder.created',
    metadata: { full_name: parsed.fullName, holder_kind: parsed.holderKind },
  })

  revalidatePath(`/iadmin/consorcios/${unit.managed_property_id}`)
  return { id: data.id as string }
}

const endHolderSchema = z.object({
  holderId: z.string().uuid(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function endUnitHolder(input: z.input<typeof endHolderSchema>) {
  const parsed = endHolderSchema.parse(input)
  const supabase = await getSupabaseServerClient()
  if (!supabase) throw new Error('Supabase no configurado')

  const { data: holder } = await supabase
    .from('iadmin_unit_holders')
    .select('id, unit_id, iadmin_units!inner(managed_property_id, iadmin_managed_properties!inner(administration_id))')
    .eq('id', parsed.holderId)
    .maybeSingle()
  if (!holder) throw new Error('Titular no encontrado')

  const unitRel = Array.isArray(holder.iadmin_units) ? holder.iadmin_units[0] : holder.iadmin_units
  const propRel = unitRel?.iadmin_managed_properties
    ? Array.isArray(unitRel.iadmin_managed_properties)
      ? unitRel.iadmin_managed_properties[0]
      : unitRel.iadmin_managed_properties
    : null
  const administrationId = propRel?.administration_id as string
  const propertyId = unitRel?.managed_property_id as string

  const { profile } = await requireIAdmin({ capability: 'holders.manage', administrationId })

  const { error } = await supabase
    .from('iadmin_unit_holders')
    .update({
      is_active: false,
      end_date: parsed.endDate ?? new Date().toISOString().slice(0, 10),
    })
    .eq('id', parsed.holderId)

  if (error) throw new Error(error.message)

  await supabase.from('iadmin_audit_logs').insert({
    administration_id: administrationId,
    actor_profile_id: profile.id,
    entity_type: 'iadmin_unit_holders',
    entity_id: parsed.holderId,
    action: 'holder.closed',
  })

  revalidatePath(`/iadmin/consorcios/${propertyId}`)
}

// ----------------------------------------------------------------------------
// Periodos contables
// ----------------------------------------------------------------------------

const openPeriodSchema = z.object({
  propertyId: z.string().uuid(),
  periodYear: z.number().int().min(2020).max(2100),
  periodMonth: z.number().int().min(1).max(12),
})

export async function openAccountingPeriod(input: z.input<typeof openPeriodSchema>) {
  const parsed = openPeriodSchema.parse(input)
  const { supabase, administrationId } = await getPropertyAdminId(parsed.propertyId)
  const { profile } = await requireIAdmin({
    capability: 'liquidations.create',
    administrationId,
  })

  const { data, error } = await supabase
    .from('iadmin_accounting_periods')
    .upsert(
      {
        managed_property_id: parsed.propertyId,
        period_year: parsed.periodYear,
        period_month: parsed.periodMonth,
        status: 'open',
      },
      { onConflict: 'managed_property_id,period_year,period_month' },
    )
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  await supabase.from('iadmin_audit_logs').insert({
    administration_id: administrationId,
    actor_profile_id: profile.id,
    entity_type: 'iadmin_accounting_periods',
    entity_id: data.id,
    action: 'period.opened',
    metadata: { period_year: parsed.periodYear, period_month: parsed.periodMonth },
  })

  revalidatePath(`/iadmin/consorcios/${parsed.propertyId}`)
  return { id: data.id as string }
}

const changePeriodStatusSchema = z.object({
  periodId: z.string().uuid(),
  nextStatus: z.enum(['open', 'locked', 'closed']),
})

export async function changePeriodStatus(input: z.input<typeof changePeriodStatusSchema>) {
  const parsed = changePeriodStatusSchema.parse(input)
  const supabase = await getSupabaseServerClient()
  if (!supabase) throw new Error('Supabase no configurado')

  const { data: period } = await supabase
    .from('iadmin_accounting_periods')
    .select('id, managed_property_id, iadmin_managed_properties!inner(administration_id)')
    .eq('id', parsed.periodId)
    .maybeSingle()
  if (!period) throw new Error('Periodo no encontrado')

  const propRel = Array.isArray(period.iadmin_managed_properties)
    ? period.iadmin_managed_properties[0]
    : period.iadmin_managed_properties
  const administrationId = propRel?.administration_id as string

  const { profile } = await requireIAdmin({
    capability: parsed.nextStatus === 'closed' ? 'liquidations.close' : 'liquidations.create',
    administrationId,
  })

  const patch: Record<string, unknown> = { status: parsed.nextStatus }
  if (parsed.nextStatus === 'closed') {
    patch.closed_at = new Date().toISOString()
    patch.closed_by = profile.id
  } else {
    patch.closed_at = null
    patch.closed_by = null
  }

  const { error } = await supabase.from('iadmin_accounting_periods').update(patch).eq('id', parsed.periodId)
  if (error) throw new Error(error.message)

  await supabase.from('iadmin_audit_logs').insert({
    administration_id: administrationId,
    actor_profile_id: profile.id,
    entity_type: 'iadmin_accounting_periods',
    entity_id: parsed.periodId,
    action: `period.${parsed.nextStatus}`,
  })

  revalidatePath(`/iadmin/consorcios/${period.managed_property_id}`)
}
