'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  Banknote,
  BarChart3,
  Bell,
  BellRing,
  Building2,
  Check,
  ChevronDown,
  FileSpreadsheet,
  Home,
  LayoutDashboard,
  Megaphone,
  MessageSquareText,
  Receipt,
  Scale,
  ScrollText,
  Search,
  Settings2,
  Table,
  Wallet,
} from 'lucide-react'
import type { IAdminCapability } from '@/lib/types'
import type { SwitcherProperty } from './consorcio-switcher'

const CURRENT_PROPERTY_COOKIE = 'currentPropertyId'

type NavItem = {
  href: string
  label: string
  icon: typeof Building2
  need: IAdminCapability
  matchPrefix?: string
  exact?: boolean
}

type Props = {
  administrationName: string
  operationalRole: string | null
  allowedCapabilities: IAdminCapability[]
  properties: SwitcherProperty[]
  cookiePropertyId: string | null
}

function setCurrentPropertyCookie(propertyId: string) {
  if (typeof document === 'undefined') return
  const maxAge = 60 * 60 * 24 * 90
  document.cookie = `${CURRENT_PROPERTY_COOKIE}=${encodeURIComponent(propertyId)}; path=/; max-age=${maxAge}; SameSite=Lax`
}

const GLOBAL_ITEMS: ReadonlyArray<NavItem> = [
  { href: '/iadmin', label: 'Inicio', icon: Home, need: 'portfolio.view', exact: true },
  { href: '/iadmin/cartera', label: 'Cartera', icon: LayoutDashboard, need: 'portfolio.view', matchPrefix: '/iadmin/cartera' },
  { href: '/iadmin/gastos', label: 'Gastos', icon: Receipt, need: 'expenses.view', matchPrefix: '/iadmin/gastos' },
  { href: '/iadmin/liquidaciones', label: 'Liquidaciones', icon: ScrollText, need: 'liquidations.view', matchPrefix: '/iadmin/liquidaciones' },
  { href: '/iadmin/cobranzas', label: 'Cobranzas', icon: Wallet, need: 'collections.view', matchPrefix: '/iadmin/cobranzas' },
  { href: '/iadmin/comunicaciones', label: 'Comunicados', icon: Megaphone, need: 'communications.send', matchPrefix: '/iadmin/comunicaciones' },
  { href: '/iadmin/recordatorios', label: 'Recordatorios', icon: BellRing, need: 'reminders.generate', matchPrefix: '/iadmin/recordatorios' },
  { href: '/iadmin/expedientes', label: 'Reclamos', icon: MessageSquareText, need: 'consorcio.view', matchPrefix: '/iadmin/expedientes' },
]

type ConsorcioItem = {
  key: string
  label: string
  icon: typeof Table
  hrefFor: (propertyId: string) => string
  matchFor: (propertyId: string) => string
  exact?: boolean
}

const CONSORCIO_ITEMS: ReadonlyArray<ConsorcioItem> = [
  {
    key: 'mesa',
    label: 'Mesa del mes',
    icon: Table,
    hrefFor: (id) => `/iadmin/consorcios/${id}`,
    matchFor: (id) => `/iadmin/consorcios/${id}`,
    exact: true,
  },
  {
    key: 'gestion',
    label: 'Datos y unidades',
    icon: Building2,
    hrefFor: (id) => `/iadmin/consorcios/${id}/gestion`,
    matchFor: (id) => `/iadmin/consorcios/${id}/gestion`,
  },
  {
    key: 'cuentas',
    label: 'Cuentas / CBU',
    icon: Banknote,
    hrefFor: (id) => `/iadmin/consorcios/${id}/cuentas`,
    matchFor: (id) => `/iadmin/consorcios/${id}/cuentas`,
  },
  {
    key: 'conciliacion',
    label: 'Conciliación',
    icon: Scale,
    hrefFor: (id) => `/iadmin/consorcios/${id}/conciliacion`,
    matchFor: (id) => `/iadmin/consorcios/${id}/conciliacion`,
  },
  {
    key: 'importar',
    label: 'Importar',
    icon: FileSpreadsheet,
    hrefFor: (id) => `/iadmin/consorcios/${id}/importar`,
    matchFor: (id) => `/iadmin/consorcios/${id}/importar`,
  },
  {
    key: 'dashboard',
    label: 'Reportes',
    icon: BarChart3,
    hrefFor: (id) => `/iadmin/consorcios/${id}/dashboard`,
    matchFor: (id) => `/iadmin/consorcios/${id}/dashboard`,
  },
]

function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href
  if (item.matchPrefix) return pathname.startsWith(item.matchPrefix)
  return pathname === item.href
}

