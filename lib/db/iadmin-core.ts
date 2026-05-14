import { pgQuery } from '@/lib/db/postgres'

export interface IAdminAdministrationRow {
  id: string
  name: string
  legal_name: string | null
  tax_id: string | null
  contact_email: string | null
  contact_phone: string | null
  is_active: boolean
  legal_info: Record<string, unknown> | null
  created_at: string
}

export interface IAdminRoleGrantRow {
  administration_id: string
  operational_role: string
  is_primary: boolean
  created_at: string
  admin_id: string
  admin_name: string
  admin_legal_name: string | null
  admin_tax_id: string | null
  admin_contact_email: string | null
  admin_contact_phone: string | null
  admin_is_active: boolean
  admin_legal_info: Record<string, unknown> | null
  admin_created_at: string
}

export interface IAdminRoleCapabilityOverrideRow {
  administration_id: string
  operational_role: string
  capability_code: string
  granted: boolean
}

export interface IAdminManagedPropertyRow {
  id: string
  administration_id: string
  building_id: string
  display_name: string | null
  property_kind: string
  tax_id: string | null
  managed_since: string | null
  management_fee_pct: string | null
  notes: string | null
  is_active: boolean
  legal_info: Record<string, unknown> | null
  created_at: string
  building_name: string
  building_address: string | null
  total_units: number | null
}

export interface IAdminPortfolioStatsRow {
  open_expenses_count: number
  pending_docs_count: number
}

export interface IAdminProviderRow {
  id: string
  administration_id: string
  name: string
  tax_id: string | null
  category: string | null
  email: string | null
  phone: string | null
  notes: string | null
  default_category: string | null
  default_description: string | null
  is_recurring: boolean
  recurring_amount: string | null
  recurring_kind: string | null
  is_active: boolean
  created_at: string
}

export interface IAdminExpenseInboxRow {
  id: string
  administration_id: string
  managed_property_id: string
  provider_name: string | null
  property_display_name: string | null
  building_name: string | null
  category: string | null
  description: string
  amount: string
  currency: string | null
  issued_at: string | null
  status: string
  expense_kind: string | null
  created_at: string
  document_count: number
  pending_extraction_count: number
}

export interface IAdminPortfolioOverviewPropertyRow {
  property_id: string
  total_balance: string | null
  pending_expenses: number
  accounts_payable_total: string | null
  overdue_amount: string | null
  current_month_liquidated: string | null
  current_month_collected: string | null
  collection_rate_pct: number | null
  has_open_period: boolean
  run_status_this_month: string | null
}

export async function getIAdminAdministrationsFromPostgres(activeOnly = false): Promise<IAdminAdministrationRow[]> {
  const params: unknown[] = []
  const where = activeOnly ? 'where a.is_active = true' : ''
  const result = await pgQuery<IAdminAdministrationRow>(
    `
      select
        a.id,
        a.name,
        a.legal_name,
        a.tax_id,
        a.contact_email,
        a.contact_phone,
        a.is_active,
        a.legal_info,
        a.created_at::text as created_at
      from public.iadmin_administrations a
      ${where}
      order by a.name asc
    `,
    params,
  )

  return result.rows
}

export async function getIAdminRoleGrantsForProfileFromPostgres(profileId: string): Promise<IAdminRoleGrantRow[]> {
  const result = await pgQuery<IAdminRoleGrantRow>(
    `
      select
        g.administration_id,
        g.operational_role,
        g.is_primary,
        g.created_at::text as created_at,
        a.id as admin_id,
        a.name as admin_name,
        a.legal_name as admin_legal_name,
        a.tax_id as admin_tax_id,
        a.contact_email as admin_contact_email,
        a.contact_phone as admin_contact_phone,
        a.is_active as admin_is_active,
        a.legal_info as admin_legal_info,
        a.created_at::text as admin_created_at
      from public.iadmin_role_grants g
      inner join public.iadmin_administrations a on a.id = g.administration_id
      where g.profile_id = $1
      order by g.is_primary desc, g.created_at asc
    `,
    [profileId],
  )

  return result.rows
}

export async function getIAdminRoleCapabilityOverridesFromPostgres(
  administrationIds: string[],
): Promise<IAdminRoleCapabilityOverrideRow[]> {
  if (administrationIds.length === 0) return []

  const result = await pgQuery<IAdminRoleCapabilityOverrideRow>(
    `
      select
        administration_id,
        operational_role,
        capability_code,
        granted
      from public.iadmin_role_capabilities
      where administration_id = any($1::uuid[])
    `,
    [administrationIds],
  )

  return result.rows
}

