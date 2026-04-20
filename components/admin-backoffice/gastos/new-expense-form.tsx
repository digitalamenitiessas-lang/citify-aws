'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { CheckCircle2, Plus, Search, Zap } from 'lucide-react'
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
  providers: Pick<IAdminProvider, 'id' | 'name' | 'isActive' | 'defaultCategory' | 'defaultDescription'>[]
}

export function NewExpenseForm({ administrationId, properties, providers }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const [managedPropertyId, setManagedPropertyId] = useState(properties[0]?.id ?? '')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [issuedAt, setIssuedAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [category, setCategory] = useState('')
  const [expenseKind, setExpenseKind] = useState<IAdminExpenseKind>('ordinaria')

  // Proveedor autocomplete
  const [providerInput, setProviderInput] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<Pick<IAdminProvider, 'id' | 'name'> | null>(null)
  const [providerOpen, setProviderOpen] = useState(false)
  const providerWrapRef = useRef<HTMLDivElement>(null)

  const activeProviders = useMemo(() => providers.filter((p) => p.isActive), [providers])

  const providerMatches = useMemo(() => {
    const query = providerInput.trim().toLowerCase()
    if (!query) return activeProviders.slice(0, 8)
    return activeProviders.filter((p) => p.name.toLowerCase().includes(query)).slice(0, 8)
  }, [activeProviders, providerInput])

  const canCreateNewProvider = useMemo(() => {
    const query = providerInput.trim()
    if (!query) return false
    if (selectedProvider) return false
    return !activeProviders.some((p) => p.name.toLowerCase() === query.toLowerCase())
  }, [providerInput, selectedProvider, activeProviders])

  if (properties.length === 0) return null

  function reset() {
    setDescription('')
    setAmount('')
    setIssuedAt(new Date().toISOString().slice(0, 10))
    setCategory('')
    setExpenseKind('ordinaria')
    setProviderInput('')
    setSelectedProvider(null)
    setProviderOpen(false)
  }

  function pickProvider(p: Pick<IAdminProvider, 'id' | 'name' | 'defaultCategory' | 'defaultDescription'>) {
    setSelectedProvider({ id: p.id, name: p.name })
    setProviderInput(p.name)
    setProviderOpen(false)
    // Precargar categoria si el gasto aun no tiene una
    if (!category && p.defaultCategory) setCategory(p.defaultCategory)
    if (!description && p.defaultDescription) setDescription(p.defaultDescription)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const numericAmount = Number(amount.replace(',', '.'))
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error('Monto invalido')
      return
    }
    if (!managedPropertyId) {
      toast.error('Seleccionar un consorcio')
      return
    }
    if (!description.trim()) {
      toast.error('Descripcion obligatoria')
      return
    }

    const providerPayload = selectedProvider
      ? { providerId: selectedProvider.id, providerName: undefined }
      : providerInput.trim()
        ? { providerId: null, providerName: providerInput.trim() }
        : { providerId: null, providerName: undefined }

    startTransition(async () => {
      try {
        const result = await createExpense({
          administrationId,
          managedPropertyId,
          description: description.trim(),
          amount: numericAmount,
          currency: 'ARS',
          issuedAt: issuedAt || null,
          category: category.trim() || null,
          expenseKind,
          ...providerPayload,
        })
        if (result.status === 'imputed') {
          toast.success('Gasto cargado e imputado al periodo')
        } else {
          toast.success('Gasto cargado. Quedo pendiente de aprobacion.')
        }
        reset()
        setOpen(false)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No se pudo crear el gasto')
      }
    })
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Cargar gasto
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Cargar gasto
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Queda imputado al periodo abierto del mes en curso.
          </p>
        </div>
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
        {properties.length > 1 ? (
          <div className="space-y-1.5 md:col-span-2">
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
        ) : null}

        {/* Proveedor: autocomplete con crear inline */}
        <div className="space-y-1.5 md:col-span-2" ref={providerWrapRef}>
          <Label>Proveedor</Label>
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-8"
                value={providerInput}
                placeholder="Buscar o crear proveedor…"
                onChange={(e) => {
                  setProviderInput(e.target.value)
                  if (selectedProvider && e.target.value !== selectedProvider.name) {
                    setSelectedProvider(null)
                  }
                  setProviderOpen(true)
                }}
                onFocus={() => setProviderOpen(true)}
              />
              {selectedProvider ? (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
              ) : null}
            </div>

            {providerOpen && (providerMatches.length > 0 || canCreateNewProvider) ? (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-background shadow-lg max-h-64 overflow-auto">
                {providerMatches.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between"
                    onClick={() => pickProvider(p)}
                  >
                    <span>{p.name}</span>
                    {p.defaultCategory ? (
                      <span className="text-xs text-muted-foreground">{p.defaultCategory}</span>
                    ) : null}
                  </button>
                ))}
                {canCreateNewProvider ? (
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm border-t border-border/50 hover:bg-muted flex items-center gap-2 text-primary"
                    onClick={() => {
                      setProviderOpen(false)
                      setSelectedProvider(null) // queda pending de crear en el server
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Crear proveedor &quot;{providerInput.trim()}&quot;
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Escribí el nombre. Si no existe, lo creamos al guardar el gasto.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Descripcion</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Factura mantenimiento ascensor"
            maxLength={240}
            rows={2}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category">Categoria</Label>
          <Input
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Mantenimiento, seguridad, limpieza..."
            maxLength={80}
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
          <Label htmlFor="issuedAt">Fecha de emision</Label>
          <Input id="issuedAt" type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="kind">Tipo de expensa</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setExpenseKind('ordinaria')}
              className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                expenseKind === 'ordinaria'
                  ? 'bg-slate-100 border-slate-300 text-slate-900 font-medium'
                  : 'border-input text-muted-foreground'
              }`}
            >
              Ordinaria
            </button>
            <button
              type="button"
              onClick={() => setExpenseKind('extraordinaria')}
              className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                expenseKind === 'extraordinaria'
                  ? 'bg-purple-100 border-purple-300 text-purple-900 font-medium'
                  : 'border-input text-muted-foreground'
              }`}
            >
              Extraordinaria
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar gasto'}
        </Button>
      </div>
    </form>
  )
}
