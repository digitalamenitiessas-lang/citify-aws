'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Home,
  Mail,
  MapPin,
  Phone,
  Shield,
  Tag,
  TrendingUp,
  User,
  Users,
} from 'lucide-react'
import { ROLE_LABELS } from '@/lib/constants'
import { ChatWidget } from '@/components/ai/chat-widget'
import type {
  SuperAdminBuildingDetail,
  SuperAdminBusinessDetail,
  SuperAdminDashboardData,
  SuperAdminPromotionDetail,
} from '@/lib/types'

type TabType = 'overview' | 'buildings' | 'users' | 'businesses' | 'promotions'

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon }: { label: string; value: number; sub: string; icon: typeof Shield }) {
  return (
    <div className="glass-card rounded-xl p-5">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
        style={{ background: 'rgba(156,156,156,0.15)', border: '1px solid rgba(0,0,0,0.06)' }}
      >
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-sm text-foreground mt-0.5">{label}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ children, color = 'default' }: { children: React.ReactNode; color?: 'default' | 'primary' | 'success' | 'warn' }) {
  const styles: Record<string, string> = {
    default: 'bg-muted text-muted-foreground',
    primary: 'text-white',
    success: 'bg-green-100 text-green-700',
    warn: 'bg-amber-100 text-amber-700',
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[color]}`}
      style={color === 'primary' ? { background: 'linear-gradient(135deg, #B85C38, #8F4020)' } : {}}
    >
      {children}
    </span>
  )
}

// ─── Section Header with optional back ───────────────────────────────────────
function SectionHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
      )}
      <div>
        <h2 className="font-bold text-foreground text-lg leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ─── Occupancy bar ────────────────────────────────────────────────────────────
function OccupancyBar({ rate }: { rate: number }) {
  const color = rate >= 80 ? '#22c55e' : rate >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(rate, 100)}%`, background: color }} />
      </div>
      <span className="text-xs font-medium text-muted-foreground w-9 text-right">{rate}%</span>
    </div>
  )
}