export async function getIAdminAdministrationByIdFromPostgres(id: string): Promise<IAdminAdministrationRow | null> {
  const result = await pgQuery<IAdminAdministrationRow>(
    `
      select
        a.id,
        a.name,
        a.legal_name,
        a.tax_id,
        a.contact_email,
        a.contact_phone,
        a.is_active,
        a.legal_info,
        a.created_at::text as created_at
      from public.iadmin_administrations a
      where a.id = $1
      limit 1
    `,
    [id],
  )

  return result.rows[0] ?? null
}

export async function getIAdminManagedPropertiesByAdministrationFromPostgres(
  administrationId: string,
): Promise<IAdminManagedPropertyRow[]> {
  const result = await pgQuery<IAdminManagedPropertyRow>(
    `
      select
        mp.id,
        mp.administration_id,
        mp.building_id,
        mp.display_name,
        mp.property_kind::text as property_kind,
        mp.tax_id,
        mp.managed_since::text as managed_since,
        mp.management_fee_pct::text as management_fee_pct,
        mp.notes,
        mp.is_active,
        mp.legal_info,
        mp.created_at::text as created_at,
        b.name as building_name,
        b.address as building_address,
        b.total_units
      from public.iadmin_managed_properties mp
      inner join public.buildings b on b.id = mp.building_id
      where mp.administration_id = $1
        and mp.is_active = true
      order by mp.created_at asc
    `,
    [administrationId],
  )

  return result.rows
}

export async function getIAdminPortfolioStatsFromPostgres(
  administrationId: string,
): Promise<IAdminPortfolioStatsRow> {
  const result = await pgQuery<IAdminPortfolioStatsRow>(
    `
      select
        (
          select count(*)::int
          from public.iadmin_expenses e
          where e.administration_id = $1
            and e.status in ('draft', 'pending_review', 'needs_doc')
        ) as open_expenses_count,
        (
          select count(*)::int
          from public.iadmin_ai_document_extractions ex
          inner join public.iadmin_expense_documents d on d.id = ex.document_id
          inner join public.iadmin_expenses e on e.id = d.expense_id
          where e.administration_id = $1
            and ex.status <> 'validated'
        ) as pending_docs_count
    `,
    [administrationId],
  )

  return (
    result.rows[0] ?? {
      open_expenses_count: 0,
      pending_docs_count: 0,
    }
  )
}

export async function getIAdminProvidersFromPostgres(administrationId: string): Promise<IAdminProviderRow[]> {
  const result = await pgQuery<IAdminProviderRow>(
    `
      select
        id,
        administration_id,
        name,
        tax_id,
        category,
        email,
        phone,
        notes,
        default_category,
        default_description,
        is_recurring,
        recurring_amount::text as recurring_amount,
        recurring_kind::text as recurring_kind,
        is_active,
        created_at::text as created_at
      from public.iadmin_providers
      where administration_id = $1
      order by is_active desc, name asc
    `,
    [administrationId],
  )

  return result.rows
}

export async function getIAdminExpensesInboxFromPostgres(
  administrationId: string,
): Promise<IAdminExpenseInboxRow[]> {
  const result = await pgQuery<IAdminExpenseInboxRow>(
    `
      select
        e.id,
        e.administration_id,
        e.managed_property_id,
        p.name as provider_name,
        mp.display_name as property_display_name,
        b.name as building_name,
        e.category,
        e.description,
        e.amount::text as amount,
        e.currency,
        e.issued_at::text as issued_at,
        e.status::text as status,
        e.expense_kind::text as expense_kind,
        e.created_at::text as created_at,
        count(distinct d.id)::int as document_count,
        count(distinct case when ex.status <> 'validated' then ex.id end)::int as pending_extraction_count
      from public.iadmin_expenses e
      left join public.iadmin_providers p on p.id = e.provider_id
      left join public.iadmin_managed_properties mp on mp.id = e.managed_property_id
      left join public.buildings b on b.id = mp.building_id
      left join public.iadmin_expense_documents d on d.expense_id = e.id
      left join public.iadmin_ai_document_extractions ex on ex.document_id = d.id
      where e.administration_id = $1
      group by
        e.id,
        e.administration_id,
        e.managed_property_id,
        p.name,
        mp.display_name,
        b.name,
        e.category,
        e.description,
        e.amount,
        e.currency,
        e.issued_at,
        e.status,
        e.expense_kind,
        e.created_at
      order by e.created_at desc
      limit 50
    `,
    [administrationId],
  )

  return result.rows
}

