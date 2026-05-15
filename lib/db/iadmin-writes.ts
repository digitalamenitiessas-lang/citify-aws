import { pgQuery } from '@/lib/db/postgres'

// ----------------------------------------------------------------------------
// Lookups compartidos
// ----------------------------------------------------------------------------

export async function getManagedPropertyAdminIdFromPostgres(
  propertyId: string,
): Promise<{ id: string; administration_id: string } | null> {
  const result = await pgQuery<{ id: string; administration_id: string }>(
    `select id, administration_id from public.iadmin_managed_properties where id = $1 limit 1`,
    [propertyId],
  )
  return result.rows[0] ?? null
}

export async function getManagedPropertyContextFromPostgres(propertyId: string): Promise<{
  display_name: string | null
  building_name: string
  building_address: string | null
} | null> {
  const result = await pgQuery<{
    display_name: string | null
    building_name: string
    building_address: string | null
  }>(
    `
      select
        mp.display_name,
        b.name as building_name,
        b.address as building_address
      from public.iadmin_managed_properties mp
      inner join public.buildings b on b.id = mp.building_id
      where mp.id = $1
      limit 1
    `,
    [propertyId],
  )
  return result.rows[0] ?? null
}

export async function getCashAccountFromPostgres(
  accountId: string,
): Promise<{ id: string; managed_property_id: string; name: string } | null> {
  const result = await pgQuery<{ id: string; managed_property_id: string; name: string }>(
    `select id, managed_property_id, name from public.iadmin_cash_accounts where id = $1 limit 1`,
    [accountId],
  )
  return result.rows[0] ?? null
}

// ----------------------------------------------------------------------------
// Liquidation items + share tokens
// ----------------------------------------------------------------------------

export async function getLiquidationItemRunFromPostgres(itemId: string): Promise<{
  id: string
  unit_id: string
  liquidation_run_id: string
  administration_id: string
  managed_property_id: string
  run_status: string
} | null> {
  const result = await pgQuery<{
    id: string
    unit_id: string
    liquidation_run_id: string
    administration_id: string
    managed_property_id: string
    run_status: string
  }>(
    `
      select
        i.id,
        i.unit_id,
        i.liquidation_run_id,
        r.administration_id,
        r.managed_property_id,
        r.status::text as run_status
      from public.iadmin_liquidation_items i
      inner join public.iadmin_liquidation_runs r on r.id = i.liquidation_run_id
      where i.id = $1
      limit 1
    `,
    [itemId],
  )
  return result.rows[0] ?? null
}

export async function revokeLiveShareTokensInPostgres(itemId: string): Promise<void> {
  await pgQuery(
    `update public.iadmin_item_share_tokens set revoked_at = now() where liquidation_item_id = $1 and revoked_at is null`,
    [itemId],
  )
}

export async function insertShareTokenInPostgres(input: {
  liquidationItemId: string
  token: string
  expiresAt: string
  createdBy: string
}): Promise<void> {
  await pgQuery(
    `
      insert into public.iadmin_item_share_tokens (liquidation_item_id, token, expires_at, created_by)
      values ($1, $2, $3::timestamptz, $4)
    `,
    [input.liquidationItemId, input.token, input.expiresAt, input.createdBy],
  )
}

// ----------------------------------------------------------------------------
// Accounting periods
// ----------------------------------------------------------------------------

export async function ensureAccountingPeriodInPostgres(input: {
  managedPropertyId: string
  periodYear: number
  periodMonth: number
}): Promise<{ id: string }> {
  const existing = await pgQuery<{ id: string }>(
    `select id from public.iadmin_accounting_periods where managed_property_id = $1 and period_year = $2 and period_month = $3 limit 1`,
    [input.managedPropertyId, input.periodYear, input.periodMonth],
  )
  if (existing.rows[0]) return existing.rows[0]

  const created = await pgQuery<{ id: string }>(
    `
      insert into public.iadmin_accounting_periods (managed_property_id, period_year, period_month, status)
      values ($1, $2, $3, 'open')
      returning id
    `,
    [input.managedPropertyId, input.periodYear, input.periodMonth],
  )
  return created.rows[0]
}

// ----------------------------------------------------------------------------
// Recurring providers + expenses
// ----------------------------------------------------------------------------

