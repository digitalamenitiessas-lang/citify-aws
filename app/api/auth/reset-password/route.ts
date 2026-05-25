import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { pgQuery } from '@/lib/db/postgres'
import { adminSetCognitoPassword, isCognitoConfigured } from '@/lib/aws/cognito'
import { getClientIp, rateLimitResponse } from '@/lib/rate-limit'

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function validatePassword(pwd: string): string | null {
  if (pwd.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'
  if (pwd.length > 72) return 'La contraseña es demasiado larga.'
  return null
}

export async function POST(request: NextRequest) {
  // Rate limit por IP: 10 intentos por minuto. El token ya es 32-byte
  // random + hasheado, asi que brute force es imposible — esto es solo
  // para evitar abuso del endpoint.
  const ip = getClientIp(request.headers)
  const limited = rateLimitResponse(`auth:reset:${ip}`, { max: 10, windowSeconds: 60 })
  if (limited) return limited

  const body = (await request.json().catch(() => null)) as
    | { token?: string; password?: string }
    | null
  const token = body?.token?.trim()
  const password = body?.password

  if (!token || !password) {
    return NextResponse.json({ error: 'Token y contraseña son requeridos.' }, { status: 400 })
  }

  const validationError = validatePassword(password)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  if (!isCognitoConfigured()) {
    return NextResponse.json({ error: 'Auth no configurado.' }, { status: 500 })
  }

  const tokenHash = hashToken(token)

  // Buscamos el token: tiene que existir, no estar usado, y no estar expirado.
  const tokenRes = await pgQuery<{
    id: string
    profile_id: string
    email: string
    full_name: string
  }>(
    `select t.id, t.profile_id, p.email, p.full_name
       from public.password_reset_tokens t
       join public.profiles p on p.id = t.profile_id
      where t.token_hash = $1
        and t.used_at is null
        and t.expires_at > now()
      limit 1`,
    [tokenHash],
  )
  const row = tokenRes.rows[0]
  if (!row) {
    return NextResponse.json(
      { error: 'El link ya expiró o no es válido. Pedí un nuevo link.' },
      { status: 400 },
    )
  }

  // Pisar la pwd en Cognito y marcar el token como usado en la misma operación.
  // Si Cognito falla, no marcamos used_at para que el user pueda reintentar.
  try {
    await adminSetCognitoPassword({ email: row.email, newPassword: password })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error de auth'
    return NextResponse.json({ error: `No pudimos actualizar la contraseña: ${msg}` }, { status: 502 })
  }

  await pgQuery(
    `update public.password_reset_tokens set used_at = now() where id = $1`,
    [row.id],
  )

  return NextResponse.json({ ok: true })
}

// Validar un token sin consumirlo (para que la página del form pueda mostrar
// "link inválido" antes de pedir la nueva pwd).
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim()
  if (!token) {
    return NextResponse.json({ valid: false }, { status: 400 })
  }
  const tokenHash = hashToken(token)
  const res = await pgQuery<{ email: string; full_name: string }>(
    `select p.email, p.full_name
       from public.password_reset_tokens t
       join public.profiles p on p.id = t.profile_id
      where t.token_hash = $1
        and t.used_at is null
        and t.expires_at > now()
      limit 1`,
    [tokenHash],
  )
  const row = res.rows[0]
  if (!row) {
    return NextResponse.json({ valid: false })
  }
  // Devolvemos solo el nombre para personalizar el form. Nunca el email
  // completo — el usuario que tenga el link ya lo conoce.
  return NextResponse.json({ valid: true, fullName: row.full_name })
}
