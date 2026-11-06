import { pgQuery } from '@/lib/db/postgres'
import { sendPushToProfile } from './send'

// Los avisos push de cada evento. Se llaman desde los mismos puntos que los
// mails (lib/email/notifications/*), que son los que ya cubren todos los
// caminos por los que ocurre cada evento.
//
// No dependen de las preferencias de mail: el push tiene su propio
// consentimiento (la persona lo activo en este dispositivo). Y un mail que
// rebota (email_blocked) no tiene por que cortar el push.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://citify.com.ar'

function truncate(text: string, max: number) {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean
}

/** Comunicado nuevo: a los vecinos del consorcio que activaron las notificaciones. */
export async function pushAnnouncementPublished(input: {
  announcementId: string
  buildingId: string
  buildingName: string
  title: string
  body: string
}): Promise<number> {
  try {
    // Mismos vecinos que el mail (lib/db/announcements.ts), sin los filtros de mail.
    const res = await pgQuery<{ profile_id: string }>(
      `select distinct p.id as profile_id
         from citify.profiles p
         left join citify.unit_profile_memberships m on m.profile_id = p.id and m.building_id = $1
        where (p.building_id = $1 or m.building_id = $1)
          and p.role = 'vecino'
          and (m.active is null or m.active = true)
          and exists (select 1 from citify.push_subscriptions s where s.profile_id = p.id)`,
      [input.buildingId],
    )
    let sent = 0
    for (const r of res.rows) {
      sent += await sendPushToProfile(r.profile_id, {
        title: `Comunicado · ${input.buildingName}`,
        body: `${input.title} — ${truncate(input.body, 110)}`,
        url: `${SITE_URL}/usuario?view=announcements&id=${encodeURIComponent(input.announcementId)}`,
        // Si se re-publica, el aviso nuevo reemplaza al anterior en el celular.
        tag: `announcement:${input.announcementId}`,
      })
    }
    return sent
  } catch (err) {
    console.error('[push] comunicado: fallo (no bloquea)', err)
    return 0
  }
}

const MONEY = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/** Liquidacion emitida: al responsable de pago de una unidad, con su monto. */
export async function pushLiquidationIssued(input: {
  profileId: string
  runId: string
  unitId: string
  propertyName: string
  unitCode: string
  periodYear: number
  periodMonth: number
  subtotal: number
  /** Link publico al detalle; si no hay, lleva al panel del vecino. */
  url: string | null
}): Promise<number> {
  const month = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(input.periodYear, input.periodMonth - 1, 1)),
  )
  return sendPushToProfile(input.profileId, {
    title: `Expensas de ${month} ${input.periodYear}`,
    body: `${input.propertyName} · Unidad ${input.unitCode}: ${MONEY.format(input.subtotal)}. Tocá para ver el detalle.`,
    url: input.url ?? `${SITE_URL}/vecino`,
    tag: `liquidation:${input.runId}:${input.unitId}`,
  })
}
