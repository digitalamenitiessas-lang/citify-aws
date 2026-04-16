'use client'

import { useMemo, useState } from 'react'
import {
  Building2,
  Gift,
  MapPin,
  Package,
  Plus,
  QrCode,
  Search,
  ShoppingBag,
  Store,
  Tag,
  Ticket,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PromotionCard } from '@/components/promotion-card'
import { MarketplaceCard } from '@/components/marketplace-card'
import { ImageUploadField } from '@/components/image-upload-field'
import { IMAGE_RULES, CATEGORIES } from '@/lib/constants'
import type { ConsumerDashboardData, MarketplaceCondition, MarketplaceItem, Promotion } from '@/lib/types'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

function QRModal({ promotion, onClose }: { promotion: Promotion; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(10,6,2,0.8)', backdropFilter: 'blur(4px)' }}>
      <div className="glass-card rounded-2xl p-8 w-full max-w-sm flex flex-col items-center relative text-center">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-5 h-5" />
        </button>
        <h2 className="font-serif text-xl font-bold text-foreground mb-1 mt-2">{promotion.businessName}</h2>
        <p className="text-muted-foreground text-sm mb-6">{promotion.title}</p>
        <div className="bg-white p-6 rounded-xl border border-border/50 mb-6 w-56 h-56 flex items-center justify-center">
          <QrCode className="w-full h-full text-foreground" strokeWidth={1} />
        </div>
        <p className="text-xs text-muted-foreground mb-4">Mostra este codigo QR en el local para registrar el canje.</p>
        <Button onClick={onClose} className="w-full btn-premium">Cerrar</Button>
      </div>
    </div>
  )
}

function CreateMarketplaceModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (payload: { title: string; price: number; description: string; condition: MarketplaceCondition }, file: File | null) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [condition, setCondition] = useState<MarketplaceCondition>('Buen Estado')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    try {
      await onSave({ title, price: Number(price), description, condition }, imageFile)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(10,6,2,0.8)', backdropFilter: 'blur(4px)' }}>
      <div className="glass-card rounded-2xl p-8 w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-5 h-5" />
        </button>
        <h2 className="font-serif text-xl font-bold text-foreground mb-6">Nueva publicacion vecinal</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Articulo</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="Ej: Bicicleta de paseo" className="bg-input/50 border-border/50" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Precio ($)</Label>
              <Input type="number" value={price} onChange={(event) => setPrice(event.target.value)} required placeholder="0" className="bg-input/50 border-border/50" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Condicion</Label>
            <select value={condition} onChange={(event) => setCondition(event.target.value as MarketplaceCondition)} className="w-full rounded-lg px-3 py-2 text-sm bg-input/50 border border-border/50 text-foreground">
              <option value="Nuevo">Nuevo</option>
              <option value="Como Nuevo">Como Nuevo</option>
              <option value="Buen Estado">Buen Estado</option>
              <option value="Usado">Usado</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Descripcion</Label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              required
              className="w-full rounded-lg px-3 py-2 text-sm bg-input/50 border border-border/50 text-foreground placeholder:text-muted-foreground outline-none resize-none transition-colors"
              placeholder="Detalles, zona de retiro, estado real..."
            />
          </div>

          <ImageUploadField
            label={IMAGE_RULES.marketplace.label}
            helpText={IMAGE_RULES.marketplace.recommended}
            maxSizeMb={IMAGE_RULES.marketplace.maxSizeMb}
            minWidth={IMAGE_RULES.marketplace.minWidth}
            minHeight={IMAGE_RULES.marketplace.minHeight}
            onFileChange={setImageFile}
          />

          <Button type="submit" className="w-full btn-premium mt-2" disabled={loading}>
            {loading ? 'Publicando...' : 'Publicar articulo'}
          </Button>
        </form>
      </div>
    </div>
  )
}

function buildMarketplacePath(profileId: string, itemId: string, file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  return `marketplace/${profileId}/${itemId}-${Date.now()}.${extension}`
}

