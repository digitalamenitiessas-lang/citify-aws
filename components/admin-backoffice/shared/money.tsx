export function Money({ amount, currency = 'ARS' }: { amount: number; currency?: string }) {
  const formatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return <span className="tabular-nums">{formatter.format(amount)}</span>
}
