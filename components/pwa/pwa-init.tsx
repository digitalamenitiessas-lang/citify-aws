'use client'

import { useEffect } from 'react'

import { getPushState, subscribeThisDevice } from './push-client'

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
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        reg = registration
        registration.update().catch(() => {})
        // Si ya dio permiso, se refresca la suscripcion en el servidor (el
        // navegador puede rotarla). El permiso NO se pide aca: solo desde el
        // boton (PushToggle), tras un click de la persona.
        if (getPushState() === 'granted') void subscribeThisDevice()
      })
      .catch((err) => console.error('[PWA] SW registration error:', err))

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return null
}
