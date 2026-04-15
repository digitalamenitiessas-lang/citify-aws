'use client'

import { useState } from 'react'
import { Navbar } from '@/components/navbar'
import { PromotionCard } from '@/components/promotion-card'
import { MarketplaceCard } from '@/components/marketplace-card'
import { mockPromotions, CATEGORIES, mockUsers, mockBuildings, Promotion, mockMarketplaceItems, MarketplaceItem } from '@/lib/mock-data'
import { Search, Tag, Building2, Gift, QrCode, X, Store, ShoppingBag, Plus, Package } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

function QRModal({ promotion, onClose }: { promotion: Promotion, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(10,6,2,0.8)', backdropFilter: 'blur(4px)' }}>
      <div className="glass-card rounded-2xl p-8 w-full max-w-sm flex flex-col items-center relative text-center">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-5 h-5" />
        </button>
        <h2 className="font-serif text-xl font-bold text-foreground mb-1 mt-2">
          {promotion.businessName}
        </h2>
        <p className="text-muted-foreground text-sm mb-6">{promotion.title}</p>
        
        <div className="bg-[#ffffff] p-6 rounded-xl border border-border/50 mb-6 w-56 h-56 flex items-center justify-center">
          <QrCode className="w-full h-full text-foreground" strokeWidth={1} />
        </div>
        
        <p className="text-xs text-muted-foreground mb-4">
          Mostrá este código QR en el local para acceder al descuento.
        </p>
        
        <Button onClick={onClose} className="w-full btn-premium">
          Cerrar
        </Button>
      </div>
    </div>
  )
}

function CreateMarketplaceModal({ onClose, onSave }: { onClose: () => void, onSave: (item: any) => void }) {
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [condition, setCondition] = useState('Buen Estado')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ title, price: Number(price), description, condition })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(10,6,2,0.8)', backdropFilter: 'blur(4px)' }}>
      <div className="glass-card rounded-2xl p-8 w-full max-w-md relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-5 h-5" />
        </button>
        <h2 className="font-serif text-xl font-bold text-foreground mb-6">
          Nueva Publicación Vecinal
        </h2>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm text-foreground">¿Qué estás vendiendo?</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} required placeholder="Ej: Bicicleta de paseo"
              className="bg-input/50 border-border/50" />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm text-foreground">Precio ($)</Label>
              <Input type="number" value={price} onChange={e => setPrice(e.target.value)} required placeholder="0"
                className="bg-input/50 border-border/50" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm text-foreground">Condición</Label>
              <select value={condition} onChange={e => setCondition(e.target.value)} required
                className="w-full rounded-lg px-3 py-2 text-sm bg-input/50 border border-border/50 text-foreground outline-none transition-colors">
                <option value="Nuevo" style={{ background: '#ffffff' }}>Nuevo</option>
                <option value="Como Nuevo" style={{ background: '#ffffff' }}>Como Nuevo</option>
                <option value="Buen Estado" style={{ background: '#ffffff' }}>Buen Estado</option>
                <option value="Usado" style={{ background: '#ffffff' }}>Usado</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm text-foreground">Descripción (opcional)</Label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="Detalles, por qué lo vendés, zona de retiro..."
              className="w-full rounded-lg px-3 py-2 text-sm bg-input/50 border border-border/50 text-foreground placeholder:text-muted-foreground outline-none resize-none transition-colors" />
          </div>
          
          <Button type="submit" className="w-full btn-premium mt-2">
            Publicar Artículo
          </Button>
        </form>
      </div>
    </div>
  )
}

