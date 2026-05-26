import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { OnboardingRequestsList } from '@/components/superadmin/onboarding-requests-list'
import { requireProfile } from '@/lib/auth'
import {
  listOnboardingRequestsFromPostgres,
  type OnboardingRequestStatus,
} from '@/lib/db/onboarding'
import { pgQuery } from '@/lib/db/postgres'

type SearchParams = {
  status?: string
  kind?: string
}

const VALID_STATUSES: OnboardingRequestStatus[] = [
  'pending',
  'contacted',
  'qualified',
  'converted',
  'dismissed',
]

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requireProfile(['super_admin'])
  const sp = await searchParams

  const statusInput = sp.status?.toLowerCase()
  const status: OnboardingRequestStatus | 'all' = VALID_STATUSES.includes(
    statusInput as OnboardingRequestStatus,
  )
    ? (statusInput as OnboardingRequestStatus)
    : 'all'

  const kindInput = sp.kind?.toLowerCase()
  const kind = kindInput === 'building' || kindInput === 'business' ? kindInput : null

  // Fetch lista + counts por status para los badges.
  const rows = await listOnboardingRequestsFromPostgres({ status, kind, limit: 200 })
  const countsResult = await pgQuery<{
    all: number
    pending: number
    contacted: number
    qualified: number
    converted: number
    dismissed: number
  }>(
    `
      select
        count(*)::int as all,
        count(*) filter (where status = 'pending')::int as pending,
        count(*) filter (where status = 'contacted')::int as contacted,
        count(*) filter (where status = 'qualified')::int as qualified,
        count(*) filter (where status = 'converted')::int as converted,
        count(*) filter (where status = 'dismissed')::int as dismissed
      from public.onboarding_requests
    `,
  )
  const countsRow = countsResult.rows[0] ?? {
    all: 0, pending: 0, contacted: 0, qualified: 0, converted: 0, dismissed: 0,
  }

  const items = rows.map((r) => ({
    id: r.id,
    kind: r.kind as 'building' | 'business',
    name: r.name,
    email: r.email,
    phone: r.phone,
    organization: r.organization,
    message: r.message,
    status: r.status as OnboardingRequestStatus,
    sourceIp: r.source_ip,
    internalNotes: r.internal_notes,
    contactedByName: r.contacted_by_name,
    contactedAt: r.contacted_at,
    convertedAt: r.converted_at,
    createdAt: r.created_at,
  }))

  return (
    <div className="min-h-screen bg-background pt-20 pb-16">
      <div className="mx-auto max-w-5xl px-6">
        <Link
          href="/superadmin"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al panel
        </Link>

        <header className="mb-6">
          <p className="text-xs uppercase tracking-wider text-primary font-medium">Onboarding</p>
          <h1 className="font-serif text-2xl font-bold text-foreground mt-1">
            Solicitudes de alta
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Leads desde el formulario de "Quiero afiliarme" en la landing. Cada nueva solicitud
            también te llega por mail; este panel es para seguimiento de funnel.
          </p>
        </header>

        <OnboardingRequestsList
          items={items}
          activeStatus={status}
          activeKind={kind}
          counts={countsRow}
        />
      </div>
    </div>
  )
}
