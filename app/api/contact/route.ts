import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/provider'
import { insertOnboardingRequestInPostgres } from '@/lib/db/onboarding'
import { getClientIp, rateLimitResponse } from '@/lib/rate-limit'

const CONTACT_DESTINATION = process.env.CONTACT_DESTINATION_EMAIL ?? 'digitalamenitiessas@gmail.com'
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type ContactKind = 'building' | 'business'

interface ContactPayload {
  kind: ContactKind
  name: string
  email: string
  phone?: string
  organization?: string
  message: string
  // Honeypot: campo escondido en el form que un humano nunca llena;
  // si viene con valor lo tratamos como bot y respondemos 200 sin
  // persistir ni mandar mail (silencioso, no le damos pista al atacante).
  website?: string
}

function sanitize(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLen)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function validate(body: unknown): { ok: true; payload: ContactPayload } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Cuerpo inválido' }
  const raw = body as Record<string, unknown>

  const kind = raw.kind === 'building' || raw.kind === 'business' ? raw.kind : null
  if (!kind) return { ok: false, error: 'Tipo de consulta inválido' }

  const name = sanitize(raw.name, 120)
  const email = sanitize(raw.email, 200)
  const phone = sanitize(raw.phone, 60)
  const organization = sanitize(raw.organization, 200)
  const message = sanitize(raw.message, 4000)
  const website = sanitize(raw.website, 200)

  if (name.length < 2) return { ok: false, error: 'Necesitamos tu nombre' }
  if (!EMAIL_REGEX.test(email)) return { ok: false, error: 'Email inválido' }
  if (message.length < 10) return { ok: false, error: 'Contanos un poco más en el mensaje' }

  return { ok: true, payload: { kind, name, email, phone, organization, message, website } }
}

export async function POST(request: Request) {
  // Rate limit publico: 5 envios por hora por IP. Suficiente para uso
  // legitimo (un mismo edificio podria enviar varios), corta abuse temprano.
  const ip = getClientIp(request.headers)
  const limited = rateLimitResponse(`contact:${ip}`, { max: 5, windowSeconds: 3600 })
  if (limited) return limited

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const result = validate(body)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const { payload } = result

  // Honeypot: si el bot lleno el campo escondido, fingimos exito y nos
  // retiramos. No persistimos ni mandamos mail.
  if (payload.website && payload.website.length > 0) {
    console.log('[api/contact] honeypot triggered', { ip, email: payload.email })
    return NextResponse.json({ ok: true })
  }

  // Persistir el lead en onboarding_requests (best-effort: si la DB falla,
  // igual intentamos el mail para no perder el contacto).
  try {
    await insertOnboardingRequestInPostgres({
      kind: payload.kind,
      name: payload.name,
      email: payload.email,
      phone: payload.phone || null,
      organization: payload.organization || null,
      message: payload.message,
      sourceIp: ip === 'unknown' ? null : ip,
      userAgent: request.headers.get('user-agent') ?? null,
      honeypotValue: null,
    })
  } catch (err) {
    console.error('[api/contact] insertOnboardingRequest failed (non-blocking)', err)
  }
  const kindLabel = payload.kind === 'building' ? 'Edificio / consorcio' : 'Negocio'
  const subject = `[Citify · ${kindLabel}] Contacto de ${payload.name}`

  const textLines = [
    `Tipo: ${kindLabel}`,
    `Nombre: ${payload.name}`,
    `Email: ${payload.email}`,
    payload.phone ? `Teléfono: ${payload.phone}` : null,
    payload.organization ? `Organización: ${payload.organization}` : null,
    '',
    'Mensaje:',
    payload.message,
  ].filter(Boolean) as string[]
  const bodyText = textLines.join('\n')

  const bodyHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1A1A1A; max-width: 600px;">
      <h2 style="color: #F04E23; margin-bottom: 8px;">Nuevo contacto desde Citify</h2>
      <p style="margin: 0 0 16px; color: #666;"><strong>${escapeHtml(kindLabel)}</strong></p>
      <table style="border-collapse: collapse; width: 100%; margin-bottom: 16px;">
        <tr><td style="padding: 4px 0; color: #666;">Nombre</td><td style="padding: 4px 0;">${escapeHtml(payload.name)}</td></tr>
        <tr><td style="padding: 4px 0; color: #666;">Email</td><td style="padding: 4px 0;"><a href="mailto:${escapeHtml(payload.email)}" style="color: #F04E23;">${escapeHtml(payload.email)}</a></td></tr>
        ${payload.phone ? `<tr><td style="padding: 4px 0; color: #666;">Teléfono</td><td style="padding: 4px 0;">${escapeHtml(payload.phone)}</td></tr>` : ''}
        ${payload.organization ? `<tr><td style="padding: 4px 0; color: #666;">Organización</td><td style="padding: 4px 0;">${escapeHtml(payload.organization)}</td></tr>` : ''}
      </table>
      <p style="margin: 0 0 4px; color: #666;">Mensaje:</p>
      <div style="white-space: pre-wrap; background: #FFF1E8; border-left: 3px solid #F04E23; border-radius: 8px; padding: 12px;">${escapeHtml(payload.message)}</div>
    </div>
  `

  try {
    await sendEmail({
      to: CONTACT_DESTINATION,
      subject,
      bodyText,
      bodyHtml,
      replyTo: payload.email,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/contact] sendEmail error:', err)
    return NextResponse.json(
      { error: 'No pudimos enviar tu mensaje. Probá de nuevo en un rato.' },
      { status: 502 },
    )
  }
}
