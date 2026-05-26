import { requireProfile } from '@/lib/auth'
import {
  BOUNCE_RATE_WARN_THRESHOLD,
  COMPLAINT_RATE_WARN_THRESHOLD,
  getEmailHealthSummary,
  listTemplateHealth,
  listTopBouncingAddresses,
  type EmailHealthWindow,
} from '@/lib/db/email-metrics'

export const dynamic = 'force-dynamic'

const WINDOWS: ReadonlyArray<{ key: EmailHealthWindow; label: string }> = [
  { key: '24h', label: 'Últimas 24h' },
  { key: '7d', label: 'Últimos 7 días' },
  { key: '30d', label: 'Últimos 30 días' },
]

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

function fmtInt(value: number): string {
  return value.toLocaleString('es-AR')
}

export default async function EmailHealthPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>
}) {
  await requireProfile(['super_admin'])
  const params = await searchParams
  const windowParam = params.window
  const activeWindow: EmailHealthWindow =
    windowParam === '24h' || windowParam === '7d' || windowParam === '30d' ? windowParam : '7d'

  const [summary, topBouncing, templates] = await Promise.all([
    getEmailHealthSummary(activeWindow),
    listTopBouncingAddresses(20),
    listTemplateHealth(activeWindow),
  ])

  return (
    <div className="min-h-screen bg-background pt-20 pb-16">
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        <header className="glass-card rounded-2xl p-6">
          <p className="text-xs uppercase tracking-wider text-primary font-medium">SuperAdmin</p>
          <h1 className="font-serif text-2xl font-bold mt-1">Salud del canal email (SES)</h1>
          <p className="text-sm text-muted-foreground mt-1">
            SES suspende el sending si el bounce rate supera 5% o el complaint rate supera 0.1% en
            ventanas largas. Estos números vienen del log local de envíos
            (<code>public.email_events</code>), alimentado por <code>lib/email/send.ts</code> y el
            webhook SNS de SES. Para la alarma de AWS, ver{' '}
            <code>scripts/setup-ses-alarms.mjs</code>.
          </p>
        </header>

        <nav className="flex gap-2">
          {WINDOWS.map((w) => {
            const isActive = w.key === activeWindow
            return (
              <a
                key={w.key}
                href={`?window=${w.key}`}
                className={[
                  'rounded-lg px-3 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/15 text-foreground font-medium'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70',
                ].join(' ')}
              >
                {w.label}
              </a>
            )
          })}
        </nav>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Enviados" value={fmtInt(summary.totalSent)} />
          <Stat label="Delivered" value={fmtInt(summary.delivered)} />
          <Stat
            label="Bounce rate"
            value={fmtPct(summary.bounceRate)}
            sub={`${fmtInt(summary.bounced)} bounces`}
            tone={summary.bounceRateBreach ? 'danger' : summary.bounceRate >= BOUNCE_RATE_WARN_THRESHOLD * 0.5 ? 'warn' : 'ok'}
          />
          <Stat
            label="Complaint rate"
            value={fmtPct(summary.complaintRate)}
            sub={`${fmtInt(summary.complained)} quejas`}
            tone={summary.complaintRateBreach ? 'danger' : summary.complaintRate >= COMPLAINT_RATE_WARN_THRESHOLD * 0.5 ? 'warn' : 'ok'}
          />
        </section>

        {(summary.bounceRateBreach || summary.complaintRateBreach) && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
            <p className="font-medium text-red-200">
              Umbral interno superado en la ventana de {activeWindow}.
            </p>
            <ul className="mt-2 list-disc list-inside text-red-100/80">
              {summary.bounceRateBreach && (
                <li>
                  Bounce rate {fmtPct(summary.bounceRate)} ≥ {fmtPct(BOUNCE_RATE_WARN_THRESHOLD)}.
                  Revisar los addresses problemáticos abajo y considerar pausar campañas no
                  transaccionales.
                </li>
              )}
              {summary.complaintRateBreach && (
                <li>
                  Complaint rate {fmtPct(summary.complaintRate)} ≥{' '}
                  {fmtPct(COMPLAINT_RATE_WARN_THRESHOLD)}. Revisar contenido y opt-in.
                </li>
              )}
            </ul>
          </div>
        )}

        <section className="glass-card rounded-2xl p-6">
          <h2 className="font-serif text-lg font-bold">Por template</h2>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-2">Sin envíos en la ventana.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left py-2">Template</th>
                    <th className="text-right py-2">Enviados</th>
                    <th className="text-right py-2">Bounced</th>
                    <th className="text-right py-2">Quejas</th>
                    <th className="text-right py-2">Bounce rate</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((row) => (
                    <tr key={row.templateKey} className="border-t border-border/40">
                      <td className="py-2 font-mono text-xs">{row.templateKey}</td>
                      <td className="py-2 text-right">{fmtInt(row.totalSent)}</td>
                      <td className="py-2 text-right">{fmtInt(row.bounced)}</td>
                      <td className="py-2 text-right">{fmtInt(row.complained)}</td>
                      <td
                        className={[
                          'py-2 text-right tabular-nums',
                          row.bounceRate >= BOUNCE_RATE_WARN_THRESHOLD ? 'text-red-300 font-medium' : '',
                        ].join(' ')}
                      >
                        {fmtPct(row.bounceRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="glass-card rounded-2xl p-6">
          <h2 className="font-serif text-lg font-bold">Addresses con más bounces (últimos 30 días)</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Los hard bounces y las complaints ya activaron <code>profiles.email_blocked</code>,
            así que no reciben más mails. Esta lista sirve para revisar patrones.
          </p>
          {topBouncing.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-3">Sin bounces registrados.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left py-2">Email</th>
                    <th className="text-right py-2">Bounces</th>
                    <th className="text-left py-2">Último tipo</th>
                    <th className="text-left py-2">Último bounce</th>
                    <th className="text-left py-2">Bloqueado</th>
                  </tr>
                </thead>
                <tbody>
                  {topBouncing.map((row) => (
                    <tr key={row.toEmail} className="border-t border-border/40">
                      <td className="py-2 font-mono text-xs">{row.toEmail}</td>
                      <td className="py-2 text-right tabular-nums">{fmtInt(row.bouncedCount)}</td>
                      <td className="py-2">{row.lastBounceType ?? '—'}</td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {row.lastBouncedAt ? new Date(row.lastBouncedAt).toLocaleString('es-AR') : '—'}
                      </td>
                      <td className="py-2">
                        {row.emailBlocked ? (
                          <span className="rounded-full bg-red-500/20 text-red-300 px-2 py-0.5 text-xs">
                            sí
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">no</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  tone = 'ok',
}: {
  label: string
  value: string
  sub?: string
  tone?: 'ok' | 'warn' | 'danger'
}) {
  const toneClass =
    tone === 'danger' ? 'text-red-300' : tone === 'warn' ? 'text-amber-300' : 'text-foreground'
  return (
    <div className="glass-card rounded-2xl p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-serif text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}
