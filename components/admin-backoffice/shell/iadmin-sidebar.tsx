'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'
import {
  Banknote,
  BarChart3,
  Building2,
  FileSpreadsheet,
  Home,
  Megaphone,
  MessageSquareText,
  Receipt,
  StickyNote,
  Table,
  Users,
  Wallet,
} from 'lucide-react'
import { isIAdminSectionOn, type IAdminSection } from '@/lib/features'
import type { IAdminCapability } from '@/lib/types'
import type { SwitcherProperty } from './consorcio-switcher'
import {
  NAV_ACTIVE,
  NAV_CARD,
  NAV_EYEBROW,
  NAV_GROUP,
  NAV_GROUP_DOT,
  NAV_GROUP_LABEL,
  NAV_IDLE,
} from '../shared/brand'

type NavItem = {
  href: string
  label: string
  icon: typeof Building2
  need: IAdminCapability
  /** Seccion del interruptor (lib/features.ts). Sin seccion = siempre visible. */
  section?: IAdminSection
  matchPrefix?: string
  /** Otras paginas en las que el item queda marcado como activo. */
  alsoActive?: RegExp
  exact?: boolean
}

type Props = {
  administrationName: string
  allowedCapabilities: IAdminCapability[]
  properties: SwitcherProperty[]
  cookiePropertyId: string | null
}

// Nav global simplificado: solo lo que tiene sentido cross-cartera.
// Cartera se sacó porque Inicio ya muestra el resumen consolidado.
// Liquidaciones y Recordatorios viven dentro de Mesa del mes de cada edificio.
// Cada item con `section` aparece solo si esa seccion esta prendida.
const GLOBAL_ITEMS: ReadonlyArray<NavItem> = [
  { href: '/iadmin', label: 'Inicio', icon: Home, need: 'portfolio.view', exact: true },
  { href: '/iadmin/pizarra', label: 'Pizarra de quejas', icon: StickyNote, need: 'consorcio.view', section: 'pizarra', matchPrefix: '/iadmin/pizarra' },
  { href: '/iadmin/comunicaciones', label: 'Comunicados', icon: Megaphone, need: 'communications.send', section: 'comunicados', matchPrefix: '/iadmin/comunicaciones' },
  { href: '/iadmin/vecinos', label: 'Vecinos', icon: Users, need: 'consorcio.view', section: 'vecinos', matchPrefix: '/iadmin/vecinos', alsoActive: /^\/iadmin\/consorcios\/[^/]+\/vecinos-masivo/ },
  { href: '/iadmin/gastos', label: 'Gastos', icon: Receipt, need: 'expenses.view', section: 'gastos', matchPrefix: '/iadmin/gastos' },
  { href: '/iadmin/cobranzas', label: 'Cobranzas', icon: Wallet, need: 'collections.view', section: 'cobranzas', matchPrefix: '/iadmin/cobranzas' },
  { href: '/iadmin/expedientes', label: 'Reclamos', icon: MessageSquareText, need: 'consorcio.view', section: 'reclamos', matchPrefix: '/iadmin/expedientes' },
]

type ConsorcioItem = {
  key: string
  section: IAdminSection
  label: string
  icon: typeof Table
  hrefFor: (id: string) => string
  matchFor: (id: string) => string
  exact?: boolean
}

const CONSORCIO_ITEMS: ReadonlyArray<ConsorcioItem> = [
  {
    key: 'mesa',
    section: 'mesaDelMes',
    label: 'Mesa del mes',
    icon: Table,
    hrefFor: (id) => `/iadmin/consorcios/${id}`,
    matchFor: (id) => `/iadmin/consorcios/${id}`,
    exact: true,
  },
  {
    key: 'gestion',
    section: 'datosYUnidades',
    label: 'Datos y unidades',
    icon: Building2,
    hrefFor: (id) => `/iadmin/consorcios/${id}/gestion`,
    matchFor: (id) => `/iadmin/consorcios/${id}/gestion`,
  },
  {
    key: 'cuentas',
    section: 'cuentas',
    label: 'Cuentas / CBU',
    icon: Banknote,
    hrefFor: (id) => `/iadmin/consorcios/${id}/cuentas`,
    matchFor: (id) => `/iadmin/consorcios/${id}/cuentas`,
  },
  {
    key: 'importar',
    section: 'importar',
    label: 'Importar',
    icon: FileSpreadsheet,
    hrefFor: (id) => `/iadmin/consorcios/${id}/importar`,
    matchFor: (id) => `/iadmin/consorcios/${id}/importar`,
  },
  {
    key: 'dashboard',
    section: 'reportes',
    label: 'Reportes',
    icon: BarChart3,
    hrefFor: (id) => `/iadmin/consorcios/${id}/dashboard`,
    matchFor: (id) => `/iadmin/consorcios/${id}/dashboard`,
  },
]

