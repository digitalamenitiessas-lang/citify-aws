import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/auth'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

type MessageBody = {
  body?: string
  mentionedProfileIds?: string[]
}

async function canAccessCase(admin: ReturnType<typeof getSupabaseAdminClient>, profile: Awaited<ReturnType<typeof getCurrentProfile>>, caseId: string) {
  const { data: caseRow, error: caseError } = await admin!
    .from('complaint_cases')
    .select('id, building_id')
    .eq('id', caseId)
    .maybeSingle()

  if (caseError || !caseRow) {
    return { allowed: false, reason: 'Expediente no encontrado.' }
  }

  if (profile?.role === 'super_admin') {
    return { allowed: true }
  }

  if (profile?.role === 'consorcio_admin') {
    const { data: assignment } = await admin!
      .from('building_admin_assignments')
      .select('building_id')
      .eq('profile_id', profile.id)
      .eq('building_id', caseRow.building_id)
      .maybeSingle()

    return { allowed: Boolean(assignment), reason: 'No autorizado para gestionar este edificio.' }
  }

  return {
    allowed: Boolean(profile?.buildingId && profile.buildingId === caseRow.building_id),
    reason: 'No autorizado para comentar este expediente.',
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentProfile()
  if (!profile) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const admin = getSupabaseAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Supabase admin no esta configurado.' }, { status: 500 })
  }

  const { id: caseId } = await params
  if (!caseId) {
    return NextResponse.json({ error: 'Falta el expediente.' }, { status: 400 })
  }

  const access = await canAccessCase(admin, profile, caseId)
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason ?? 'No autorizado.' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as MessageBody | null
  const messageBody = body?.body?.trim()
  const mentionedProfileIds = Array.isArray(body?.mentionedProfileIds)
    ? body!.mentionedProfileIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : []

  if (!messageBody) {
    return NextResponse.json({ error: 'El comentario esta vacio.' }, { status: 400 })
  }

  const { data, error } = await admin.rpc('post_complaint_case_message', {
    target_case_id: caseId,
    message_body: messageBody,
    message_kind: 'comment',
    mentioned_profile_ids: mentionedProfileIds,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const row = Array.isArray(data) ? data[0] : null
  if (!row) {
    return NextResponse.json({ error: 'No se pudo registrar el comentario.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, message: row })
}
