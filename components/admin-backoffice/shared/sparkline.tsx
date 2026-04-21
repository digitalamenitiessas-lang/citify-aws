'use client'

type Props = {
  values: Array<number | null>
  width?: number
  height?: number
  strokeClass?: string
  fillClass?: string
  dotLastClass?: string
  ariaLabel?: string
}

/**
 * Mini-gráfico de línea SVG, sin dependencias.
 * Los `null` se dibujan como gaps. El último punto se resalta si no es null.
 */
export function Sparkline({
  values,
  width = 72,
  height = 18,
  strokeClass = 'stroke-primary',
  fillClass = 'fill-primary/10',
  dotLastClass = 'fill-primary',
  ariaLabel,
}: Props) {
  const numeric = values.map((v) => (v === null || !Number.isFinite(v) ? null : v))
  const nonNull = numeric.filter((v): v is number => v !== null)
  if (nonNull.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="shrink-0"
        aria-label={ariaLabel ?? 'Sin suficientes datos'}
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          className="stroke-muted-foreground/30"
          strokeDasharray="2 3"
          strokeWidth={1}
        />
      </svg>
    )
  }

  const min = Math.min(...nonNull)
  const max = Math.max(...nonNull)
  const range = max - min || 1
  const stepX = values.length > 1 ? width / (values.length - 1) : 0
  const padding = 2

  const points: Array<{ x: number; y: number } | null> = numeric.map((v, i) => {
    if (v === null) return null
    const x = i * stepX
    const y = padding + (1 - (v - min) / range) * (height - padding * 2)
    return { x, y }
  })

  // Segmentos continuos (saltamos null)
  const segments: string[] = []
  let current: Array<{ x: number; y: number }> = []
  for (const p of points) {
    if (p === null) {
      if (current.length >= 2) segments.push(pathFrom(current))
      current = []
    } else {
      current.push(p)
    }
  }
  if (current.length >= 2) segments.push(pathFrom(current))

  // Fill (área bajo la curva) del ÚLTIMO segmento sólo, para no ensuciar
  const last = current.length >= 2 ? current : null
  const fillPath = last
    ? `${pathFrom(last)} L ${last[last.length - 1].x} ${height} L ${last[0].x} ${height} Z`
    : null

  const lastPoint = points[points.length - 1]

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
      aria-label={ariaLabel}
    >
      {fillPath ? <path d={fillPath} className={fillClass} /> : null}
      {segments.map((d, i) => (
        <path key={i} d={d} className={strokeClass} fill="none" strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {lastPoint ? <circle cx={lastPoint.x} cy={lastPoint.y} r={1.8} className={dotLastClass} /> : null}
    </svg>
  )
}

function pathFrom(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ''
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
}
