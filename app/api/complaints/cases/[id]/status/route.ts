import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/auth'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import type { ComplaintCaseStatus } from '@/lib/types'

type StatusBody = {
  status?: ComplaintCaseStatus
}

const ALLOWED_STATUSES: ComplaintCaseStatus[] = ['nuevo', 'en_revision', 'en_desarrollo', 'en_espera', 'resuelto', 'cerrado']

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

  const admin = getSupabaseAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Supabase admin no esta configurado.' }, { status: 500 })
  }

  const { id: caseId } = await params
  const body = (await request.json().catch(() => null)) as StatusBody | null
  const nextStatus = body?.status

  if (!caseId || !nextStatus || !ALLOWED_STATUSES.includes(nextStatus)) {
    return NextResponse.json({ error: 'Estado invalido.' }, { status: 400 })
  }

  const { data: caseRow, error: caseError } = await admin
    .from('complaint_cases')
    .select('id, building_id')
    .eq('id', caseId)
    .maybeSingle()

  if (caseError || !caseRow) {
    return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 })
  }

  if (profile.role !== 'super_admin') {
    const { data: assignment } = await admin
      .from('building_admin_assignments')
      .select('building_id')
      .eq('profile_id', profile.id)
      .eq('building_id', caseRow.building_id)
      .maybeSingle()

    if (!assignment) {
      return NextResponse.json({ error: 'No autorizado para gestionar este edificio.' }, { status: 403 })
    }
  }

  const { data, error } = await admin.rpc('update_complaint_case_status', {
    target_case_id: caseId,
    next_status: nextStatus,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const row = Array.isArray(data) ? data[0] : null
  return NextResponse.json({ ok: true, result: row ?? null })
}