export function IAdminSidebar({
  administrationName,
  operationalRole,
  allowedCapabilities,
  properties,
  cookiePropertyId,
}: Props) {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const allowed = useMemo(() => new Set(allowedCapabilities), [allowedCapabilities])

  // Active property: URL > cookie > primer disponible.
  const urlMatch = pathname.match(/^\/iadmin\/consorcios\/([^/]+)/)
  const urlPropertyId = urlMatch ? urlMatch[1] : null
  const activeFromUrl = urlPropertyId
    ? properties.find((p) => p.id === urlPropertyId)
    : null
  const activeFromCookie = cookiePropertyId
    ? properties.find((p) => p.id === cookiePropertyId)
    : null
  const activeProperty = activeFromUrl ?? activeFromCookie ?? properties[0] ?? null

  // Switcher state
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [query, setQuery] = useState('')
  const switcherRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!switcherOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSwitcherOpen(false)
    }
    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKey)
    }
  }, [switcherOpen])

  function pickProperty(propertyId: string) {
    setCurrentPropertyCookie(propertyId)
    setSwitcherOpen(false)
    setQuery('')

    // Si estoy dentro de un consorcio, saltar al mismo path del nuevo.
    const consorcioPathMatch = pathname.match(/^\/iadmin\/consorcios\/[^/]+(\/.*)?$/)
    if (consorcioPathMatch) {
      const suffix = consorcioPathMatch[1] ?? ''
      router.push(`/iadmin/consorcios/${propertyId}${suffix}`)
    } else {
      router.refresh()
    }
  }

  const normalizedQuery = query.trim().toLowerCase()
  const filteredProperties = normalizedQuery
    ? properties.filter((p) => {
        const name = (p.displayName ?? p.buildingName ?? '').toLowerCase()
        const addr = (p.buildingAddress ?? '').toLowerCase()
        return name.includes(normalizedQuery) || addr.includes(normalizedQuery)
      })
    : properties

  const visibleGlobalItems = GLOBAL_ITEMS.filter((item) => allowed.has(item.need))
  const showConsorcioBlock = activeProperty && allowed.has('consorcio.view')

  return (
    <div className="glass-card rounded-2xl flex flex-col overflow-hidden">
      {/* ───── Workspace switcher ───── */}
      <div ref={switcherRef} className="relative border-b border-border/40">
        <button
          type="button"
          onClick={() => setSwitcherOpen((v) => !v)}
          className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors"
          aria-haspopup="listbox"
          aria-expanded={switcherOpen}
        >
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-primary font-medium">
            <Building2 className="w-3 h-3" />
            Administración
          </div>
          <div className="flex items-start justify-between gap-2 mt-1">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">
                {administrationName}
              </div>
              {operationalRole ? (
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {operationalRole}
                </div>
              ) : null}
            </div>
            {properties.length > 1 ? (
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${switcherOpen ? 'rotate-180' : ''}`}
              />
            ) : null}
          </div>
        </button>

        {switcherOpen && properties.length > 1 ? (
          <div className="absolute left-2 right-2 top-full mt-1 z-40 rounded-xl border border-border/60 bg-background shadow-xl overflow-hidden">
            <div className="border-b border-border/40 p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar consorcio…"
                  className="w-full rounded-md border border-border/50 bg-background pl-8 pr-2 py-1.5 text-sm focus:outline-none focus:border-primary/50"
                  autoFocus
                />
              </div>
            </div>
            <ul className="max-h-72 overflow-y-auto p-1">
              {filteredProperties.length === 0 ? (
                <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                  Sin resultados
                </li>
              ) : (
                filteredProperties.map((p) => {
                  const isActive = p.id === activeProperty?.id
                  const name = p.displayName ?? p.buildingName
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => pickProperty(p.id)}
                        className={`w-full text-left flex items-start gap-2 rounded-md px-2.5 py-2 text-sm transition-colors ${
                          isActive ? 'bg-primary/10' : 'hover:bg-muted/60'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-foreground truncate">{name}</div>
                          {p.buildingAddress ? (
                            <div className="text-xs text-muted-foreground truncate">{p.buildingAddress}</div>
                          ) : null}
                        </div>
                        {isActive ? <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-1" /> : null}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        ) : null}
      </div>

      {/* ───── Global / Cartera ───── */}
      <div className="flex flex-col gap-0.5 p-3">
        <SectionLabel>Cartera global</SectionLabel>
        {visibleGlobalItems.map((item) => {
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

      {/* ───── Consorcio activo ───── */}
      {showConsorcioBlock && activeProperty ? (
        <div className="border-t border-border/40 flex flex-col gap-0.5 p-3 bg-primary/[0.03]">
          <SectionLabel>Edificio activo</SectionLabel>
          <div className="px-3 pb-1">
            <div className="text-sm font-semibold text-foreground truncate">
              {activeProperty.displayName ?? activeProperty.buildingName}
            </div>
            {activeProperty.buildingAddress ? (
              <div className="text-[10px] text-muted-foreground truncate">
                {activeProperty.buildingAddress}
              </div>
            ) : null}
          </div>
          {CONSORCIO_ITEMS.map((item) => {
            const href = item.hrefFor(activeProperty.id)
            const matchPath = item.matchFor(activeProperty.id)
            const isActive = item.exact ? pathname === matchPath : pathname.startsWith(matchPath)
            const Icon = item.icon
            return (
              <Link
                key={item.key}
                href={href}
                className={[
                  'flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/15 text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                ].join(' ')}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </Link>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
      {children}
    </div>
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

// re-export por compat con imports antiguos del shell
export { Settings2 as _SettingsIcon }
