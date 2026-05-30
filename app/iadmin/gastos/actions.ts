'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { findMembership, requireIAdmin } from '@/lib/auth'
import {
  buildExpenseDocumentObjectKey,
  createPrivateS3DownloadUrl,
  deleteObjectFromS3,
  uploadBufferToS3,
} from '@/lib/aws/s3'
import { canTransition } from '@/lib/iadmin/expense-status'
import { insertIAdminAuditLogInPostgres } from '@/lib/db/iadmin-core'
import { pgQuery } from '@/lib/db/postgres'
import {
  assertProrataNotOver100,
  changeExpenseStatusInPostgres,
  ensureAccountingPeriodInPostgres,
  findProviderByNameInPostgres,
  getAccountingPeriodIdAndStatusFromPostgres,
  getAIExtractionWithAdminFromPostgres,
  getExpenseDocumentWithAdminFromPostgres,
  getExpenseStatusInfoFromPostgres,
  getManagedPropertyAdminIdFromPostgres,
  insertAIExtractionInPostgres,
  insertExpenseDocumentInPostgres,
  insertExpenseInPostgres,
  insertProviderQuickFromPostgres,
  setProviderDefaultCategoryIfNullInPostgres,
  updateAIExtractionDecisionInPostgres,
} from '@/lib/db/iadmin-writes'
import type { IAdminCapability, IAdminExpenseStatus } from '@/lib/types'

const createExpenseSchema = z.object({
  administrationId: z.string().uuid(),
  managedPropertyId: z.string().uuid(),
  accountingPeriodId: z.string().uuid().nullable().optional(),
  // El periodo (mes/año) al que se imputa el gasto. Si no se manda, el server
  // usa el mes actual. La fecha de emision (issuedAt) es independiente — un
  // gasto se puede imputar a junio aunque la factura sea de mayo, por ejemplo.
  periodYear: z.number().int().min(2020).max(2100).optional(),
  periodMonth: z.number().int().min(1).max(12).optional(),
  providerId: z.string().uuid().nullable().optional(),
  providerName: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().min(1).max(240),
  amount: z.number().nonnegative(),
  currency: z.string().trim().min(1).max(8).default('ARS'),
  issuedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  expenseKind: z.enum(['ordinaria', 'extraordinaria']).optional().default('ordinaria'),
  autoImpute: z.boolean().optional().default(true),
  draftDocument: z.object({
    fileBase64: z.string().min(100),
    fileName: z.string().min(1),
    mimeType: z.string().min(1),
    sizeBytes: z.number().int().nonnegative().optional(),
    aiSuggestedFields: z.record(z.unknown()).optional(),
    aiConfidence: z.number().min(0).max(100).optional(),
    aiProvider: z.string().optional(),
  }).optional(),
})

export type CreateExpenseInput = z.input<typeof createExpenseSchema>

export type CreateExpenseResult =
  | { ok: true; id: string; status: IAdminExpenseStatus }
  | { ok: false; error: string; code?: string }

/**
 * Wrapper público de la action. Envuelve `createExpenseImpl` para devolver los
 * errores de negocio como objeto. Si tirábamos throw, Next.js en producción los
 * reemplaza por "An error occurred in the Server Components render. ..." y el
 * usuario nunca ve el mensaje real (período cerrado, alícuota > 100%, etc.).
 */
export async function createExpense(input: CreateExpenseInput): Promise<CreateExpenseResult> {
  try {
    const result = await createExpenseImpl(input)
    return { ok: true, ...result }
  } catch (error) {
    if (error instanceof Error) {
      const code = (error as Error & { code?: string }).code
      // Log server-side para no perder el stack; el cliente ve solo el mensaje.
      console.error('[createExpense] business error:', error.message, code ? `(code=${code})` : '')
      return { ok: false, error: error.message, code }
    }
    console.error('[createExpense] unknown error:', error)
    return { ok: false, error: 'Error inesperado al cargar el gasto' }
  }
}

