'use client'

import { useEffect, useState } from 'react'
import { Navbar } from '@/components/navbar'
import { mockPromotions, mockBusinesses, mockUsers, Promotion, CATEGORIES } from '@/lib/mock-data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PromotionCard } from '@/components/promotion-card'
import { Plus, X, TrendingUp, Tag, BarChart3 } from 'lucide-react'


function PromotionFormModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Promotion | null
  onSave: (data: Omit<Promotion, 'id' | 'businessId' | 'businessName' | 'usageCount' | 'createdAt'>) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [discount, setDiscount] = useState(initial?.discount ?? '')
  const [category, setCategory] = useState(initial?.category ?? CATEGORIES[1])
  const [expirationDate, setExpirationDate] = useState(initial?.expirationDate ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ title, description, discount, category, expirationDate })
  }

  const inputClass = "w-full rounded-xl px-4 py-3 text-sm bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
  const labelClass = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(10,6,2,0.75)', backdropFilter: 'blur(6px)' }}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-7 pt-7 pb-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-0.5">
                {initial ? 'Editando' : 'Nueva'}
              </p>
              <h2 className="text-xl font-bold text-gray-900">
                {initial ? 'Editar Promoción' : 'Crear Promoción'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="px-7 py-6 flex flex-col gap-5">
          <div>
            <label className={labelClass}>Título de la Promoción</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              placeholder="ej. 20% de descuento en brunch"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Descripción</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
              rows={3}
              placeholder="Describí los detalles de la promoción..."
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Descuento</label>
              <input
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                required
                placeholder="ej. 20% o Gratis"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Vencimiento</label>
              <input
                type="date"
                value={expirationDate}
                onChange={e => setExpirationDate(e.target.value)}
                required
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Categoría</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className={inputClass}
            >
              {CATEGORIES.filter(c => c !== 'Todas').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-colors"
              style={{ background: 'linear-gradient(135deg, #B85C38, #8F4020)' }}
            >
              {initial ? 'Guardar Cambios' : 'Crear Promoción'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


export default function BusinessDashboard() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null)

  // Autenticación Mock
  const user = mockUsers.find(u => u.role === 'business_admin')!
  const business = mockBusinesses.find(b => b.id === user.businessId)

  useEffect(() => {
    if (user?.businessId) {
      setPromotions(mockPromotions.filter(p => p.businessId === user.businessId))
    }
  }, [])
  const totalUsage = promotions.reduce((s, p) => s + p.usageCount, 0)

  // Total de vecinos (usuarios consumidores) en la plataforma
  const totalConsumers = mockUsers.filter(u => u.role === 'consumer').length || 1

  const handleSave = (data: Omit<Promotion, 'id' | 'businessId' | 'businessName' | 'usageCount' | 'createdAt'>) => {
    if (editingPromo) {
      setPromotions(prev => prev.map(p => p.id === editingPromo.id ? { ...p, ...data } : p))
    } else {
      const newPromo: Promotion = {
        id: `p${Date.now()}`,
        businessId: user.businessId ?? 'new',
        businessName: business?.name ?? user.name,
        usageCount: 0,
        createdAt: new Date().toISOString().split('T')[0],
        ...data,
      }
      setPromotions(prev => [newPromo, ...prev])
    }
    setShowForm(false)
    setEditingPromo(null)
  }

  const handleDelete = (id: string) => {
    setPromotions(prev => prev.filter(p => p.id !== id))
  }

  const handleEdit = (p: Promotion) => {
    setEditingPromo(p)
    setShowForm(true)
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <div className="pt-20 pb-6 px-6 border-b border-border/50 bg-grid">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5 font-medium tracking-wider uppercase">Panel del Comercio</p>
            <h1 className="font-serif text-2xl font-bold text-foreground">{business?.name ?? user.name}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{business?.category ?? 'Comercio'} · Administrá tus promociones</p>
          </div>
          <Button onClick={() => { setEditingPromo(null); setShowForm(true) }} className="btn-premium gap-2">
            <Plus className="w-4 h-4" />
            Nueva Promoción
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Promociones Activas', value: promotions.length, icon: Tag },
            { label: 'Canjes Totales', value: totalUsage, icon: TrendingUp },
            { label: 'Canjes Promedio / Promo', value: promotions.length ? Math.round(totalUsage / promotions.length) : 0, icon: BarChart3 },
          ].map(s => (
            <div key={s.label} className="glass-card rounded-xl p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(156,156,156,0.15)', border: '1px solid rgba(0,0,0,0.06)' }}>
                <s.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Analytics Chart */}
        {promotions.length > 0 && (
          <div className="glass-card rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-foreground">Rendimiento de Promociones</h2>
              </div>
              <span className="text-xs text-muted-foreground px-2.5 py-1 rounded-full" style={{ background: 'rgba(0,0,0,0.04)' }}>
                {totalConsumers} vecinos registrados · {totalUsage} canjes totales
              </span>
            </div>

            <div className="flex flex-col gap-4">
              {promotions
                .slice()
                .sort((a, b) => b.usageCount - a.usageCount)
                .map((p, i) => {
                  // Alcance: qué % del total de vecinos ya canjeó esta promo
                  const reach = Math.min(Math.round((p.usageCount / totalConsumers) * 100), 100)
                  const colors = [
                    'linear-gradient(90deg, #B85C38, #8F4020)',
                    'linear-gradient(90deg, #C4733D, #A05025)',
                    'linear-gradient(90deg, #8B6B52, #6B4F3A)',
                    'linear-gradient(90deg, #D4A882, #B88055)',
                  ]
                  return (
                    <div key={p.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-foreground font-medium truncate max-w-[55%]">{p.title}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-muted-foreground">{p.usageCount} de {totalConsumers} vecinos</span>
                          <span className="text-sm font-bold text-foreground tabular-nums">{reach}% alcance</span>
                        </div>
                      </div>
                      <div className="h-2.5 rounded-full w-full" style={{ background: 'rgba(0,0,0,0.06)' }}>
                        <div
                          className="h-2.5 rounded-full transition-all duration-700"
                          style={{ width: `${reach}%`, background: colors[i % colors.length] }}
                        />
                      </div>
                    </div>
                  )
                })
              }
            </div>
          </div>
        )}

        {/* Promotions */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-foreground">Tus Promociones</h2>
          <span className="text-sm text-muted-foreground">{promotions.length} en total</span>
        </div>

        {promotions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {promotions.map(promo => (
              <PromotionCard key={promo.id} promotion={promo} showAnalytics onEdit={handleEdit} onDelete={handleDelete} />
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-xl p-12 text-center">
            <Tag className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">Aún no hay promociones. ¡Creá la primera!</p>
            <Button onClick={() => setShowForm(true)} className="btn-premium gap-2">
              <Plus className="w-4 h-4" /> Crear Promoción
            </Button>
          </div>
        )}
      </div>

      {showForm && (
        <PromotionFormModal
          initial={editingPromo}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingPromo(null) }}
        />
      )}
    </div>
  )
}