function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.alsoActive?.test(pathname)) return true
  if (item.exact) return pathname === item.href
  if (item.matchPrefix) return pathname.startsWith(item.matchPrefix)
  return pathname === item.href
}

export function IAdminSidebar({
  administrationName,
  allowedCapabilities,
  properties,
  cookiePropertyId,
}: Props) {
  const pathname = usePathname() ?? ''
  const allowed = useMemo(() => new Set(allowedCapabilities), [allowedCapabilities])

  // Active property: URL > cookie > (si hay un solo edificio, ese) > null.
  // "all" en cookie → ningún edificio activo (vista consolidada).
  const urlMatch = pathname.match(/^\/iadmin\/consorcios\/([^/]+)/)
  const urlPropertyId = urlMatch ? urlMatch[1] : null
  const isAllCookie = cookiePropertyId === 'all'
  const activeFromUrl = urlPropertyId
    ? properties.find((p) => p.id === urlPropertyId)
    : null
  const activeFromCookie =
    !isAllCookie && cookiePropertyId
      ? properties.find((p) => p.id === cookiePropertyId)
      : null
  // Si el admin solo tiene un edificio, ese es el active por default.
  const singleProperty = properties.length === 1 ? properties[0] : null
  const activeProperty = activeFromUrl ?? activeFromCookie ?? singleProperty ?? null

  const visibleGlobalItems = GLOBAL_ITEMS.filter(
    (item) => allowed.has(item.need) && (!item.section || isIAdminSectionOn(item.section)),
  )
  const visibleConsorcioItems = CONSORCIO_ITEMS.filter((item) => isIAdminSectionOn(item.section))
  const showConsorcioBlock =
    activeProperty && allowed.has('consorcio.view') && visibleConsorcioItems.length > 0

  // Negro de la marca con el activo en naranja (ver NAV_* en shared/brand.ts).
  return (
    <div className={NAV_CARD}>
      {/* Brand mínima (sin switcher; el switcher vive en el header) */}
      <div className="px-3 pb-2 pt-1">
        <div className={NAV_EYEBROW}>Backoffice</div>
        <div className="text-sm font-semibold text-white truncate mt-0.5">
          {administrationName}
        </div>
      </div>

      {/* Global / Cartera */}
      <nav className="flex flex-col gap-px">
        {visibleGlobalItems.map((item) => {
          const isActive = isItemActive(item, pathname)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] transition-colors',
                isActive ? NAV_ACTIVE : NAV_IDLE,
              ].join(' ')}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Edificio activo — compacto, sin re-mostrar nombre (ya está en header) */}
      {showConsorcioBlock && activeProperty ? (
        <>
          <div className={NAV_GROUP}>
            <div className={NAV_GROUP_DOT} />
            <div className={NAV_GROUP_LABEL}>
              {activeProperty.displayName ?? activeProperty.buildingName}
            </div>
          </div>
          <nav className="flex flex-col gap-px mt-0.5">
            {visibleConsorcioItems.map((item) => {
              const href = item.hrefFor(activeProperty.id)
              const matchPath = item.matchFor(activeProperty.id)
              const isActive = item.exact ? pathname === matchPath : pathname.startsWith(matchPath)
              const Icon = item.icon
              return (
                <Link
                  key={item.key}
                  href={href}
                  className={[
                    'flex items-center gap-2.5 rounded-md pl-6 pr-3 py-1 text-[12.5px] transition-colors',
                    isActive ? NAV_ACTIVE : NAV_IDLE,
                  ].join(' ')}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </>
      ) : null}
    </div>
  )
}
