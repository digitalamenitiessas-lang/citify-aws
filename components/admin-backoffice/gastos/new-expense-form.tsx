'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { IAdminExpenseKind, IAdminManagedProperty, IAdminProvider } from '@/lib/types'
import { createExpense } from '@/app/iadmin/gastos/actions'

type Props = {
  administrationId: string
  properties: Pick<IAdminManagedProperty, 'id' | 'displayName' | 'buildingName'>[]
  providers: Pick<IAdminProvider, 'id' | 'name' | 'isActive'>[]
}

export function NewExpenseForm({ administrationId, properties, providers }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [managedPropertyId, setManagedPropertyId] = useState(properties[0]?.id ?? '')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [issuedAt, setIssuedAt] = useState('')
  const [category, setCategory] = useState('')
  const [providerId, setProviderId] = useState<string>('')
  const [expenseKind, setExpenseKind] = useState<IAdminExpenseKind>('ordinaria')

  if (properties.length === 0) {
    return null
  }

  function reset() {
    setDescription('')
    setAmount('')
    setIssuedAt('')
    setCategory('')
    setProviderId('')
    setExpenseKind('ordinaria')
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const numericAmount = Number(amount.replace(',', '.'))
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      toast.error('Monto invalido')
      return
    }
    if (!managedPropertyId) {
      toast.error('Seleccionar un consorcio')
      return
    }
    startTransition(async () => {
      try {
        await createExpense({
          administrationId,
          managedPropertyId,
          description,
          amount: numericAmount,
          currency: 'ARS',
          issuedAt: issuedAt || null,
          category: category || null,
          providerId: providerId || null,
          expenseKind,
        })
        toast.success('Gasto creado en borrador')
        reset()
        setOpen(false)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No se pudo crear el gasto')
      }
    })
  }

  const activeProviders = providers.filter((p) => p.isActive)

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          Cargar gasto
        </Button>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-card rounded-2xl p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-foreground">Nuevo gasto</h3>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => {
            reset()
            setOpen(false)
          }}
        >
          Cancelar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="property">Consorcio</Label>
          <select
            id="property"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={managedPropertyId}
            onChange={(e) => setManagedPropertyId(e.target.value)}
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName ?? p.buildingName}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="issuedAt">Fecha emision</Label>
          <Input id="issuedAt" type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="description">Descripcion</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Factura mantenimiento ascensor"
            maxLength={240}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="amount">Monto (ARS)</Label>
          <Input
            id="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category">Categoria</Label>
          <Input
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Mantenimiento, seguridad, etc."
            maxLength={80}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="provider">Proveedor</Label>
          <select
            id="provider"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
          >
            <option value="">— Sin proveedor —</option>
            {activeProviders.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="kind">Tipo de expensa</Label>
          <select
            id="kind"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={expenseKind}
            onChange={(e) => setExpenseKind(e.target.value as IAdminExpenseKind)}
          >
            <option value="ordinaria">Ordinaria</option>
            <option value="extraordinaria">Extraordinaria</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar borrador'}
        </Button>
      </div>
    </form>
  )
}