async function createExpenseImpl(input: CreateExpenseInput): Promise<{ id: string; status: IAdminExpenseStatus }> {
  const parsed = createExpenseSchema.parse(input)
  const { profile, context } = await requireIAdmin({
    capability: 'expenses.create',
    administrationId: parsed.administrationId,
  })

  const property = await getManagedPropertyAdminIdFromPostgres(parsed.managedPropertyId)
  if (!property || property.administration_id !== parsed.administrationId) {
    throw new Error('Consorcio fuera de la administracion')
  }

  await assertProrataNotOver100(parsed.managedPropertyId)

  let providerId = parsed.providerId ?? null
  if (!providerId && parsed.providerName && parsed.providerName.trim().length > 0) {
    const existing = await findProviderByNameInPostgres({
      administrationId: parsed.administrationId,
      name: parsed.providerName.trim(),
    })
    if (existing) {
      providerId = existing.id
    } else {
      const created = await insertProviderQuickFromPostgres({
        administrationId: parsed.administrationId,
        name: parsed.providerName.trim(),
        category: parsed.category ?? null,
      })
      providerId = created.id
    }
  } else if (providerId && parsed.category) {
    await setProviderDefaultCategoryIfNullInPostgres({ providerId, category: parsed.category })
  }

  // Resolución del período: prioridad por accountingPeriodId, luego year/month
  // explícitos, finalmente el mes actual como default.
  let accountingPeriodId = parsed.accountingPeriodId ?? null
  let periodLabel = ''
  if (!accountingPeriodId) {
    const now = new Date()
    const year = parsed.periodYear ?? now.getFullYear()
    const month = parsed.periodMonth ?? now.getMonth() + 1
    periodLabel = `${String(month).padStart(2, '0')}/${year}`

    const existing = await getAccountingPeriodIdAndStatusFromPostgres({
      managedPropertyId: parsed.managedPropertyId,
      periodYear: year,
      periodMonth: month,
    })
    if (existing) {
      if (existing.status === 'closed') {
        throw new Error(
          `El periodo ${periodLabel} esta cerrado. Reabrilo desde Liquidaciones si necesitas cargar gastos retroactivos.`,
        )
      }
      accountingPeriodId = existing.id
    } else {
      const created = await ensureAccountingPeriodInPostgres({
        managedPropertyId: parsed.managedPropertyId,
        periodYear: year,
        periodMonth: month,
      })
      accountingPeriodId = created.id
    }
  } else {
    // Validamos que el período no esté cerrado aunque venga referenciado por id.
    const periodInfo = await pgQuery<{
      status: string
      period_year: number
      period_month: number
      managed_property_id: string
    }>(
      `select status::text as status, period_year, period_month, managed_property_id
         from public.iadmin_accounting_periods
        where id = $1
        limit 1`,
      [accountingPeriodId],
    )
    const info = periodInfo.rows[0]
    if (!info) throw new Error('El periodo indicado no existe')
    if (info.managed_property_id !== parsed.managedPropertyId) {
      throw new Error('El periodo no pertenece a este consorcio')
    }
    periodLabel = `${String(info.period_month).padStart(2, '0')}/${info.period_year}`
    if (info.status === 'closed') {
      throw new Error(`El periodo ${periodLabel} esta cerrado y no admite mas gastos.`)
    }
  }

  // Si ya hay una liquidación emitida o cerrada para este período, no se
  // pueden cargar más gastos sin reabrirla — sino se rompe el cálculo.
  const liqRes = await pgQuery<{ status: string }>(
    `select status::text as status
       from public.iadmin_liquidation_runs
      where managed_property_id = $1
        and accounting_period_id = $2
        and status in ('issued', 'closed')
      limit 1`,
    [parsed.managedPropertyId, accountingPeriodId],
  )
  if (liqRes.rows[0]) {
    const runStatus = liqRes.rows[0].status
    // Sentinela para que la UI pueda detectar este error puntual y mostrar
    // un banner con link a Liquidaciones en lugar de un toast genérico.
    const error = new Error(
      `Periodo ${periodLabel} ya ${runStatus === 'issued' ? 'liquidado' : 'cerrado'}. ` +
        `Reabrí la liquidación si necesitás cargar más gastos en ese mes.`,
    )
    ;(error as Error & { code?: string }).code = 'PERIOD_ALREADY_LIQUIDATED'
    throw error
  }

  const canApprove =
    context.isSuperAdmin ||
    (context.memberships
      .find((m) => m.administration.id === parsed.administrationId)
      ?.capabilities.includes('expenses.approve') ?? false)
  const initialStatus: IAdminExpenseStatus = parsed.autoImpute && canApprove ? 'imputed' : 'pending_review'

  const created = await insertExpenseInPostgres({
    administrationId: parsed.administrationId,
    managedPropertyId: parsed.managedPropertyId,
    accountingPeriodId,
    providerId,
    category: parsed.category ?? null,
    description: parsed.description,
    amount: parsed.amount,
    currency: parsed.currency,
    issuedAt: parsed.issuedAt ?? null,
    dueAt: parsed.dueAt ?? null,
    status: initialStatus,
    expenseKind: parsed.expenseKind ?? 'ordinaria',
    createdBy: profile.id,
    approvedBy: initialStatus === 'imputed' ? profile.id : null,
  })

  if (parsed.draftDocument) {
    try {
      const storagePath = buildExpenseDocumentObjectKey(
        parsed.administrationId,
        created.id,
        parsed.draftDocument.fileName,
      )
      const base64 = parsed.draftDocument.fileBase64.replace(/^data:[^;]+;base64,/, '')
      const bin = Buffer.from(base64, 'base64')

      await uploadBufferToS3({
        objectKey: storagePath,
        body: bin,
        contentType: parsed.draftDocument.mimeType,
      })

      try {
        const docRow = await insertExpenseDocumentInPostgres({
          expenseId: created.id,
          storagePath,
          fileName: parsed.draftDocument.fileName,
          mimeType: parsed.draftDocument.mimeType,
          sizeBytes: parsed.draftDocument.sizeBytes ?? bin.length,
          uploadedBy: profile.id,
        })
        await insertAIExtractionInPostgres({
          documentId: docRow.id,
          status: 'validated',
          provider: parsed.draftDocument.aiProvider ?? 'openrouter',
          suggestedFields: parsed.draftDocument.aiSuggestedFields ?? {},
          confidence: parsed.draftDocument.aiConfidence ?? null,
          validatedBy: profile.id,
        })
      } catch {
        await deleteObjectFromS3(storagePath).catch(() => undefined)
      }
    } catch (docErr) {
      await insertIAdminAuditLogInPostgres({
        administrationId: parsed.administrationId,
        actorProfileId: profile.id,
        entityType: 'iadmin_expenses',
        entityId: created.id,
        action: 'expense.doc_upload_failed',
        metadata: { error: docErr instanceof Error ? docErr.message : String(docErr) },
      })
    }
  }

  await insertIAdminAuditLogInPostgres({
    administrationId: parsed.administrationId,
    actorProfileId: profile.id,
    entityType: 'iadmin_expenses',
    entityId: created.id,
    action: initialStatus === 'imputed' ? 'expense.created_and_imputed' : 'expense.created',
    metadata: {
      amount: parsed.amount,
      currency: parsed.currency,
      status: initialStatus,
      has_ai_doc: Boolean(parsed.draftDocument),
    },
  })

  revalidatePath('/iadmin/gastos')
  revalidatePath('/iadmin/cartera')
  revalidatePath(`/iadmin/consorcios/${parsed.managedPropertyId}`)
  return { id: created.id, status: initialStatus }
}

