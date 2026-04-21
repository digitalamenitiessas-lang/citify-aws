'use client'

import { useState } from 'react'
import { Check, Copy, ExternalLink, Mail, MessageCircle, Printer, Share2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { EmitAndNotifyResult } from '@/app/iadmin/consorcios/[id]/planilla/actions'

function formatARS(n: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

export function PublishDialog({
  result,
  onClose,
}: {
  result: EmitAndNotifyResult
  onClose: () => void
}) {
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())

  const withPhone = result.neighbors.filter((n) => n.holderPhone)
  const withoutPhone = result.neighbors.filter((n) => !n.holderPhone)
  const withEmail = result.neighbors.filter((n) => n.holderEmail)

  function markSent(itemId: string) {
    setSentIds((prev) => new Set(prev).add(itemId))
  }

  async function copyAll() {
    const lines = result.neighbors.map(
      (n) =>
        `━ ${n.unitCode}${n.holderName ? ` · ${n.holderName}` : ''}${n.holderPhone ? ` · ${n.holderPhone}` : ''} ━\n${n.message}`,
    )
    try {
      await navigator.clipboard.writeText(lines.join('\n\n'))
      toast.success(`${result.neighbors.length} mensajes copiados`)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  function mailtoAll() {
    const to = withEmail.map((n) => n.holderEmail).join(',')
    const subject = `Liquidación de expensas ${result.periodLabel}`
    const body = result.neighbors[0]?.message.split('\n')[0] ?? ''
    return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-background shadow-xl flex flex-col">
        <header className="px-5 py-4 border-b border-border/40 flex items-start justify-between">
          <div>
            <h3 className="font-serif text-xl font-semibold text-foreground">
              ✅ Liquidación emitida
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Período {result.periodLabel} · {formatARS(result.liquidated)} · {result.neighbors.length} unidades
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="px-5 py-3 border-b border-border/40 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={copyAll}>
            <Copy className="w-3.5 h-3.5 mr-1.5" />
            Copiar todos
          </Button>
          {withEmail.length > 0 ? (
            <a
              href={mailtoAll()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <Mail className="w-3.5 h-3.5" />
              Email a los {withEmail.length} con email
            </a>
          ) : null}
          <a
            href={`/print/liquidaciones/${result.runId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Printer className="w-3.5 h-3.5" />
            PDF imprimible
          </a>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground self-center">
            {sentIds.size}/{result.neighbors.length} enviados
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {withoutPhone.length > 0 ? (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {withoutPhone.length} vecinos no tienen teléfono cargado. Cargá los teléfonos en "Gestión → unidades" para poder mandarles por WhatsApp.
            </div>
          ) : null}

          <ul className="divide-y divide-border/30">
            {result.neighbors.map((n) => {
              const sent = sentIds.has(n.itemId)
              return (
                <li key={n.itemId} className="py-3 flex items-start gap-3">
                  <div className="w-10 shrink-0 text-xs text-muted-foreground tabular-nums">{n.unitCode}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {n.holderName ?? 'Sin titular'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {n.holderPhone ? `📱 ${n.holderPhone}` : 'sin teléfono'}
                      {n.holderEmail ? ` · ✉ ${n.holderEmail}` : ''}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      A pagar: <span className="font-medium text-foreground">{formatARS(n.amountToPay)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {n.shareUrl ? (
                      <a
                        href={n.shareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-input px-2 py-1.5 text-xs hover:bg-muted"
                        title="Ver liquidación del vecino"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : null}
                    {n.holderPhone && n.whatsappHref ? (
                      <a
                        href={n.whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => markSent(n.itemId)}
                        className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${
                          sent
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {sent ? <Check className="w-3.5 h-3.5" /> : <MessageCircle className="w-3.5 h-3.5" />}
                        {sent ? 'Enviado' : 'WhatsApp'}
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(n.message)
                          toast.success('Mensaje copiado')
                          markSent(n.itemId)
                        }}
                        className="rounded-md border border-input px-2 py-1.5 text-xs hover:bg-muted"
                        title="Copiar mensaje"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _icons = { Share2 }
