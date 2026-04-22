'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Check, ChevronRight, Info, Loader2, Plus, Search, Send, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type {
  IAdminCashAccountWithBalance,
  IAdminMesaState,
  IAdminMonthlyGrid,
  IAdminMonthlyGridRow,
} from '@/lib/types'
import {
  addRecurringRubro,
  emitAndNotify,
  quickPayFromMesa,
  type EmitAndNotifyResult,
  upsertMonthlyCell,
} from '@/app/iadmin/consorcios/[id]/planilla/actions'
import {
  acceptPredictionsAndEmit,
  generateMonthPredictions,
  type MonthPrediction,
} from '@/app/iadmin/consorcios/[id]/planilla/predict-actions'
import { PublishDialog } from '@/components/admin-backoffice/consorcio/publish-dialog'
import { MesaDistribution } from '@/components/admin-backoffice/consorcio/mesa-distribution'
import { MesaPayments } from '@/components/admin-backoffice/consorcio/mesa-payments'
import { MesaAssistant } from '@/components/admin-backoffice/consorcio/mesa-assistant'
import { MesaHeader } from '@/components/admin-backoffice/consorcio/mesa-header'
import { CellHistoryPopover } from '@/components/admin-backoffice/consorcio/cell-history-popover'
import { Sparkline } from '@/components/admin-backoffice/shared/sparkline'

type Props = {
  grid: IAdminMonthlyGrid
  state: IAdminMesaState
  cashAccounts: IAdminCashAccountWithBalance[]
  canEmit: boolean
  canManageRubros: boolean
  canRegisterPayments: boolean
}

type VisibleRange = 3 | 6 | 12

function formatARSShort(n: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n)
}

function cellKey(providerId: string, year: number, month: number) {
  return `${providerId}::${year}-${month}`
}

