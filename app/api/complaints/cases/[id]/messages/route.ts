import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/auth'
import { pgQueryAsProfile } from '@/lib/db/postgres'

type MessageBody = {
  body?: string
  mentionedProfileIds?: string[]
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentProfile()
  if (!profile) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const { id: caseId } = await params
  if (!caseId) {
    return NextResponse.json({ error: 'Falta el expediente.' }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as MessageBody | null
  const messageBody = body?.body?.trim()

  if (!messageBody) {
    return NextResponse.json({ error: 'El comentario esta vacio.' }, { status: 400 })
  }

  try {
    const result = await pgQueryAsProfile(
      profile.id,
      `select * from public.post_complaint_case_message($1, $2, 'comment'::public.complaint_case_message_type)`,
      [caseId, messageBody],
    )
    const row = result.rows[0]
    if (!row) {
      return NextResponse.json({ error: 'No se pudo registrar el comentario.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, message: row })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al postear' },
      { status: 400 },
    )
  }
}
