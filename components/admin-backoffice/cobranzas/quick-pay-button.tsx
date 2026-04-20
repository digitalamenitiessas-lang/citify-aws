'use client'

import { useTransition } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { IAdminCashAccountWithBalance } from '@/lib/types'
import { registerCollection } from '@/app/iadmin/cobranzas/actions'

type Props = {
  itemId: string
  balanceRemaining: number
  defaultAccount: Pick<IAdminCashAccountWithBalance, 'id' | 'name'> | null
  onEditClick?: () => void
}

/**
 * Registra un pago "por default" con 1 click:
 * - monto = saldo pendiente
 * - cuenta = primera activa del consorcio
 * - fecha = hoy
 * - metodo = transferencia
 *
 * Si el admin quiere editar detalles, usa onEditClick -> abre el form completo.
 */
export function QuickPayButton({ itemId, balanceRemaining, defaultAccount, onEditClick }: Props) {
  const [pending, startTransition] = useTransition()

  if (!defaultAccount) {
    return (
      <div className="text-[10px] text-amber-700 whitespace-nowrap">
        Sin cuenta activa
      </div>
    )
  }

  function handleQuickPay() {
    if (!defaultAccount) return
    startTransition(async () => {
      try {
        const { receiptNumber } = await registerCollection({
          liquidationItemId: itemId,
          cashAccountId: defaultAccount.id,
          amount: balanceRemaining,
          paidAt: new Date().toISOString().slice(0, 10),
          method: 'transferencia',
        })
        toast.success(`Pago registrado · Recibo ${receiptNumber}`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Error al registrar')
      }
    })
  }

  return (
    <div className="flex gap-1 whitespace-nowrap">
      <Button
        size="sm"
        variant="default"
        disabled={pending}
        onClick={handleQuickPay}
        title={`Marcar pagado · ${defaultAccount.name}`}
      >
        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
        Pagó
      </Button>
      {onEditClick ? (
        <Button size="sm" variant="ghost" onClick={onEditClick} title="Editar detalles del pago">
          …
        </Button>
      ) : null}
    </div>
  )
}
