import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/auth'
import { pgQuery, pgQueryAsProfile } from '@/lib/db/postgres'
import { notifyComplaintStatusChanged } from '@/lib/email/notifications/complaints'
import type { ComplaintCaseStatus } from '@/lib/types'

type StatusBody = {
  status?: ComplaintCaseStatus
}

const ALLOWED_STATUSES: ComplaintCaseStatus[] = [
  'nuevo',
  'en_revision',
  'en_desarrollo',
  'en_espera',
  'resuelto',
  'cerrado',
]

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentProfile()
  if (!profile) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  if (profile.role !== 'consorcio_admin' && profile.role !== 'super_admin') {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })
  }

  const { id: caseId } = await params
  const body = (await request.json().catch(() => null)) as StatusBody | null
  const nextStatus = body?.status

  if (!caseId || !nextStatus || !ALLOWED_STATUSES.includes(nextStatus)) {
    return NextResponse.json({ error: 'Estado invalido.' }, { status: 400 })
  }

  try {
    // Capturamos el estado anterior antes de la actualizacion para poder
    // pasarlo a la notificacion. Si no existe el expediente, dejamos que
    // el RPC tire el error correspondiente.
    const prevRes = await pgQuery<{ status: string }>(
      `select status::text as status from public.complaint_cases where id = $1 limit 1`,
      [caseId],
    )
    const previousStatus = prevRes.rows[0]?.status ?? null

    const result = await pgQueryAsProfile(
      profile.id,
      `select * from public.update_complaint_case_status($1, $2::public.complaint_case_status)`,
      [caseId, nextStatus],
    )

    if (previousStatus && previousStatus !== nextStatus) {
      void notifyComplaintStatusChanged(caseId, previousStatus, nextStatus, profile.id)
    }

    return NextResponse.json({ ok: true, result: result.rows[0] ?? null })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al cambiar estado' },
      { status: 400 },
    )
  }
}