// ─── CONSORCIOS LIST ──────────────────────────────────────────────────────────
function BuildingsList({
  buildings,
  onSelect,
}: {
  buildings: SuperAdminBuildingDetail[]
  onSelect: (b: SuperAdminBuildingDetail) => void
}) {
  return (
    <div>
      <SectionHeader
        title="Consorcios"
        subtitle={`${buildings.length} edificio${buildings.length !== 1 ? 's' : ''} adherido${buildings.length !== 1 ? 's' : ''}`}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {buildings.map((building) => (
          <button
            key={building.id}
            onClick={() => onSelect(building)}
            className="glass-card glass-card-hover rounded-xl p-5 text-left group transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(156,156,156,0.15)', border: '1px solid rgba(0,0,0,0.06)' }}
                >
                  <Home className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                    {building.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {building.address}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-foreground">{building.totalUnits}</div>
                <div className="text-xs text-muted-foreground">Unidades</div>
              </div>
              <div>
                <div className="text-lg font-bold text-foreground">{building.registeredNeighbors}</div>
                <div className="text-xs text-muted-foreground">Vecinos</div>
              </div>
              <div>
                <div className="text-lg font-bold text-foreground">{building.admins.length}</div>
                <div className="text-xs text-muted-foreground">Admin{building.admins.length !== 1 ? 's' : ''}</div>
              </div>
            </div>

            <div className="mt-3">
              <OccupancyBar rate={building.occupancyRate} />
            </div>
          </button>
        ))}

        {buildings.length === 0 && (
          <div className="col-span-2 text-center py-12 text-muted-foreground text-sm">
            No hay consorcios registrados.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CONSORCIO DETAIL ─────────────────────────────────────────────────────────
function BuildingDetail({ building, onBack }: { building: SuperAdminBuildingDetail; onBack: () => void }) {
  return (
    <div>
      <SectionHeader
        title={building.name}
        subtitle={building.address}
        onBack={onBack}
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Unidades totales', value: building.totalUnits },
          { label: 'Vecinos registrados', value: building.registeredNeighbors },
          { label: 'Administradores', value: building.admins.length },
          { label: 'Ocupación', value: `${building.occupancyRate}%` },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-xl p-4 text-center">
            <div className="text-xl font-bold text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Admins */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">
              Usuario Encargado del Consorcio
            </h3>
          </div>
          {building.admins.length === 0 ? (
            <div className="px-5 py-8 text-center text-muted-foreground text-sm">
              Sin administrador asignado
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {building.admins.map((admin) => (
                <div key={admin.profileId} className="px-5 py-4 flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                    style={{ background: 'linear-gradient(135deg, #B85C38, #8F4020)' }}
                  >
                    {admin.fullName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">{admin.fullName}</span>
                      {admin.isPrimary && <Badge color="primary">Principal</Badge>}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Mail className="w-3 h-3" />
                      {admin.email}
                    </div>
                    {admin.phone && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Phone className="w-3 h-3" />
                        {admin.phone}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Occupancy */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Nivel de Ocupación</h3>
          </div>
          <div className="px-5 py-6 flex flex-col items-center justify-center gap-4">
            <div className="relative w-28 h-28">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/30" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke="#B85C38" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${Math.min(building.occupancyRate, 100) * 2.51} 251`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-foreground">{building.occupancyRate}%</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm text-foreground font-medium">
                {building.registeredNeighbors} de {building.totalUnits} unidades ocupadas
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">según vecinos registrados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Residents table */}
      <div className="glass-card rounded-xl overflow-hidden mt-6">
        <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">
            Vecinos Registrados ({building.registeredNeighbors})
          </h3>
        </div>
        {building.neighbors.length === 0 ? (
          <div className="px-5 py-8 text-center text-muted-foreground text-sm">
            No hay vecinos registrados en este edificio.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50" style={{ background: 'rgba(0,0,0,0.03)' }}>
                  {['Nombre', 'Email', 'Piso', 'Unidad', 'Teléfono'].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {building.neighbors.map((neighbor) => (
                  <tr key={neighbor.id} className="border-b border-border/30 last:border-0 hover:bg-secondary/30">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #B85C38, #8F4020)' }}
                        >
                          {neighbor.avatarText}
                        </div>
                        <span className="font-medium text-foreground">{neighbor.fullName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{neighbor.email}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{neighbor.floor ?? '—'}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{neighbor.unit ?? '—'}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{neighbor.phone ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── NEGOCIOS LIST ────────────────────────────────────────────────────────────
function BusinessesList({
  businesses,
  onSelect,
}: {
  businesses: SuperAdminBusinessDetail[]
  onSelect: (b: SuperAdminBusinessDetail) => void
}) {
  return (
    <div>
      <SectionHeader
        title="Negocios"
        subtitle={`${businesses.length} negocio${businesses.length !== 1 ? 's' : ''} afiliado${businesses.length !== 1 ? 's' : ''}`}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {businesses.map((business) => (
          <button
            key={business.id}
            onClick={() => onSelect(business)}
            className="glass-card glass-card-hover rounded-xl p-5 text-left group transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden border border-border/60 bg-background flex items-center justify-center flex-shrink-0">
                  {business.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={business.logoUrl} alt={business.name} className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                    {business.name}
                  </h3>
                  <Badge>{business.category}</Badge>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
            </div>

            <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{business.description}</p>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-foreground">{business.promotions.length}</div>
                <div className="text-xs text-muted-foreground">Cupones</div>
              </div>
              <div>
                <div className="text-lg font-bold text-foreground">{business.totalRedemptions}</div>
                <div className="text-xs text-muted-foreground">Canjes</div>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-foreground truncate">
                  {business.topBuilding ?? '—'}
                </div>
                <div className="text-xs text-muted-foreground">Top edificio</div>
              </div>
            </div>
          </button>
        ))}

        {businesses.length === 0 && (
          <div className="col-span-2 text-center py-12 text-muted-foreground text-sm">
            No hay negocios registrados.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── NEGOCIO DETAIL ───────────────────────────────────────────────────────────
function BusinessDetail({ business, onBack }: { business: SuperAdminBusinessDetail; onBack: () => void }) {
  return (
    <div>
      <SectionHeader title={business.name} subtitle={business.category} onBack={onBack} />

      {/* Header card */}
      <div className="glass-card rounded-xl p-5 mb-6 flex items-start gap-5">
        <div className="w-16 h-16 rounded-xl overflow-hidden border border-border/60 bg-background flex items-center justify-center flex-shrink-0">
          {business.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.logoUrl} alt={business.name} className="w-full h-full object-cover" />
          ) : (
            <Building2 className="w-7 h-7 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-foreground text-lg">{business.name}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{business.description}</p>
          <div className="flex items-center gap-3 mt-3">
            <Badge>{business.category}</Badge>
            {business.topBuilding && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Más activo en: <strong className="text-foreground ml-1">{business.topBuilding}</strong>
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-center flex-shrink-0">
          <div className="glass-card rounded-lg px-4 py-3">
            <div className="text-xl font-bold text-foreground">{business.promotions.length}</div>
            <div className="text-xs text-muted-foreground">Cupones</div>
          </div>
          <div className="glass-card rounded-lg px-4 py-3">
            <div className="text-xl font-bold text-foreground">{business.totalRedemptions}</div>
            <div className="text-xs text-muted-foreground">Canjes</div>
          </div>
        </div>
      </div>

      {/* Promotions */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
          <Tag className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">
            Cupones y Promociones ({business.promotions.length})
          </h3>
        </div>

        {business.promotions.length === 0 ? (
          <div className="px-5 py-8 text-center text-muted-foreground text-sm">
            Este negocio no tiene promociones cargadas.
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {business.promotions.map((promotion) => (
              <PromotionRow key={promotion.id} promotion={promotion} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PROMOTION ROW (expandable) ───────────────────────────────────────────────
function PromotionRow({ promotion }: { promotion: SuperAdminPromotionDetail }) {
  const [expanded, setExpanded] = useState(false)
  const isExpired = promotion.expirationDate < new Date().toISOString().slice(0, 10)

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-5 py-4 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg overflow-hidden border border-border/60 bg-background flex items-center justify-center flex-shrink-0">
            {promotion.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={promotion.imageUrl} alt={promotion.title} className="w-full h-full object-cover" />
            ) : (
              <Tag className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-foreground text-sm">{promotion.title}</p>
                <p className="text-xs text-primary font-medium mt-0.5">{promotion.discount}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isExpired ? (
                  <Badge color="warn">Vencido</Badge>
                ) : (
                  <Badge color="success">Activo</Badge>
                )}
                <ChevronRight
                  className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
                />
              </div>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-xs text-muted-foreground">
                {promotion.usageCount} canje{promotion.usageCount !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-muted-foreground">
                Vence: {promotion.expirationDate}
              </span>
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 pt-0">
          <div className="rounded-lg p-4" style={{ background: 'rgba(0,0,0,0.03)' }}>
            {promotion.redemptionsByBuilding.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center">Sin canjes registrados todavía.</p>
            ) : (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Uso por edificio
                </p>
                <div className="space-y-2">
                  {promotion.redemptionsByBuilding.map((item) => {
                    const maxCount = promotion.redemptionsByBuilding[0].count
                    const pct = Math.round((item.count / maxCount) * 100)
                    return (
                      <div key={item.buildingId} className="flex items-center gap-3">
                        <div className="w-32 text-xs text-foreground font-medium truncate">{item.buildingName}</div>
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #B85C38, #D4784E)' }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground w-14 text-right">
                          {item.count} canje{item.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export function SuperAdminDashboard({ data }: { data: SuperAdminDashboardData }) {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [selectedBuilding, setSelectedBuilding] = useState<SuperAdminBuildingDetail | null>(null)
  const [selectedBusiness, setSelectedBusiness] = useState<SuperAdminBusinessDetail | null>(null)

  const totalUsage = data.promotions.reduce((sum, p) => sum + p.usageCount, 0)

  const tabs: { key: TabType; label: string; icon: typeof Shield }[] = [
    { key: 'overview', label: 'Resumen', icon: Shield },
    { key: 'buildings', label: 'Consorcios', icon: Home },
    { key: 'users', label: 'Usuarios', icon: Users },
    { key: 'businesses', label: 'Negocios', icon: Building2 },
    { key: 'promotions', label: 'Promociones', icon: Tag },
  ]

  function handleTabChange(tab: TabType) {
    setActiveTab(tab)
    setSelectedBuilding(null)
    setSelectedBusiness(null)
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="glass-card rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-primary" />
          <p className="text-xs text-primary font-medium tracking-wider uppercase">Panel de super administrador</p>
        </div>
        <h1 className="font-serif text-2xl font-bold text-foreground">Resumen operativo de la plataforma</h1>
        <p className="text-muted-foreground text-sm mt-1">Datos en tiempo real desde Supabase.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-8 w-fit flex-wrap" style={{ background: 'rgba(0,0,0,0.03)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key ? 'text-white' : 'text-muted-foreground hover:text-foreground'
            }`}
            style={activeTab === tab.key ? { background: 'linear-gradient(135deg, #B85C38, #8F4020)' } : {}}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Usuarios" value={data.users.length} sub={`${data.users.filter((u) => u.role === 'vecino').length} vecinos`} icon={Users} />
            <StatCard label="Consorcios" value={data.buildings.length} sub="Edificios adheridos" icon={Home} />
            <StatCard label="Negocios" value={data.businesses.length} sub={`${data.users.filter((u) => u.role === 'negocio_admin').length} admins`} icon={Building2} />
            <StatCard label="Canjes registrados" value={totalUsage} sub="Desde promotion_redemptions" icon={TrendingUp} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'buildings', label: 'Consorcios', desc: `${data.buildings.length} edificios adheridos`, icon: Home },
              { key: 'users', label: 'Usuarios', desc: `${data.users.length} cuentas registradas`, icon: Users },
              { key: 'businesses', label: 'Negocios', desc: `${data.businesses.length} negocios adheridos`, icon: Building2 },
              { key: 'promotions', label: 'Promociones', desc: `${data.promotions.length} promociones cargadas`, icon: Tag },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => handleTabChange(item.key as TabType)}
                className="glass-card glass-card-hover rounded-xl p-5 text-left group flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(156,156,156,0.15)', border: '1px solid rgba(0,0,0,0.06)' }}
                  >
                    <item.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground text-sm">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.desc}</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CONSORCIOS */}
      {activeTab === 'buildings' && !selectedBuilding && (
        <BuildingsList buildings={data.buildings} onSelect={setSelectedBuilding} />
      )}
      {activeTab === 'buildings' && selectedBuilding && (
        <BuildingDetail building={selectedBuilding} onBack={() => setSelectedBuilding(null)} />
      )}

      {/* USUARIOS */}
      {activeTab === 'users' && (
        <div>
          <SectionHeader title="Usuarios" subtitle={`${data.users.length} cuentas registradas`} />
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50" style={{ background: 'rgba(0,0,0,0.03)' }}>
                    {['Usuario', 'Email', 'Rol', 'Teléfono'].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user) => (
                    <tr key={user.id} className="border-b border-border/30 last:border-0 hover:bg-secondary/30">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #B85C38, #8F4020)' }}
                          >
                            {user.avatarText}
                          </div>
                          <span className="font-medium text-foreground">{user.fullName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">{user.email}</td>
                      <td className="px-5 py-3.5">
                        <Badge color={user.role === 'super_admin' ? 'primary' : 'default'}>
                          {ROLE_LABELS[user.role]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">{user.phone ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* NEGOCIOS */}
      {activeTab === 'businesses' && !selectedBusiness && (
        <BusinessesList businesses={data.businesses} onSelect={setSelectedBusiness} />
      )}
      {activeTab === 'businesses' && selectedBusiness && (
        <BusinessDetail business={selectedBusiness} onBack={() => setSelectedBusiness(null)} />
      )}

      {/* PROMOCIONES */}
      {activeTab === 'promotions' && (
        <div>
          <SectionHeader title="Promociones" subtitle={`${data.promotions.length} promociones cargadas`} />
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="divide-y divide-border/30">
              {data.promotions.map((promotion) => (
                <PromotionRow key={promotion.id} promotion={promotion as SuperAdminPromotionDetail} />
              ))}
              {data.promotions.length === 0 && (
                <div className="px-5 py-8 text-center text-muted-foreground text-sm">
                  No hay promociones cargadas.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ChatWidget />
    </div>
  )
}
