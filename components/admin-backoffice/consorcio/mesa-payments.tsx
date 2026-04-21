'use client'

import { useMemo, useState, useTransition } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Money } from '@/components/admin-backoffice/shared/money'
import type { IAdminCashAccountWithBalance, IAdminMesaState } from '@/lib/types'

type Props = {
  state: IAdminMesaState
  cashAccounts: IAdminCashAccountWithBalance[]
  onPayQuick: (itemIdLookup: { unitId: string; amount: number }) => Promise<void>
  canRegister: boolean
}

type Filter = 'all' | 'pending' | 'paid'

export function MesaPayments({ state, cashAccounts, onPayQuick, canRegister }: Props) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [pending, startTransition] = useTransition()

  const activeAccount = cashAccounts.find((a) => a.isActive)

  const filtered = useMemo(() => {
    switch (filter) {
      case 'pending':
        return state.units.filter((u) => u.balance > 0.01)
      case 'paid':
        return state.units.filter((u) => u.subtotal > 0 && u.balance < 0.01)
      default:
        return state.units
    }
  }, [filter, state.units])

  function handleQuickPay(unitId: string, amount: number) {
    startTransition(async () => {
      try {
        await onPayQuick({ unitId, amount })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Error al registrar pago')
      }
    })
  }

  return (
    <section className="glass-card rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-4 border-b border-border/40 flex items-center justify-between hover:bg-muted/30"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
            <Wallet className="w-4 h-4 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-serif text-lg font-semibold text-foreground">Control de pagos</h3>
            <p className="text-xs text-muted-foreground">
              {state.collectionRatePct !== null
                ? `Cobrado ${state.collectionRatePct}% · ${state.totalCollected.toLocaleString('es-AR')} / ${(state.totalToDistribute + state.previousBalanceTotal).toLocaleString('es-AR')}`
                : 'Sin liquidación para cobrar todavía'}
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open ? (
        <>
          <div className="px-5 py-3 border-b border-border/40 flex items-center gap-2 flex-wrap">
            {(['all', 'pending', 'paid'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${
                  filter === f
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {f === 'all' ? `Todos (${state.units.length})` : f === 'pending' ? `Con saldo (${state.units.filter((u) => u.balance > 0.01).length})` : `Al día (${state.units.filter((u) => u.subtotal > 0 && u.balance < 0.01).length})`}
              </button>
            ))}
            <div className="flex-1" />
            {canRegister && !activeAccount ? (
              <span className="text-xs text-amber-700">Configurá una cuenta bancaria para registrar pagos</span>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase tracking-wider border-b border-border/40 bg-muted/20">
                  <th className="text-left px-4 py-2 font-medium">Unidad</th>
                  <th className="text-left px-4 py-2 font-medium">Titular</th>
                  <th className="text-right px-4 py-2 font-medium">Total</th>
                  <th className="text-right px-4 py-2 font-medium">Cobrado</th>
                  <th className="text-right px-4 py-2 font-medium">Saldo</th>
                  {canRegister ? <th className="px-2 py-2" /> : null}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Sin unidades para mostrar en este filtro.
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => {
                    const isPaid = u.subtotal > 0 && u.balance < 0.01
                    return (
                      <tr key={u.unitId} className="border-b border-border/20 last:border-0">
                        <td className="px-4 py-1.5 font-medium text-foreground flex items-center gap-1.5">
                          {u.unitCode}
                          {isPaid ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : null}
                        </td>
                        <td className="px-4 py-1.5 text-muted-foreground">{u.holderName ?? <span className="italic">—</span>}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums">
                          {u.subtotal > 0 ? u.subtotal.toLocaleString('es-AR') : '—'}
                        </td>
                        <td className="px-4 py-1.5 text-right tabular-nums text-emerald-700">
                          {u.collected > 0 ? u.collected.toLocaleString('es-AR') : '—'}
                        </td>
                        <td className={`px-4 py-1.5 text-right tabular-nums ${u.balance > 0 ? 'text-rose-700 font-medium' : 'text-muted-foreground'}`}>
                          {u.balance > 0 ? u.balance.toLocaleString('es-AR') : '✓'}
                        </td>
                        {canRegister ? (
                          <td className="px-2 py-1.5 text-right">
                            {u.balance > 0.01 && activeAccount && state.hasRun ? (
                              <Button
                                size="sm"
                                variant="default"
                                disabled={pending}
                                onClick={() => handleQuickPay(u.unitId, u.balance)}
                              >
                                {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Pagó'}
                              </Button>
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    )
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 font-medium">
                  <td colSpan={2} className="px-4 py-2">Total</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    <Money amount={state.totalToDistribute + state.previousBalanceTotal} />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-700">
                    <Money amount={state.totalCollected} />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-rose-700">
                    <Money amount={state.totalPending} />
                  </td>
                  {canRegister ? <td /> : null}
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : null}
    </section>
  )
}
