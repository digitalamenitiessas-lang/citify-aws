import { NextRequest, NextResponse } from 'next/server'
import { pgQuery } from '@/lib/db/postgres'

// Webhook que recibe notificaciones de SES via SNS (bounces, complaints,
// deliveries). Marca email_events.status y, en bounces duros / complaints,
// prende profiles.email_blocked para parar futuros envios al address.
//
// Seguridad minima: aceptamos el body solo si el SigningCertURL viene de
// amazonaws.com. Para verificacion completa de firma habria que validar
// la signature (TODO: agregar @aws-sdk/sns-message-validator si subimos
// volumen).

interface SnsEnvelope {
  Type: string
  MessageId?: string
  Token?: string
  TopicArn?: string
  Subject?: string
  Message?: string
  Timestamp?: string
  SignatureVersion?: string
  Signature?: string
  SigningCertURL?: string
  SubscribeURL?: string
  UnsubscribeURL?: string
}

interface SesBounce {
  notificationType: 'Bounce'
  bounce: {
    bounceType: 'Undetermined' | 'Permanent' | 'Transient'
    bounceSubType: string
    bouncedRecipients: Array<{ emailAddress: string; diagnosticCode?: string; status?: string }>
    timestamp: string
    feedbackId: string
  }
  mail: { messageId: string; source: string }
}

interface SesComplaint {
  notificationType: 'Complaint'
  complaint: {
    complainedRecipients: Array<{ emailAddress: string }>
    timestamp: string
    feedbackId: string
    complaintFeedbackType?: string
  }
  mail: { messageId: string; source: string }
}

interface SesDelivery {
  notificationType: 'Delivery'
  delivery: {
    timestamp: string
    recipients: string[]
  }
  mail: { messageId: string; source: string }
}

type SesPayload = SesBounce | SesComplaint | SesDelivery

function isAmazonSigningUrl(url: string | undefined): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname.endsWith('.amazonaws.com')
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.text()
  let envelope: SnsEnvelope
  try {
    envelope = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  // Verificacion minima de origen.
  if (!isAmazonSigningUrl(envelope.SigningCertURL)) {
    console.warn('[ses-webhook] rejected: signing url no amazonaws', envelope.SigningCertURL)
    return NextResponse.json({ error: 'untrusted source' }, { status: 403 })
  }

  // SNS exige confirmar la suscripcion la primera vez visitando SubscribeURL.
  if (envelope.Type === 'SubscriptionConfirmation') {
    if (!envelope.SubscribeURL) {
      return NextResponse.json({ error: 'no subscribe url' }, { status: 400 })
    }
    try {
      await fetch(envelope.SubscribeURL, { method: 'GET' })
      console.log('[ses-webhook] subscription confirmed', { topicArn: envelope.TopicArn })
    } catch (err) {
      console.error('[ses-webhook] confirm failed', err)
      return NextResponse.json({ error: 'confirm failed' }, { status: 502 })
    }
    return NextResponse.json({ ok: true })
  }

  if (envelope.Type !== 'Notification') {
    return NextResponse.json({ ok: true })
  }

  if (!envelope.Message) {
    return NextResponse.json({ error: 'no message' }, { status: 400 })
  }

  let payload: SesPayload
  try {
    payload = JSON.parse(envelope.Message)
  } catch {
    return NextResponse.json({ error: 'invalid sns message' }, { status: 400 })
  }

  try {
    if (payload.notificationType === 'Bounce') {
      await handleBounce(payload)
    } else if (payload.notificationType === 'Complaint') {
      await handleComplaint(payload)
    } else if (payload.notificationType === 'Delivery') {
      await handleDelivery(payload)
    }
  } catch (err) {
    console.error('[ses-webhook] handler error', err)
    return NextResponse.json({ error: 'handler error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

async function handleBounce(p: SesBounce) {
  const messageId = p.mail.messageId
  const isHard = p.bounce.bounceType === 'Permanent'

  // Marcar el evento (best-effort: si no encontramos por messageId, igual
  // intentamos bloquear el address).
  await pgQuery(
    `update public.email_events
        set status = 'bounced',
            bounced_at = now(),
            metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
      where ses_message_id = $1`,
    [
      messageId,
      JSON.stringify({
        bounce_type: p.bounce.bounceType,
        bounce_sub_type: p.bounce.bounceSubType,
        feedback_id: p.bounce.feedbackId,
      }),
    ],
  )

  // Para bounces permanentes (mailbox doesnt exist, blacklisted, etc.)
  // bloqueamos el address para no seguir mandando.
  if (isHard) {
    for (const r of p.bounce.bouncedRecipients) {
      await pgQuery(
        `update public.profiles
            set email_blocked = true,
                email_blocked_reason = $2,
                email_blocked_at = coalesce(email_blocked_at, now())
          where lower(email) = lower($1)`,
        [r.emailAddress, `hard_bounce: ${p.bounce.bounceSubType}`],
      )
    }
  }
}

async function handleComplaint(p: SesComplaint) {
  const messageId = p.mail.messageId

  await pgQuery(
    `update public.email_events
        set status = 'complained',
            complained_at = now(),
            metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb
      where ses_message_id = $1`,
    [
      messageId,
      JSON.stringify({
        feedback_id: p.complaint.feedbackId,
        feedback_type: p.complaint.complaintFeedbackType,
      }),
    ],
  )

  // Quejas SIEMPRE bloquean (es decision del usuario).
  for (const r of p.complaint.complainedRecipients) {
    await pgQuery(
      `update public.profiles
          set email_blocked = true,
              email_blocked_reason = $2,
              email_blocked_at = coalesce(email_blocked_at, now())
        where lower(email) = lower($1)`,
      [r.emailAddress, 'complaint'],
    )
  }
}

async function handleDelivery(p: SesDelivery) {
  await pgQuery(
    `update public.email_events
        set status = case when status = 'sent' then 'delivered' else status end,
            delivered_at = now()
      where ses_message_id = $1`,
    [p.mail.messageId],
  )
}
