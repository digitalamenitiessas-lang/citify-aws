// Ciro: el asistente de Citify.
//
// Su avatar es el isotipo de la marca (la C con las barras de los edificios).
// Las dos barras de la derecha son su "voz": cuando Ciro piensa o escribe,
// laten una despues de la otra, como una señal que sale de la C. Trazos
// copiados de public/citify-isotipo.svg (capa naranja), en currentColor.
//
// Mismo diseño que Cori, el asistente de Countrify (countrify-aws,
// components/ai/cori-avatar.tsx), con la marca de Citify.

// La C con la primera barra pegada: queda fija.
const C_SHAPE =
  'M188.78,548.51c25.9,27.47,55.98,49.07,90.44,63.89l.06-95.87,96.08-78.32.02,312.8c-94.37-1.61-184.86-38.42-254.54-102.22C38.34,573.25-5.83,464.39.62,352.46,9.84,185.5,131.15,45.84,293.73,9.58c74.9-16.71,150.91-11.81,222.15,16.69,50.24,20.1,95,50.23,132.08,89.92l-95.85,76.57c-20.3-17.96-42.28-33.09-67.1-44.9-40.61-19.14-84.25-26.94-129.17-22.95-36.97,3.28-71.78,13.86-104.19,31.62-73.18,40.11-122.61,114.64-129.95,198.06-6.27,71.2,18.68,141.06,67.1,193.93Z'

// La barra alta del medio: late primero.
const BAR_TALL = 'M424.14,750.67l-.03-452.83,100.38-81.83.03,514.77c-32.07,10.71-64.77,17.37-100.38,19.89Z'

const BAR_RIGHT = 'M683.82,631.37c-30.86,31.38-66.32,57.24-105.42,77.49l.04-302.34,105.28,89.59.11,135.26Z'

/** El isotipo solo, en `currentColor`. `active` hace latir las barras. */
export function CiroMark({ className, active = false }: { className?: string; active?: boolean }) {
  return (
    <svg viewBox="0 0 683.82 751.02" fill="currentColor" aria-hidden="true" className={className}>
      <path d={C_SHAPE} />
      <path d={BAR_TALL} className={active ? 'ciro-wave' : undefined} />
      <path d={BAR_RIGHT} className={active ? 'ciro-wave ciro-wave-late' : undefined} />
    </svg>
  )
}

const SIZES = {
  sm: { box: 'h-7 w-7', mark: 'h-4 w-4' },
  md: { box: 'h-9 w-9', mark: 'h-5 w-5' },
  lg: { box: 'h-14 w-14', mark: 'h-8 w-8' },
} as const

/**
 * Ciro en su circulo: tinte naranja de la marca con el isotipo en naranja. Se
 * ve igual en tema claro y oscuro, como cualquier logo.
 */
export function CiroAvatar({
  size = 'md',
  active = false,
  className = '',
}: {
  size?: keyof typeof SIZES
  active?: boolean
  className?: string
}) {
  const s = SIZES[size]
  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-full bg-[var(--citify-blush)] text-[var(--citify-terracotta)] ${s.box} ${className}`}
    >
      <CiroMark className={s.mark} active={active} />
    </div>
  )
}