async function uploadMarketplaceImage(path: string, file: File) {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    throw new Error('Supabase no esta configurado.')
  }

  const { error } = await supabase.storage.from('marketplace-images').upload(path, file, { upsert: true })
  if (error) {
    throw error
  }

  return supabase.storage.from('marketplace-images').getPublicUrl(path).data.publicUrl
}

export function ConsumerDashboard({
  initialData,
  profileId,
  profileName,
  avatarText,
}: {
  initialData: ConsumerDashboardData
  profileId: string
  profileName: string
  avatarText: string
}) {
  const [mainView, setMainView] = useState<'promotions' | 'marketplace' | 'map' | 'my-coupons'>('promotions')
  const [selectedCategory, setSelectedCategory] = useState('Todas')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'building'>('all')
  const [qrPromotion, setQrPromotion] = useState<Promotion | null>(null)
  const [savedCoupons, setSavedCoupons] = useState<string[]>(initialData.savedPromotionIds)
  const [usedCoupons, setUsedCoupons] = useState<string[]>(initialData.usedPromotionIds)
  const [marketplaceItems, setMarketplaceItems] = useState<MarketplaceItem[]>(initialData.marketplaceItems)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const filteredPromotions = useMemo(() => {
    return initialData.promotions.filter((promotion) => {
      const matchCategory = selectedCategory === 'Todas' || promotion.category === selectedCategory
      const query = search.trim().toLowerCase()
      const matchSearch =
        !query ||
        promotion.title.toLowerCase().includes(query) ||
        promotion.businessName.toLowerCase().includes(query) ||
        promotion.description.toLowerCase().includes(query)
      const matchBuilding = activeTab === 'building' ? promotion.buildingId === initialData.building?.id : true
      return matchCategory && matchSearch && matchBuilding
    })
  }, [activeTab, initialData.building?.id, initialData.promotions, search, selectedCategory])

  const filteredMarketplace = useMemo(
    () => marketplaceItems.filter((item) => item.buildingId === initialData.building?.id),
    [initialData.building?.id, marketplaceItems],
  )

  const buildingPromosCount = useMemo(
    () => initialData.promotions.filter((promotion) => promotion.buildingId === initialData.building?.id).length,
    [initialData.building?.id, initialData.promotions],
  )

  async function toggleSave(promotion: Promotion) {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      toast.error('Supabase no esta configurado.')
      return
    }

    if (savedCoupons.includes(promotion.id)) {
      const { error } = await supabase.from('saved_promotions').delete().eq('profile_id', profileId).eq('promotion_id', promotion.id)
      if (error) {
        toast.error(error.message)
        return
      }
      setSavedCoupons((prev) => prev.filter((id) => id !== promotion.id))
      toast.success('Cupon removido de tu billetera.')
      return
    }

    const { error } = await supabase.from('saved_promotions').insert({ profile_id: profileId, promotion_id: promotion.id })
    if (error) {
      toast.error(error.message)
      return
    }

    setSavedCoupons((prev) => [...prev, promotion.id])
    toast.success('Cupon guardado.')
  }

  async function markUsed(promotion: Promotion) {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      toast.error('Supabase no esta configurado.')
      return
    }

    const { error } = await supabase.from('promotion_redemptions').insert({
      profile_id: profileId,
      promotion_id: promotion.id,
      status: 'redeemed',
    })

    if (error) {
      toast.error(error.message)
      return
    }

    setUsedCoupons((prev) => (prev.includes(promotion.id) ? prev : [...prev, promotion.id]))
    toast.success('Canje registrado.')
  }

  async function createMarketplaceItem(payload: { title: string; price: number; description: string; condition: MarketplaceCondition }, file: File | null) {
    const supabase = getSupabaseBrowserClient()
    if (!supabase || !initialData.building) {
      toast.error('Supabase no esta configurado o el perfil no tiene edificio.')
      return
    }

    const itemId = crypto.randomUUID()
    let imagePath: string | null = null
    let imageUrl: string | null = null

    if (file) {
      imagePath = buildMarketplacePath(profileId, itemId, file)
      imageUrl = await uploadMarketplaceImage(imagePath, file)
    }

    const { error } = await supabase.from('marketplace_items').insert({
      id: itemId,
      seller_profile_id: profileId,
      building_id: initialData.building.id,
      title: payload.title,
      price: payload.price,
      description: payload.description,
      condition: payload.condition,
      image_path: imagePath,
      is_active: true,
    })

    if (error) {
      toast.error(error.message)
      return
    }

    setMarketplaceItems((prev) => [
      {
        id: itemId,
        title: payload.title,
        price: payload.price,
        description: payload.description,
        condition: payload.condition,
        sellerId: profileId,
        sellerName: profileName,
        sellerAvatar: avatarText,
        sellerPhone: null,
        buildingId: initialData.building.id,
        createdAt: new Date().toISOString(),
        imagePath,
        imageUrl,
        isActive: true,
      },
      ...prev,
    ])

    toast.success('Publicacion creada.')
  }

  const categories = useMemo(() => {
    const values = new Set<string>(CATEGORIES)
    initialData.promotions.forEach((promotion) => values.add(promotion.category))
    return ['Todas', ...Array.from(values).filter((value) => value !== 'Todas')]
  }, [initialData.promotions])

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="glass-card rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #B85C38, #8F4020)' }}>
            {avatarText}
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">Hola, {profileName.split(' ')[0]}</h1>
            <p className="text-muted-foreground text-sm">Consorcio {initialData.building?.name ?? 'sin asignar'}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          {[
            { key: 'promotions', label: 'Beneficios', icon: Tag },
            { key: 'marketplace', label: 'Mercado Vecinal', icon: ShoppingBag },
            { key: 'map', label: 'Locales', icon: MapPin },
            { key: 'my-coupons', label: 'Mis Cupones', icon: Ticket },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setMainView(item.key as typeof mainView)}
              className={`pb-3 text-sm font-medium transition-colors relative ${mainView === item.key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <div className="flex items-center gap-2">
                <item.icon className="w-4 h-4" />
                {item.label}
                {item.key === 'my-coupons' && savedCoupons.length > 0 ? (
                  <span className="bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{savedCoupons.length}</span>
                ) : null}
              </div>
              {mainView === item.key ? <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" /> : null}
            </button>
          ))}
        </div>
      </div>

      {mainView === 'promotions' ? (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            {[
              { label: 'Promociones activas', value: initialData.promotions.length, icon: Store },
              { label: 'Exclusivas de tu edificio', value: buildingPromosCount, icon: Building2 },
              { label: 'Cupones guardados', value: savedCoupons.length, icon: Gift },
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

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex gap-2 p-1 rounded-xl w-full sm:w-fit" style={{ background: 'rgba(0,0,0,0.03)' }}>
              <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 sm:flex-none flex justify-center items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'all' ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}
                style={activeTab === 'all' ? { background: 'linear-gradient(135deg, #B85C38, #8F4020)' } : {}}
              >
                <Tag className="w-4 h-4" />
                Toda la red
              </button>
              <button
                onClick={() => setActiveTab('building')}
                className={`flex-1 sm:flex-none flex justify-center items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'building' ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}
                style={activeTab === 'building' ? { background: 'linear-gradient(135deg, #B85C38, #8F4020)' } : {}}
              >
                <Building2 className="w-4 h-4" />
                En mi consorcio
              </button>
            </div>

            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar promociones..." value={search} onChange={(event) => setSearch(event.target.value)} className="pl-10 bg-input/50 border-border/50" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  selectedCategory === category ? 'text-white border border-primary/50' : 'text-muted-foreground border border-border/50 hover:border-primary/30 hover:text-foreground'
                }`}
                style={selectedCategory === category ? { background: 'linear-gradient(135deg, #B85C38, #8F4020)' } : { background: 'rgba(184,92,56,0.05)' }}
              >
                {category}
              </button>
            ))}
          </div>

          {filteredPromotions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPromotions.map((promotion) => (
                <PromotionCard
                  key={promotion.id}
                  promotion={promotion}
                  showSaveAction
                  isSaved={savedCoupons.includes(promotion.id)}
                  onSaveToggle={toggleSave}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 glass-card rounded-xl">
              <Gift className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-foreground font-medium mb-1">No hay promociones disponibles aqui</p>
              <p className="text-muted-foreground text-sm">Cuando el negocio cargue nuevas promos en Supabase apareceran aca.</p>
            </div>
          )}
        </div>
      ) : null}

      {mainView === 'marketplace' ? (
        <div>
          <div className="glass-card rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 border-primary/10">
            <div>
              <h2 className="font-serif text-2xl font-bold text-foreground flex items-center gap-2">
                <ShoppingBag className="w-6 h-6 text-primary" /> Mercado interno
              </h2>
              <p className="text-muted-foreground text-sm mt-1 max-w-md">
                Publicaciones reales de tus vecinos, con carga asistida de imagenes en Supabase Storage.
              </p>
            </div>
            <Button onClick={() => setShowCreateModal(true)} className="btn-premium gap-2 whitespace-nowrap">
              <Plus className="w-4 h-4" /> Crear publicacion
            </Button>
          </div>

          {filteredMarketplace.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMarketplace.map((item) => (
                <MarketplaceCard
                  key={item.id}
                  item={item}
                  onContact={(value) => {
                    if (value.sellerPhone) {
                      window.location.href = `tel:${value.sellerPhone}`
                    } else {
                      toast.message(`Contacta a ${value.sellerName} desde administracion del edificio.`)
                    }
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 glass-card rounded-xl">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
              <p className="text-foreground font-medium mb-1">Aun no hay publicaciones en tu edificio.</p>
              <p className="text-muted-foreground text-sm mb-4">La base arranco vacia, asi que puedes ser la primera persona en publicar.</p>
              <Button onClick={() => setShowCreateModal(true)} variant="outline" className="gap-2">
                <Plus className="w-4 h-4" /> Crear primera publicacion
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {mainView === 'my-coupons' ? (
        <div className="mb-8">
          <div className="glass-card rounded-2xl p-6 mb-8 border-primary/10 relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="font-serif text-2xl font-bold text-foreground flex items-center gap-2">
                <Ticket className="w-6 h-6 text-primary" /> Mi billetera de cupones
              </h2>
              <p className="text-muted-foreground text-sm mt-1 max-w-xl">
                Guarda promociones, abre el QR y registra el canje en la base real.
              </p>
            </div>
          </div>

          {savedCoupons.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {initialData.promotions.filter((promotion) => savedCoupons.includes(promotion.id)).map((promotion) => (
                <PromotionCard
                  key={promotion.id}
                  promotion={promotion}
                  showUseAction
                  isUsed={usedCoupons.includes(promotion.id)}
                  onUse={(value) => setQrPromotion(value)}
                  onMarkUsed={markUsed}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 glass-card rounded-xl">
              <Ticket className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-foreground font-medium mb-1">Tu billetera esta vacia</p>
              <p className="text-muted-foreground text-sm">Guarda promociones para empezar a usar cupones reales.</p>
            </div>
          )}
        </div>
      ) : null}

      {mainView === 'map' ? (
        <div className="glass-card rounded-2xl p-6">
          <h2 className="font-serif text-2xl font-bold text-foreground flex items-center gap-2 mb-2">
            <MapPin className="w-6 h-6 text-primary" /> Comercios cercanos
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            En esta etapa dejamos el mapa consumiendo datos reales, pero representado como listado visual sin geolocalizacion avanzada.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from(new Map(initialData.promotions.map((promotion) => [promotion.businessId, promotion])).values()).map((promotion) => (
              <div key={promotion.businessId} className="rounded-xl border border-border/50 bg-secondary/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{promotion.businessName}</h3>
                    <p className="text-sm text-muted-foreground">Promociones activas en la plataforma</p>
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    {initialData.promotions.filter((item) => item.businessId === promotion.businessId).length} promos
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {qrPromotion ? <QRModal promotion={qrPromotion} onClose={() => setQrPromotion(null)} /> : null}
      {showCreateModal ? <CreateMarketplaceModal onClose={() => setShowCreateModal(false)} onSave={createMarketplaceItem} /> : null}
    </div>
  )
}
