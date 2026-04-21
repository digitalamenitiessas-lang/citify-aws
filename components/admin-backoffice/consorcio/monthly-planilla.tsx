'use client'

import { useState, useTransition } from 'react'
import { Check, FileText, Loader2, Plus, Send, Sparkles } from 'lucide-react'
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
              Completá los montos del mes. Cada celda se guarda sola al salir.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canManageRubros && !showRubroForm ? (
              <Button size="sm" variant="outline" onClick={() => setShowRubroForm(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Rubro
              </Button>
            ) : null}
          </div>
        </header>

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
                    {grid.months.map((m) => (
                      <EditableCell
                        key={`${row.providerId}-${m.year}-${m.month}`}
                        row={row}
                        year={m.year}
                        month={m.month}
                        editing={editingCell === cellKey(row.providerId, m.year, m.month)}
                        pending={pendingCells.has(cellKey(row.providerId, m.year, m.month))}
                        amount={getDisplayAmount(row, m.year, m.month)}
                        isCurrent={m.isCurrent}
                        isEditable={row.cells.find((c) => c.year === m.year && c.month === m.month)?.isEditable ?? true}
                        onStartEdit={() => setEditingCell(cellKey(row.providerId, m.year, m.month))}
                        onCommit={(val) => {
                          setEditingCell(null)
                          void commitCell(row, m.year, m.month, val)
                        }}
                        onCancel={() => setEditingCell(null)}
                      />
                    ))}
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-muted/40 font-serif font-bold text-[15px]">
                <td className="px-4 py-3 sticky left-0 bg-muted/40">TOTAL</td>
                {grid.months.map((m) => {
                  const displayedTotal = allRows.reduce((sum, row) => {
                    const val = getDisplayAmount(row, m.year, m.month)
                    return sum + (val ?? 0)
                  }, 0)
                  return (
                    <td
                      key={`tot-${m.year}-${m.month}`}
                      className={`px-4 py-3 text-right tabular-nums ${m.isCurrent ? 'bg-primary/20 text-primary' : ''}`}
                    >
                      {displayedTotal > 0 ? `$ ${formatARSShort(displayedTotal)}` : '—'}
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
              Emitir y avisar a los vecinos
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {canEmit
                ? grid.readyToEmit
                  ? `Vas a emitir la liquidación de ${currentMonth.label} y generar mensajes prearmados para los ${grid.activeUnitsCount} vecinos.`
                  : 'Cargá al menos un gasto del mes para poder emitir.'
                : 'Tu rol no puede emitir liquidaciones.'}
            </p>
          </div>
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
  isCurrent,
  isEditable,
  onStartEdit,
  onCommit,
  onCancel,
}: {
  row: IAdminMonthlyGridRow
  year: number
  month: number
  editing: boolean
  pending: boolean
  amount: number | null
  isCurrent: boolean
  isEditable: boolean
  onStartEdit: () => void
  onCommit: (val: number | null) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(amount !== null ? String(amount) : '')

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
