import webpush from 'web-push'
import {
  deletePushSubscriptionByEndpointInPostgres,
  listPushSubscriptionsForProfileFromPostgres,
} from '@/lib/db/business'

// Envio de notificaciones push, solo desde el servidor. Los avisos los
// disparan eventos del sistema (lib/push/events.ts), nunca un endpoint con
// texto libre: habia uno (/api/push/send) que dejaba a cualquier admin de
// consorcio o de negocio mandarle a cualquier vecino el texto y el link que
// quisiera. Se elimino.

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_MAILTO = process.env.VAPID_MAILTO ?? 'mailto:soporte@citify.com.ar'

let configured: boolean | null = null

function configure(): boolean {
  if (configured !== null) return configured
  configured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)
  if (configured) webpush.setVapidDetails(VAPID_MAILTO, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!)
  else console.error('[push] faltan las claves VAPID: no se envian notificaciones')
  return configured
}

/** Lo que muestra el service worker (public/sw.js). */
export interface PushPayload {
  title: string
  body: string
  /** A donde lleva al tocarla. */
  url: string
  /** Avisos con el mismo tag se reemplazan en el dispositivo en vez de apilarse. */
  tag: string
}

/**
 * Manda el aviso a todos los dispositivos de una persona. Nunca tira: un
 * push que falla no puede frenar el evento que lo disparo. Devuelve cuantos
 * dispositivos lo recibieron.
 */
export async function sendPushToProfile(profileId: string, payload: PushPayload): Promise<number> {
  if (!configure()) return 0
  try {
    const subs = await listPushSubscriptionsForProfileFromPostgres(profileId)
    const results = await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(payload),
            // Si el dispositivo esta apagado, el servicio guarda el aviso un dia.
            { TTL: 60 * 60 * 24 },
          )
          return 1
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) {
            await deletePushSubscriptionByEndpointInPostgres(sub.endpoint)
          } else {
            console.error('[push] fallo un envio:', status, (err as Error).message)
          }
          return 0
        }
      }),
    )
    return results.reduce<number>((a, b) => a + b, 0)
  } catch (err) {
    console.error('[push] fallo el envio a', profileId, err)
    return 0
  }
}
