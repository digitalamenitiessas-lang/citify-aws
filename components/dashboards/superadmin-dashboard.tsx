'use client'

import { useState } from 'react'
import { Building2, ChevronRight, Home, Shield, Tag, TrendingUp, Users } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/constants'
import type { SuperAdminDashboardData } from '@/lib/types'

type TabType = 'overview' | 'buildings' | 'users' | 'businesses' | 'promotions'

export function SuperAdminDashboard({ data }: { data: SuperAdminDashboardData }) {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const totalUsage = data.promotions.reduce((sum, promotion) => sum + promotion.usageCount, 0)

  const tabs: { key: TabType; label: string; icon: typeof Shield }[] = [
    { key: 'overview', label: 'Resumen', icon: Shield },
    { key: 'buildings', label: 'Consorcios', icon: Home },
    { key: 'users', label: 'Usuarios', icon: Users },
    { key: 'businesses', label: 'Comercios', icon: Building2 },
    { key: 'promotions', label: 'Promociones', icon: Tag },
  ]

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="glass-card rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-primary" />
          <p className="text-xs text-primary font-medium tracking-wider uppercase">Panel de super administrador</p>
        </div>
        <h1 className="font-serif text-2xl font-bold text-foreground">Resumen operativo de la plataforma</h1>
        <p className="text-muted-foreground text-sm mt-1">Todo el dominio esta leyendo desde Supabase, ya sin mock data como fuente activa.</p>
      </div>

      <div className="flex gap-1 p-1 rounded-xl mb-8 w-fit" style={{ background: 'rgba(0,0,0,0.03)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}
            style={activeTab === tab.key ? { background: 'linear-gradient(135deg, #B85C38, #8F4020)' } : {}}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Usuarios', value: data.users.length, icon: Users, sub: `${data.users.filter((user) => user.role === 'vecino').length} vecinos` },
              { label: 'Consorcios', value: data.buildings.length, icon: Home, sub: 'Edificios adheridos' },
              { label: 'Comercios', value: data.businesses.length, icon: Building2, sub: `${data.users.filter((user) => user.role === 'negocio_admin').length} admins` },
              { label: 'Canjes registrados', value: totalUsage, icon: TrendingUp, sub: 'Desde promotion_redemptions' },
            ].map((stat) => (
              <div key={stat.label} className="glass-card rounded-xl p-5">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: 'rgba(156,156,156,0.15)', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <stat.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="text-sm text-foreground mt-0.5">{stat.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{stat.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'buildings', label: 'Consorcios', desc: `${data.buildings.length} edificios adheridos`, icon: Home },
              { key: 'users', label: 'Usuarios', desc: `${data.users.length} cuentas registradas`, icon: Users },
              { key: 'businesses', label: 'Comercios', desc: `${data.businesses.length} comercios adheridos`, icon: Building2 },
              { key: 'promotions', label: 'Promociones', desc: `${data.promotions.length} promociones cargadas`, icon: Tag },
            ].map((item) => (
              <button key={item.key} onClick={() => setActiveTab(item.key as TabType)} className="glass-card glass-card-hover rounded-xl p-5 text-left group flex items-center justify-between">
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
      ) : null}

      {activeTab === 'buildings' ? (
        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50" style={{ background: 'rgba(0,0,0,0.03)' }}>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Edificio</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Direccion</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Unidades</th>
              </tr>
            </thead>
            <tbody>
              {data.buildings.map((building) => (
                <tr key={building.id} className="border-b border-border/30 last:border-0 hover:bg-secondary/30">
                  <td className="px-5 py-3.5 font-medium text-foreground">{building.name}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{building.address}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{building.totalUnits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {activeTab === 'users' ? (
        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50" style={{ background: 'rgba(0,0,0,0.03)' }}>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Usuario</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Email</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Rol</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => (
                <tr key={user.id} className="border-b border-border/30 last:border-0 hover:bg-secondary/30">
                  <td className="px-5 py-3.5 font-medium text-foreground">{user.fullName}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{user.email}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{ROLE_LABELS[user.role]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {activeTab === 'businesses' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.businesses.map((business) => (
            <div key={business.id} className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl overflow-hidden border border-border/60 bg-background flex items-center justify-center">
                  {business.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={business.logoUrl} alt={business.name} className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{business.name}</h3>
                  <p className="text-sm text-muted-foreground">{business.category}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-3">{business.description}</p>
            </div>
          ))}
        </div>
      ) : null}

      {activeTab === 'promotions' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.promotions.map((promotion) => (
            <div key={promotion.id} className="glass-card rounded-xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-24 h-24 rounded-xl overflow-hidden border border-border/60 bg-background flex items-center justify-center flex-shrink-0">
                  {promotion.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={promotion.imageUrl} alt={promotion.title} className="w-full h-full object-cover" />
                  ) : (
                    <Tag className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{promotion.title}</h3>
                  <p className="text-sm text-muted-foreground">{promotion.businessName}</p>
                  <p className="text-xs text-primary mt-1 font-medium">{promotion.discount}</p>
                  <p className="text-xs text-muted-foreground mt-2">Canjes: {promotion.usageCount}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
