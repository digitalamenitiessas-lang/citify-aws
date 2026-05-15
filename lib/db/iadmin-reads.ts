import { pgQuery } from '@/lib/db/postgres'

// ----------------------------------------------------------------------------
// Cash accounts + balance (suma de movimientos)
// ----------------------------------------------------------------------------

export type CashAccountWithBalanceRow = {
  id: string
  managed_property_id: string
  name: string
  kind: string
  bank_name: string | null
  account_number: string | null
  cbu: string | null
  alias: string | null
  opening_balance: string | null
  opening_balance_at: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  current_balance: string
  movements_count: number
}

export async function listCashAccountsWithBalanceFromPostgres(
  propertyId: string,
): Promise<CashAccountWithBalanceRow[]> {
  const result = await pgQuery<CashAccountWithBalanceRow>(
    `
      with sums as (
        select cash_account_id, coalesce(sum(amount), 0)::text as total, count(*)::int as moves_count
        from public.iadmin_bank_movements
        where managed_property_id = $1
        group by cash_account_id
      )
      select
        a.id,
        a.managed_property_id,
        a.name,
        a.kind::text as kind,
        a.bank_name,
        a.account_number,
        a.cbu,
        a.alias,
        a.opening_balance::text as opening_balance,
        a.opening_balance_at::text as opening_balance_at,
        a.notes,
        a.is_active,
        a.created_at::text as created_at,
        coalesce(s.total, '0') as current_balance,
        coalesce(s.moves_count, 0) as movements_count
      from public.iadmin_cash_accounts a
      left join sums s on s.cash_account_id = a.id
      where a.managed_property_id = $1
      order by a.is_active desc, a.created_at asc
    `,
    [propertyId],
  )
  return result.rows
}

// ----------------------------------------------------------------------------
// Cash movements (con account name + expense description)
// ----------------------------------------------------------------------------

export type CashMovementRow = {
  id: string
  cash_account_id: string | null
  cash_account_name: string | null
  administration_id: string
  managed_property_id: string | null
  movement_date: string
  description: string | null
  amount: string
  balance: string | null
  external_ref: string | null
  movement_kind: string | null
  expense_id: string | null
  expense_description: string | null
  created_at: string
}

export async function listCashMovementsFromPostgres(input: {
  managedPropertyId: string
  accountId?: string | null
  limit: number
}): Promise<CashMovementRow[]> {
  const result = await pgQuery<CashMovementRow>(
    `
      select
        m.id,
        m.cash_account_id,
        ca.name as cash_account_name,
        m.administration_id,
        m.managed_property_id,
        m.movement_date::text as movement_date,
        m.description,
        m.amount::text as amount,
        null::text as balance,
        m.external_ref,
        m.movement_kind::text as movement_kind,
        m.expense_id,
        e.description as expense_description,
        m.created_at::text as created_at
      from public.iadmin_bank_movements m
      left join public.iadmin_cash_accounts ca on ca.id = m.cash_account_id
      left join public.iadmin_expenses e on e.id = m.expense_id
      where m.managed_property_id = $1
        and ($2::uuid is null or m.cash_account_id = $2)
      order by m.movement_date desc, m.created_at desc
      limit $3
    `,
    [input.managedPropertyId, input.accountId ?? null, input.limit],
  )
  return result.rows
}

// ----------------------------------------------------------------------------
// Reminders con todo el contexto (property, unit, holder, share token)
// ----------------------------------------------------------------------------

export type ReminderRowWithContext = {
  id: string
  administration_id: string
  managed_property_id: string | null
  property_display_name: string | null
  building_name: string | null
  liquidation_item_id: string
  unit_code: string | null
  holder_full_name: string | null
  holder_phone: string | null
  holder_email: string | null
  reminder_kind: string
  status: string
  message_body: string | null
  amount_due: string | null
  due_label: string | null
  due_date: string | null
  generated_at: string
  sent_at: string | null
  dismissed_at: string | null
  share_token: string | null
}

