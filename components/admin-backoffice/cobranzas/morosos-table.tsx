'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { MorosoUnitRow } from '@/lib/db/iadmin-reads'
import { Money } from '@/components/admin-backoffice/shared/money'

function fmtDateAr(s: string | null): string {
  if (!s) return '—'
  // s viene 'YYYY-MM-DD'. Lo mostramos dd/mm/yyyy sin pasar por Date para
  // evitar drift de timezone.
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return s
  return `${m[3]}/${m[2]}/${m[1]}`
}

function daysAgo(s: string | null): number | null {
  if (!s) return null
  const d = new Date(s + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - d.getTime()) / 86_400_000)
}

export function MorososTable({ rows }: { rows: MorosoUnitRow[] }) {
  const [search, setSearch] = useState('')
  const [propertyFilter, setPropertyFilter] = useState('')

  const properties = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows) {
      const label = r.property_display_name?.trim() || r.building_name || '—'
      map.set(r.managed_property_id, label)
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }))
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (propertyFilter && r.managed_property_id !== propertyFilter) return false
      if (!q) return true
      const hay = `${r.unit_code} ${r.holder_name ?? ''} ${r.building_name ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [rows, search, propertyFilter])

  if (rows.length === 0) {
    return (
      <div className="glass-card rounded-2xl px-5 py-12 text-center text-sm text-muted-foreground">
        Sin unidades con saldo pendiente. Buen trabajo 🎉
      </div>
    )
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="p-3 border-b border-border/40 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por unidad o nombre…"
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-input bg-background"
          />
        </div>
        {properties.length > 1 ? (
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            <option value="">Todos los consorcios</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        ) : null}
        <span className="text-xs text-muted-foreground ml-1">
          {filtered.length} de {rows.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Unidad</th>
              <th className="text-left px-3 py-2 font-medium">Titular</th>
              <th className="text-right px-3 py-2 font-medium">Total</th>
              <th className="text-right px-3 py-2 font-medium">Al día</th>
              <th className="text-right px-3 py-2 font-medium">0-30</th>
              <th className="text-right px-3 py-2 font-medium">31-60</th>
              <th className="text-right px-3 py-2 font-medium">61-90</th>
              <th className="text-right px-3 py-2 font-medium">+90</th>
              <th className="text-left px-3 py-2 font-medium">Venc. más viejo</th>
              <th className="text-left px-3 py-2 font-medium">Último pago</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const overdueDays = daysAgo(r.oldest_due_date)
              const severity =
                overdueDays === null || overdueDays < 0
                  ? 'normal'
                  : overdueDays > 90
                    ? 'heavy'
                    : overdueDays > 30
                      ? 'mid'
                      : 'low'
              return (
                <tr key={r.unit_id} className="border-t border-border/40 hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <div className="font-medium text-foreground">{r.unit_code}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.property_display_name?.trim() || r.building_name}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-foreground">{r.holder_name ?? '—'}</div>
                    {r.holder_phone ? (
                      <div className="text-xs text-muted-foreground">{r.holder_phone}</div>
                    ) : null}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-semibold ${
                      severity === 'heavy'
                        ? 'text-rose-700'
                        : severity === 'mid'
                          ? 'text-orange-700'
                          : severity === 'low'
                            ? 'text-amber-700'
                            : 'text-foreground'
                    }`}
                  >
                    <Money amount={Number(r.total_balance)} />
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {Number(r.bucket_current) > 0 ? (
                      <Money amount={Number(r.bucket_current)} />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {Number(r.bucket_0_30) > 0 ? <Money amount={Number(r.bucket_0_30)} /> : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-amber-700">
                    {Number(r.bucket_31_60) > 0 ? <Money amount={Number(r.bucket_31_60)} /> : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-orange-700">
                    {Number(r.bucket_61_90) > 0 ? <Money amount={Number(r.bucket_61_90)} /> : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-rose-700 font-medium">
                    {Number(r.bucket_over_90) > 0 ? (
                      <Money amount={Number(r.bucket_over_90)} />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-foreground">{fmtDateAr(r.oldest_due_date)}</div>
                    {overdueDays !== null && overdueDays > 0 ? (
                      <div className="text-xs text-muted-foreground">hace {overdueDays} días</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {fmtDateAr(r.last_payment_at?.slice(0, 10) ?? null)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
