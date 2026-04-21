'use client'

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Lock,
  TrendingDown,
  TrendingUp,
  Users2,
  Wallet,
} from 'lucide-react'
import { Sparkline } from '@/components/admin-backoffice/shared/sparkline'
import type { IAdminMesaState, IAdminMonthlyGrid } from '@/lib/types'

type Props = {
  grid: IAdminMonthlyGrid
  state: IAdminMesaState
  visibleRange: 3 | 6 | 12
  onChangeRange: (range: 3 | 6 | 12) => void
}

function formatARS(n: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n)
}

function monthName(month: number, year: number): string {
  const names = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ]
  return `${names[month - 1]} ${year}`
}

type MonthStatus =
  | { kind: 'pristine'; label: 'Sin cargar'; icon: typeof Clock3; tone: 'muted' }
  | { kind: 'draft'; label: 'Borrador'; icon: typeof Clock3; tone: 'neutral' }
  | { kind: 'calculated'; label: 'Calculada'; icon: typeof FileCheck2; tone: 'info' }
  | { kind: 'issued'; label: 'Emitida'; icon: typeof CheckCircle2; tone: 'success' }
  | { kind: 'closed'; label: 'Cerrada'; icon: typeof Lock; tone: 'locked' }

function resolveStatus(grid: IAdminMonthlyGrid, state: IAdminMesaState): MonthStatus {
  const current = grid.months[grid.months.length - 1]
  if (state.runStatus === 'issued') return { kind: 'issued', label: 'Emitida', icon: CheckCircle2, tone: 'success' }
  if (state.runStatus === 'closed') return { kind: 'closed', label: 'Cerrada', icon: Lock, tone: 'locked' }
  if (state.runStatus === 'calculated') return { kind: 'calculated', label: 'Calculada', icon: FileCheck2, tone: 'info' }
  if (current.total > 0 || grid.readyToEmit) return { kind: 'draft', label: 'Borrador', icon: Clock3, tone: 'neutral' }
  return { kind: 'pristine', label: 'Sin cargar', icon: Clock3, tone: 'muted' }
}

const TONE_CLASSES: Record<MonthStatus['tone'], string> = {
  muted: 'bg-muted text-muted-foreground border-border',
  neutral: 'bg-amber-50 text-amber-900 border-amber-200',
  info: 'bg-sky-50 text-sky-900 border-sky-200',
  success: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  locked: 'bg-slate-100 text-slate-700 border-slate-300',
}

export function MesaHeader({ grid, state, visibleRange, onChangeRange }: Props) {
  const current = grid.months[grid.months.length - 1]
  const previous = grid.months[grid.months.length - 2] ?? null

  const currentTotal = current.total ?? 0
  const previousTotal = previous?.total ?? 0
  const deltaPct =
    previousTotal > 0 ? Math.round(((currentTotal - previousTotal) / previousTotal) * 1000) / 10 : null

  const status = resolveStatus(grid, state)
  const toneClass = TONE_CLASSES[status.tone]
  const StatusIcon = status.icon

  const unitsWithBalance = state.units.filter((u) => u.balance > 0.01).length
  const unitsPaid = state.units.filter((u) => u.subtotal > 0 && u.balance < 0.01).length
  const unitsTotal = state.units.length

  // Serie de totales por mes para el sparkline (ordenado del más viejo al más nuevo)
  const totalsSeries = grid.months.map((m) => (m.total ?? 0) > 0 ? m.total : null)

  return (
    <section className="glass-card rounded-2xl overflow-hidden">
      <header className="px-5 py-4 border-b border-border/40 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Mesa del mes
          </p>
          <h1 className="font-serif text-2xl font-bold text-foreground capitalize leading-tight">
            {monthName(current.month, current.year)}
          </h1>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${toneClass}`}
            >
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </span>
            {current.periodStatus === 'locked' || current.periodStatus === 'closed' ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px]">
                <Lock className="w-2.5 h-2.5" /> Período {current.periodStatus}
              </span>
            ) : null}
            {!state.coverageOk ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 text-[10px]">
                <AlertTriangle className="w-2.5 h-2.5" />
                Alícuotas {(state.alicuotaSum * 100).toFixed(2)}% ≠ 100%
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-full border border-border/50 bg-background p-0.5 text-xs">
          {([3, 6, 12] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChangeRange(n)}
              className={`rounded-full px-2.5 py-1 transition-colors ${
                visibleRange === n ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
              }`}
              title={`Ver últimos ${n} meses`}
            >
              {n}m
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border/40">
        <KpiCard
          icon={Wallet}
          label="Total del mes"
          value={currentTotal > 0 ? `$ ${formatARS(currentTotal)}` : '—'}
          hint={
            deltaPct === null
              ? previousTotal === 0
                ? 'sin referencia previa'
                : ''
              : `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}% vs ${previous?.label ?? ''}`
          }
          hintIcon={deltaPct !== null ? (deltaPct >= 0 ? TrendingUp : TrendingDown) : undefined}
          hintTone={deltaPct === null ? 'muted' : deltaPct >= 0 ? 'warning' : 'success'}
          sparkline={<Sparkline values={totalsSeries} width={80} height={22} />}
        />
        <KpiCard
          icon={CheckCircle2}
          label="Cobrado del mes"
          value={
            state.hasRun
              ? `${state.collectionRatePct ?? 0}%`
              : '—'
          }
          hint={
            state.hasRun
              ? `$ ${formatARS(state.totalCollected)} / $ ${formatARS(
                  state.totalToDistribute + state.previousBalanceTotal,
                )}`
              : 'Pendiente de emitir'
          }
          hintTone="muted"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Saldo pendiente"
          value={state.totalPending > 0 ? `$ ${formatARS(state.totalPending)}` : '—'}
          hint={
            unitsWithBalance > 0
              ? `${unitsWithBalance} ${unitsWithBalance === 1 ? 'unidad debe' : 'unidades deben'}`
              : state.hasRun
                ? 'todas al día'
                : ''
          }
          hintTone={unitsWithBalance > 0 ? 'warning' : 'success'}
        />
        <KpiCard
          icon={Users2}
          label="Unidades al día"
          value={unitsTotal > 0 ? `${unitsPaid} / ${unitsTotal}` : '—'}
          hint={
            unitsTotal > 0
              ? `${Math.round((unitsPaid / Math.max(unitsTotal, 1)) * 100)}% del padrón`
              : 'Sin unidades activas'
          }
          hintTone="muted"
        />
      </div>
    </section>
  )
}

type HintTone = 'muted' | 'success' | 'warning'

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  hintIcon: HintIcon,
  hintTone = 'muted',
  sparkline,
}: {
  icon: typeof Wallet
  label: string
  value: string
  hint?: string
  hintIcon?: typeof TrendingUp
  hintTone?: HintTone
  sparkline?: React.ReactNode
}) {
  const hintColor =
    hintTone === 'success'
      ? 'text-emerald-700'
      : hintTone === 'warning'
        ? 'text-amber-800'
        : 'text-muted-foreground'

  return (
    <div className="px-5 py-4 flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </p>
        <p className="font-serif text-xl font-semibold text-foreground tabular-nums leading-tight mt-0.5 truncate">
          {value}
        </p>
        <div className={`text-[11px] ${hintColor} mt-0.5 flex items-center gap-1`}>
          {HintIcon ? <HintIcon className="w-3 h-3" /> : null}
          <span className="truncate">{hint}</span>
        </div>
      </div>
      {sparkline ? <div className="shrink-0 pt-1">{sparkline}</div> : null}
    </div>
  )
}
