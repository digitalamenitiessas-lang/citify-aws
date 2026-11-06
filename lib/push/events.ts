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

// ─── Administrador de consorcio ──────────────────────────────────────────────

/** Admins asignados al edificio que activaron las notificaciones. */
async function buildingAdminsWithPush(buildingId: string): Promise<string[]> {
  const res = await pgQuery<{ profile_id: string }>(
    `select distinct p.id as profile_id
       from citify.building_admin_assignments baa
       join citify.profiles p on p.id = baa.profile_id
      where baa.building_id = $1
        and p.role = 'consorcio_admin'
        and exists (select 1 from citify.push_subscriptions s where s.profile_id = p.id)`,
    [buildingId],
  )
  return res.rows.map((r) => r.profile_id)
}

/**
 * Un vecino informo un pago: hay un comprobante para validar. Mientras no se
 * valida, el vecino que ya pago sigue figurando como deudor.
 *
 * Agrupado por consorcio: el aviso dice cuantos pagos hay pendientes y lleva
 * el mismo tag, asi que si llegan varios, en el celular queda UNO con el
 * numero actualizado en lugar de una pila.
 */
export async function pushPaymentClaimSubmitted(claimId: string): Promise<number> {
  try {
    const ctxRes = await pgQuery<{ managed_property_id: string; building_id: string; property_name: string; pending: number }>(
      `select mp.id as managed_property_id,
              mp.building_id,
              coalesce(nullif(trim(mp.display_name), ''), b.name) as property_name,
              (select count(*)::int from citify.iadmin_payment_claims c
                where c.managed_property_id = mp.id and c.status = 'pending') as pending
         from citify.iadmin_payment_claims pc
         join citify.iadmin_managed_properties mp on mp.id = pc.managed_property_id
         join citify.buildings b on b.id = mp.building_id
        where pc.id = $1`,
      [claimId],
    )
    const ctx = ctxRes.rows[0]
    if (!ctx) return 0
    const admins = await buildingAdminsWithPush(ctx.building_id)
    let sent = 0
    for (const profileId of admins) {
      sent += await sendPushToProfile(profileId, {
        title: ctx.pending === 1 ? 'Pago informado para validar' : `${ctx.pending} pagos informados para validar`,
        body: `${ctx.property_name}: ${ctx.pending === 1 ? 'un vecino subió' : 'vecinos subieron'} el comprobante. Mientras no lo valides, figuran como deudores.`,
        url: `${SITE_URL}/iadmin/cobranzas/validar`,
        tag: `payment-claims:${ctx.managed_property_id}`,
      })
    }
    return sent
  } catch (err) {
    console.error('[push] pago informado: fallo (no bloquea)', err)
    return 0
  }
}

/** Reclamo nuevo de un vecino: a los admins del edificio. */
export async function pushComplaintCreated(input: {
  caseId: string
  buildingId: string
  buildingName: string
  caseCode: string
  title: string
  authorName: string
}): Promise<number> {
  try {
    let sent = 0
    for (const profileId of await buildingAdminsWithPush(input.buildingId)) {
      sent += await sendPushToProfile(profileId, {
        title: `Reclamo nuevo · ${input.buildingName}`,
        body: `${input.authorName}: ${truncate(input.title, 120)} (${input.caseCode})`,
        url: `${SITE_URL}/iadmin/expedientes?caseId=${encodeURIComponent(input.caseId)}`,
        tag: `complaint:${input.caseId}`,
      })
    }
    return sent
  } catch (err) {
    console.error('[push] reclamo nuevo: fallo (no bloquea)', err)
    return 0
  }
}

/** Respuesta en un reclamo: a un admin destinatario del mensaje. */
export async function pushComplaintMessage(input: {
  profileId: string
  caseId: string
  caseCode: string
  buildingName: string
  authorName: string
  message: string
}): Promise<number> {
  return sendPushToProfile(input.profileId, {
    title: `${input.authorName} respondió en ${input.caseCode}`,
    body: `${input.buildingName}: ${truncate(input.message, 120)}`,
    url: `${SITE_URL}/iadmin/expedientes?caseId=${encodeURIComponent(input.caseId)}`,
    // Mismo tag que el reclamo: la conversacion ocupa un solo lugar en el celular.
    tag: `complaint:${input.caseId}`,
  })
}