export default function ConsumerDashboard() {
  const [mainView, setMainView] = useState<'promotions' | 'marketplace'>('promotions')
  
  // States para Promociones
  const [selectedCategory, setSelectedCategory] = useState('Todas')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'building'>('all')
  const [qrPromo, setQrPromo] = useState<Promotion | null>(null)

  // States para Marketplace
  const [marketplaceItems, setMarketplaceItems] = useState<MarketplaceItem[]>(mockMarketplaceItems)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Autenticación Mock
  const user = mockUsers.find(u => u.role === 'consumer' && u.buildingId === 'build_1')!
  const building = mockBuildings.find(b => b.id === user.buildingId)

  // Filtros de Promociones
  const filteredPromos = mockPromotions.filter((p) => {
    const matchCat = selectedCategory === 'Todas' || p.category === selectedCategory
    const matchSearch = search.trim() === '' ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.businessName.toLowerCase().includes(search.toLowerCase())
    
    const matchBuilding = activeTab === 'building' ? p.buildingId === user.buildingId : true

    return matchCat && matchSearch && matchBuilding
  })

  // Filtros de Marketplace (Solo del edificio del usuario actual por defecto)
  const filteredMarketplace = marketplaceItems.filter(m => m.buildingId === user.buildingId)

  const buildingPromosCount = mockPromotions.filter(p => p.buildingId === user.buildingId).length

  const handleCreateMarketplaceItem = (data: any) => {
    const newItem: MarketplaceItem = {
      id: `m${Date.now()}`,
      sellerId: user.id,
      buildingId: user.buildingId!,
      createdAt: new Date().toISOString(),
      ...data
    }
    setMarketplaceItems(prev => [newItem, ...prev])
    setShowCreateModal(false)
  }

  return (
    <div className="min-h-screen bg-background relative">
      <Navbar />

      {/* Header */}
      <div className="pt-20 pb-0 px-6 border-b border-border/50 bg-grid">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-[#ffffff]"
              style={{ background: 'linear-gradient(135deg, #B85C38, #8F4020)' }}>
              {user.avatar}
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold text-foreground">
                Hola, {user.name.split(' ')[0]}
              </h1>
              <p className="text-muted-foreground text-sm">Consorcio {building?.name}</p>
            </div>
          </div>

          {/* Main Navigation Tabs */}
          <div className="flex gap-6 mt-4">
            <button 
              onClick={() => setMainView('promotions')}
              className={`pb-4 text-sm font-medium transition-colors relative ${mainView === 'promotions' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4" /> Beneficios & Comercios
              </div>
              {mainView === 'promotions' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
            <button 
              onClick={() => setMainView('marketplace')}
              className={`pb-4 text-sm font-medium transition-colors relative ${mainView === 'marketplace' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" /> Mercado Vecinal
              </div>
              {mainView === 'marketplace' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        
        {/* VISTA PROMOCIONES */}
        {mainView === 'promotions' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
              <div className="glass-card rounded-xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(156,156,156,0.15)', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <Store className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">{mockPromotions.length}</div>
                  <div className="text-xs text-muted-foreground">Locales cercanos</div>
                </div>
              </div>
              <div className="glass-card rounded-xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(156,156,156,0.15)', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">{buildingPromosCount}</div>
                  <div className="text-xs text-muted-foreground">Exclusivas en tu edificio</div>
                </div>
              </div>
              <div className="glass-card rounded-xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(156,156,156,0.15)', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <Gift className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">$240k+</div>
                  <div className="text-xs text-muted-foreground">Ahorro Potencial Promedio</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              {/* Tab Toggle - Promos */}
              <div className="flex gap-2 p-1 rounded-xl w-full sm:w-fit"
                style={{ background: 'rgba(0,0,0,0.03)' }}>
                <button onClick={() => setActiveTab('all')}
                  className={`flex-1 sm:flex-none flex justify-center items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'all' ? 'text-[#ffffff]' : 'text-muted-foreground hover:text-foreground'}`}
                  style={activeTab === 'all' ? { background: 'linear-gradient(135deg, #B85C38, #8F4020)' } : {}}>
                  <Tag className="w-4 h-4" />
                  Todas Blancas
                </button>
                <button onClick={() => setActiveTab('building')}
                  className={`flex-1 sm:flex-none flex justify-center items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'building' ? 'text-[#ffffff]' : 'text-muted-foreground hover:text-foreground'}`}
                  style={activeTab === 'building' ? { background: 'linear-gradient(135deg, #B85C38, #8F4020)' } : {}}>
                  <Building2 className="w-4 h-4" />
                  En mi Consorcio
                </button>
              </div>

              {/* Search */}
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar promociones..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-input/50 border-border/50 text-foreground"
                />
              </div>
            </div>

            {/* Category Filters */}
            <div className="flex flex-wrap gap-2 mb-8">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    selectedCategory === cat
                      ? 'text-[#ffffff] border border-primary/50'
                      : 'text-muted-foreground border border-border/50 hover:border-primary/30 hover:text-foreground'
                  }`}
                  style={selectedCategory === cat ? { background: 'linear-gradient(135deg, #B85C38, #8F4020)' } : { background: 'rgba(184,92,56,0.05)' }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Results */}
            <div className="mb-6 flex justify-between items-end border-b border-border/30 pb-4">
              <div>
                <h2 className="font-serif text-xl font-bold text-foreground">
                  {activeTab === 'all' ? 'Descubrí Ofertas' : `Exclusivas para ${building?.name}`}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {filteredPromos.length} {filteredPromos.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}
                </p>
              </div>
            </div>

            {filteredPromos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPromos.map((promo) => (
                  <PromotionCard 
                    key={promo.id} 
                    promotion={promo} 
                    showUseCoupon 
                    onUse={(p) => setQrPromo(p)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 glass-card rounded-xl">
                <Gift className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-foreground font-medium mb-1">No hay promociones disponibles aquí</p>
                <p className="text-muted-foreground text-sm">Intentá cambiar tu búsqueda o consultar luego.</p>
              </div>
            )}
          </div>
        )}

        {/* VISTA MARKETPLACE */}
        {mainView === 'marketplace' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="glass-card rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 border-primary/10">
              <div>
                <h2 className="font-serif text-2xl font-bold text-foreground flex items-center gap-2">
                  <ShoppingBag className="w-6 h-6 text-primary" /> Mercado Interno
                </h2>
                <p className="text-muted-foreground text-sm mt-1 max-w-md">
                  Vende, regala o intercambia artículos directamente con tus vecinos del edificio {building?.name}. Transacciones más fáciles, seguras y sin envíos.
                </p>
              </div>
              <Button onClick={() => setShowCreateModal(true)} className="btn-premium gap-2 whitespace-nowrap">
                <Plus className="w-4 h-4" /> Crear Publicación
              </Button>
            </div>

            <div className="mb-6 flex justify-between items-end border-b border-border/30 pb-4">
              <div>
                <h3 className="font-semibold text-foreground">Artículos en Venta</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {filteredMarketplace.length} artículos publicados por tus vecinos
                </p>
              </div>
            </div>

            {filteredMarketplace.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMarketplace.map((item) => {
                  const seller = mockUsers.find(u => u.id === item.sellerId)
                  return (
                    <MarketplaceCard key={item.id} item={item} seller={seller} onContact={(i) => alert(`Contactando vendedor de: ${i.title}...`)} />
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-20 glass-card rounded-xl">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                <p className="text-foreground font-medium mb-1">Ningún vecino está vendiendo nada actualmente.</p>
                <p className="text-muted-foreground text-sm mb-4">¡Anímate a ser el primero en publicar ese mueble que no usas!</p>
                <Button onClick={() => setShowCreateModal(true)} variant="outline" className="gap-2">
                  <Plus className="w-4 h-4" /> Crear Primera Publicación
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {qrPromo && (
        <QRModal promotion={qrPromo} onClose={() => setQrPromo(null)} />
      )}

      {showCreateModal && (
        <CreateMarketplaceModal onClose={() => setShowCreateModal(false)} onSave={handleCreateMarketplaceItem} />
      )}
    </div>
  )
}