export async function listRecurringProvidersFromPostgres(administrationId: string): Promise<
  Array<{
    id: string
    name: string
    recurring_amount: string | null
    recurring_kind: string | null
    default_category: string | null
  }>
> {
  const result = await pgQuery<{
    id: string
    name: string
    recurring_amount: string | null
    recurring_kind: string | null
    default_category: string | null
  }>(
    `
      select id, name, recurring_amount::text as recurring_amount, recurring_kind::text as recurring_kind, default_category
      from public.iadmin_providers
      where administration_id = $1 and is_recurring = true and is_active = true
    `,
    [administrationId],
  )
  return result.rows
}

export async function listExpenseProviderIdsForPeriodInPostgres(input: {
  managedPropertyId: string
  periodId: string
  providerIds: string[]
}): Promise<string[]> {
  if (input.providerIds.length === 0) return []
  const result = await pgQuery<{ provider_id: string | null }>(
    `
      select provider_id
      from public.iadmin_expenses
      where managed_property_id = $1 and accounting_period_id = $2 and provider_id = any($3::uuid[])
    `,
    [input.managedPropertyId, input.periodId, input.providerIds],
  )
  return result.rows.map((r: { provider_id: string | null }) => r.provider_id).filter((x: string | null): x is string => Boolean(x))
}

export async function listRecentProviderExpensesInPostgres(input: {
  managedPropertyId: string
  providerIds: string[]
  fromDate: string
}): Promise<Array<{ provider_id: string | null; amount: string; issued_at: string | null }>> {
  if (input.providerIds.length === 0) return []
  const result = await pgQuery<{ provider_id: string | null; amount: string; issued_at: string | null }>(
    `
      select provider_id, amount::text as amount, issued_at::text as issued_at
      from public.iadmin_expenses
      where managed_property_id = $1
        and provider_id = any($2::uuid[])
        and issued_at >= $3::date
      order by issued_at desc
    `,
    [input.managedPropertyId, input.providerIds, input.fromDate],
  )
  return result.rows
}

export async function insertRecurringExpenseInPostgres(input: {
  administrationId: string
  managedPropertyId: string
  accountingPeriodId: string
  providerId: string
  category: string | null
  description: string
  amount: number
  issuedAt: string
  status: string
  expenseKind: string
  createdBy: string
  approvedBy: string | null
}): Promise<{ id: string }> {
  const result = await pgQuery<{ id: string }>(
    `
      insert into public.iadmin_expenses (
        administration_id, managed_property_id, accounting_period_id, provider_id,
        category, description, amount, currency, issued_at, status, expense_kind,
        created_by, approved_by, approved_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, 'ARS', $8::date,
        $9::iadmin_expense_status, $10::iadmin_expense_kind,
        $11, $12, case when $12::uuid is null then null else now() end
      )
      returning id
    `,
    [
      input.administrationId,
      input.managedPropertyId,
      input.accountingPeriodId,
      input.providerId,
      input.category,
      input.description,
      input.amount,
      input.issuedAt,
      input.status,
      input.expenseKind,
      input.createdBy,
      input.approvedBy,
    ],
  )
  return result.rows[0]
}

// ----------------------------------------------------------------------------
// Cash accounts
// ----------------------------------------------------------------------------

export async function insertCashAccountInPostgres(input: {
  managedPropertyId: string
  name: string
  kind: string
  bankName: string | null
  accountNumber: string | null
  cbu: string | null
  alias: string | null
  openingBalance: number
  openingBalanceAt: string | null
  notes: string | null
}): Promise<{ id: string }> {
  const result = await pgQuery<{ id: string }>(
    `
      insert into public.iadmin_cash_accounts (
        managed_property_id, name, kind, bank_name, account_number, cbu, alias,
        opening_balance, opening_balance_at, notes, is_active
      )
      values ($1, $2, $3::iadmin_cash_account_kind, $4, $5, $6, $7, $8, $9::date, $10, true)
      returning id
    `,
    [
      input.managedPropertyId,
      input.name,
      input.kind,
      input.bankName,
      input.accountNumber,
      input.cbu,
      input.alias,
      input.openingBalance,
      input.openingBalanceAt,
      input.notes,
    ],
  )
  return result.rows[0]
}