export async function getIAdminProviderByIdFromPostgres(
  providerId: string,
): Promise<{ id: string; administration_id: string } | null> {
  const result = await pgQuery<{ id: string; administration_id: string }>(
    `select id, administration_id from public.iadmin_providers where id = $1 limit 1`,
    [providerId],
  )
  return result.rows[0] ?? null
}

export async function createIAdminProviderInPostgres(input: {
  administrationId: string
  name: string
  taxId: string | null
  category: string | null
  email: string | null
  phone: string | null
  notes: string | null
  isRecurring: boolean
  recurringAmount: number | null
  recurringKind: 'ordinaria' | 'extraordinaria'
}): Promise<{ id: string }> {
  const result = await pgQuery<{ id: string }>(
    `
      insert into public.iadmin_providers (
        administration_id, name, tax_id, category, email, phone, notes,
        is_recurring, recurring_amount, recurring_kind, is_active
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::iadmin_expense_kind, true)
      returning id
    `,
    [
      input.administrationId,
      input.name,
      input.taxId,
      input.category,
      input.email,
      input.phone,
      input.notes,
      input.isRecurring,
      input.recurringAmount,
      input.recurringKind,
    ],
  )
  return { id: result.rows[0].id }
}

export async function updateIAdminProviderInPostgres(
  providerId: string,
  patch: Partial<{
    name: string
    taxId: string | null
    category: string | null
    email: string | null
    phone: string | null
    notes: string | null
    isRecurring: boolean
    recurringAmount: number | null
    recurringKind: 'ordinaria' | 'extraordinaria'
    isActive: boolean
  }>,
): Promise<void> {
  const columns: string[] = []
  const values: unknown[] = []
  const map: Record<string, { col: string; cast?: string }> = {
    name: { col: 'name' },
    taxId: { col: 'tax_id' },
    category: { col: 'category' },
    email: { col: 'email' },
    phone: { col: 'phone' },
    notes: { col: 'notes' },
    isRecurring: { col: 'is_recurring' },
    recurringAmount: { col: 'recurring_amount' },
    recurringKind: { col: 'recurring_kind', cast: 'iadmin_expense_kind' },
    isActive: { col: 'is_active' },
  }

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const meta = map[key]
    if (!meta) continue
    values.push(value)
    columns.push(meta.cast ? `${meta.col} = $${values.length}::${meta.cast}` : `${meta.col} = $${values.length}`)
  }

  if (columns.length === 0) return

  values.push(providerId)
  await pgQuery(
    `update public.iadmin_providers set ${columns.join(', ')} where id = $${values.length}`,
    values,
  )
}

