'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileSpreadsheet, LayoutDashboard, Scale, Settings, Table, Wallet } from 'lucide-react'
import type { IAdminCapability } from '@/lib/types'

type SubNavItem = {
  key: string
  href: (propertyId: string) => string
  label: string
  icon: typeof LayoutDashboard
  need: IAdminCapability
  exact?: boolean
}

const ITEMS: SubNavItem[] = [
  {
    key: 'planilla',
    href: (id) => `/iadmin/consorcios/${id}`,
    label: 'Planilla del mes',
    icon: Table,
    need: 'consorcio.view',
    exact: true,
  },
  {
    key: 'dashboard',
    href: (id) => `/iadmin/consorcios/${id}/dashboard`,
    label: 'Dashboard',
    icon: LayoutDashboard,
    need: 'consorcio.view',
  },
  {
    key: 'gestion',
    href: (id) => `/iadmin/consorcios/${id}/gestion`,
    label: 'Gestion',
    icon: Settings,
    need: 'consorcio.view',
  },
  {
    key: 'cuentas',
    href: (id) => `/iadmin/consorcios/${id}/cuentas`,
    label: 'Cuentas',
    icon: Wallet,
    need: 'cash_accounts.view',
  },
  {
    key: 'conciliacion',
    href: (id) => `/iadmin/consorcios/${id}/conciliacion`,
    label: 'Conciliacion',
    icon: Scale,
    need: 'collections.register',
  },
  {
    key: 'importar',
    href: (id) => `/iadmin/consorcios/${id}/importar`,
    label: 'Importar',
    icon: FileSpreadsheet,
    need: 'units.manage',
  },
]

export function ConsorcioSubNav({
  propertyId,
  propertyName,
  propertyAddress,
  allowedCapabilities,
}: {
  propertyId: string
  propertyName: string
  propertyAddress: string
  allowedCapabilities: IAdminCapability[]
}) {
  const pathname = usePathname() ?? ''
  const allowed = new Set(allowedCapabilities)
  const visibleItems = ITEMS.filter((item) => allowed.has(item.need))

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-primary font-medium">Consorcio</p>
          <h1 className="font-serif text-xl font-bold text-foreground mt-0.5 truncate">{propertyName}</h1>
          {propertyAddress ? (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{propertyAddress}</p>
          ) : null}
        </div>
      </div>
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-border/40 pt-3">
        {visibleItems.map((item) => {
          const href = item.href(propertyId)
          const isActive = item.exact
            ? pathname === `/iadmin/consorcios/${propertyId}`
            : pathname.startsWith(href)
          const Icon = item.icon
          return (
            <Link
              key={item.key}
              href={href}
              className={[
                'shrink-0 px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2',
                isActive
                  ? 'bg-primary/10 text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              ].join(' ')}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
