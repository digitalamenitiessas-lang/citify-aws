import { pgQuery } from '@/lib/db/postgres'

export type OnboardingRequestKind = 'building' | 'business'
export type OnboardingRequestStatus =
  | 'pending'
  | 'contacted'
  | 'qualified'
  | 'converted'
  | 'dismissed'

export type OnboardingRequestRow = {
  id: string
  kind: OnboardingRequestKind
  name: string
  email: string
  phone: string | null
  organization: string | null
  message: string
  status: OnboardingRequestStatus
  source_ip: string | null
  user_agent: string | null
  internal_notes: string | null
  contacted_by_profile_id: string | null
  contacted_by_name: string | null
  contacted_at: string | null
  converted_at: string | null
  created_at: string
  updated_at: string
}

export async function insertOnboardingRequestInPostgres(input: {
  kind: OnboardingRequestKind
  name: string
  email: string
  phone: string | null
  organization: string | null
  message: string
  sourceIp: string | null
  userAgent: string | null
  honeypotValue: string | null
}): Promise<{ id: string }> {
  const result = await pgQuery<{ id: string }>(
    `
      insert into public.onboarding_requests
        (kind, name, email, phone, organization, message,
         source_ip, user_agent, honeypot_value)
      values
        ($1::public.onboarding_request_kind, $2, lower($3), $4, $5, $6,
         $7::inet, $8, $9)
      returning id
    `,
    [
      input.kind,
      input.name,
      input.email,
      input.phone,
      input.organization,
      input.message,
      input.sourceIp,
      input.userAgent,
      input.honeypotValue,
    ],
  )
  return result.rows[0]
}

export async function listOnboardingRequestsFromPostgres(input: {
  status?: OnboardingRequestStatus | 'all'
  kind?: OnboardingRequestKind | null
  limit?: number
}): Promise<OnboardingRequestRow[]> {
  const status = input.status ?? 'all'
  const result = await pgQuery<OnboardingRequestRow>(
    `
      select
        r.id,
        r.kind::text as kind,
        r.name,
        r.email,
        r.phone,
        r.organization,
        r.message,
        r.status::text as status,
        host(r.source_ip) as source_ip,
        r.user_agent,
        r.internal_notes,
        r.contacted_by_profile_id,
        p.full_name as contacted_by_name,
        r.contacted_at::text as contacted_at,
        r.converted_at::text as converted_at,
        r.created_at::text as created_at,
        r.updated_at::text as updated_at
      from public.onboarding_requests r
      left join public.profiles p on p.id = r.contacted_by_profile_id
      where ($1::text = 'all' or r.status::text = $1)
        and ($2::text is null or r.kind::text = $2)
      order by r.created_at desc
      limit $3
    `,
    [status, input.kind ?? null, input.limit ?? 200],
  )
  return result.rows
}

export async function countPendingOnboardingRequestsFromPostgres(): Promise<number> {
  const result = await pgQuery<{ c: number }>(
    `select count(*)::int as c from public.onboarding_requests where status = 'pending'`,
  )
  return result.rows[0]?.c ?? 0
}

export async function updateOnboardingRequestStatusInPostgres(input: {
  id: string
  status: OnboardingRequestStatus
  notes: string | null
  actorProfileId: string
}): Promise<void> {
  // Set contacted_at / converted_at automaticamente segun la transicion.
  await pgQuery(
    `
      update public.onboarding_requests
        set status = $2::public.onboarding_request_status,
            internal_notes = coalesce($3, internal_notes),
            contacted_by_profile_id = case
              when $2::text in ('contacted', 'qualified', 'converted')
                and contacted_by_profile_id is null
              then $4 else contacted_by_profile_id
            end,
            contacted_at = case
              when $2::text in ('contacted', 'qualified', 'converted')
                and contacted_at is null
              then now() else contacted_at
            end,
            converted_at = case
              when $2::text = 'converted' and converted_at is null
              then now()
              when $2::text != 'converted' then null
              else converted_at
            end
      where id = $1
    `,
    [input.id, input.status, input.notes, input.actorProfileId],
  )
}
