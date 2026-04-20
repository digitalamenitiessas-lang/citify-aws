'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { findMembership, requireIAdmin } from '@/lib/auth'
import { canTransition } from '@/lib/iadmin/expense-status'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import type { IAdminCapability, IAdminExpenseStatus } from '@/lib/types'

const createExpenseSchema = z.object({
  administrationId: z.string().uuid(),
  managedPropertyId: z.string().uuid(),
  accountingPeriodId: z.string().uuid().nullable().optional(),
  providerId: z.string().uuid().nullable().optional(),
  category: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().min(1).max(240),
  amount: z.number().nonnegative(),
  currency: z.string().trim().min(1).max(8).default('ARS'),
  issuedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  expenseKind: z.enum(['ordinaria', 'extraordinaria']).optional().default('ordinaria'),
})

export type CreateExpenseInput = z.input<typeof createExpenseSchema>

export async function createExpense(input: CreateExpenseInput) {
  const parsed = createExpenseSchema.parse(input)
  const { profile } = await requireIAdmin({
    capability: 'expenses.create',
    administrationId: parsed.administrationId,
  })

  const supabase = await getSupabaseServerClient()
  if (!supabase) throw new Error('Supabase no configurado')

  // Verificamos que la property pertenece a la administracion que declaramos.
  const { data: propertyRow } = await supabase
    .from('iadmin_managed_properties')
    .select('id, administration_id')
    .eq('id', parsed.managedPropertyId)
    .maybeSingle()

  if (!propertyRow || propertyRow.administration_id !== parsed.administrationId) {
    throw new Error('Consorcio fuera de la administracion')
  }

  const { data, error } = await supabase
    .from('iadmin_expenses')
    .insert({
      administration_id: parsed.administrationId,
      managed_property_id: parsed.managedPropertyId,
      accounting_period_id: parsed.accountingPeriodId ?? null,
      provider_id: parsed.providerId ?? null,
      category: parsed.category ?? null,
      description: parsed.description,
      amount: parsed.amount,
      currency: parsed.currency,
      issued_at: parsed.issuedAt ?? null,
      due_at: parsed.dueAt ?? null,
      status: 'draft' as IAdminExpenseStatus,
      expense_kind: parsed.expenseKind ?? 'ordinaria',
      created_by: profile.id,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  await supabase.from('iadmin_audit_logs').insert({
    administration_id: parsed.administrationId,
    actor_profile_id: profile.id,
    entity_type: 'iadmin_expenses',
    entity_id: data.id,
    action: 'expense.created',
    metadata: { amount: parsed.amount, currency: parsed.currency },
  })

  revalidatePath('/iadmin/gastos')
  revalidatePath('/iadmin/cartera')
  return { id: data.id as string }
}

const changeStatusSchema = z.object({
  expenseId: z.string().uuid(),
  nextStatus: z.enum(['draft', 'pending_review', 'needs_doc', 'approved', 'rejected', 'imputed']),
  note: z.string().trim().max(500).optional(),
})

export async function changeExpenseStatus(input: z.input<typeof changeStatusSchema>) {
  const parsed = changeStatusSchema.parse(input)
  const { profile, context } = await requireIAdmin({ capability: 'expenses.view' })

  const supabase = await getSupabaseServerClient()
  if (!supabase) throw new Error('Supabase no configurado')

  const { data: expense } = await supabase
    .from('iadmin_expenses')
    .select('id, status, administration_id')
    .eq('id', parsed.expenseId)
    .maybeSingle()

  if (!expense) throw new Error('Gasto no encontrado')

  if (!context.isSuperAdmin) {
    const membership = findMembership(context, expense.administration_id)
    const capabilities: ReadonlySet<IAdminCapability> = new Set(membership?.capabilities ?? [])
    if (!canTransition(expense.status, parsed.nextStatus, capabilities)) {
      throw new Error('Transicion no permitida para tu rol')
    }
  }

  const patch: Record<string, unknown> = { status: parsed.nextStatus }
  if (parsed.nextStatus === 'approved') {
    patch.approved_by = profile.id
    patch.approved_at = new Date().toISOString()
  }
  if (parsed.nextStatus === 'rejected' && parsed.note) {
    patch.rejected_reason = parsed.note
  }

  const { error } = await supabase.from('iadmin_expenses').update(patch).eq('id', parsed.expenseId)
  if (error) throw new Error(error.message)

  await supabase.from('iadmin_audit_logs').insert({
    administration_id: expense.administration_id,
    actor_profile_id: profile.id,
    entity_type: 'iadmin_expenses',
    entity_id: parsed.expenseId,
    action: `expense.${parsed.nextStatus}`,
    metadata: parsed.note ? { note: parsed.note } : null,
  })

  revalidatePath('/iadmin/gastos')
  revalidatePath(`/iadmin/gastos/${parsed.expenseId}`)
}

const attachDocumentSchema = z.object({
  expenseId: z.string().uuid(),
  storagePath: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().nullable().optional(),
  sizeBytes: z.number().int().nonnegative().nullable().optional(),
})

// Registra el documento ya subido al bucket y crea la fila vacia de extraccion
// (status=pending). Aqui no llamamos a un proveedor de IA: dejamos el hook listo
// para que la fase 2 lo reemplace por una integracion real.
export async function attachExpenseDocument(input: z.input<typeof attachDocumentSchema>) {
  const parsed = attachDocumentSchema.parse(input)
  const { profile } = await requireIAdmin({ capability: 'documents.upload' })

  const supabase = await getSupabaseServerClient()
  if (!supabase) throw new Error('Supabase no configurado')

  const { data: expense } = await supabase
    .from('iadmin_expenses')
    .select('id, administration_id, status')
    .eq('id', parsed.expenseId)
    .maybeSingle()

  if (!expense) throw new Error('Gasto no encontrado')

  const { data: doc, error } = await supabase
    .from('iadmin_expense_documents')
    .insert({
      expense_id: parsed.expenseId,
      storage_path: parsed.storagePath,
      file_name: parsed.fileName,
      mime_type: parsed.mimeType ?? null,
      size_bytes: parsed.sizeBytes ?? null,
      uploaded_by: profile.id,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  await supabase.from('iadmin_ai_document_extractions').insert({
    document_id: doc.id,
    status: 'pending',
    provider: 'manual',
    suggested_fields: {},
  })

  // si estaba needs_doc, vuelve a pending_review
  if (expense.status === 'needs_doc') {
    await supabase.from('iadmin_expenses').update({ status: 'pending_review' }).eq('id', parsed.expenseId)
  }

  await supabase.from('iadmin_audit_logs').insert({
    administration_id: expense.administration_id,
    actor_profile_id: profile.id,
    entity_type: 'iadmin_expense_documents',
    entity_id: doc.id,
    action: 'document.attached',
    metadata: { file_name: parsed.fileName },
  })

  revalidatePath(`/iadmin/gastos/${parsed.expenseId}`)
  return { id: doc.id as string }
}

const validateExtractionSchema = z.object({
  extractionId: z.string().uuid(),
  decision: z.enum(['validated', 'rejected']),
  notes: z.string().trim().max(500).optional(),
})

export async function validateAIExtraction(input: z.input<typeof validateExtractionSchema>) {
  const parsed = validateExtractionSchema.parse(input)
  const { profile } = await requireIAdmin({ capability: 'documents.validate' })

  const supabase = await getSupabaseServerClient()
  if (!supabase) throw new Error('Supabase no configurado')

  const { data: extraction } = await supabase
    .from('iadmin_ai_document_extractions')
    .select('id, document_id, iadmin_expense_documents ( expense_id, iadmin_expenses ( administration_id ) )')
    .eq('id', parsed.extractionId)
    .maybeSingle()

  if (!extraction) throw new Error('Extraccion no encontrada')

  const { error } = await supabase
    .from('iadmin_ai_document_extractions')
    .update({
      status: parsed.decision,
      validated_by: profile.id,
      validated_at: new Date().toISOString(),
      validation_notes: parsed.notes ?? null,
    })
    .eq('id', parsed.extractionId)

  if (error) throw new Error(error.message)

  const docRow = Array.isArray(extraction.iadmin_expense_documents)
    ? extraction.iadmin_expense_documents[0]
    : extraction.iadmin_expense_documents
  const expenseRow = docRow?.iadmin_expenses
    ? Array.isArray(docRow.iadmin_expenses)
      ? docRow.iadmin_expenses[0]
      : docRow.iadmin_expenses
    : null

  if (expenseRow?.administration_id) {
    await supabase.from('iadmin_audit_logs').insert({
      administration_id: expenseRow.administration_id,
      actor_profile_id: profile.id,
      entity_type: 'iadmin_ai_document_extractions',
      entity_id: parsed.extractionId,
      action: `extraction.${parsed.decision}`,
      metadata: parsed.notes ? { notes: parsed.notes } : null,
    })
  }

  if (docRow?.expense_id) {
    revalidatePath(`/iadmin/gastos/${docRow.expense_id}`)
  }
}
