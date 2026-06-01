'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { updateExpense } from '@/app/iadmin/gastos/actions'
import type { IAdminExpenseKind } from '@/lib/types'

type Props = {
  expenseId: string
  initial: {
    description: string
    amount: number
    category: string | null
    issuedAt: string | null
    expenseKind: IAdminExpenseKind
  }
  canEdit: boolean
  blockedReason: string | null
}

export function ExpenseEditForm({ expenseId, initial, canEdit, blockedReason }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [description, setDescription] = useState(initial.description)
  const [amount, setAmount] = useState(String(initial.amount))
  const [category, setCategory] = useState(initial.category ?? '')
  const [issuedAt, setIssuedAt] = useState(initial.issuedAt ?? '')
  const [expenseKind, setExpenseKind] = useState<IAdminExpenseKind>(initial.expenseKind)

  if (!canEdit) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <Lock className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Este gasto no se puede editar. {blockedReason ?? 'El período ya fue liquidado o cerrado.'}
        </span>
      </div>
    )
  }

  function resetForm() {
    setDescription(initial.description)
    setAmount(String(initial.amount))
    setCategory(initial.category ?? '')
    setIssuedAt(initial.issuedAt ?? '')
    setExpenseKind(initial.expenseKind)
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="w-3.5 h-3.5 mr-1.5" />
        Editar gasto
      </Button>
    )
  }

  async function handleSubmit() {
    const parsedAmount = Number(amount)
    if (!description.trim()) {
      toast.error('La descripción es obligatoria')
      return
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      toast.error('El monto no es válido')
      return
    }
    setSaving(true)
    try {
      const result = await updateExpense({
        expenseId,
        description: description.trim(),
        amount: parsedAmount,
        category: category.trim() ? category.trim() : null,
        issuedAt: issuedAt ? issuedAt : null,
        expenseKind,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Gasto actualizado')
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('No se pudo actualizar el gasto')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Editar gasto</h3>
        <button
          type="button"
          onClick={() => {
            resetForm()
            setOpen(false)
          }}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="sm:col-span-2 space-y-1">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Descripción</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={240}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Monto</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm tabular-nums"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Emitido</span>
          <input
            type="date"
            value={issuedAt}
            onChange={(e) => setIssuedAt(e.target.value)}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Categoría</span>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            maxLength={80}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Tipo</span>
          <select
            value={expenseKind}
            onChange={(e) => setExpenseKind(e.target.value as IAdminExpenseKind)}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
          >
            <option value="ordinaria">Ordinaria</option>
            <option value="extraordinaria">Extraordinaria</option>
          </select>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            resetForm()
            setOpen(false)
          }}
          disabled={saving}
        >
          Cancelar
        </Button>
      </div>
    </div>
  )
}