// ─── Pizarra de quejas ───────────────────────────────────────────────────────

/**
 * Admins del edificio con notificaciones activas. Los busca por las dos vias
 * que existen: la administracion que maneja el edificio (de donde sale el
 * acceso al panel) y la asignacion directa al edificio.
 */
async function boardAdminsWithPush(buildingId: string): Promise<string[]> {
  const res = await pgQuery<{ profile_id: string }>(
    `select distinct p.id as profile_id
       from citify.profiles p
      where p.role = 'consorcio_admin'
        and exists (select 1 from citify.push_subscriptions s where s.profile_id = p.id)
        and (
          exists (select 1
                    from citify.iadmin_managed_properties mp
                    join citify.iadmin_role_grants g on g.administration_id = mp.administration_id
                   where mp.building_id = $1 and mp.is_active and g.profile_id = p.id)
          or exists (select 1
                       from citify.building_admin_assignments baa
                      where baa.building_id = $1 and baa.profile_id = p.id)
        )`,
    [buildingId],
  )
  return res.rows.map((r) => r.profile_id)
}

/**
 * Queja nueva en la pizarra: a los admins del edificio. Si es anonima, el
 * aviso tampoco dice quien fue.
 */
export async function pushBoardPostCreated(input: {
  postId: string
  buildingId: string
  buildingName: string
  body: string
  authorLabel: string
}): Promise<number> {
  try {
    let sent = 0
    for (const profileId of await boardAdminsWithPush(input.buildingId)) {
      sent += await sendPushToProfile(profileId, {
        title: `Queja nueva · ${input.buildingName}`,
        body: `${input.authorLabel}: ${truncate(input.body, 120)}`,
        url: `${SITE_URL}/iadmin/pizarra?id=${encodeURIComponent(input.postId)}`,
        tag: `board:${input.postId}`,
      })
    }
    return sent
  } catch (err) {
    console.error('[push] queja nueva: fallo (no bloquea)', err)
    return 0
  }
}

/** La administracion respondio una queja: al autor (aunque sea anonima, el servidor sabe quien es). */
export async function pushBoardPostReplied(input: {
  postId: string
  authorProfileId: string
  buildingName: string
  reply: string
}): Promise<number> {
  return sendPushToProfile(input.authorProfileId, {
    title: 'La administración respondió tu queja',
    body: `${input.buildingName}: ${truncate(input.reply, 120)}`,
    url: `${SITE_URL}/usuario?view=board&id=${encodeURIComponent(input.postId)}`,
    tag: `board:${input.postId}`,
  })
}

/**
 * Cambio de estado: al autor. Cuando se resuelve, tambien a los vecinos que se
 * sumaron ("me pasa lo mismo"), que tambien estaban esperando.
 */
export async function pushBoardPostStatusChanged(input: {
  postId: string
  authorProfileId: string
  supporterIds: string[]
  buildingName: string
  body: string
  status: 'recibida' | 'en_curso' | 'resuelta'
}): Promise<number> {
  if (input.status === 'recibida') return 0
  try {
    const url = `${SITE_URL}/usuario?view=board&id=${encodeURIComponent(input.postId)}`
    const snippet = truncate(input.body, 100)
    let sent = await sendPushToProfile(input.authorProfileId, {
      title: input.status === 'resuelta' ? 'Tu queja se resolvió' : 'Tu queja está en curso',
      body: `${input.buildingName}: ${snippet}`,
      url,
      tag: `board:${input.postId}`,
    })
    if (input.status === 'resuelta') {
      for (const profileId of input.supporterIds) {
        if (profileId === input.authorProfileId) continue
        sent += await sendPushToProfile(profileId, {
          title: 'Se resolvió una queja a la que te sumaste',
          body: `${input.buildingName}: ${snippet}`,
          url,
          tag: `board:${input.postId}`,
        })
      }
    }
    return sent
  } catch (err) {
    console.error('[push] estado de queja: fallo (no bloquea)', err)
    return 0
  }
}
