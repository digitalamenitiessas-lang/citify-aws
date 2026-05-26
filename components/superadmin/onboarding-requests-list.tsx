'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { CheckCircle2, Clock, MessageSquare, Trash2, UserCheck, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { updateOnboardingRequestAction } from '@/app/superadmin/onboarding/actions'

type Status = 'pending' | 'contacted' | 'qualified' | 'converted' | 'dismissed'

type Item = {
  id: string
  kind: 'building' | 'business'
  name: string
  email: string
  phone: string | null
  organization: string | null
  message: string
  status: Status
  sourceIp: string | null
  internalNotes: string | null
  contactedByName: string | null
  contactedAt: string | null
  convertedAt: string | null
  createdAt: string
}

const STATUS_LABELS: Record<Status, string> = {
  pending: 'Pendiente',
  contacted: 'Contactado',
  qualified: 'Calificado',
  converted: 'Convertido',
  dismissed: 'Descartado',
}

const STATUS_TONES: Record<Status, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  contacted: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  qualified: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  converted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  dismissed: 'bg-muted text-muted-foreground',
}

const STATUS_OPTIONS: Status[] = ['pending', 'contacted', 'qualified', 'converted', 'dismissed']

export function OnboardingRequestsList({
  items,
  activeStatus,
  activeKind,
  counts,
}: {
  items: Item[]
  activeStatus: Status | 'all'
  activeKind: 'building' | 'business' | null
  counts: { all: number } & Partial<Record<Status, number>>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({})

  function updateFilter(key: 'status' | 'kind', value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === null || value === '') params.delete(key)
    else params.set(key, value)
    startTransition(() => {
      router.replace(`${pathname}${params.toString() ? '?' + params.toString() : ''}`, { scroll: false })
    })
  }

  function changeStatus(id: string, nextStatus: Status) {
    const notes = notesDraft[id]?.trim() || null
    startTransition(async () => {
      try {
        await updateOnboardingRequestAction({ id, status: nextStatus, notes })
        toast.success(`Marcado como ${STATUS_LABELS[nextStatus].toLowerCase()}`)
        setNotesDraft((curr) => {
          const next = { ...curr }
          delete next[id]
          return next
        })
        setExpandedId(null)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No se pudo actualizar')
      }
    })
  }

  const statusTabs = useMemo(
    () => [
      { key: 'all' as const, label: 'Todos', count: counts.all },
      ...STATUS_OPTIONS.map((s) => ({ key: s, label: STATUS_LABELS[s], count: counts[s] ?? 0 })),
    ],
    [counts],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => updateFilter('status', tab.key === 'all' ? null : tab.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activeStatus === tab.key
                ? 'bg-primary text-white'
                : 'bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            }`}
            disabled={pending}
          >
            {tab.label}
            <span className={`inline-flex items-center justify-center min-w-[1.25rem] rounded-full px-1 text-[10px] ${
              activeStatus === tab.key ? 'bg-white/20 text-white' : 'bg-background text-muted-foreground'
            }`}>{tab.count}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <select
            value={activeKind ?? ''}
            onChange={(e) => updateFilter('kind', e.target.value || null)}
            disabled={pending}
            className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs h-8"
          >
            <option value="">Todos los tipos</option>
            <option value="building">Edificios</option>
            <option value="business">Negocios</option>
          </select>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="glass-card rounded-2xl px-5 py-12 text-center text-sm text-muted-foreground">
          No hay solicitudes que coincidan con estos filtros.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const isExpanded = expandedId === item.id
            const kindLabel = item.kind === 'building' ? 'Edificio' : 'Negocio'
            const createdRelative = formatRelative(item.createdAt)
            return (
              <div key={item.id} className="glass-card rounded-2xl border border-border/40 p-4">
                <button type="button" onClick={() => setExpandedId(isExpanded ? null : item.id)} className="w-full text-left">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONES[item.status]}`}>
                          {STATUS_LABELS[item.status]}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                          {kindLabel}
                        </span>
                        <span className="text-xs text-muted-foreground">{createdRelative}</span>
                      </div>
                      <div className="font-medium text-sm text-foreground">{item.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {item.email}
                        {item.organization ? ` · ${item.organization}` : ''}
                        {item.phone ? ` · ${item.phone}` : ''}
                      </div>
                    </div>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="mt-4 pt-4 border-t border-border/30 space-y-3">
                    <div className="rounded-lg bg-muted/30 p-3 text-sm text-foreground whitespace-pre-line">
                      {item.message}
                    </div>

                    {item.internalNotes ? (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-semibold">Notas internas:</span>{' '}
                        <span className="whitespace-pre-line">{item.internalNotes}</span>
                      </div>
                    ) : null}

                    {item.contactedAt || item.convertedAt ? (
                      <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                        {item.contactedAt ? (
                          <span>
                            Contactado {formatDate(item.contactedAt)}
                            {item.contactedByName ? ` por ${item.contactedByName}` : ''}
                          </span>
                        ) : null}
                        {item.convertedAt ? <span>· Convertido {formatDate(item.convertedAt)}</span> : null}
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <Textarea
                        rows={2}
                        placeholder="Notas internas (opcional, se agrega al cambiar de estado)"
                        value={notesDraft[item.id] ?? ''}
                        onChange={(e) => setNotesDraft((curr) => ({ ...curr, [item.id]: e.target.value }))}
                      />
                      <div className="flex flex-wrap gap-2 justify-end">
                        <ActionButton
                          icon={MessageSquare}
                          label="Contactado"
                          disabled={pending || item.status === 'contacted'}
                          onClick={() => changeStatus(item.id, 'contacted')}
                        />
                        <ActionButton
                          icon={UserCheck}
                          label="Calificar"
                          disabled={pending || item.status === 'qualified'}
                          onClick={() => changeStatus(item.id, 'qualified')}
                        />
                        <ActionButton
                          icon={CheckCircle2}
                          label="Convertir"
                          disabled={pending || item.status === 'converted'}
                          onClick={() => changeStatus(item.id, 'converted')}
                          variant="primary"
                        />
                        <ActionButton
                          icon={XCircle}
                          label="Descartar"
                          disabled={pending || item.status === 'dismissed'}
                          onClick={() => changeStatus(item.id, 'dismissed')}
                          variant="ghost"
                        />
                        {item.status !== 'pending' ? (
                          <ActionButton
                            icon={Clock}
                            label="Reabrir"
                            disabled={pending}
                            onClick={() => changeStatus(item.id, 'pending')}
                            variant="ghost"
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  variant = 'default',
}: {
  icon: typeof CheckCircle2
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'primary' | 'ghost'
}) {
  const base = 'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const tone =
    variant === 'primary'
      ? 'bg-primary text-white hover:brightness-110'
      : variant === 'ghost'
      ? 'text-muted-foreground hover:bg-muted/50'
      : 'border border-border/60 text-foreground hover:bg-muted/50'
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${tone}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

function formatRelative(iso: string): string {
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'hace un instante'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `hace ${diffH} h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `hace ${diffD} d`
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