export async function updateCashAccountInPostgres(
  accountId: string,
  patch: Partial<{
    name: string
    kind: string
    bankName: string | null
    accountNumber: string | null
    cbu: string | null
    alias: string | null
    notes: string | null
    isActive: boolean
  }>,
): Promise<void> {
  const map: Record<string, { col: string; cast?: string }> = {
    name: { col: 'name' },
    kind: { col: 'kind', cast: 'iadmin_cash_account_kind' },
    bankName: { col: 'bank_name' },
    accountNumber: { col: 'account_number' },
    cbu: { col: 'cbu' },
    alias: { col: 'alias' },
    notes: { col: 'notes' },
    isActive: { col: 'is_active' },
  }
  const cols: string[] = []
  const values: unknown[] = []
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const meta = map[key]
    if (!meta) continue
    values.push(value)
    cols.push(meta.cast ? `${meta.col} = $${values.length}::${meta.cast}` : `${meta.col} = $${values.length}`)
  }
  if (cols.length === 0) return
  values.push(accountId)
  await pgQuery(
    `update public.iadmin_cash_accounts set ${cols.join(', ')} where id = $${values.length}`,
    values,
  )
}

export async function getCashAccountWithAdminFromPostgres(accountId: string): Promise<{
  id: string
  managed_property_id: string
  administration_id: string
} | null> {
  const result = await pgQuery<{
    id: string
    managed_property_id: string
    administration_id: string
  }>(
    `
      select ca.id, ca.managed_property_id, mp.administration_id
      from public.iadmin_cash_accounts ca
      inner join public.iadmin_managed_properties mp on mp.id = ca.managed_property_id
      where ca.id = $1
      limit 1
    `,
    [accountId],
  )
  return result.rows[0] ?? null
}

// ----------------------------------------------------------------------------
// Expenses (lookups + pagos)
// ----------------------------------------------------------------------------

export async function getExpenseForPaymentFromPostgres(expenseId: string): Promise<{
  id: string
  administration_id: string
  managed_property_id: string
  amount: string
  description: string
  status: string
} | null> {
  const result = await pgQuery<{
    id: string
    administration_id: string
    managed_property_id: string
    amount: string
    description: string
    status: string
  }>(
    `
      select id, administration_id, managed_property_id, amount::text as amount, description, status::text as status
      from public.iadmin_expenses
      where id = $1
      limit 1
    `,
    [expenseId],
  )
  return result.rows[0] ?? null
}

export async function existingExpensePaymentMovementInPostgres(expenseId: string): Promise<boolean> {
  const result = await pgQuery<{ id: string }>(
    `select id from public.iadmin_bank_movements where expense_id = $1 and movement_kind = 'expense_payment' limit 1`,
    [expenseId],
  )
  return result.rows.length > 0
}

// ----------------------------------------------------------------------------
// Reminders
// ----------------------------------------------------------------------------

export type ReminderItemRow = {
  run_id: string
  managed_property_id: string
  due_dates: any
  item_id: string
  ordinary_amount: string | null
  extraordinary_amount: string | null
  previous_balance: string | null
  unit_code: string | null
  holder_full_name: string | null
  holder_phone: string | null
}

export async function listReminderRunsWithItemsFromPostgres(input: {
  administrationId: string
  managedPropertyId?: string | null
}): Promise<ReminderItemRow[]> {
  const result = await pgQuery<ReminderItemRow>(
    `
      with chosen_holder as (
        select distinct on (h.unit_id)
          h.unit_id,
          h.full_name,
          h.phone,
          h.is_active
        from public.iadmin_unit_holders h
        order by h.unit_id, h.is_active desc, h.created_at asc
      )
      select
        r.id as run_id,
        r.managed_property_id,
        r.due_dates,
        i.id as item_id,
        i.ordinary_amount::text as ordinary_amount,
        i.extraordinary_amount::text as extraordinary_amount,
        i.previous_balance::text as previous_balance,
        u.code as unit_code,
        ch.full_name as holder_full_name,
        ch.phone as holder_phone
      from public.iadmin_liquidation_runs r
      inner join public.iadmin_liquidation_items i on i.liquidation_run_id = r.id
      left join public.iadmin_units u on u.id = i.unit_id
      left join chosen_holder ch on ch.unit_id = u.id
      where r.administration_id = $1
        and r.status in ('issued', 'closed')
        and ($2::uuid is null or r.managed_property_id = $2)
    `,
    [input.administrationId, input.managedPropertyId ?? null],
  )
  return result.rows
}

