// Notificaciones push del lado del navegador. Lo usan PwaInit (refresca la
// suscripcion al abrir la app) y PushToggle (el boton "Activar notificaciones").

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

export type PushState =
  | 'unsupported' //       el navegador no tiene push, o falta la clave
  | 'ios-needs-install' // iPhone/iPad: Apple solo permite push con la app instalada
  | 'default' //           todavia no se pidio permiso
  | 'denied' //            la persona las bloqueo
  | 'granted' //           activadas

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
}

function isInstalled() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function getPushState(): PushState {
  if (typeof window === 'undefined') return 'unsupported'
  // En iPhone, PushManager ni siquiera existe hasta que la app esta instalada
  // en la pantalla de inicio (iOS 16.4+): hay que decirle como instalarla.
  if (isIOS() && !isInstalled()) return 'ios-needs-install'
  if (!VAPID_PUBLIC_KEY || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported'
  }
  return Notification.permission as PushState
}

/**
 * Suscribe este dispositivo y lo registra en el servidor. Reutiliza la
 * suscripcion existente si la hay. Devuelve false si algo fallo.
 */
export async function subscribeThisDevice(): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY) return false
  try {
    const reg = await navigator.serviceWorker.ready
    const subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }))
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    })
    return res.ok
  } catch (err) {
    console.error('[push] no se pudo suscribir:', err)
    return false
  }
}

/** Pide permiso (solo tras un click: los navegadores castigan pedirlo solo) y suscribe. */
export async function enablePush(confirmBody: string): Promise<PushState> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission as PushState
  const ok = await subscribeThisDevice()
  if (ok) {
    // Confirmacion inmediata, generada en el propio dispositivo: la persona ve
    // como se ve un aviso sin esperar a que pase algo en el consorcio.
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification('Notificaciones activadas', {
      body: confirmBody,
      icon: '/apple-icon.png',
      tag: 'citify-push-activadas',
    })
  }
  return ok ? 'granted' : 'default'
}
