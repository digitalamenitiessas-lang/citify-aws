'use client'

import { Navbar } from '@/components/navbar'
import { mockUsers, mockBuildings } from '@/lib/mock-data'
import { Building2, Users, Phone, Mail, Home } from 'lucide-react'

export default function ConsorcioDashboard() {
  // Autenticación Mock
  const user = mockUsers.find(u => u.role === 'consorcio_admin')!
  const building = mockBuildings.find(b => b.id === user.buildingId)

  // Vecinos del edificio
  const neighbors = mockUsers.filter(u => u.role === 'vecino' && u.buildingId === user.buildingId)

  const occupancyRate = building ? Math.round((neighbors.length / building.totalUnits) * 100) : 0

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <div className="pt-20 pb-6 px-6 border-b border-border/50 bg-grid">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-primary" />
            <p className="text-xs text-primary font-medium tracking-wider uppercase">Panel del Consorcio</p>
          </div>
          <h1 className="font-serif text-2xl font-bold text-foreground">{building?.name ?? 'Consorcio'}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{building?.address}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="glass-card rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(156,156,156,0.15)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <Home className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{building?.totalUnits ?? 0}</div>
              <div className="text-xs text-muted-foreground">Unidades Totales</div>
            </div>
          </div>
          
          <div className="glass-card rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(156,156,156,0.15)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{neighbors.length}</div>
              <div className="text-xs text-muted-foreground">Vecinos Registrados</div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(156,156,156,0.15)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{occupancyRate}%</div>
              <div className="text-xs text-muted-foreground">Adopción CITIFY</div>
            </div>
          </div>
        </div>

        {/* Neighbors Table */}
        <h2 className="font-semibold text-foreground mb-4">Vecinos Registrados <span className="text-muted-foreground font-normal text-sm">({neighbors.length})</span></h2>
        
        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50" style={{ background: 'rgba(0,0,0,0.03)' }}>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Vecino</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Unidad</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Contacto</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Última Actividad</th>
              </tr>
            </thead>
            <tbody>
              {neighbors.length > 0 ? neighbors.map((n, i) => (
                <tr key={n.id} className={`border-b border-border/30 transition-colors hover:bg-secondary/30 ${i === neighbors.length - 1 ? 'border-0' : ''}`}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-[#ffffff] flex-shrink-0"
                           style={{ background: 'linear-gradient(135deg, #B85C38, #8F4020)' }}>
                        {n.avatar ?? n.name.charAt(0)}
                      </div>
                      <span className="font-medium text-foreground">{n.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                       <span className="px-2.5 py-1 rounded-md text-xs font-medium border border-border/50" style={{ background: 'rgba(0,0,0,0.02)' }}>
                         Piso {n.floor ?? '-'}
                       </span>
                       <span className="px-2.5 py-1 rounded-md text-xs font-medium border border-border/50" style={{ background: 'rgba(0,0,0,0.02)' }}>
                         Depto {n.unit ?? '-'}
                       </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col gap-1 text-muted-foreground">
                      <div className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer w-fit">
                        <Mail className="w-3.5 h-3.5" />
                        <span className="text-xs">{n.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer w-fit">
                        <Phone className="w-3.5 h-3.5" />
                        <span className="text-xs">{n.phone ?? 'No registrado'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground text-xs">
                    {new Date(n.createdAt).toLocaleDateString('es-AR', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-muted-foreground">
                    Todavía no hay vecinos registrados en este edificio.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