export async function sumLivePaymentsByItemsFromPostgres(
  runIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (runIds.length === 0) return out
  const result = await pgQuery<{ liquidation_item_id: string; amount: string }>(
    `
      select liquidation_item_id, amount::text as amount
      from public.iadmin_payments
      where liquidation_run_id = any($1::uuid[])
        and is_void = false
        and liquidation_item_id is not null
    `,
    [runIds],
  )
  for (const row of result.rows) {
    out.set(row.liquidation_item_id, (out.get(row.liquidation_item_id) ?? 0) + Number(row.amount))
  }
  return out
}

export async function listExistingRemindersTodayFromPostgres(input: {
  liquidationItemIds: string[]
  todayDate: string
}): Promise<Set<string>> {
  if (input.liquidationItemIds.length === 0) return new Set()
  const result = await pgQuery<{ liquidation_item_id: string; reminder_kind: string }>(
    `
      select liquidation_item_id, reminder_kind::text as reminder_kind
      from public.iadmin_reminders
      where liquidation_item_id = any($1::uuid[])
        and generated_at >= $2::timestamptz
    `,
    [input.liquidationItemIds, `${input.todayDate}T00:00:00Z`],
  )
  return new Set(result.rows.map((r: { liquidation_item_id: string; reminder_kind: string }) => `${r.liquidation_item_id}::${r.reminder_kind}`))
}

export async function insertReminderInPostgres(input: {
  administrationId: string
  managedPropertyId: string
  liquidationItemId: string
  reminderKind: string
  amountDue: number
  dueLabel: string
  dueDate: string
  messageBody: string
}): Promise<void> {
  await pgQuery(
    `
      insert into public.iadmin_reminders (
        administration_id, managed_property_id, liquidation_item_id, reminder_kind,
        status, amount_due, due_label, due_date, message_body
      )
      values ($1, $2, $3, $4::iadmin_reminder_kind, 'pending', $5, $6, $7::date, $8)
    `,
    [
      input.administrationId,
      input.managedPropertyId,
      input.liquidationItemId,
      input.reminderKind,
      input.amountDue,
      input.dueLabel,
      input.dueDate,
      input.messageBody,
    ],
  )
}

export async function getReminderAdminFromPostgres(
  reminderId: string,
): Promise<{ id: string; administration_id: string } | null> {
  const result = await pgQuery<{ id: string; administration_id: string }>(
    `select id, administration_id from public.iadmin_reminders where id = $1 limit 1`,
    [reminderId],
  )
  return result.rows[0] ?? null
}

export async function setReminderStatusInPostgres(input: {
  reminderId: string
  status: 'sent' | 'dismissed'
  actorProfileId: string
  notes?: string | null
}): Promise<void> {
  if (input.status === 'sent') {
    await pgQuery(
      `update public.iadmin_reminders set status = 'sent'::iadmin_reminder_status, sent_at = now(), sent_by = $1 where id = $2`,
      [input.actorProfileId, input.reminderId],
    )
  } else {
    await pgQuery(
      `
        update public.iadmin_reminders
        set status = 'dismissed'::iadmin_reminder_status,
            dismissed_at = now(),
            dismissed_by = $1,
            notes = coalesce($2, notes)
        where id = $3
      `,
      [input.actorProfileId, input.notes ?? null, input.reminderId],
    )
  }
}

export async function bulkUpdatePendingRemindersInPostgres(input: {
  administrationId: string
  reminderIds: string[]
  status: 'sent' | 'dismissed'
  actorProfileId: string
}): Promise<number> {
  if (input.reminderIds.length === 0) return 0
  if (input.status === 'sent') {
    const result = await pgQuery<{ id: string }>(
      `
        update public.iadmin_reminders
        set status = 'sent'::iadmin_reminder_status, sent_at = now(), sent_by = $1
        where administration_id = $2
          and id = any($3::uuid[])
          and status = 'pending'
        returning id
      `,
      [input.actorProfileId, input.administrationId, input.reminderIds],
    )
    return result.rows.length
  }
  const result = await pgQuery<{ id: string }>(
    `
      update public.iadmin_reminders
      set status = 'dismissed'::iadmin_reminder_status, dismissed_at = now(), dismissed_by = $1
      where administration_id = $2
        and id = any($3::uuid[])
        and status = 'pending'
      returning id
    `,
    [input.actorProfileId, input.administrationId, input.reminderIds],
  )
  return result.rows.length
}

