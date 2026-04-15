'use client'

import { useState } from 'react'
import { Navbar } from '@/components/navbar'
import { mockUsers, mockBusinesses, mockPromotions, mockBuildings } from '@/lib/mock-data'
import { Users, Building2, Tag, Shield, TrendingUp, ChevronRight, Home } from 'lucide-react'

type TabType = 'overview' | 'buildings' | 'users' | 'businesses' | 'promotions'

const ROLE_BADGE: Record<string, { label: string, style: React.CSSProperties }> = {
  super_admin: { label: 'Admin', style: { background: 'rgba(122,122,122,0.2)', color: '#c4c4c4', border: '1px solid rgba(0,0,0,0.08)' } },
  negocio_admin: { label: 'Admin Negocio', style: { background: 'rgba(156,156,156,0.15)', color: '#969696', border: '1px solid rgba(0,0,0,0.06)' } },
  consorcio_admin: { label: 'Admin Consorcio', style: { background: 'rgba(184, 92, 56, 0.15)', color: '#B85C38', border: '1px solid rgba(184, 92, 56, 0.2)' } },
  vecino: { label: 'Vecino', style: { background: 'rgba(0,0,0,0.03)', color: '#8c8c8c', border: '1px solid rgba(122,122,122,0.25)' } },
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  const totalUsage = mockPromotions.reduce((s, p) => s + p.usageCount, 0)

  const overviewStats = [
    { label: 'Total de Usuarios', value: mockUsers.length, icon: Users, sub: `${mockUsers.filter(u => u.role === 'vecino').length} vecinos` },
    { label: 'Total Consorcios', value: mockBuildings.length, icon: Home, sub: `Edificios adheridos` },
    { label: 'Comercios', value: mockBusinesses.length, icon: Building2, sub: `${mockUsers.filter(u => u.role === 'negocio_admin').length} admins` },
    { label: 'Promociones', value: mockPromotions.length, icon: Tag, sub: 'Promociones activas' },
  ]

  const tabs: { key: TabType; label: string; icon: typeof Users }[] = [
    { key: 'overview', label: 'Resumen', icon: Shield },
    { key: 'buildings', label: 'Consorcios', icon: Home },
    { key: 'users', label: 'Usuarios', icon: Users },
    { key: 'businesses', label: 'Comercios', icon: Building2 },
    { key: 'promotions', label: 'Promociones', icon: Tag },
  ]

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <div className="pt-20 pb-6 px-6 border-b border-border/50 bg-grid">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-primary" />
            <p className="text-xs text-primary font-medium tracking-wider uppercase">Panel de Super Administrador</p>
          </div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Resumen de la Plataforma</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Administrar usuarios, consorcios, comercios y promociones</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl mb-8 w-fit"
          style={{ background: 'rgba(0,0,0,0.03)' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.key ? 'text-[#ffffff]' : 'text-muted-foreground hover:text-foreground'}`}
              style={activeTab === t.key ? { background: 'linear-gradient(135deg, #B85C38, #8F4020)' } : {}}>
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {overviewStats.map(s => (
                <div key={s.label} className="glass-card rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                     <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(156,156,156,0.15)', border: '1px solid rgba(0,0,0,0.06)' }}>
                       <s.icon className="w-5 h-5 text-primary" />
                     </div>
                  </div>
                  <div className="text-2xl font-bold text-foreground">{s.value}</div>
                  <div className="text-sm text-foreground mt-0.5">{s.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Quick nav cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: 'buildings', label: 'Consorcios', desc: `${mockBuildings.length} edificios adheridos`, icon: Home },
                { key: 'users', label: 'Usuarios', desc: `${mockUsers.length} cuentas registradas`, icon: Users },
                { key: 'businesses', label: 'Administrar Comercios', desc: `${mockBusinesses.length} comercios adheridos`, icon: Building2 },
                { key: 'promotions', label: 'Administrar Promociones', desc: `${mockPromotions.length} promociones activas`, icon: Tag },
              ].map(item => (
                <button key={item.key} onClick={() => setActiveTab(item.key as TabType)}
                  className="glass-card glass-card-hover rounded-xl p-5 text-left group flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(156,156,156,0.15)', border: '1px solid rgba(0,0,0,0.06)' }}>
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

        {/* Buildings */}
        {activeTab === 'buildings' && (
          <div>
            <h2 className="font-semibold text-foreground mb-4">Consorcios <span className="text-muted-foreground font-normal text-sm">({mockBuildings.length})</span></h2>
            <div className="glass-card rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50" style={{ background: 'rgba(0,0,0,0.03)' }}>
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Edificio</th>
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Dirección</th>
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Unidades Totales</th>
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Vecinos Registrados</th>
                  </tr>
                </thead>
                <tbody>
                  {mockBuildings.map((b, i) => {
                    const neighbors = mockUsers.filter(u => u.buildingId === b.id).length
                    return (
                      <tr key={b.id} className={`border-b border-border/30 transition-colors hover:bg-secondary/30 ${i === mockBuildings.length - 1 ? 'border-0' : ''}`}>
                        <td className="px-5 py-3.5"><span className="font-medium text-foreground">{b.name}</span></td>
                        <td className="px-5 py-3.5 text-muted-foreground">{b.address}</td>
                        <td className="px-5 py-3.5 text-muted-foreground">{b.totalUnits}</td>
                        <td className="px-5 py-3.5">
                           <span className="font-semibold text-primary">{neighbors} vecinos</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Users */}
        {activeTab === 'users' && (
          <div>
            <h2 className="font-semibold text-foreground mb-4">Todos los Usuarios <span className="text-muted-foreground font-normal text-sm">({mockUsers.length})</span></h2>
            <div className="glass-card rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50" style={{ background: 'rgba(0,0,0,0.03)' }}>
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Usuario</th>
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Correo</th>
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Rol</th>
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Fecha de Ingreso</th>
                  </tr>
                </thead>
                <tbody>
                  {mockUsers.map((u, i) => (
                    <tr key={u.id} className={`border-b border-border/30 transition-colors hover:bg-secondary/30 ${i === mockUsers.length - 1 ? 'border-0' : ''}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-[#ffffff] flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #B85C38, #8F4020)' }}>
                            {u.avatar}
                          </div>
                          <span className="font-medium text-foreground">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">{u.email}</td>
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium" style={ROLE_BADGE[u.role]?.style}>
                          {ROLE_BADGE[u.role]?.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString('es-AR', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Businesses */}
        {activeTab === 'businesses' && (
          <div>
            <h2 className="font-semibold text-foreground mb-4">Todos los Comercios <span className="text-muted-foreground font-normal text-sm">({mockBusinesses.length})</span></h2>
            <div className="glass-card rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50" style={{ background: 'rgba(0,0,0,0.03)' }}>
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Comercio</th>
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Categoría</th>
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Promociones</th>
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Fecha de Ingreso</th>
                  </tr>
                </thead>
                <tbody>
                  {mockBusinesses.map((b, i) => {
                    const promoCount = mockPromotions.filter(p => p.businessId === b.id).length
                    return (
                      <tr key={b.id} className={`border-b border-border/30 transition-colors hover:bg-secondary/30 ${i === mockBusinesses.length - 1 ? 'border-0' : ''}`}>
                        <td className="px-5 py-3.5">
                          <div>
                            <div className="font-medium text-foreground">{b.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{b.description}</div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-0.5 rounded-full text-xs" style={{ background: 'rgba(156,156,156,0.12)', color: '#969696', border: '1px solid rgba(0,0,0,0.06)' }}>
                            {b.category}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">{promoCount} activas</td>
                        <td className="px-5 py-3.5 text-muted-foreground">{new Date(b.createdAt).toLocaleDateString('es-AR', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Promotions */}
        {activeTab === 'promotions' && (
          <div>
            <h2 className="font-semibold text-foreground mb-4">Todas las Promociones <span className="text-muted-foreground font-normal text-sm">({mockPromotions.length})</span></h2>
            <div className="glass-card rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50" style={{ background: 'rgba(0,0,0,0.03)' }}>
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Promoción</th>
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Comercio</th>
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Descuento</th>
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Uso</th>
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Vencimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {mockPromotions.map((p, i) => {
                    const isExpired = new Date(p.expirationDate) < new Date()
                    return (
                      <tr key={p.id} className={`border-b border-border/30 transition-colors hover:bg-secondary/30 ${i === mockPromotions.length - 1 ? 'border-0' : ''}`}>
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-foreground">{p.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{p.category}</div>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">{p.businessName}</td>
                        <td className="px-5 py-3.5">
                          <span className="font-semibold text-primary">{p.discount}</span>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">{p.usageCount.toLocaleString()}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs ${isExpired ? 'text-red-400' : 'text-muted-foreground'}`}>
                            {isExpired ? 'Vencida' : new Date(p.expirationDate).toLocaleDateString('es-AR', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