export async function insertIAdminAuditLogInPostgres(input: {
  administrationId: string
  actorProfileId: string
  entityType: string
  entityId: string | null
  action: string
  metadata?: Record<string, unknown> | null
}): Promise<void> {
  await pgQuery(
    `
      insert into public.iadmin_audit_logs (
        administration_id, actor_profile_id, entity_type, entity_id, action, metadata
      )
      values ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [
      input.administrationId,
      input.actorProfileId,
      input.entityType,
      input.entityId,
      input.action,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ],
  )
}

export async function getIAdminPortfolioOverviewRowsFromPostgres(
  administrationId: string,
  currentYear: number,
  currentMonth: number,
): Promise<IAdminPortfolioOverviewPropertyRow[]> {
  const result = await pgQuery<IAdminPortfolioOverviewPropertyRow>(
    `
      with props as (
        select mp.id
        from public.iadmin_managed_properties mp
        where mp.administration_id = $1
          and mp.is_active = true
      ),
      active_accounts as (
        select ca.id, ca.managed_property_id
        from public.iadmin_cash_accounts ca
        where ca.managed_property_id in (select id from props)
          and ca.is_active = true
      ),
      balances as (
        select
          aa.managed_property_id as property_id,
          coalesce(sum(bm.amount), 0) as total_balance
        from active_accounts aa
        left join public.iadmin_bank_movements bm on bm.cash_account_id = aa.id
        group by aa.managed_property_id
      ),
      expenses as (
        select
          e.id,
          e.managed_property_id,
          e.status::text as status,
          e.amount
        from public.iadmin_expenses e
        where e.managed_property_id in (select id from props)
      ),
      paid_expenses as (
        select distinct bm.expense_id
        from public.iadmin_bank_movements bm
        where bm.movement_kind = 'expense_payment'
          and bm.expense_id is not null
      ),
      expense_rollup as (
        select
          e.managed_property_id as property_id,
          count(*) filter (where e.status in ('pending_review', 'needs_doc'))::int as pending_expenses,
          coalesce(sum(case when e.status in ('approved', 'imputed') and pe.expense_id is null then e.amount else 0 end), 0) as accounts_payable_total
        from expenses e
        left join paid_expenses pe on pe.expense_id = e.id
        group by e.managed_property_id
      ),
      current_periods as (
        select
          ap.managed_property_id as property_id,
          bool_or(ap.status = 'open') as has_open_period
        from public.iadmin_accounting_periods ap
        where ap.managed_property_id in (select id from props)
          and ap.period_year = $2
          and ap.period_month = $3
        group by ap.managed_property_id
      ),
      runs as (
        select
          lr.id,
          lr.managed_property_id as property_id,
          lr.status::text as status,
          lr.ordinary_total,
          lr.extraordinary_total,
          ap.period_year,
          ap.period_month
        from public.iadmin_liquidation_runs lr
        inner join public.iadmin_accounting_periods ap on ap.id = lr.accounting_period_id
        where lr.managed_property_id in (select id from props)
          and lr.status in ('calculated', 'issued', 'closed')
      ),
      run_payments as (
        select
          liquidation_run_id as run_id,
          coalesce(sum(amount), 0) as collected
        from public.iadmin_payments
        where liquidation_run_id in (select id from runs)
          and is_void = false
        group by liquidation_run_id
      ),
      historical_item_overdue as (
        select
          r.property_id,
          coalesce(sum(greatest(
            0,
            coalesce(li.ordinary_amount, 0) + coalesce(li.extraordinary_amount, 0) + coalesce(li.previous_balance, 0)
            - coalesce(ip.paid, 0)
          )), 0) as overdue_amount
        from runs r
        inner join public.iadmin_liquidation_items li on li.liquidation_run_id = r.id
        left join (
          select
            liquidation_item_id,
            coalesce(sum(amount), 0) as paid
          from public.iadmin_payments
          where liquidation_item_id is not null
            and is_void = false
          group by liquidation_item_id
        ) ip on ip.liquidation_item_id = li.id
        where r.status <> 'calculated'
          and not (r.period_year = $2 and r.period_month = $3)
        group by r.property_id
      ),
      current_run as (
        select distinct on (r.property_id)
          r.property_id,
          r.status as run_status_this_month,
          coalesce(r.ordinary_total, 0) + coalesce(r.extraordinary_total, 0) as current_month_liquidated,
          coalesce(rp.collected, 0) as current_month_collected
        from runs r
        left join run_payments rp on rp.run_id = r.id
        where r.period_year = $2
          and r.period_month = $3
        order by r.property_id, r.id desc
      )
      select
        p.id as property_id,
        coalesce(b.total_balance, 0)::text as total_balance,
        coalesce(er.pending_expenses, 0) as pending_expenses,
        coalesce(er.accounts_payable_total, 0)::text as accounts_payable_total,
        coalesce(ho.overdue_amount, 0)::text as overdue_amount,
        coalesce(cr.current_month_liquidated, 0)::text as current_month_liquidated,
        coalesce(cr.current_month_collected, 0)::text as current_month_collected,
        case
          when coalesce(cr.current_month_liquidated, 0) > 0
            then round((coalesce(cr.current_month_collected, 0) / cr.current_month_liquidated) * 100)
          else null
        end::int as collection_rate_pct,
        coalesce(cp.has_open_period, false) as has_open_period,
        cr.run_status_this_month
      from props p
      left join balances b on b.property_id = p.id
      left join expense_rollup er on er.property_id = p.id
      left join historical_item_overdue ho on ho.property_id = p.id
      left join current_run cr on cr.property_id = p.id
      left join current_periods cp on cp.property_id = p.id
      order by p.id
    `,
    [administrationId, currentYear, currentMonth],
  )

  return result.rows
}