// ----------------------------------------------------------------------------
// Reads para proyecciones / reportes
// ----------------------------------------------------------------------------

export async function getManagedPropertyForProjectionFromPostgres(propertyId: string): Promise<{
  id: string
  administration_id: string
  display_name: string | null
  management_fee_pct: string | null
  building_name: string
  total_units: number
} | null> {
  const result = await pgQuery<{
    id: string
    administration_id: string
    display_name: string | null
    management_fee_pct: string | null
    building_name: string
    total_units: number
  }>(
    `
      select
        mp.id,
        mp.administration_id,
        mp.display_name,
        mp.management_fee_pct::text as management_fee_pct,
        b.name as building_name,
        b.total_units
      from public.iadmin_managed_properties mp
      inner join public.buildings b on b.id = mp.building_id
      where mp.id = $1
      limit 1
    `,
    [propertyId],
  )
  return result.rows[0] ?? null
}

export async function listImputedExpensesForProjectionFromPostgres(input: {
  managedPropertyId: string
  fromDate: string
}): Promise<
  Array<{
    amount: string
    category: string | null
    expense_kind: string | null
    issued_at: string | null
    provider_name: string | null
  }>
> {
  const result = await pgQuery<{
    amount: string
    category: string | null
    expense_kind: string | null
    issued_at: string | null
    provider_name: string | null
  }>(
    `
      select
        e.amount::text as amount,
        e.category,
        e.expense_kind::text as expense_kind,
        e.issued_at::text as issued_at,
        p.name as provider_name
      from public.iadmin_expenses e
      left join public.iadmin_providers p on p.id = e.provider_id
      where e.managed_property_id = $1
        and e.issued_at >= $2::date
        and e.status in ('imputed', 'approved')
      order by e.issued_at asc
    `,
    [input.managedPropertyId, input.fromDate],
  )
  return result.rows
}

export async function listCashAccountsByPropertyFromPostgres(propertyId: string): Promise<
  Array<{ id: string; name: string; kind: string | null; is_active: boolean }>
> {
  const result = await pgQuery<{ id: string; name: string; kind: string | null; is_active: boolean }>(
    `select id, name, kind::text as kind, is_active from public.iadmin_cash_accounts where managed_property_id = $1`,
    [propertyId],
  )
  return result.rows
}

export async function sumBankMovementsForAccountsFromPostgres(accountIds: string[]): Promise<number> {
  if (accountIds.length === 0) return 0
  const result = await pgQuery<{ total: string }>(
    `select coalesce(sum(amount), 0)::text as total from public.iadmin_bank_movements where cash_account_id = any($1::uuid[])`,
    [accountIds],
  )
  return Number(result.rows[0]?.total ?? 0)
}

export async function listIssuedLiquidationRunsForProjectionFromPostgres(input: {
  managedPropertyId: string
  limit: number
}): Promise<
  Array<{
    id: string
    ordinary_total: string | null
    extraordinary_total: string | null
    period_year: number | null
    period_month: number | null
  }>
> {
  const result = await pgQuery<{
    id: string
    ordinary_total: string | null
    extraordinary_total: string | null
    period_year: number | null
    period_month: number | null
  }>(
    `
      select
        r.id,
        r.ordinary_total::text as ordinary_total,
        r.extraordinary_total::text as extraordinary_total,
        ap.period_year,
        ap.period_month
      from public.iadmin_liquidation_runs r
      left join public.iadmin_accounting_periods ap on ap.id = r.accounting_period_id
      where r.managed_property_id = $1 and r.status in ('issued', 'closed')
      order by r.generated_at desc
      limit $2
    `,
    [input.managedPropertyId, input.limit],
  )
  return result.rows
}

export async function listActivePaymentsForProjectionFromPostgres(propertyId: string): Promise<
  Array<{ amount: string; liquidation_run_id: string | null }>