export function MonthlyPlanilla({
  grid,
  state,
  cashAccounts,
  canEmit,
  canManageRubros,
  canRegisterPayments,
}: Props) {
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [localValues, setLocalValues] = useState<Record<string, number | null>>({})
  const [pendingCells, setPendingCells] = useState<Set<string>>(new Set())
  const [_, startTransition] = useTransition()

  const [showRubroForm, setShowRubroForm] = useState(false)
  const [newRubroName, setNewRubroName] = useState('')

  const [publishResult, setPublishResult] = useState<EmitAndNotifyResult | null>(null)
  const [publishing, setPublishing] = useState(false)

  const [assistantOpen, setAssistantOpen] = useState(false)
  const [predictions, setPredictions] = useState<Map<string, MonthPrediction>>(new Map())

  // Rango visible (client-side). El grid ya vino con hasta 12 meses.
  const initialRange: VisibleRange =
    grid.months.length >= 12 ? 3 : grid.months.length >= 6 ? 3 : 3
  const [visibleRange, setVisibleRange] = useState<VisibleRange>(initialRange)

  // Matrix de refs para navegación por teclado
  const cellRefs = useRef<Map<string, HTMLTableCellElement>>(new Map())
  function registerCellRef(rowIdx: number, monthIdx: number, el: HTMLTableCellElement | null) {
    const k = `${rowIdx}-${monthIdx}`
    if (el) cellRefs.current.set(k, el)
    else cellRefs.current.delete(k)
  }

  // Búsqueda + agrupación
  const [search, setSearch] = useState('')
  const [groupBy, setGroupBy] = useState<'none' | 'category'>('none')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const visibleMonths = useMemo(() => {
    const take = Math.min(visibleRange, grid.months.length)
    return grid.months.slice(-take)
  }, [grid.months, visibleRange])

  const currentMonth = grid.months[grid.months.length - 1]

  function getDisplayAmount(row: IAdminMonthlyGridRow, year: number, month: number): number | null {
    const key = cellKey(row.providerId, year, month)
    if (key in localValues) return localValues[key]
    const cell = row.cells.find((c) => c.year === year && c.month === month)
    return cell?.amount ?? null
  }

  async function commitCell(
    row: IAdminMonthlyGridRow,
    year: number,
    month: number,
    nextAmount: number | null,
  ) {
    const key = cellKey(row.providerId, year, month)
    const cell = row.cells.find((c) => c.year === year && c.month === month)
    if (cell && cell.amount === nextAmount) return

    setPendingCells((prev) => new Set(prev).add(key))
    setLocalValues((prev) => ({ ...prev, [key]: nextAmount }))

    startTransition(async () => {
      try {
        await upsertMonthlyCell({
          propertyId: grid.propertyId,
          providerId: row.providerId || null,
          year,
          month,
          amount: nextAmount,
          expenseKind: row.expenseKind,
        })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Error al guardar')
        setLocalValues((prev) => {
          const next = { ...prev }
          delete next[key]
          return next
        })
      } finally {
        setPendingCells((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      }
    })
  }

  async function handleAddRubro(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newRubroName.trim()
    if (!name) {
      toast.error('Nombre obligatorio')
      return
    }
    try {
      await addRecurringRubro({ administrationId: grid.administrationId, name })
      toast.success('Rubro agregado — recargando')
      setNewRubroName('')
      setShowRubroForm(false)
      if (typeof window !== 'undefined') window.location.reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error')
    }
  }

  async function handleEmit() {
    setPublishing(true)
    try {
      const result = await emitAndNotify({
        propertyId: grid.propertyId,
        year: currentMonth.year,
        month: currentMonth.month,
      })
      setPublishResult(result)
      toast.success(`Liquidación emitida · ${result.neighbors.length} vecinos`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al emitir')
    } finally {
      setPublishing(false)
    }
  }

  async function handleRequestPredictions() {
    try {
      const result = await generateMonthPredictions({
        propertyId: grid.propertyId,
        year: currentMonth.year,
        month: currentMonth.month,
      })
      const map = new Map<string, MonthPrediction>()
      for (const p of result.predictions) map.set(p.providerId, p)
      setPredictions(map)
      if (result.predictions.length === 0) {
        toast.info('No hay historial suficiente para sugerir montos')
      } else {
        toast.success(`IA sugirió ${result.predictions.length} montos. Revisá cada uno.`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error de IA')
    }
  }

  function acceptPrediction(providerId: string) {
    const pred = predictions.get(providerId)
    if (!pred) return
    const row = grid.rows.find((r) => r.providerId === providerId)
    if (!row) return
    void commitCell(row, currentMonth.year, currentMonth.month, pred.suggestedAmount)
    setPredictions((prev) => {
      const next = new Map(prev)
      next.delete(providerId)
      return next
    })
  }

  function dismissPrediction(providerId: string) {
    setPredictions((prev) => {
      const next = new Map(prev)
      next.delete(providerId)
      return next
    })
  }

  async function handleAcceptAllAndEmit() {
    const toAccept: Array<{ providerId: string; amount: number }> = []
    for (const [providerId, pred] of predictions) {
      const row = grid.rows.find((r) => r.providerId === providerId)
      if (!row) continue
      const key = cellKey(providerId, currentMonth.year, currentMonth.month)
      const displayed = key in localValues
        ? localValues[key]
        : row.cells.find((c) => c.year === currentMonth.year && c.month === currentMonth.month)?.amount ?? null
      if (displayed !== null) continue
      toAccept.push({ providerId, amount: pred.suggestedAmount })
    }

    if (toAccept.length === 0) {
      if (grid.readyToEmit) await handleEmit()
      return
    }

    setPublishing(true)
    try {
      const result = await acceptPredictionsAndEmit({
        propertyId: grid.propertyId,
        year: currentMonth.year,
        month: currentMonth.month,
        acceptedPredictions: toAccept,
      })
      setPublishResult(result.emit)
      setPredictions(new Map())
      toast.success(`${result.applied} sugerencias aceptadas y liquidación emitida`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error')
    } finally {
      setPublishing(false)
    }
  }

  async function handleQuickPay({ unitId, amount }: { unitId: string; amount: number }) {
    const result = await quickPayFromMesa({
      propertyId: grid.propertyId,
      year: currentMonth.year,
      month: currentMonth.month,
      unitId,
      amount,
    })
    toast.success(`Pago registrado · Recibo ${result.receiptNumber}`)
  }

  const allRows = grid.freeRow ? [...grid.rows, grid.freeRow] : grid.rows
  const hasPredictions = predictions.size > 0

  // Filtro por search (por nombre de rubro o categoría)
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allRows
    return allRows.filter(
      (r) =>
        r.providerName.toLowerCase().includes(q) ||
        (r.category ?? '').toLowerCase().includes(q),
    )
  }, [allRows, search])

  // Agrupación: si groupBy = 'category', armamos grupos. Extraordinarias siempre
  // forman su propio grupo al final. Si hay búsqueda activa, no agrupamos.
  type RowGroup = { key: string; label: string; rows: IAdminMonthlyGridRow[]; isExtra: boolean }
  const groups: RowGroup[] = useMemo(() => {
    if (groupBy === 'none' || search.trim()) {
      return [{ key: '__all__', label: '', rows: filteredRows, isExtra: false }]
    }
    const byKey = new Map<string, RowGroup>()
    for (const row of filteredRows) {
      if (row.expenseKind === 'extraordinaria') {
        const g = byKey.get('__ext__') ?? { key: '__ext__', label: 'Extraordinarias', rows: [], isExtra: true }
        g.rows.push(row)
        byKey.set('__ext__', g)
        continue
      }
      const cat = (row.category ?? '').trim() || 'Sin categoría'
      const k = `cat:${cat.toLowerCase()}`
      const g = byKey.get(k) ?? { key: k, label: cat, rows: [], isExtra: false }
      g.rows.push(row)
      byKey.set(k, g)
    }
    // Ordenar: primero las categorías alfabéticamente, extraordinarias al final
    const list = Array.from(byKey.values()).filter((g) => !g.isExtra).sort((a, b) => a.label.localeCompare(b.label))
    const extra = Array.from(byKey.values()).find((g) => g.isExtra)
    return extra ? [...list, extra] : list
  }, [filteredRows, groupBy, search])

  // Lista plana de filas visibles (respeta grupos colapsados). Es la que usa kbd-nav.
  const visibleRows: IAdminMonthlyGridRow[] = useMemo(() => {
    if (groupBy === 'none' || search.trim()) return filteredRows
    const out: IAdminMonthlyGridRow[] = []
    for (const g of groups) {
      if (collapsedGroups.has(g.key)) continue
      for (const r of g.rows) out.push(r)
    }
    return out
  }, [groups, groupBy, search, collapsedGroups, filteredRows])

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function subtotalForGroup(g: RowGroup, year: number, month: number): number {
    let total = 0
    for (const row of g.rows) {
      const val = getDisplayAmount(row, year, month)
      if (val !== null) total += val
    }
    return total
  }

  // Movimiento entre celdas. `edit: true` abre edit mode directamente.
  function moveFocus(targetRow: number, targetMonth: number, edit = false) {
    if (visibleRows.length === 0) return
    const totalRows = visibleRows.length
    const totalMonths = visibleMonths.length
    const r = Math.max(0, Math.min(totalRows - 1, targetRow))
    const m = Math.max(0, Math.min(totalMonths - 1, targetMonth))
    const row = visibleRows[r]
    const month = visibleMonths[m]
    const cell = row.cells.find((c) => c.year === month.year && c.month === month.month)
    const isEditable = cell?.isEditable ?? false

    if (edit && isEditable) {
      setEditingCell(cellKey(row.providerId, month.year, month.month))
    } else {
      setEditingCell(null)
      queueMicrotask(() => {
        cellRefs.current.get(`${r}-${m}`)?.focus()
      })
    }
  }

  return (
    <div className="space-y-4">
      <MesaHeader
        grid={grid}
        state={state}
        visibleRange={visibleRange}
        onChangeRange={setVisibleRange}
      />

      {grid.activeUnitsCount === 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠ No hay unidades activas. Agregá las unidades desde Configuración → Datos del consorcio.
        </div>
      ) : null}

      <section className="mesa-card overflow-hidden">
        <header className="px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-serif text-lg font-semibold text-foreground">Gastos del mes</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cargá los montos. Cada celda se guarda sola. La mini-curva a la derecha es la tendencia del rubro.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canManageRubros && !showRubroForm ? (
              <Button size="sm" variant="outline" onClick={() => setShowRubroForm(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Rubro
              </Button>
            ) : null}
            <Button
              size="sm"
              variant={assistantOpen ? 'default' : 'ghost'}
              onClick={() => setAssistantOpen((v) => !v)}
              className={assistantOpen ? '' : 'text-muted-foreground'}
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Asistente
            </Button>
          </div>
        </header>

        <div className="divider-soft" />

        {allRows.length > 3 ? (
          <div className="px-6 py-2.5 flex items-center gap-2 flex-wrap bg-muted/10">
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar rubro…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearch('')
                    ;(e.target as HTMLInputElement).blur()
                  }
                }}
                className="w-full text-xs pl-8 pr-2 py-1.5 rounded-full border border-border/50 bg-background focus:outline-none focus:border-primary/40 focus:shadow-[0_0_0_3px_rgba(184,92,56,0.08)] transition-shadow"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              ) : null}
            </div>
            <div className="flex-1" />
            <div className="seg" role="group" aria-label="Agrupar rubros">
              <button
                type="button"
                aria-pressed={groupBy === 'none'}
                onClick={() => setGroupBy('none')}
              >
                Sin agrupar
              </button>
              <button
                type="button"
                aria-pressed={groupBy === 'category'}
                onClick={() => setGroupBy('category')}
              >
                Por categoría
              </button>
            </div>
            {filteredRows.length !== allRows.length ? (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {filteredRows.length} / {allRows.length}
              </span>
            ) : null}
          </div>
        ) : null}

        {showRubroForm ? (
          <form onSubmit={handleAddRubro} className="px-6 py-3 bg-muted/20 flex items-end gap-2 mesa-fade-in">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Nombre del rubro</Label>
              <Input
                value={newRubroName}
                onChange={(e) => setNewRubroName(e.target.value)}
                placeholder="Ej. Fondo de obra"
                autoFocus
              />
            </div>
            <Button type="submit" size="sm">Agregar</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setShowRubroForm(false); setNewRubroName('') }}>
              Cancelar
            </Button>
          </form>
        ) : null}

        {hasPredictions ? (
          <div className="px-6 py-2 bg-primary/5 text-xs text-foreground flex items-center justify-between gap-3 flex-wrap mesa-fade-in">
            <span>{predictions.size} montos sugeridos aplicados en la columna {currentMonth.label}. Revisá cada uno.</span>
            <button onClick={() => setPredictions(new Map())} className="text-muted-foreground hover:text-foreground text-xs">
              Descartar todos
            </button>
          </div>
        ) : null}

        <ScrollableTable>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-muted-foreground uppercase tracking-[0.12em] border-b border-border/40 bg-muted/25">
                <th className="text-left px-4 py-3 font-medium sticky left-0 bg-muted/25 z-10 min-w-[240px] sticky-shadow-right relative">
                  Rubro
                </th>
                {visibleMonths.map((m) => (
                  <th
                    key={`${m.year}-${m.month}`}
                    className={`text-right px-4 py-3 font-medium min-w-[108px] ${m.isCurrent ? 'th-current-month' : ''}`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {m.isCurrent ? <span className="live-dot inline-block text-primary" aria-hidden /> : null}
                      {m.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleMonths.length + 1} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Sin rubros. Agregá con <b>+ Rubro</b> arriba.
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleMonths.length + 1} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No hay rubros que coincidan con “{search}”.
                  </td>
                </tr>
              ) : (
                (() => {
                  // Render agrupado o flat — usamos un contador global para rowIdx
                  // de navegación por teclado (sobre `visibleRows`, que excluye grupos colapsados)
                  let visibleIdx = 0
                  const fragments: React.ReactNode[] = []
                  const isGrouped = groupBy === 'category' && !search.trim()

                  for (const g of groups) {
                    if (isGrouped && g.label) {
                      const collapsed = collapsedGroups.has(g.key)
                      fragments.push(
                        <tr
                          key={`grp-${g.key}`}
                          className="bg-muted/20 border-b border-border/20 text-xs"
                        >
                          <td className="px-4 py-1.5 sticky left-0 bg-muted/25 sticky-shadow-right relative">
                            <button
                              type="button"
                              onClick={() => toggleGroup(g.key)}
                              className="flex items-center gap-1.5 text-foreground font-medium uppercase tracking-[0.08em] text-[10px] hover:text-primary transition-colors"
                              aria-expanded={!collapsed}
                            >
                              <ChevronRight
                                className={`w-3 h-3 transition-transform ${collapsed ? '' : 'rotate-90'}`}
                              />
                              {g.label}
                              <span className="text-muted-foreground font-normal normal-case tracking-normal">
                                · {g.rows.length}
                              </span>
                            </button>
                          </td>
                          {visibleMonths.map((m) => {
                            const subtotal = subtotalForGroup(g, m.year, m.month)
                            return (
                              <td
                                key={`grp-${g.key}-${m.year}-${m.month}`}
                                className={`px-4 py-1.5 text-right tabular-nums text-[11px] text-muted-foreground stat-value ${m.isCurrent ? 'th-current-month' : ''}`}
                              >
                                {subtotal > 0 ? `$ ${formatARSShort(subtotal)}` : '—'}
                              </td>
                            )
                          })}
                        </tr>,
                      )
                      if (collapsed) continue
                    }
                    for (const row of g.rows) {
                      const rowIdx = visibleIdx
                      visibleIdx += 1
                      const fullSeries = grid.months.map((m) => getDisplayAmount(row, m.year, m.month))
                      fragments.push(
                        <tr
                          key={row.providerId || 'free'}
                          className="planilla-row border-b border-border/15 last:border-0 transition-colors"
                        >
                          <td className="px-4 py-2 sticky left-0 bg-background sticky-shadow-right relative">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-foreground truncate flex items-center gap-1.5">
                                  {row.providerName}
                                  {row.expenseKind === 'extraordinaria' ? (
                                    <span className="inline-flex rounded-full bg-purple-100 text-purple-800 px-1.5 py-0 text-[9px] font-medium">
                                      EXT
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <Sparkline
                                values={fullSeries}
                                width={72}
                                height={20}
                                ariaLabel={`Tendencia de ${row.providerName}`}
                              />
                            </div>
                          </td>
                          {visibleMonths.map((m, monthIdx) => {
                            const prediction = m.isCurrent && row.providerId ? predictions.get(row.providerId) : undefined
                            const displayedAmount = getDisplayAmount(row, m.year, m.month)
                            const cellData = row.cells.find((c) => c.year === m.year && c.month === m.month)
                            return (
                              <EditableCell
                                key={`${row.providerId}-${m.year}-${m.month}`}
                                rowIdx={rowIdx}
                                monthIdx={monthIdx}
                                registerRef={registerCellRef}
                                providerName={row.providerName}
                                cellData={cellData}
                                editing={editingCell === cellKey(row.providerId, m.year, m.month)}
                                pending={pendingCells.has(cellKey(row.providerId, m.year, m.month))}
                                amount={displayedAmount}
                                prediction={displayedAmount === null ? prediction : undefined}
                                isCurrent={m.isCurrent}
                                isEditable={cellData?.isEditable ?? true}
                                onStartEdit={() => setEditingCell(cellKey(row.providerId, m.year, m.month))}
                                onCommit={(val) => {
                                  setEditingCell(null)
                                  void commitCell(row, m.year, m.month, val)
                                }}
                                onCancel={() => setEditingCell(null)}
                                onMove={moveFocus}
                                onAcceptPrediction={() => acceptPrediction(row.providerId)}
                                onDismissPrediction={() => dismissPrediction(row.providerId)}
                              />
                            )
                          })}
                        </tr>,
                      )
                    }
                  }
                  return fragments
                })()
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gradient-to-b from-muted/40 to-muted/60 font-serif font-bold text-[15px]">
                <td className="px-4 py-3 sticky left-0 bg-muted/50 sticky-shadow-right relative tracking-wide text-foreground">
                  {search.trim() ? 'SUBTOTAL' : 'TOTAL'}
                </td>
                {visibleMonths.map((m) => {
                  let total = 0
                  for (const row of filteredRows) {
                    const val = getDisplayAmount(row, m.year, m.month)
                    if (val !== null) total += val
                    else if (m.isCurrent && row.providerId) {
                      const pred = predictions.get(row.providerId)
                      if (pred) total += pred.suggestedAmount
                    }
                  }
                  return (
                    <td
                      key={`tot-${m.year}-${m.month}`}
                      className={`px-4 py-3 text-right tabular-nums stat-value ${m.isCurrent ? 'th-current-month' : ''}`}
                    >
                      {total > 0 ? `$ ${formatARSShort(total)}` : '—'}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          </table>
        </ScrollableTable>
      </section>

      <MesaDistribution state={state} />

      <MesaPayments
        state={state}
        cashAccounts={cashAccounts}
        canRegister={canRegisterPayments}
        onPayQuick={handleQuickPay}
        propertyId={grid.propertyId}
        currentMonthYear={currentMonth.year}
        currentMonth={currentMonth.month}
      />

      <section className="mesa-card p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-serif text-lg font-semibold text-foreground">
              {hasPredictions ? 'Aceptar sugerencias y emitir' : state.hasRun ? 'Re-emitir con los cambios' : 'Emitir y avisar a los vecinos'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {canEmit
                ? grid.readyToEmit || hasPredictions
                  ? `Se genera la liquidación de ${currentMonth.label} y los mensajes para los ${grid.activeUnitsCount} vecinos.`
                  : 'Cargá al menos un gasto del mes para poder emitir.'
                : 'Tu rol no puede emitir liquidaciones.'}
            </p>
          </div>
          <Button
            size="lg"
            disabled={!canEmit || (!grid.readyToEmit && !hasPredictions) || publishing || grid.activeUnitsCount === 0}
            onClick={hasPredictions ? handleAcceptAllAndEmit : handleEmit}
          >
            {publishing ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Procesando…
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-1.5" />
                Emitir y avisar
              </>
            )}
          </Button>
        </div>
      </section>

      {publishResult ? (
        <PublishDialog result={publishResult} onClose={() => setPublishResult(null)} />
      ) : null}

      {assistantOpen ? (
        <MesaAssistant
          propertyId={grid.propertyId}
          administrationId={grid.administrationId}
          year={currentMonth.year}
          month={currentMonth.month}
          hasPredictions={hasPredictions}
          onRequestPredictions={handleRequestPredictions}
          onClose={() => setAssistantOpen(false)}
        />
      ) : null}
    </div>
  )
}

/**
 * Wrapper que detecta el scroll horizontal de la tabla y agrega la clase
 * `is-scrolled` al contenedor, para que la columna sticky muestre su sombra
 * lateral. 100% CSS, sin JS en cada frame gracias al throttle de rAF.
 */
function ScrollableTable({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        if (!ref.current) return
        ref.current.classList.toggle('is-scrolled', ref.current.scrollLeft > 4)
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    // Estado inicial
    onScroll()
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div ref={ref} className="overflow-x-auto">
      {children}
    </div>
  )
}

type EditableCellProps = {
  rowIdx: number
  monthIdx: number
  registerRef: (rowIdx: number, monthIdx: number, el: HTMLTableCellElement | null) => void
  providerName: string
  cellData: IAdminMonthlyGridRow['cells'][number] | undefined
  editing: boolean
  pending: boolean
  amount: number | null
  prediction?: MonthPrediction
  isCurrent: boolean
  isEditable: boolean
  onStartEdit: () => void
  onCommit: (val: number | null) => void
  onCancel: () => void
  onMove: (rowIdx: number, monthIdx: number, edit?: boolean) => void
  onAcceptPrediction?: () => void
  onDismissPrediction?: () => void
}

function EditableCell({
  rowIdx,
  monthIdx,
  registerRef,
  providerName,
  cellData,
  editing,
  pending,
  amount,
  prediction,
  isCurrent,
  isEditable,
  onStartEdit,
  onCommit,
  onCancel,
  onMove,
  onAcceptPrediction,
  onDismissPrediction,
}: EditableCellProps) {
  const [draft, setDraft] = useState(amount !== null ? String(amount) : '')

  if (editing && isEditable) {
    return (
      <td
        className={`px-1 py-1 ${isCurrent ? 'th-current-month' : ''}`}
        ref={(el) => registerRef(rowIdx, monthIdx, el)}
      >
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const n = draft.trim() ? Number(draft.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')) : null
            if (n !== null && !Number.isFinite(n)) {
              onCancel()
              return
            }
            onCommit(n === 0 ? null : n)
          }}
          onKeyDown={(e) => {
            const commitAndMove = (dr: number, dc: number, edit = false) => {
              const n = draft.trim() ? Number(draft.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')) : null
              if (n !== null && !Number.isFinite(n)) return
              e.preventDefault()
              onCommit(n === 0 ? null : n)
              queueMicrotask(() => onMove(rowIdx + dr, monthIdx + dc, edit))
            }
            if (e.key === 'Enter') commitAndMove(1, 0, true)
            else if (e.key === 'Tab') commitAndMove(0, e.shiftKey ? -1 : 1, true)
            else if (e.key === 'Escape') {
              setDraft(amount !== null ? String(amount) : '')
              onCancel()
              queueMicrotask(() => onMove(rowIdx, monthIdx, false))
            }
          }}
          className="w-full text-right tabular-nums text-sm bg-background border border-primary/70 rounded-md px-2 py-1 outline-none shadow-[0_0_0_3px_rgba(184,92,56,0.12)] transition-shadow"
        />
      </td>
    )
  }

  if (prediction && amount === null && isEditable) {
    return (
      <td
        className={`px-2 py-2 ${isCurrent ? 'th-current-month' : ''}`}
        ref={(el) => registerRef(rowIdx, monthIdx, el)}
        tabIndex={0}
        onKeyDown={(e) => handleNavKeys(e, rowIdx, monthIdx, onMove, onStartEdit)}
      >
        <div className="flex flex-col items-end gap-1 mesa-fade-in">
          <span className="text-muted-foreground italic tabular-nums text-xs">
            ~ {formatARSShort(prediction.suggestedAmount)}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onAcceptPrediction}
              className="rounded-md bg-foreground text-background px-1.5 py-0.5 text-[10px] hover:opacity-90 transition-opacity"
              title={prediction.reason}
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={onStartEdit}
              className="rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-[10px] hover:border-primary/40 transition-colors"
              title="Editar"
            >
              ✎
            </button>
            <button
              type="button"
              onClick={onDismissPrediction}
              className="rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              title="Descartar"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </td>
    )
  }

  const hasHistory = Boolean(cellData?.expenseId)
  const contents = (
    <div className="flex items-center justify-end gap-1.5 stat-value group/cell relative">
      {pending ? <Loader2 className="w-3 h-3 animate-spin text-primary" /> : null}
      {hasHistory && cellData ? (
        <CellHistoryPopover cell={cellData} providerName={providerName}>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="absolute -top-0.5 right-full mr-1 opacity-0 group-hover/cell:opacity-60 hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
            aria-label="Ver historial"
            tabIndex={-1}
          >
            <Info className="w-3 h-3" />
          </button>
        </CellHistoryPopover>
      ) : null}
      {amount !== null ? formatARSShort(amount) : <span className="text-muted-foreground/60">—</span>}
    </div>
  )

  return (
    <td
      ref={(el) => registerRef(rowIdx, monthIdx, el)}
      tabIndex={isEditable ? 0 : -1}
      onClick={isEditable ? onStartEdit : undefined}
      onKeyDown={(e) => handleNavKeys(e, rowIdx, monthIdx, onMove, onStartEdit)}
      className={`px-4 py-2 text-right tabular-nums transition-colors outline-none focus:shadow-[inset_0_0_0_2px_rgba(184,92,56,0.5)] ${
        isCurrent ? 'th-current-month font-medium' : ''
      } ${
        isEditable ? 'cursor-pointer hover:bg-primary/10' : 'cursor-not-allowed opacity-60'
      } ${amount !== null ? 'text-foreground' : 'text-muted-foreground/70'}`}
      title={isEditable ? 'Enter edita · ↑↓←→ mueve · i ve historial' : 'Período cerrado'}
    >
      {contents}
    </td>
  )
}

function handleNavKeys(
  e: React.KeyboardEvent<HTMLTableCellElement>,
  rowIdx: number,
  monthIdx: number,
  onMove: (r: number, c: number, edit?: boolean) => void,
  onStartEdit: () => void,
) {
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    onMove(rowIdx, monthIdx + 1)
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    onMove(rowIdx, monthIdx - 1)
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    onMove(rowIdx + 1, monthIdx)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    onMove(rowIdx - 1, monthIdx)
  } else if (e.key === 'Enter' || e.key === 'F2' || e.key === ' ') {
    e.preventDefault()
    onStartEdit()
  } else if (e.key === 'Tab') {
    // Dejar que el Tab nativo pase a la fila siguiente respetando shift
    e.preventDefault()
    onMove(rowIdx, monthIdx + (e.shiftKey ? -1 : 1))
  }
}
