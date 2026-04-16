'use client'

import { useMemo, useState } from 'react'
import { Building2, ChevronRight, Home, Mail, Phone, Users } from 'lucide-react'
import type { ConsorcioDashboardData } from '@/lib/types'

export function ConsorcioDashboard({ data }: { data: ConsorcioDashboardData }) {
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(data.primaryBuildingId)

  const selectedManagedBuilding = useMemo(() => {
    return (
      data.managedBuildings.find((item) => item.building.id === selectedBuildingId) ??
      data.managedBuildings[0] ??
      null
    )
  }, [data.managedBuildings, selectedBuildingId])

  if (data.managedBuildings.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="glass-card rounded-2xl p-8">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h1 className="font-serif text-2xl font-bold text-foreground">Sin edificios asignados</h1>
          </div>
          <p className="text-muted-foreground">
            Tu cuenta tiene rol de consorcio, pero todavia no tiene edificios vinculados en `building_admin_assignments`.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="glass-card rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-4 h-4 text-primary" />
          <p className="text-xs text-primary font-medium tracking-wider uppercase">Panel del consorcio</p>
        </div>
        <h1 className="font-serif text-2xl font-bold text-foreground">Resumen multi-edificio</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Vista consolidada de todos los edificios asignados y detalle del edificio activo.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Edificios asignados', value: data.totalBuildings, icon: Building2 },
          { label: 'Unidades totales', value: data.totalUnits, icon: Home },
          { label: 'Vecinos registrados', value: data.totalNeighbors, icon: Users },
          { label: 'Adopcion promedio', value: `${data.averageOccupancyRate}%`, icon: Building2 },
        ].map((stat) => (
          <div key={stat.label} className="glass-card rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(156,156,156,0.15)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <stat.icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-serif text-2xl font-bold text-foreground">Tus edificios</h2>
            <p className="text-sm text-muted-foreground">Resumen por edificio con selector de contexto activo.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.managedBuildings.map((item) => (
            <button
              key={item.building.id}
              onClick={() => setSelectedBuildingId(item.building.id)}
              className={`glass-card rounded-xl p-5 text-left transition-all border ${
                selectedManagedBuilding?.building.id === item.building.id ? 'border-primary/40 shadow-lg' : 'border-border/40 hover:border-primary/20'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    {data.primaryBuildingId === item.building.id ? 'Edificio principal' : 'Edificio asignado'}
                  </p>
                  <h3 className="font-semibold text-foreground">{item.building.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{item.building.address}</p>
                </div>
                <ChevronRight className={`w-4 h-4 ${selectedManagedBuilding?.building.id === item.building.id ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>

              <div className="grid grid-cols-3 gap-3 mt-5">
                <div>
                  <div className="text-lg font-bold text-foreground">{item.building.totalUnits}</div>
                  <div className="text-[11px] text-muted-foreground">Unidades</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-foreground">{item.registeredNeighbors}</div>
                  <div className="text-[11px] text-muted-foreground">Vecinos</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-primary">{item.occupancyRate}%</div>
                  <div className="text-[11px] text-muted-foreground">Adopcion</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedManagedBuilding ? (
        <>
          <div className="glass-card rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-2 mb-1">
              <Home className="w-4 h-4 text-primary" />
              <p className="text-xs text-primary font-medium tracking-wider uppercase">Detalle activo</p>
            </div>
            <h2 className="font-serif text-2xl font-bold text-foreground">{selectedManagedBuilding.building.name}</h2>
            <p className="text-muted-foreground text-sm mt-1">{selectedManagedBuilding.building.address}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Unidades totales', value: selectedManagedBuilding.building.totalUnits, icon: Home },
              { label: 'Vecinos registrados', value: selectedManagedBuilding.registeredNeighbors, icon: Users },
              { label: 'Adopcion CITIFY', value: `${selectedManagedBuilding.occupancyRate}%`, icon: Building2 },
            ].map((stat) => (
              <div key={stat.label} className="glass-card rounded-xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(156,156,156,0.15)', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <stat.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="glass-card rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50" style={{ background: 'rgba(0,0,0,0.03)' }}>
                  <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Vecino</th>
                  <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Unidad</th>
                  <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Contacto</th>
                  <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Alta</th>
                </tr>
              </thead>
              <tbody>
                {selectedManagedBuilding.neighbors.length > 0 ? (
                  selectedManagedBuilding.neighbors.map((neighbor, index) => (
                    <tr key={neighbor.id} className={`border-b border-border/30 transition-colors hover:bg-secondary/30 ${index === selectedManagedBuilding.neighbors.length - 1 ? 'border-0' : ''}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                            style={{ background: 'linear-gradient(135deg, #B85C38, #8F4020)' }}>
                            {neighbor.avatarText}
                          </div>
                          <span className="font-medium text-foreground">{neighbor.fullName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        Piso {neighbor.floor ?? '-'} · Depto {neighbor.unit ?? '-'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1 text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5" />
                            <span className="text-xs">{neighbor.email}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5" />
                            <span className="text-xs">{neighbor.phone ?? 'No registrado'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs">
                        {new Date(neighbor.createdAt).toLocaleDateString('es-AR')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-5 py-16 text-center text-muted-foreground">
                      Todavia no hay vecinos registrados en este edificio.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}
