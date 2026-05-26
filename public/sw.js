// Bump SW_VERSION cuando cambies este archivo para forzar update en clientes.
// El registro usa updateViaCache: 'none' (ver components/pwa/pwa-init.tsx) y
// los headers de /sw.js son no-cache (ver next.config.mjs), así que el byte-diff
// es lo único que dispara la activación de un nuevo SW.
const SW_VERSION = '2026-05-26-1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Cleanup defensivo de caches viejas (versiones previas del SW podían
      // haber dejado caches con otros nombres). Hoy no usamos Cache API.
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
      await self.clients.claim()
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clientList) {
        client.postMessage({ type: 'sw-activated', version: SW_VERSION })
      }
    })()
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'skip-waiting') self.skipWaiting()
})

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data?.json() ?? {} } catch { data = { title: 'Citify', body: event.data?.text() ?? '' } }

  const title = data.title ?? 'Citify'
  const options = {
    body: data.body ?? '',
    icon: '/apple-icon.png',
    badge: '/icon-light-32x32.png',
    tag: data.tag ?? 'citify-notification',
    renotify: true,
    data: { url: data.url ?? '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const existing = windowClients.find((c) => c.url === url && 'focus' in c)
      if (existing) return existing.focus()
      return clients.openWindow(url)
    })
  )
})
