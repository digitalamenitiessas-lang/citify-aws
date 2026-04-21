'use client'

import { useMemo, useState, useTransition } from 'react'
import { Check, FileText, Loader2, Plus, Send, Sparkles, Wand2, X, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { IAdminMonthlyGrid, IAdminMonthlyGridRow } from '@/lib/types'
import {
  addRecurringRubro,
  emitAndNotify,
  type EmitAndNotifyResult,
  upsertMonthlyCell,
} from '@/app/iadmin/consorcios/[id]/planilla/actions'
import {
  acceptPredictionsAndEmit,
  generateMonthPredictions,
  type MonthPrediction,
} from '@/app/iadmin/consorcios/[id]/planilla/predict-actions'
import { PublishDialog } from '@/components/admin-backoffice/consorcio/publish-dialog'

type Props = {
  grid: IAdminMonthlyGrid
  canEmit: boolean
  canManageRubros: boolean
}

function formatARSShort(n: number): string {
  return new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 0,
  }).format(n)
}

export function MonthlyPlanilla({ grid, canEmit, canManageRubros }: Props) {
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [localValues, setLocalValues] = useState<Record<string, number | null>>({})
  const [pendingCells, setPendingCells] = useState<Set<string>>(new Set())
  const [_, startTransition] = useTransition()

  // Agregar rubro
  const [showRubroForm, setShowRubroForm] = useState(false)
  const [newRubroName, setNewRubroName] = useState('')

  // Publicar
  const [publishResult, setPublishResult] = useState<EmitAndNotifyResult | null>(null)
  const [publishing, setPublishing] = useState(false)

  // Predicciones IA
  const [predicting, setPredicting] = useState(false)
  const [predictions, setPredictions] = useState<Map<string, MonthPrediction>>(new Map())

  const currentMonth = grid.months[grid.months.length - 1]

  function cellKey(providerId: string, year: number, month: number) {
    return `${providerId}::${year}-${month}`
  }

  function getDisplayAmount(row: IAdminMonthlyGridRow, year: number, month: number): number | null {
    const key = cellKey(row.providerId, year, month)
    if (key in localValues) return localValues[key]
    const cell = row.cells.find((c) => c.year === year && c.month === month)
    return cell?.amount ?? null
  }

  async function commitCell(row: IAdminMonthlyGridRow, year: number, month: number, nextAmount: number | null) {
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
      toast.success('Rubro agregado — recargá para verlo')
      setNewRubroName('')
      setShowRubroForm(false)
      // Refrescar
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

  async function handlePredict() {
    setPredicting(true)
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
        toast.info('No hay historial suficiente para predecir')
      } else {
        toast.success(`IA sugirió ${result.predictions.length} montos`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error de IA')
    } finally {
      setPredicting(false)
    }
  }

  function acceptPrediction(providerId: string) {
    const pred = predictions.get(providerId)
    if (!pred) return
    const row = grid.rows.find((r) => r.providerId === providerId)
    if (!row) return
    void commitCell(row, currentMonth.year, currentMonth.month, pred.suggestedAmount)
    // Sacamos la predicción de la lista (ya está aplicada)
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
      // Solo aceptamos si la celda del mes actual está vacía
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
      toast.info('No hay predicciones para aceptar')
      // Si ya tiene valores cargados, emitimos directo
      if (grid.readyToEmit) {
        await handleEmit()
      }
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
      toast.success(`${result.applied} predicciones aceptadas y liquidación emitida`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error')
    } finally {
      setPublishing(false)
    }
  }

  // Mes actual "está vacío" si no hay ninguna celda con monto en el mes actual
  const currentMonthHasAnyValue = useMemo(() => {
    for (const row of grid.rows) {
      const key = cellKey(row.providerId, currentMonth.year, currentMonth.month)
      if (key in localValues && localValues[key] !== null) return true
      const c = row.cells.find((c) => c.year === currentMonth.year && c.month === currentMonth.month)
      if (c?.amount !== null && c?.amount !== undefined) return true
    }
    if (grid.freeRow) {
      const c = grid.freeRow.cells.find((c) => c.year === currentMonth.year && c.month === currentMonth.month)
      if (c?.amount !== null && c?.amount !== undefined) return true
    }
    return false
  }, [grid, localValues, currentMonth.year, currentMonth.month])

  const hasPredictions = predictions.size > 0

  const allRows = grid.freeRow ? [...grid.rows, grid.freeRow] : grid.rows
  const totalAlicuotaPct = grid.totalAlicuota * 100
  const alicuotaOk = Math.abs(grid.totalAlicuota - 1) < 0.001

  return (
    <div className="space-y-4">
      {/* Advertencia si alicuotas no suman 100% */}
      {grid.activeUnitsCount === 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠ No hay unidades activas cargadas. Agregá las unidades desde "Gestión" antes de emitir.
        </div>
      ) : !alicuotaOk ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠ Las alícuotas de {grid.activeUnitsCount} unidades suman {totalAlicuotaPct.toFixed(2)}% (debería ser 100%).
          Revisá las unidades.
        </div>
      ) : null}

      <section className="glass-card rounded-2xl overflow-hidden">
        <header className="px-5 py-4 border-b border-border/40 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-serif text-xl font-semibold text-foreground">Planilla de gastos</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {currentMonthHasAnyValue
                ? 'Completá los montos del mes. Cada celda se guarda sola al salir.'
                : `Mes ${currentMonth.label} sin cargar. Usá "Pre-llenar con IA" para arrancar con sugerencias del histórico.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!currentMonthHasAnyValue && !hasPredictions && grid.rows.length > 0 ? (
              <Button
                size="sm"
                onClick={handlePredict}
                disabled={predicting}
                className="bg-gradient-to-r from-purple-600 to-primary text-white hover:opacity-90"
              >
                {predicting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Analizando histórico…
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                    Pre-llenar con IA
                  </>
                )}
              </Button>
            ) : null}
            {canManageRubros && !showRubroForm ? (
              <Button size="sm" variant="outline" onClick={() => setShowRubroForm(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Rubro
              </Button>
            ) : null}
          </div>
        </header>

        {hasPredictions ? (
          <div className="px-5 py-3 border-b border-border/40 bg-gradient-to-r from-purple-50 to-primary/5 flex items-start gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground">
                {predictions.size} sugerencias de IA aplicadas en la columna {currentMonth.label}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              · Revisá cada valor y aceptá individualmente, o confirmá todos junto con la emisión abajo.
            </span>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" onClick={() => setPredictions(new Map())}>
              Descartar sugerencias
            </Button>
          </div>
        ) : null}

        {showRubroForm ? (
          <form onSubmit={handleAddRubro} className="px-5 py-3 border-b border-border/30 bg-muted/30 flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Nombre del rubro</Label>
              <Input
                value={newRubroName}
                onChange={(e) => setNewRubroName(e.target.value)}
                placeholder="Ej. Fondo de obra, Fumigación, etc."
                autoFocus
              />
            </div>
            <Button type="submit" size="sm">Agregar</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setShowRubroForm(false); setNewRubroName('') }}>
              Cancelar
            </Button>
          </form>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground uppercase tracking-wider border-b border-border/40 bg-muted/30">
                <th className="text-left px-4 py-3 font-medium sticky left-0 bg-muted/30 z-10">Rubro</th>
                {grid.months.map((m) => (
                  <th
                    key={`${m.year}-${m.month}`}
                    className={`text-right px-4 py-3 font-medium min-w-[120px] ${
                      m.isCurrent ? 'bg-primary/10 text-primary' : ''
                    }`}
                  >
                    {m.label}
                    {m.isCurrent ? <span className="ml-1 text-[9px]">(actual)</span> : null}
                    {m.periodStatus === 'closed' ? (
                      <span className="block text-[9px] text-muted-foreground">cerrado</span>
                    ) : m.runStatus === 'issued' ? (
                      <span className="block text-[9px] text-emerald-600">emitida</span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allRows.length === 0 ? (
                <tr>
                  <td colSpan={grid.months.length + 1} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Aún no hay rubros. Agregá uno con <b>"+ Rubro"</b> arriba.
                  </td>
                </tr>
              ) : (
                allRows.map((row) => (
                  <tr key={row.providerId || 'free'} className="border-b border-border/20 last:border-0">
                    <td className="px-4 py-2 sticky left-0 bg-background font-medium text-foreground">
                      {row.providerName}
                      {row.expenseKind === 'extraordinaria' ? (
                        <span className="ml-1.5 inline-flex rounded-full bg-purple-100 text-purple-800 px-1.5 py-0 text-[9px]">
                          EXT
                        </span>
                      ) : null}
                      {row.category ? (
                        <div className="text-[10px] text-muted-foreground">{row.category}</div>
                      ) : null}
                    </td>
                    {grid.months.map((m) => {
                      const prediction = m.isCurrent && row.providerId ? predictions.get(row.providerId) : undefined
                      const displayedAmount = getDisplayAmount(row, m.year, m.month)
                      return (
                        <EditableCell
                          key={`${row.providerId}-${m.year}-${m.month}`}
                          row={row}
                          year={m.year}
                          month={m.month}
                          editing={editingCell === cellKey(row.providerId, m.year, m.month)}
                          pending={pendingCells.has(cellKey(row.providerId, m.year, m.month))}
                          amount={displayedAmount}
                          prediction={displayedAmount === null ? prediction : undefined}
                          isCurrent={m.isCurrent}
                          isEditable={row.cells.find((c) => c.year === m.year && c.month === m.month)?.isEditable ?? true}
                          onStartEdit={() => setEditingCell(cellKey(row.providerId, m.year, m.month))}
                          onCommit={(val) => {
                            setEditingCell(null)
                            void commitCell(row, m.year, m.month, val)
                          }}
                          onCancel={() => setEditingCell(null)}
                          onAcceptPrediction={() => acceptPrediction(row.providerId)}
                          onDismissPrediction={() => dismissPrediction(row.providerId)}
                        />
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-muted/40 font-serif font-bold text-[15px]">
                <td className="px-4 py-3 sticky left-0 bg-muted/40">TOTAL</td>
                {grid.months.map((m) => {
                  let displayedTotal = 0
                  let predictedTotal = 0
                  for (const row of allRows) {
                    const val = getDisplayAmount(row, m.year, m.month)
                    if (val !== null) displayedTotal += val
                    else if (m.isCurrent && row.providerId) {
                      const pred = predictions.get(row.providerId)
                      if (pred) predictedTotal += pred.suggestedAmount
                    }
                  }
                  const grandTotal = displayedTotal + predictedTotal
                  return (
                    <td
                      key={`tot-${m.year}-${m.month}`}
                      className={`px-4 py-3 text-right tabular-nums ${m.isCurrent ? 'bg-primary/20 text-primary' : ''}`}
                    >
                      {grandTotal > 0 ? `$ ${formatARSShort(grandTotal)}` : '—'}
                      {m.isCurrent && predictedTotal > 0 ? (
                        <div className="text-[10px] font-normal text-purple-700 flex items-center justify-end gap-1 mt-0.5">
                          <Sparkles className="w-3 h-3" />
                          ${formatARSShort(predictedTotal)} sugerido
                        </div>
                      ) : null}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Emitir */}
      <section className="glass-card rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-serif text-lg font-semibold text-foreground">
              {hasPredictions ? 'Aceptar sugerencias y emitir' : 'Emitir y avisar a los vecinos'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hasPredictions
                ? `${predictions.size} montos sugeridos por IA + ${
                    Object.keys(localValues).filter((k) => k.endsWith(`::${currentMonth.year}-${currentMonth.month}`)).length
                  } editados manualmente. Al confirmar, se imputan todos y se emite la liquidación a los ${grid.activeUnitsCount} vecinos.`
                : canEmit
                  ? grid.readyToEmit
                    ? `Vas a emitir la liquidación de ${currentMonth.label} y generar mensajes prearmados para los ${grid.activeUnitsCount} vecinos.`
                    : 'Cargá al menos un gasto del mes para poder emitir.'
                  : 'Tu rol no puede emitir liquidaciones.'}
            </p>
          </div>
          {hasPredictions ? (
            <Button
              size="lg"
              disabled={!canEmit || publishing || grid.activeUnitsCount === 0}
              onClick={handleAcceptAllAndEmit}
              className="bg-gradient-to-r from-purple-600 to-primary text-white hover:opacity-90"
            >
              {publishing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Procesando…
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-1.5" />
                  Aceptar {predictions.size} sugerencias y emitir
                </>
              )}
            </Button>
          ) : (
            <Button
              size="lg"
              disabled={!canEmit || !grid.readyToEmit || publishing || grid.activeUnitsCount === 0}
              onClick={handleEmit}
            >
              {publishing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Emitiendo…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-1.5" />
                  Emitir y avisar
                </>
              )}
            </Button>
          )}
        </div>
      </section>

      {publishResult ? (
        <PublishDialog
          result={publishResult}
          onClose={() => setPublishResult(null)}
        />
      ) : null}
    </div>
  )
}

function EditableCell({
  row,
  year,
  month,
  editing,
  pending,
  amount,
  prediction,
  isCurrent,
  isEditable,
  onStartEdit,
  onCommit,
  onCancel,
  onAcceptPrediction,
  onDismissPrediction,
}: {
  row: IAdminMonthlyGridRow
  year: number
  month: number
  editing: boolean
  pending: boolean
  amount: number | null
  prediction?: MonthPrediction
  isCurrent: boolean
  isEditable: boolean
  onStartEdit: () => void
  onCommit: (val: number | null) => void
  onCancel: () => void
  onAcceptPrediction?: () => void
  onDismissPrediction?: () => void
}) {
  const [draft, setDraft] = useState(amount !== null ? String(amount) : '')
  void row
  void year
  void month

  if (editing && isEditable) {
    return (
      <td className={`px-1 py-1 ${isCurrent ? 'bg-primary/10' : ''}`}>
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
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            else if (e.key === 'Escape') {
              setDraft(amount !== null ? String(amount) : '')
              onCancel()
            }
          }}
          className="w-full text-right tabular-nums text-sm bg-background border border-primary rounded px-2 py-1 outline-none"
        />
      </td>
    )
  }

  // Celda con sugerencia IA (no hay amount cargado y hay prediction)
  if (prediction && amount === null && isEditable) {
    const confidenceColor =
      prediction.confidence >= 85
        ? 'text-emerald-700'
        : prediction.confidence >= 60
          ? 'text-amber-700'
          : 'text-rose-700'
    return (
      <td className={`px-2 py-2 ${isCurrent ? 'bg-primary/5' : ''} relative group`}>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1 text-purple-700 tabular-nums">
            <Sparkles className="w-3 h-3" />
            <span className="font-medium">{formatARSShort(prediction.suggestedAmount)}</span>
          </div>
          <div className={`text-[10px] ${confidenceColor}`}>{prediction.confidence}% conf.</div>
          <div className="flex gap-0.5">
            <button
              type="button"
              onClick={onAcceptPrediction}
              className="rounded bg-emerald-600 text-white px-1.5 py-0.5 text-[10px] font-medium hover:bg-emerald-700"
              title={prediction.reason}
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={onStartEdit}
              className="rounded border border-input px-1.5 py-0.5 text-[10px] hover:bg-muted"
              title="Editar manualmente"
            >
              ✎
            </button>
            <button
              type="button"
              onClick={onDismissPrediction}
              className="rounded border border-input px-1.5 py-0.5 text-[10px] hover:bg-muted text-muted-foreground"
              title="Descartar sugerencia"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </td>
    )
  }

  return (
    <td
      onClick={isEditable ? onStartEdit : undefined}
      className={`px-4 py-2 text-right tabular-nums ${
        isCurrent ? 'bg-primary/5' : ''
      } ${isEditable ? 'cursor-pointer hover:bg-primary/10' : 'cursor-not-allowed opacity-60'} ${
        amount !== null ? 'text-foreground' : 'text-muted-foreground'
      }`}
      title={isEditable ? 'Click para editar' : 'Período cerrado'}
    >
      <div className="flex items-center justify-end gap-1">
        {pending ? <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" /> : null}
        {amount !== null ? formatARSShort(amount) : <span className="text-muted-foreground">—</span>}
      </div>
    </td>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _icons = { Check, FileText, Sparkles }
