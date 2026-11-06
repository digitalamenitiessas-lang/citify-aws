'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, Share, X } from 'lucide-react'
import { BRAND_CHIP } from '@/components/admin-backoffice/shared/brand'
import { IADMIN_FINANZAS, VECINO_EXPENSAS } from '@/lib/features'
import { enablePush, getPushState, type PushState } from './push-client'


/**
 * Activar notificaciones push en este dispositivo.
 *
 * - variant="banner": aviso en el panel del vecino. Solo aparece si todavia no
 *   las activo (o si en iPhone falta instalar la app), y se puede cerrar.
 * - variant="settings": en Configuracion, siempre visible, con el estado.
 *
 * El permiso se pide solo al tocar el boton: un pedido automatico al entrar
 * lo rechaza casi todo el mundo, y el navegador despues no deja volver a pedirlo.
 */
// Que se avisa a cada uno: el texto del boton y de la confirmacion depende de
// quien lo ve. Los eventos estan en lib/push/events.ts.
const AUDIENCE = {
  vecino: VECINO_EXPENSAS
    ? {
        what: 'cuándo hay un comunicado nuevo, salen tus expensas o te responden una queja',
        granted: 'de comunicados nuevos, de tus expensas y de las respuestas a tus quejas',
      }
    : {
        what: 'cuándo hay un comunicado nuevo o te responden una queja',
        granted: 'de comunicados nuevos y de las respuestas a tus quejas',
      },
  // Con las finanzas apagadas (lib/features.ts) no hay pagos para validar:
  // el aviso que importa es la queja nueva en la pizarra.
  admin: IADMIN_FINANZAS
    ? {
        what: 'cuándo un vecino informa un pago para validar o publica una queja',
        granted: 'de pagos informados para validar y de quejas nuevas en la pizarra',
      }
    : {
        what: 'cuándo un vecino publica una queja en la pizarra',
        granted: 'de las quejas nuevas en la pizarra',
      },
} as const

export function PushToggle({
  variant,
  audience = 'vecino',
}: {
  variant: 'banner' | 'settings'
  audience?: keyof typeof AUDIENCE
}) {
  const who = AUDIENCE[audience]
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setState(getPushState())
    try {
      setDismissed(localStorage.getItem(`citify-push-banner-cerrado:${audience}`) === '1')
    } catch {
      setDismissed(false)
    }
  }, [audience])

  if (state === null) return null

  if (variant === 'banner') {
    if (dismissed || (state !== 'default' && state !== 'ios-needs-install')) return null
  }

  async function activate() {
    setBusy(true)
    setState(await enablePush(`Te vamos a avisar ${who.granted}.`))
    setBusy(false)
  }

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(`citify-push-banner-cerrado:${audience}`, '1')
    } catch {
      // sin almacenamiento: se vuelve a mostrar la proxima vez, no pasa nada
    }
  }

  const copy: Record<PushState, { title: string; body: string }> = {
    default: {
      title: 'Enterate al instante',
      body: `Activá las notificaciones para saber ${who.what}.`,
    },
    granted: {
      title: 'Notificaciones activadas',
      body: `Te avisamos en este dispositivo ${who.granted}.`,
    },
    denied: {
      title: 'Notificaciones bloqueadas',
      body: 'Las bloqueaste en este navegador. Para activarlas, habilitalas en la configuración del sitio y volvé a esta pantalla.',
    },
    'ios-needs-install': {
      title: 'Instalá la app para recibir avisos',
      body: 'En iPhone las notificaciones funcionan con Citify en la pantalla de inicio: tocá Compartir y después "Agregar a inicio".',
    },
    unsupported: {
      title: 'Este navegador no admite notificaciones',
      body: 'Probá desde Chrome, Edge o Safari actualizados.',
    },
  }

  const Icon = state === 'denied' || state === 'unsupported' ? BellOff : state === 'ios-needs-install' ? Share : Bell
  const wrapper =
    variant === 'banner'
      ? 'glass-card rounded-2xl p-4 mb-4 flex items-start gap-3'
      : 'glass-card rounded-2xl p-6 mb-6 flex items-start gap-3'

  return (
    <div className={wrapper}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${BRAND_CHIP}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {variant === 'settings' && state === 'default' ? 'Notificaciones en este dispositivo' : copy[state].title}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">{copy[state].body}</p>
        {state === 'default' ? (
          <button
            type="button"
            onClick={activate}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--citify-terracotta)] px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <Bell className="h-4 w-4" />
            {busy ? 'Activando…' : 'Activar notificaciones'}
          </button>
        ) : null}
      </div>
      {variant === 'banner' ? (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar aviso de notificaciones"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  )
}
