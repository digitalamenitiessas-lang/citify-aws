'use client'

import { useState, useTransition } from 'react'
import { Banknote, CheckCircle2, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { IAdminCashAccountKind, IAdminCashAccountWithBalance } from '@/lib/types'
import {
  createCashAccount,
  setCashAccountActive,
  updateCashAccount,
} from '@/app/iadmin/consorcios/[id]/cuentas/actions'

const KIND_OPTIONS: Array<{ value: IAdminCashAccountKind; label: string }> = [
  { value: 'bank', label: 'Banco' },
  { value: 'cash', label: 'Caja chica' },
  { value: 'reserve', label: 'Fondo de reserva' },
  { value: 'other', label: 'Otra' },
]

const KIND_LABELS: Record<IAdminCashAccountKind, string> = {
  bank: 'Banco',
  cash: 'Caja',
  reserve: 'Reserva',
  other: 'Otra',
}

type Props = {
  propertyId: string
  accounts: IAdminCashAccountWithBalance[]
  canManage: boolean
}

type AccountDraft = {
  name: string
  kind: IAdminCashAccountKind
  bankName: string
  accountNumber: string
  cbu: string
  alias: string
}

const emptyDraft: AccountDraft = {
  name: '',
  kind: 'bank',
  bankName: '',
  accountNumber: '',
  cbu: '',
  alias: '',
}

function accountToDraft(a: IAdminCashAccountWithBalance): AccountDraft {
  return {
    name: a.name,
    kind: a.kind,
    bankName: a.bankName ?? '',
    accountNumber: a.accountNumber ?? '',
    cbu: a.cbu ?? '',
    alias: a.alias ?? '',
  }
}

export function CashAccountsManager({ propertyId, accounts, canManage }: Props) {
  const [pending, startTransition] = useTransition()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<AccountDraft>(emptyDraft)

  function resetForm() {
    setDraft(emptyDraft)
    setCreating(false)
    setEditingId(null)
  }

  function submitAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.name.trim()) {
      toast.error('Nombre obligatorio')
      return
    }

    startTransition(async () => {
      try {
        if (editingId) {
          await updateCashAccount({
            accountId: editingId,
            name: draft.name,
            kind: draft.kind,
            bankName: draft.bankName || null,
            accountNumber: draft.accountNumber || null,
            cbu: draft.cbu || null,
            alias: draft.alias || null,
          })
          toast.success('Cuenta actualizada')
        } else {
          await createCashAccount({
            propertyId,
            name: draft.name,
            kind: draft.kind,
            bankName: draft.bankName || null,
            accountNumber: draft.accountNumber || null,
            cbu: draft.cbu || null,
            alias: draft.alias || null,
          })
          toast.success('Cuenta creada y activada')
        }
        resetForm()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Error')
      }
    })
  }

  function handleActivate(accountId: string) {
    startTransition(async () => {
      try {
        await setCashAccountActive({ accountId, isActive: true })
        toast.success('Cuenta marcada como activa')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Error')
      }
    })
  }

  function openEdit(a: IAdminCashAccountWithBalance) {
    setDraft(accountToDraft(a))
    setEditingId(a.id)
    setCreating(false)
  }

  const activeAccount = accounts.find((a) => a.isActive) ?? null

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border/40 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        Estas cuentas/CBU se usan para que los vecinos sepan dónde transferir.
        <b className="text-foreground"> Solo puede haber una activa por consorcio</b> — la activa se
        incluye automáticamente en el mensaje de cada liquidación.
      </div>

      {!activeAccount ? (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠ No hay ninguna cuenta activa. Cargá o activá una para poder emitir liquidaciones con
          datos de pago para los vecinos.
        </div>
      ) : null}

      {canManage && !creating && !editingId ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Nueva cuenta
          </Button>
        </div>
      ) : null}

      {(creating || editingId) && canManage ? (
        <form onSubmit={submitAccount} className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground">
              {editingId ? 'Editar cuenta' : 'Nueva cuenta'}
            </h3>
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={resetForm}>
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Banco Galicia - CC" required />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value as IAdminCashAccountKind })}
              >
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Banco</Label>
              <Input value={draft.bankName} onChange={(e) => setDraft({ ...draft, bankName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Nº de cuenta</Label>
              <Input value={draft.accountNumber} onChange={(e) => setDraft({ ...draft, accountNumber: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>CBU</Label>
              <Input value={draft.cbu} onChange={(e) => setDraft({ ...draft, cbu: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Alias</Label>
              <Input value={draft.alias} onChange={(e) => setDraft({ ...draft, alias: e.target.value })} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear y activar cuenta'}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="grid grid-cols-1 gap-3">
        {accounts.length === 0 ? (
          <div className="glass-card rounded-2xl px-5 py-12 text-center text-sm text-muted-foreground">
            No hay cuentas cargadas. {canManage ? 'Cargá la primera arriba.' : ''}
          </div>
        ) : (
          accounts.map((a) => (
            <div
              key={a.id}
              className={`glass-card rounded-2xl p-5 ${
                a.isActive ? 'border-2 border-emerald-300' : 'opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Banknote className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate flex items-center gap-2">
                      {a.name}
                      {a.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> activa
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {KIND_LABELS[a.kind]}
                      {a.bankName ? ` · ${a.bankName}` : ''}
                    </div>
                    {a.cbu || a.alias || a.accountNumber ? (
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {a.accountNumber ? `Cuenta: ${a.accountNumber} · ` : ''}
                        {a.cbu ? `CBU: ${a.cbu} · ` : ''}
                        {a.alias ? `Alias: ${a.alias}` : ''}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {canManage ? (
                <div className="mt-3 flex flex-wrap gap-2 justify-end">
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => openEdit(a)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" />
                    Editar
                  </Button>
                  {!a.isActive ? (
                    <Button size="sm" disabled={pending} onClick={() => handleActivate(a.id)}>
                      Marcar como activa
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