const changeStatusSchema = z.object({
  expenseId: z.string().uuid(),
  nextStatus: z.enum(['draft', 'pending_review', 'needs_doc', 'approved', 'rejected', 'imputed']),
  note: z.string().trim().max(500).optional(),
})

export async function changeExpenseStatus(input: z.input<typeof changeStatusSchema>) {
  const parsed = changeStatusSchema.parse(input)
  const { profile, context } = await requireIAdmin({ capability: 'expenses.view' })

  const expense = await getExpenseStatusInfoFromPostgres(parsed.expenseId)
  if (!expense) throw new Error('Gasto no encontrado')

  if (!context.isSuperAdmin) {
    const membership = findMembership(context, expense.administration_id)
    const capabilities: ReadonlySet<IAdminCapability> = new Set(membership?.capabilities ?? [])
    if (!canTransition(expense.status as any, parsed.nextStatus, capabilities)) {
      throw new Error('Transicion no permitida para tu rol')
    }
  }

  await changeExpenseStatusInPostgres({
    expenseId: parsed.expenseId,
    nextStatus: parsed.nextStatus,
    approvedBy: parsed.nextStatus === 'approved' ? profile.id : null,
    rejectedReason: parsed.nextStatus === 'rejected' ? parsed.note ?? null : null,
  })

  await insertIAdminAuditLogInPostgres({
    administrationId: expense.administration_id,
    actorProfileId: profile.id,
    entityType: 'iadmin_expenses',
    entityId: parsed.expenseId,
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

export async function attachExpenseDocument(input: z.input<typeof attachDocumentSchema>) {
  const parsed = attachDocumentSchema.parse(input)
  const { profile } = await requireIAdmin({ capability: 'documents.upload' })

  const expense = await getExpenseStatusInfoFromPostgres(parsed.expenseId)
  if (!expense) throw new Error('Gasto no encontrado')

  const doc = await insertExpenseDocumentInPostgres({
    expenseId: parsed.expenseId,
    storagePath: parsed.storagePath,
    fileName: parsed.fileName,
    mimeType: parsed.mimeType ?? null,
    sizeBytes: parsed.sizeBytes ?? null,
    uploadedBy: profile.id,
  })

  await insertAIExtractionInPostgres({
    documentId: doc.id,
    status: 'pending',
    provider: 'manual',
    suggestedFields: {},
    confidence: null,
  })

  if (expense.status === 'needs_doc') {
    await changeExpenseStatusInPostgres({
      expenseId: parsed.expenseId,
      nextStatus: 'pending_review',
      approvedBy: null,
      rejectedReason: null,
    })
  }

  await insertIAdminAuditLogInPostgres({
    administrationId: expense.administration_id,
    actorProfileId: profile.id,
    entityType: 'iadmin_expense_documents',
    entityId: doc.id,
    action: 'document.attached',
    metadata: { file_name: parsed.fileName },
  })

  revalidatePath(`/iadmin/gastos/${parsed.expenseId}`)
  return { id: doc.id }
}

const signedDocSchema = z.object({
  documentId: z.string().uuid(),
})

export async function getExpenseDocumentSignedUrl(
  input: z.input<typeof signedDocSchema>,
): Promise<{ url: string; fileName: string }> {
  const parsed = signedDocSchema.parse(input)
  const { profile, context } = await requireIAdmin({ capability: 'expenses.view' })

  const doc = await getExpenseDocumentWithAdminFromPostgres(parsed.documentId)
  if (!doc) throw new Error('Documento no encontrado')

  const canView =
    context.isSuperAdmin ||
    context.memberships.some(
      (membership) =>
        membership.administration.id === doc.administration_id &&
        membership.capabilities.includes('expenses.view'),
    )

  if (!canView && profile.role !== 'super_admin') {
    throw new Error('No autorizado para ver este comprobante')
  }

  return {
    url: await createPrivateS3DownloadUrl(doc.storage_path, doc.file_name ?? undefined),
    fileName: doc.file_name ?? 'documento',
  }
}

const validateExtractionSchema = z.object({
  extractionId: z.string().uuid(),
  decision: z.enum(['validated', 'rejected']),
  notes: z.string().trim().max(500).optional(),
})

export async function validateAIExtraction(input: z.input<typeof validateExtractionSchema>) {
  const parsed = validateExtractionSchema.parse(input)
  const { profile } = await requireIAdmin({ capability: 'documents.validate' })

  const extraction = await getAIExtractionWithAdminFromPostgres(parsed.extractionId)
  if (!extraction) throw new Error('Extraccion no encontrada')

  await updateAIExtractionDecisionInPostgres({
    extractionId: parsed.extractionId,
    decision: parsed.decision,
    validatedBy: profile.id,
    validationNotes: parsed.notes ?? null,
  })

  await insertIAdminAuditLogInPostgres({
    administrationId: extraction.administration_id,
    actorProfileId: profile.id,
    entityType: 'iadmin_ai_document_extractions',
    entityId: parsed.extractionId,
    action: `extraction.${parsed.decision}`,
    metadata: parsed.notes ? { notes: parsed.notes } : null,
  })

  revalidatePath(`/iadmin/gastos/${extraction.expense_id}`)
}
