'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Banknote,
  Bell,
  BellRing,
  Building2,
  Home,
  Megaphone,
  MessageSquareText,
  Receipt,
  ScrollText,
  Wallet,
} from 'lucide-react'
import type { IAdminCapability } from '@/lib/types'

type NavItem = {
  href: string
  label: string
  icon: typeof Building2
  need: IAdminCapability
  matchPrefix?: string
  exact?: boolean
}

type NavGroup = {
  key: string
  label?: string
  items: NavItem[]
}

const NAV_GROUPS: ReadonlyArray<NavGroup> = [
  {
    key: 'home',
    items: [
      {
        href: '/iadmin',
        label: 'Inicio',
        icon: Home,
        need: 'portfolio.view',
        exact: true,
      },
    ],
  },
  {
    key: 'edificio',
    label: 'Edificio',
    items: [
      {
        href: '/iadmin/cartera',
        label: 'Cartera',
        icon: Building2,
        need: 'portfolio.view',
        matchPrefix: '/iadmin/cartera',
      },
    ],
  },
  {
    key: 'operacion',
    label: 'Operación del mes',
    items: [
      {
        href: '/iadmin/gastos',
        label: 'Gastos',
        icon: Receipt,
        need: 'expenses.view',
        matchPrefix: '/iadmin/gastos',
      },
      {
        href: '/iadmin/liquidaciones',
        label: 'Liquidaciones',
        icon: ScrollText,
        need: 'liquidations.view',
        matchPrefix: '/iadmin/liquidaciones',
      },
      {
        href: '/iadmin/cobranzas',
        label: 'Cobranzas',
        icon: Wallet,
        need: 'collections.view',
        matchPrefix: '/iadmin/cobranzas',
      },
    ],
  },
  {
    key: 'comunicacion',
    label: 'Comunicación',
    items: [
      {
        href: '/iadmin/comunicaciones',
        label: 'Comunicados',
        icon: Megaphone,
        need: 'communications.send',
        matchPrefix: '/iadmin/comunicaciones',
      },
      {
        href: '/iadmin/recordatorios',
        label: 'Recordatorios',
        icon: BellRing,
        need: 'reminders.generate',
        matchPrefix: '/iadmin/recordatorios',
      },
    ],
  },
  {
    key: 'vecinos',
    label: 'Vecinos',
    items: [
      {
        href: '/iadmin/expedientes',
        label: 'Reclamos',
        icon: MessageSquareText,
        need: 'consorcio.view',
        matchPrefix: '/iadmin/expedientes',
      },
    ],
  },
]

function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href
  if (item.matchPrefix) return pathname.startsWith(item.matchPrefix)
  return pathname === item.href
}

export function IAdminNav({ allowedCapabilities }: { allowedCapabilities: IAdminCapability[] }) {
  const pathname = usePathname() ?? ''
  const allowed = new Set(allowedCapabilities)

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => allowed.has(item.need)),
  })).filter((group) => group.items.length > 0)

  return (
    <nav className="flex flex-col gap-4 p-3">
      {visibleGroups.map((group) => (
        <div key={group.key} className="flex flex-col gap-0.5">
          {group.label ? (
            <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </div>
          ) : null}
          {group.items.map((item) => {
            const isActive = isItemActive(item, pathname)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                ].join(' ')}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

export function IAdminNotificationsBadge() {
  return (
    <button
      type="button"
      className="relative rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label="Notificaciones"
    >
      <Bell className="w-4 h-4" />
    </button>
  )
}

export function IAdminBalanceHint() {
  return (
    <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
      <Banknote className="w-3.5 h-3.5" />
      Cierre del periodo en curso
    </div>
  )
}
