'use client'

import { useEffect } from 'react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function PwaInit() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let reg: ServiceWorkerRegistration | null = null
    let reloading = false

    // Cuando un nuevo SW toma control, recargamos para que la tab quede en la
    // misma versión que el resto de los assets servidos por el server actual.
    const onControllerChange = () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    // Si una tab queda abierta horas, al volver el foco re-chequeamos updates
    // del SW en vez de esperar al next navigation.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        reg?.update().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    // updateViaCache: 'none' fuerza al browser a saltearse el HTTP cache cuando
    // re-fetchea /sw.js. Combinado con los headers no-cache del config, todo
    // cambio de byte en sw.js dispara activación inmediata.
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(async (registration) => {
      reg = registration
      registration.update().catch(() => {})

      if (!VAPID_PUBLIC_KEY || !('PushManager' in window)) return
      if (!('Notification' in window) || Notification.permission !== 'granted') return

      try {
        const existing = await registration.pushManager.getSubscription()
        const subscription = existing ?? await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription.toJSON()),
        })
      } catch (err) {
        console.error('[PWA] Push subscription error:', err)
      }
    }).catch((err) => console.error('[PWA] SW registration error:', err))

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return null
}
