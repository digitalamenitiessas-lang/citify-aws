import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { toneStyles, type Tone } from './brand'

/**
 * Tarjeta de numero del panel (Inicio y Cobranzas).
 *
 * El chip del icono lleva el color del estado (verde bien, ambar atencion, rojo
 * problema) y, sin estado, el tinte naranja de la marca: el color suma informacion
 * ademas de identidad. Antes cada pantalla tenia su propia copia identica de
 * esta tarjeta, con el icono gris.
 */
export function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  href,
  compact = false,
}: {
  icon: LucideIcon
  label: string
  value: React.ReactNode
  hint?: string
  tone?: Tone
  href?: string
  /** Numero un poco mas chico, para grillas densas. */
  compact?: boolean
}) {
  const t = toneStyles(tone)
  const className = `glass-card rounded-2xl p-4 ${
    href ? 'hover:ring-1 hover:ring-primary/40 transition-all cursor-pointer' : ''
  }`

  const body = (
    <>
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${t.chip}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div
        className={`mt-3 font-serif font-bold tabular-nums leading-none ${compact ? 'text-xl' : 'text-2xl'} ${t.value}`}
      >
        {value}
      </div>
      {hint ? <div className="text-xs text-muted-foreground mt-2">{hint}</div> : null}
    </>
  )

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}