export async function listRemindersWithContextFromPostgres(input: {
  administrationId: string
  status?: string | null
  limit: number
}): Promise<ReminderRowWithContext[]> {
  const result = await pgQuery<ReminderRowWithContext>(
    `
      with chosen_holder as (
        select distinct on (unit_id) unit_id, full_name, phone, email, is_active
        from public.iadmin_unit_holders
        order by unit_id, is_active desc, created_at asc
      ),
      live_token as (
        select distinct on (liquidation_item_id) liquidation_item_id, token
        from public.iadmin_item_share_tokens
        where revoked_at is null
        order by liquidation_item_id, created_at desc
      )
      select
        r.id,
        r.administration_id,
        r.managed_property_id,
        mp.display_name as property_display_name,
        b.name as building_name,
        r.liquidation_item_id,
        u.code as unit_code,
        ch.full_name as holder_full_name,
        ch.phone as holder_phone,
        ch.email as holder_email,
        r.reminder_kind::text as reminder_kind,
        r.status::text as status,
        r.message_body,
        r.amount_due::text as amount_due,
        r.due_label,
        r.due_date::text as due_date,
        r.generated_at::text as generated_at,
        r.sent_at::text as sent_at,
        r.dismissed_at::text as dismissed_at,
        lt.token as share_token
      from public.iadmin_reminders r
      left join public.iadmin_managed_properties mp on mp.id = r.managed_property_id
      left join public.buildings b on b.id = mp.building_id
      left join public.iadmin_liquidation_items i on i.id = r.liquidation_item_id
      left join public.iadmin_units u on u.id = i.unit_id
      left join chosen_holder ch on ch.unit_id = u.id
      left join live_token lt on lt.liquidation_item_id = i.id
      where r.administration_id = $1
        and ($2::text is null or r.status::text = $2)
      order by r.generated_at desc
      limit $3
    `,
    [input.administrationId, input.status ?? null, input.limit],
  )
  return result.rows
}

// ----------------------------------------------------------------------------
// Expense detail con docs + extractions + payment + property name
// ----------------------------------------------------------------------------

export type ExpenseDetailRow = {
  id: string
  administration_id: string
  managed_property_id: string
  provider_name: string | null
  category: string | null
  description: string
  amount: string
  currency: string | null
  issued_at: string | null
  due_at: string | null
  status: string
  expense_kind: string | null
  created_at: string
  property_display_name: string | null
  building_name: string | null
}

export async function getExpenseDetailRowFromPostgres(
  expenseId: string,
): Promise<ExpenseDetailRow | null> {
  const result = await pgQuery<ExpenseDetailRow>(
    `
      select
        e.id,
        e.administration_id,
        e.managed_property_id,
        p.name as provider_name,
        e.category,
        e.description,
        e.amount::text as amount,
        e.currency,
        e.issued_at::text as issued_at,
        e.due_at::text as due_at,
        e.status::text as status,
        e.expense_kind::text as expense_kind,
        e.created_at::text as created_at,
        mp.display_name as property_display_name,
        b.name as building_name
      from public.iadmin_expenses e
      left join public.iadmin_providers p on p.id = e.provider_id
      left join public.iadmin_managed_properties mp on mp.id = e.managed_property_id
      left join public.buildings b on b.id = mp.building_id
      where e.id = $1
      limit 1
    `,
    [expenseId],
  )
  return result.rows[0] ?? null
}

export type ExpenseDocumentRowWithExtraction = {
  id: string
  storage_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  uploaded_at: string
  extraction_id: string | null
  extraction_status: string | null
  extraction_provider: string | null
  extraction_suggested_fields: any
  extraction_confidence: number | null
  extraction_validated_by: string | null
  extraction_validated_at: string | null
  extraction_validation_notes: string | null
}

export async function listExpenseDocumentsWithExtractionFromPostgres(
  expenseId: string,
): Promise<ExpenseDocumentRowWithExtraction[]> {
  const result = await pgQuery<ExpenseDocumentRowWithExtraction>(
    `
      with picked_extraction as (
        select distinct on (document_id)
          document_id, id, status, provider, suggested_fields, confidence,
          validated_by, validated_at, validation_notes
        from public.iadmin_ai_document_extractions
        order by document_id, created_at desc
      )
      select
        d.id,
        d.storage_path,
        d.file_name,
        d.mime_type,
        d.size_bytes,
        d.uploaded_at::text as uploaded_at,
        x.id as extraction_id,
        x.status::text as extraction_status,
        x.provider as extraction_provider,
        x.suggested_fields as extraction_suggested_fields,
        x.confidence as extraction_confidence,
        x.validated_by as extraction_validated_by,
        x.validated_at::text as extraction_validated_at,
        x.validation_notes as extraction_validation_notes
      from public.iadmin_expense_documents d
      left join picked_extraction x on x.document_id = d.id
      where d.expense_id = $1
      order by d.uploaded_at desc
    `,
    [expenseId],
  )
  return result.rows
}

export type ExpensePaymentRow = {
  movement_date: string | null
  cash_account_name: string | null
}

export async function getExpensePaymentInfoFromPostgres(
  expenseId: string,
): Promise<ExpensePaymentRow | null> {
  const result = await pgQuery<ExpensePaymentRow>(
    `
      select m.movement_date::text as movement_date, ca.name as cash_account_name
      from public.iadmin_bank_movements m
      left join public.iadmin_cash_accounts ca on ca.id = m.cash_account_id
      where m.expense_id = $1 and m.movement_kind = 'expense_payment'
      limit 1
    `,
    [expenseId],
  )
  return result.rows[0] ?? null
}