> {
  const result = await pgQuery<{ amount: string; liquidation_run_id: string | null }>(
    `select amount::text as amount, liquidation_run_id from public.iadmin_payments where managed_property_id = $1 and is_void = false`,
    [propertyId],
  )
  return result.rows
}

// ----------------------------------------------------------------------------
// Bank movements + payments (cobranzas)
// ----------------------------------------------------------------------------

export async function insertBankMovementInPostgres(input: {
  administrationId: string
  managedPropertyId: string
  cashAccountId: string
  movementDate: string
  description: string
  amount: number
  externalRef: string | null
  movementKind: string
  createdBy: string
  expenseId?: string | null
}): Promise<{ id: string }> {
  const result = await pgQuery<{ id: string }>(
    `
      insert into public.iadmin_bank_movements (
        administration_id, managed_property_id, cash_account_id, movement_date,
        description, amount, external_ref, movement_kind, expense_id, created_by
      )
      values ($1, $2, $3, $4::date, $5, $6, $7, $8::iadmin_bank_movement_kind, $9, $10)
      returning id
    `,
    [
      input.administrationId,
      input.managedPropertyId,
      input.cashAccountId,
      input.movementDate,
      input.description,
      input.amount,
      input.externalRef,
      input.movementKind,
      input.expenseId ?? null,
      input.createdBy,
    ],
  )
  return result.rows[0]
}

export async function deleteBankMovementInPostgres(movementId: string): Promise<void> {
  await pgQuery(`delete from public.iadmin_bank_movements where id = $1`, [movementId])
}

export async function callIAdminNextReceiptNumberInPostgres(adminId: string): Promise<string> {
  const result = await pgQuery<{ result: string }>(
    `select public.iadmin_next_receipt_number(admin_id := $1) as result`,
    [adminId],
  )
  return result.rows[0].result
}

export async function insertCollectionPaymentInPostgres(input: {
  administrationId: string
  managedPropertyId: string
  liquidationRunId: string
  liquidationItemId: string
  unitId: string
  cashAccountId: string
  bankMovementId: string
  amount: number
  surchargeAmount: number
  paidAt: string
  method: string | null
  reference: string | null
  receiptNumber: string
  dueLabel: string | null
  notes: string | null
  createdBy: string
}): Promise<{ id: string; receipt_number: string }> {
  const result = await pgQuery<{ id: string; receipt_number: string }>(
    `
      insert into public.iadmin_payments (
        administration_id, managed_property_id, liquidation_run_id, liquidation_item_id,
        unit_id, cash_account_id, bank_movement_id, amount, surcharge_amount, paid_at,
        method, reference, receipt_number, due_label, notes, created_by
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date, $11, $12, $13, $14, $15, $16)
      returning id, receipt_number
    `,
    [
      input.administrationId,
      input.managedPropertyId,
      input.liquidationRunId,
      input.liquidationItemId,
      input.unitId,
      input.cashAccountId,
      input.bankMovementId,
      input.amount,
      input.surchargeAmount,
      input.paidAt,
      input.method,
      input.reference,
      input.receiptNumber,
      input.dueLabel,
      input.notes,
      input.createdBy,
    ],
  )
  return result.rows[0]
}

export async function getPaymentForVoidFromPostgres(paymentId: string): Promise<{
  id: string
  administration_id: string
  managed_property_id: string
  liquidation_run_id: string | null
  bank_movement_id: string | null
  is_void: boolean
} | null> {
  const result = await pgQuery<{
    id: string
    administration_id: string
    managed_property_id: string
    liquidation_run_id: string | null
    bank_movement_id: string | null
    is_void: boolean
  }>(
    `
      select id, administration_id, managed_property_id, liquidation_run_id, bank_movement_id, is_void
      from public.iadmin_payments
      where id = $1
      limit 1
    `,
    [paymentId],
  )
  return result.rows[0] ?? null
}

export async function voidPaymentInPostgres(input: {
  paymentId: string
  voidedBy: string
  reason: string
}): Promise<void> {
  await pgQuery(
    `
      update public.iadmin_payments
      set is_void = true,
          voided_at = now(),
          voided_by = $1,
          void_reason = $2
      where id = $3
    `,
    [input.voidedBy, input.reason, input.paymentId],
  )
}
