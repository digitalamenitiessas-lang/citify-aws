'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  CircleAlert,
  Flame,
  Gift,
  Home,
  MapPin,
  Package,
  Plus,
  QrCode,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  Ticket,
  Info,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NeighborCasesPanel } from '@/components/complaints/neighbor-cases-panel'
import { ImageUploadField } from '@/components/image-upload-field'
import { ChatWidget } from '@/components/ai/chat-widget'
import { IMAGE_RULES, CATEGORIES } from '@/lib/constants'
import type { ConsumerDashboardData, MarketplaceCondition, MarketplaceItem, Promotion, PromotionRedemptionToken } from '@/lib/types'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { createHouseholdNeighbor } from '@/app/usuario/actions'
import DynamicMap from '@/components/map/map-view-dynamic'
import type { MapMarker } from '@/components/map/map-view'

// ─── HELPERS ────────────────────────────────────────────────────────────────

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3 // metres
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}


function buildMarketplacePath(profileId: string, itemId: string, file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  return `marketplace/${profileId}/${itemId}-${Date.now()}.${ext}`
}

async function uploadMarketplaceImage(path: string, file: File) {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) throw new Error('Supabase no esta configurado.')
  const { error } = await supabase.storage.from('marketplace-images').upload(path, file, { upsert: true })
  if (error) throw error
  return supabase.storage.from('marketplace-images').getPublicUrl(path).data.publicUrl
}

// ─── QR MODAL ───────────────────────────────────────────────────────────────

function QRModal({ promotion, onClose }: { promotion: Promotion; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(10,6,2,0.85)', backdropFilter: 'blur(6px)' }}>
      <div className="glass-card rounded-2xl p-8 w-full max-w-sm flex flex-col items-center relative text-center">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-5 h-5" />
        </button>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, #F04E23, #C73E15)' }}>
          <QrCode className="w-7 h-7 text-white" />
        </div>
        <h2 className="font-serif text-xl font-bold text-foreground mb-0.5">{promotion.businessName}</h2>
        <p className="text-muted-foreground text-sm mb-6">{promotion.title}</p>
        <div className="mb-6 flex h-52 w-52 items-center justify-center rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
          <QrCode className="w-full h-full text-foreground" strokeWidth={1} />
        </div>
        <p className="text-xs text-muted-foreground mb-5">Mostra este código QR en el local para canjear el beneficio.</p>
        <button onClick={onClose} className="w-full py-3 rounded-xl text-sm font-semibold text-white btn-premium">Cerrar</button>
      </div>
    </div>
  )
}

function PromotionQrModal({
  promotion,
  token,
  loading,
  onClose,
}: {
  promotion: Promotion
  token: PromotionRedemptionToken | null
  loading: boolean
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(10,6,2,0.85)', backdropFilter: 'blur(6px)' }}>
      <div className="glass-card rounded-2xl p-8 w-full max-w-sm flex flex-col items-center relative text-center">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-5 h-5" />
        </button>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, #F04E23, #C73E15)' }}>
          <QrCode className="w-7 h-7 text-white" />
        </div>
        <h2 className="font-serif text-xl font-bold text-foreground mb-0.5">{promotion.businessName}</h2>
        <p className="text-muted-foreground text-sm mb-6">{promotion.title}</p>
        <div className="mb-4 flex min-h-56 w-56 items-center justify-center rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <QrCode className="w-12 h-12 text-primary/60" strokeWidth={1.25} />
              <p className="text-xs font-medium">Preparando tu codigo...</p>
            </div>
          ) : token ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=224x224&data=${encodeURIComponent(token.qrValue)}`}
              alt={`QR de ${promotion.title}`}
              className="h-52 w-52 rounded-xl"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <QrCode className="w-12 h-12 text-primary/60" strokeWidth={1.25} />
              <p className="text-xs font-medium">No pudimos generar el QR.</p>
            </div>
          )}
        </div>
        <div className="mb-5 w-full rounded-2xl border border-border/60 bg-background/80 p-4 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Codigo unico</p>
          <p className="mt-2 text-lg font-bold tracking-[0.24em] text-foreground">{token?.token ?? '---'}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {token ? `Valido hasta ${new Date(token.expiresAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}.` : 'Vuelve a intentarlo en unos segundos.'}
          </p>
        </div>
        <p className="text-xs text-muted-foreground mb-5">Mostra este QR o el codigo al negocio. El canje queda disponible una sola vez por promocion.</p>
        <button onClick={onClose} className="w-full py-3 rounded-xl text-sm font-semibold text-white btn-premium">Cerrar</button>
      </div>
    </div>
  )
}

// ─── CREATE MARKETPLACE MODAL ────────────────────────────────────────────────

function CreateMarketplaceModal({ onClose, onSave }: {
  onClose: () => void
  onSave: (payload: { title: string; price: number; description: string; condition: MarketplaceCondition }, file: File | null) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [condition, setCondition] = useState<MarketplaceCondition>('Buen Estado')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try { await onSave({ title, price: Number(price), description, condition }, imageFile); onClose() }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(10,6,2,0.85)', backdropFilter: 'blur(6px)' }}>
      <div className="glass-card rounded-2xl p-8 w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"><X className="w-5 h-5" /></button>
        <h2 className="font-serif text-xl font-bold text-foreground mb-6">Nueva publicación vecinal</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Artículo</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} required placeholder="Ej: Bicicleta de paseo" className="bg-input/50 border-border/50" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Precio ($)</Label>
              <Input type="number" value={price} onChange={e => setPrice(e.target.value)} required placeholder="0" className="bg-input/50 border-border/50" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Condición</Label>
            <select value={condition} onChange={e => setCondition(e.target.value as MarketplaceCondition)} className="w-full rounded-lg px-3 py-2 text-sm bg-input/50 border border-border/50 text-foreground">
              <option>Nuevo</option><option>Como Nuevo</option><option>Buen Estado</option><option>Usado</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Descripción</Label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} required className="w-full rounded-lg px-3 py-2 text-sm bg-input/50 border border-border/50 text-foreground placeholder:text-muted-foreground outline-none resize-none" placeholder="Detalles, zona de retiro, estado real..." />
          </div>
          <ImageUploadField label={IMAGE_RULES.marketplace.label} helpText={IMAGE_RULES.marketplace.recommended} maxSizeMb={IMAGE_RULES.marketplace.maxSizeMb} minWidth={IMAGE_RULES.marketplace.minWidth} minHeight={IMAGE_RULES.marketplace.minHeight} onFileChange={setImageFile} />
          <button type="submit" className="w-full py-3 rounded-xl text-sm font-semibold text-white btn-premium mt-2" disabled={loading}>
            {loading ? 'Publicando...' : 'Publicar artículo'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── DISCOUNT BADGE ───────────────────────────────────────────────────────────

function DiscountBadge({ discount }: { discount: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #F04E23, #C73E15)' }}>
      {discount}
    </span>
  )
}

// ─── FEATURED BUSINESS CARD (large card for horizontal scroll) ────────────────

function FeaturedBusinessCard({ promotion, isSaved, onSaveToggle, onWantCoupon }: {
  promotion: Promotion
  isSaved: boolean
  onSaveToggle: (p: Promotion) => void
  onWantCoupon: (p: Promotion) => void
}) {
  const isExpired = promotion.expirationDate < new Date().toISOString().slice(0, 10)
  return (
    <div className="flex-shrink-0 w-52 rounded-2xl overflow-hidden border border-border/60 bg-card" style={{ boxShadow: '0 4px 20px rgba(0, 0, 0,0.08)' }}>
      {/* image */}
      <div className="relative h-32 bg-gradient-to-br from-secondary to-muted overflow-hidden">
        {promotion.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={promotion.imageUrl} alt={promotion.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Tag className="w-10 h-10 text-muted-foreground opacity-40" />
          </div>
        )}
        {/* overlay pill */}
        <div className="absolute top-2 left-2">
          <DiscountBadge discount={promotion.discount} />
        </div>
        {/* save heart */}
        <button
          onClick={() => onSaveToggle(promotion)}
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all"
          style={{ background: isSaved ? 'linear-gradient(135deg,#F04E23,#C73E15)' : 'rgba(255,255,255,0.85)' }}
        >
          <Gift className="w-3.5 h-3.5" style={{ color: isSaved ? '#fff' : '#F04E23' }} />
        </button>
      </div>

      {/* content */}
      <div className="p-3">
        <div className="flex items-center gap-1 mb-1">
          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
          <span className="text-xs text-muted-foreground">
            {(4 + (promotion.id.charCodeAt(0) % 10) / 10).toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground ml-1">· {promotion.usageCount} canjes</span>
        </div>
        <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-1">{promotion.businessName}</h3>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{promotion.title}</p>

        <div className="flex gap-2 mt-3">
          {isExpired ? (
            <span className="flex-1 text-center py-1.5 rounded-lg text-xs font-medium text-muted-foreground bg-muted">Vencido</span>
          ) : (
            <>
              <button
                onClick={() => onWantCoupon(promotion)}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white btn-premium"
              >
                {isSaved ? 'Lo quiero' : 'Lo quiero'}
              </button>
              <button
                onClick={() => onSaveToggle(promotion)}
                className="px-2 py-1.5 rounded-lg text-xs font-medium border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
                style={isSaved ? { background: 'rgba(240, 78, 35,0.1)', color: 'var(--primary)', borderColor: 'rgba(240, 78, 35,0.3)' } : {}}
              >
                {isSaved ? '✓' : '+'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── HOT COUPON CARD (compact for "más canjeados") ───────────────────────────

function HotCouponCard({ promotion, isSaved, onSaveToggle, onWantCoupon }: {
  promotion: Promotion
  isSaved: boolean
  onSaveToggle: (p: Promotion) => void
  onWantCoupon: (p: Promotion) => void
}) {
  const isExpired = promotion.expirationDate < new Date().toISOString().slice(0, 10)
  return (
    <div className="flex-shrink-0 w-44 rounded-2xl overflow-hidden border border-border/60 bg-card" style={{ boxShadow: '0 4px 20px rgba(0, 0, 0,0.08)' }}>
      <div className="relative h-24 bg-gradient-to-br from-secondary to-muted overflow-hidden">
        {promotion.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={promotion.imageUrl} alt={promotion.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Flame className="w-8 h-8 text-primary opacity-40" />
          </div>
        )}
        <div className="absolute top-1.5 left-1.5">
          <DiscountBadge discount={promotion.discount} />
        </div>
      </div>
      <div className="p-2.5">
        <p className="font-semibold text-xs text-foreground line-clamp-1">{promotion.businessName}</p>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-tight">{promotion.title}</p>
        <div className="mt-2">
          {isExpired ? (
            <span className="block text-center py-1.5 rounded-lg text-xs font-medium text-muted-foreground bg-muted">Vencido</span>
          ) : (
            <button onClick={() => onWantCoupon(promotion)} className="w-full py-1.5 rounded-lg text-xs font-semibold text-white btn-premium">
              Lo quiero
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── BUILDING EXCLUSIVE CARD ─────────────────────────────────────────────────

function ExclusiveCard({ promotion, isSaved, onSaveToggle, onWantCoupon }: {
  promotion: Promotion
  isSaved: boolean
  onSaveToggle: (p: Promotion) => void
  onWantCoupon: (p: Promotion) => void
}) {
  const isExpired = promotion.expirationDate < new Date().toISOString().slice(0, 10)
  return (
    <div className="flex-shrink-0 w-52 rounded-2xl overflow-hidden border border-primary/20 bg-card relative" style={{ boxShadow: '0 4px 24px rgba(240, 78, 35,0.12)' }}>
      <div className="absolute top-2 left-2 z-10">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#F04E23,#C73E15)' }}>
          <Sparkles className="w-3 h-3" /> Exclusivo
        </span>
      </div>
      <div className="relative h-32 bg-gradient-to-br from-secondary to-muted overflow-hidden">
        {promotion.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={promotion.imageUrl} alt={promotion.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="w-10 h-10 text-primary opacity-30" />
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-foreground text-sm line-clamp-1">{promotion.businessName}</h3>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{promotion.title}</p>
        <DiscountBadge discount={promotion.discount} />
        <div className="flex gap-2 mt-3">
          {isExpired ? (
            <span className="flex-1 text-center py-1.5 rounded-lg text-xs font-medium text-muted-foreground bg-muted">Vencido</span>
          ) : (
            <button onClick={() => onWantCoupon(promotion)} className="flex-1 py-1.5 rounded-xl text-xs font-bold text-white btn-premium">
              Lo quiero
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── SECTION HEADER ──────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, title, onSeeAll }: { icon: typeof Tag; title: string; onSeeAll?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <h2 className="font-bold text-foreground text-base">{title}</h2>
      </div>
      {onSeeAll && (
        <button onClick={onSeeAll} className="flex items-center gap-0.5 text-xs text-primary font-medium hover:underline">
          Ver todo <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ─── FULL PROMOTIONS VIEW ─────────────────────────────────────────────────────

function FullPromotionsView({ promotions, savedCoupons, onSaveToggle, onWantCoupon, onBack, title }: {
  promotions: Promotion[]
  savedCoupons: string[]
  onSaveToggle: (p: Promotion) => void
  onWantCoupon: (p: Promotion) => void
  onBack: () => void
  title: string
}) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todas')

  const categories = useMemo(() => {
    const s = new Set<string>(CATEGORIES)
    promotions.forEach(p => s.add(p.category))
    return ['Todas', ...Array.from(s).filter(c => c !== 'Todas')]
  }, [promotions])

  const filtered = useMemo(() => promotions.filter(p => {
    const q = search.trim().toLowerCase()
    const matchSearch = !q || p.title.toLowerCase().includes(q) || p.businessName.toLowerCase().includes(q)
    const matchCat = category === 'Todas' || p.category === category
    return matchSearch && matchCat
  }), [promotions, search, category])

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <h2 className="font-bold text-foreground text-lg">{title}</h2>
      </div>

      {/* search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar promociones..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-input/50 border-border/50" />
      </div>

      {/* categories */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${category === cat ? 'text-white' : 'text-muted-foreground border border-border/50 hover:text-foreground'}`}
            style={category === cat ? { background: 'linear-gradient(135deg,#F04E23,#C73E15)' } : { background: 'rgba(240, 78, 35,0.05)' }}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <div key={p.id} className="glass-card glass-card-hover rounded-2xl overflow-hidden">
              <div className="relative h-36 bg-gradient-to-br from-secondary to-muted">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Tag className="w-10 h-10 text-muted-foreground opacity-30" /></div>
                )}
                <div className="absolute top-2 left-2"><DiscountBadge discount={p.discount} /></div>
                <button onClick={() => onSaveToggle(p)} className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all"
                  style={{ background: savedCoupons.includes(p.id) ? 'linear-gradient(135deg,#F04E23,#C73E15)' : 'rgba(255,255,255,0.85)' }}>
                  <Gift className="w-3.5 h-3.5" style={{ color: savedCoupons.includes(p.id) ? '#fff' : '#F04E23' }} />
                </button>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-foreground text-sm">{p.businessName}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 mb-3 line-clamp-2">{p.title}</p>
                <button onClick={() => onWantCoupon(p)} className="w-full py-2.5 rounded-xl text-xs font-bold text-white btn-premium">
                  Lo quiero
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 glass-card rounded-xl">
          <Gift className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-foreground font-medium mb-1">No hay promociones</p>
          <p className="text-muted-foreground text-sm">Probá cambiando el filtro o la búsqueda.</p>
        </div>
      )}
    </div>
  )
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────

type MainView = 'home' | 'all-promos' | 'building-promos' | 'marketplace' | 'my-coupons' | 'stores' | 'complaints' | 'household'

export function ConsumerDashboard({ initialData, profileId, profileName, avatarText }: {
  initialData: ConsumerDashboardData
  profileId: string
  profileName: string
  avatarText: string
}) {
  const [mainView, setMainView] = useState<MainView>('home')
  const [qrPromotion, setQrPromotion] = useState<Promotion | null>(null)
  const [qrToken, setQrToken] = useState<PromotionRedemptionToken | null>(null)
  const [isLoadingQr, setIsLoadingQr] = useState(false)
  const [savedCoupons, setSavedCoupons] = useState<string[]>(initialData.savedPromotionIds)
  const [usedCoupons, setUsedCoupons] = useState<string[]>(initialData.usedPromotionIds)
  const [marketplaceItems, setMarketplaceItems] = useState<MarketplaceItem[]>(initialData.marketplaceItems)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [search, setSearch] = useState('')
  const [couponFilter, setCouponFilter] = useState<'disponibles' | 'usados'>('disponibles')
  const [isAddingHousehold, startHouseholdTransition] = useTransition()
  const [householdMembers, setHouseholdMembers] = useState(initialData.householdMembers)
  const [householdDraft, setHouseholdDraft] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: 'Citify2026!',
  })

  const firstName = profileName.split(' ')[0]
  const buildingName = initialData.building?.name ?? 'tu consorcio'
  const buildingId = initialData.building?.id
  const principalMembership = initialData.unitMemberships.find((membership) => membership.relationshipType === 'vecino_principal')
  const additionalHouseholdCount = householdMembers.filter((membership) => membership.relationshipType === 'vecino_adicional' && membership.active).length
  const canAddHousehold = Boolean(principalMembership) && additionalHouseholdCount < 4

  const allPromos = initialData.promotions
  const buildingPromos = useMemo(() => allPromos.filter(p => p.buildingId === buildingId), [allPromos, buildingId])
  const mostRedeemed = useMemo(() => [...allPromos].sort((a, b) => b.usageCount - a.usageCount).slice(0, 8), [allPromos])
  const featuredPromos = useMemo(() => allPromos.slice(0, 8), [allPromos])

  const filteredMarketplace = useMemo(() => marketplaceItems.filter(i => i.buildingId === buildingId), [marketplaceItems, buildingId])

  const uniqueBusinesses = useMemo(() => {
    const map = new Map<string, Promotion>()
    allPromos.forEach(p => { if (!map.has(p.businessId)) map.set(p.businessId, p) })
    return Array.from(map.values())
  }, [allPromos])

  const sortedMapBusinesses = useMemo(() => {
    let list = initialData.businesses.filter(b => b.latitude != null && b.longitude != null)
    if (initialData.building?.latitude && initialData.building?.longitude) {
      const bLat = initialData.building.latitude
      const bLng = initialData.building.longitude
      list = list.map(b => {
        const dist = calculateDistance(bLat, bLng, b.latitude!, b.longitude!)
        return { ...b, distanceToBuilding: dist }
      }).sort((a, b) => (a as any).distanceToBuilding - (b as any).distanceToBuilding)
    }
    return list
  }, [initialData.businesses, initialData.building])

  const mapMarkers: MapMarker[] = useMemo(() => {
    const markers: MapMarker[] = []
    if (initialData.building?.latitude && initialData.building?.longitude) {
      markers.push({
        id: 'building',
        lat: initialData.building.latitude,
        lng: initialData.building.longitude,
        type: 'building',
        popupContent: <div className="font-bold text-center">Tu edificio<br/><span className="text-xs font-normal">{initialData.building.name}</span></div>
      })
    }
    sortedMapBusinesses.forEach(b => {
      markers.push({
        id: b.id,
        lat: b.latitude!,
        lng: b.longitude!,
        type: 'business',
        popupContent: (
          <div className="flex flex-col gap-1 items-center min-w-[120px]">
            <span className="font-bold">{b.name}</span>
            <span className="text-xs text-muted-foreground">{b.address}</span>
            <span className="text-xs text-primary font-medium">{b.category}</span>
          </div>
        )
      })
    })
    return markers
  }, [sortedMapBusinesses, initialData.building])

  async function toggleSave(promotion: Promotion) {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) { toast.error('Supabase no está configurado.'); return }
    if (savedCoupons.includes(promotion.id)) {
      const { error } = await supabase.from('saved_promotions').delete().eq('profile_id', profileId).eq('promotion_id', promotion.id)
      if (error) { toast.error(error.message); return }
      setSavedCoupons(prev => prev.filter(id => id !== promotion.id))
      toast.success('Cupón removido de tu billetera.')
    } else {
      const { error } = await supabase.from('saved_promotions').insert({ profile_id: profileId, promotion_id: promotion.id })
      if (error) { toast.error(error.message); return }
      setSavedCoupons(prev => [...prev, promotion.id])
      toast.success('Cupón guardado.')
    }
  }

  async function handleWantCoupon(promotion: Promotion) {
    if (!savedCoupons.includes(promotion.id)) {
      const supabase = getSupabaseBrowserClient()
      if (!supabase) { toast.error('Supabase no está configurado.'); return }
      const { error } = await supabase.from('saved_promotions').insert({ profile_id: profileId, promotion_id: promotion.id })
      if (error) { toast.error(error.message); return }
      setSavedCoupons(prev => [...prev, promotion.id])
      toast.success('Cupón guardado en tu billetera.')
    }
    setMainView('my-coupons')
    setCouponFilter('disponibles')
  }

  async function markUsed(promotion: Promotion) {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) { toast.error('Supabase no está configurado.'); return }
    const { error } = await supabase.from('promotion_redemptions').insert({ profile_id: profileId, promotion_id: promotion.id, status: 'redeemed' })
    if (error) { toast.error(error.message); return }
    setUsedCoupons(prev => prev.includes(promotion.id) ? prev : [...prev, promotion.id])
    toast.success('Canje registrado.')
    setQrPromotion(null)
  }

  async function handleUse(promotion: Promotion) {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) { toast.error('Supabase no esta configurado.'); return }
    if (usedCoupons.includes(promotion.id)) {
      toast.error('Esta promocion ya fue usada.')
      return
    }

    setQrPromotion(promotion)
    setQrToken(null)
    setIsLoadingQr(true)

    const { data, error } = await supabase.rpc('create_promotion_redemption_token', {
      target_promotion_id: promotion.id,
    })

    setIsLoadingQr(false)

    if (error) {
      toast.error(error.message)
      setQrPromotion(null)
      return
    }

    const row = Array.isArray(data) ? data[0] : null
    if (!row) {
      toast.error('No se pudo generar el codigo del cupon.')
      setQrPromotion(null)
      return
    }

    setQrToken({
      id: row.id,
      token: row.token,
      qrValue: row.qr_value,
      expiresAt: row.expires_at,
      promotionId: row.promotion_id,
      promotionTitle: row.promotion_title,
      businessName: row.business_name,
    })
  }

  async function createMarketplaceItem(payload: { title: string; price: number; description: string; condition: MarketplaceCondition }, file: File | null) {
    const supabase = getSupabaseBrowserClient()
    if (!supabase || !initialData.building) { toast.error('No hay edificio asignado.'); return }
    const itemId = crypto.randomUUID()
    let imagePath: string | null = null
    let imageUrl: string | null = null
    if (file) { imagePath = buildMarketplacePath(profileId, itemId, file); imageUrl = await uploadMarketplaceImage(imagePath, file) }
    const { error } = await supabase.from('marketplace_items').insert({ id: itemId, seller_profile_id: profileId, building_id: initialData.building.id, title: payload.title, price: payload.price, description: payload.description, condition: payload.condition, image_path: imagePath, is_active: true })
    if (error) { toast.error(error.message); return }
    setMarketplaceItems(prev => [{ id: itemId, title: payload.title, price: payload.price, description: payload.description, condition: payload.condition, sellerId: profileId, sellerName: profileName, sellerAvatar: avatarText, sellerPhone: null, buildingId: initialData.building!.id, createdAt: new Date().toISOString(), imagePath, imageUrl, isActive: true }, ...prev])
    toast.success('Publicación creada.')
  }

  // ── Bottom nav items
  function submitHouseholdNeighbor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!principalMembership) {
      toast.error('Solo el vecino principal puede agregar familiares.')
      return
    }

    startHouseholdTransition(async () => {
      try {
        const result = await createHouseholdNeighbor({
          unitId: principalMembership.unitId,
          fullName: householdDraft.fullName,
          email: householdDraft.email,
          phone: householdDraft.phone || null,
          password: householdDraft.password,
        })
        const now = new Date().toISOString()
        setHouseholdMembers((prev) => [
          ...prev,
          {
            id: result.profileId,
            unitId: principalMembership.unitId,
            buildingId: principalMembership.buildingId,
            profileId: result.profileId,
            relationshipType: 'vecino_adicional',
            isPrimary: false,
            active: true,
            createdByProfileId: profileId,
            createdAt: now,
            unitCode: principalMembership.unitCode,
            unitFloor: principalMembership.unitFloor,
            buildingName: principalMembership.buildingName,
            profile: {
              id: result.profileId,
              email: householdDraft.email,
              fullName: householdDraft.fullName,
              role: 'vecino',
              avatarText: householdDraft.fullName.slice(0, 2).toUpperCase(),
              businessId: null,
              buildingId: principalMembership.buildingId,
              floor: principalMembership.unitFloor,
              unit: principalMembership.unitCode,
              phone: householdDraft.phone || null,
              createdAt: now,
            },
          },
        ])
        setHouseholdDraft({ fullName: '', email: '', phone: '', password: 'Citify2026!' })
        toast.success('Familiar agregado a tu unidad.')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Error')
      }
    })
  }

  const nav = [
    { key: 'home', label: 'Inicio', icon: Home },
    { key: 'all-promos', label: 'Beneficios', icon: Tag },
    { key: 'my-coupons', label: 'Mis Cupones', icon: Ticket },
    { key: 'household', label: 'Unidad', icon: Users },
    { key: 'marketplace', label: 'Mercado', icon: ShoppingBag },
    { key: 'complaints', label: 'Expedientes', icon: CircleAlert },
    { key: 'stores', label: 'Ubicaciones', icon: MapPin },
  ] as const

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--background)' }}>

      {/* ── HERO HEADER ──────────────────────────────────────────────────── */}
      {mainView === 'home' && (
        <div className="relative overflow-hidden border-b border-border/60 bg-background px-5 pt-4 pb-4">
          {/* subtle orange glow — top right */}
          <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-60" style={{ background: 'radial-gradient(circle, rgba(240,78,35,0.18), transparent 70%)' }} />

          <div className="relative z-10">
            <div className="flex items-baseline flex-wrap gap-x-2 gap-y-0.5">
              <h1 className="text-foreground text-xl font-semibold tracking-tight leading-tight">
                Hola, {firstName} <span aria-hidden>👋</span>
              </h1>
              {initialData.building?.name && (
                <span className="inline-flex items-center gap-1 text-muted-foreground text-xs font-medium">
                  <Building2 className="w-3 h-3" />
                  {initialData.building.name}
                </span>
              )}
            </div>
            <p className="mt-1 text-muted-foreground text-xs">
              <span className="font-semibold text-primary">{allPromos.length} promos</span> disponibles
              {buildingPromos.length > 0 && <> · <span className="font-semibold text-primary">{buildingPromos.length}</span> exclusivas de tu edificio</>}
            </p>

            {/* Search bar */}
            <div className="mt-3 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={() => setMainView('all-promos')}
                placeholder="Buscar promociones..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none border border-border bg-card text-foreground transition-colors focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── CONTENT ──────────────────────────────────────────────────────── */}
      <div className="px-4 pt-5 max-w-5xl mx-auto">

        {/* HOME VIEW */}
        {mainView === 'home' && (
          <div className="space-y-8">

            {/* Locales Destacados */}
            <section>
              <SectionTitle icon={Star} title="Locales destacados" onSeeAll={() => setMainView('all-promos')} />
              <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
                {featuredPromos.length === 0 ? (
                  <div className="text-muted-foreground text-sm py-4">Sin promociones disponibles aún.</div>
                ) : featuredPromos.map(p => (
                  <FeaturedBusinessCard key={p.id} promotion={p} isSaved={savedCoupons.includes(p.id)} onSaveToggle={toggleSave} onWantCoupon={handleWantCoupon} />
                ))}
              </div>
            </section>

            {/* Más canjeados */}
            {mostRedeemed.some(p => p.usageCount > 0) && (
              <section>
                <SectionTitle icon={Flame} title="Más canjeados hoy" onSeeAll={() => setMainView('all-promos')} />
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
                  {mostRedeemed.filter(p => p.usageCount > 0).map(p => (
                    <HotCouponCard key={p.id} promotion={p} isSaved={savedCoupons.includes(p.id)} onSaveToggle={toggleSave} onWantCoupon={handleWantCoupon} />
                  ))}
                </div>
              </section>
            )}

            {/* Exclusivos del consorcio */}
            {buildingPromos.length > 0 && (
              <section>
                <SectionTitle icon={Sparkles} title={`Exclusivos de ${buildingName}`} onSeeAll={() => setMainView('building-promos')} />
                <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
                  {buildingPromos.map(p => (
                    <ExclusiveCard key={p.id} promotion={p} isSaved={savedCoupons.includes(p.id)} onSaveToggle={toggleSave} onWantCoupon={handleWantCoupon} />
                  ))}
                </div>
              </section>
            )}

            {/* Quick stats */}
            <section>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Activos', value: allPromos.length, icon: Tag },
                  { label: 'Guardados', value: savedCoupons.length, icon: Gift },
                  { label: 'Canjeados', value: usedCoupons.length, icon: Ticket },
                ].map(s => (
                  <div key={s.label} className="glass-card rounded-2xl p-4 text-center">
                    <s.icon className="w-5 h-5 text-primary mx-auto mb-1" />
                    <div className="text-xl font-bold text-foreground">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ALL PROMOTIONS */}
        {mainView === 'all-promos' && (
          <FullPromotionsView
            promotions={allPromos}
            savedCoupons={savedCoupons}
            onSaveToggle={toggleSave}
            onWantCoupon={handleWantCoupon}
            onBack={() => setMainView('home')}
            title="Todos los beneficios"
          />
        )}

        {/* BUILDING PROMOS */}
        {mainView === 'building-promos' && (
          <FullPromotionsView
            promotions={buildingPromos}
            savedCoupons={savedCoupons}
            onSaveToggle={toggleSave}
            onWantCoupon={handleWantCoupon}
            onBack={() => setMainView('home')}
            title={`Exclusivos de ${buildingName}`}
          />
        )}

        {/* MY COUPONS */}
        {mainView === 'my-coupons' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setMainView('home')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>
              <h2 className="font-bold text-foreground text-lg">Mi billetera</h2>
            </div>

            {(() => {
              const disponiblesCount = allPromos.filter(p => savedCoupons.includes(p.id) && !usedCoupons.includes(p.id)).length;
              const usadosCount = allPromos.filter(p => savedCoupons.includes(p.id) && usedCoupons.includes(p.id)).length;
              
              return (
                <div className="flex gap-2 mb-6">
                  <button
                    onClick={() => setCouponFilter('disponibles')}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      couponFilter === 'disponibles' ? 'text-white shadow-lg' : 'text-muted-foreground border border-border/50 bg-input/20'
                    }`}
                    style={couponFilter === 'disponibles' ? { background: 'linear-gradient(135deg,#F04E23,#C73E15)' } : {}}
                  >
                    Disponibles
                    {disponiblesCount > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-xs ${couponFilter === 'disponibles' ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground border border-border/50'}`}>
                        {disponiblesCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setCouponFilter('usados')}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      couponFilter === 'usados' ? 'text-white shadow-lg' : 'text-muted-foreground border border-border/50 bg-input/20'
                    }`}
                    style={couponFilter === 'usados' ? { background: 'linear-gradient(135deg,#F04E23,#C73E15)' } : {}}
                  >
                    Usados
                    {usadosCount > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-xs ${couponFilter === 'usados' ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground border border-border/50'}`}>
                        {usadosCount}
                      </span>
                    )}
                  </button>
                </div>
              );
            })()}

            {allPromos.filter(p => savedCoupons.includes(p.id) && (couponFilter === 'disponibles' ? !usedCoupons.includes(p.id) : usedCoupons.includes(p.id))).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {allPromos.filter(p => savedCoupons.includes(p.id) && (couponFilter === 'disponibles' ? !usedCoupons.includes(p.id) : usedCoupons.includes(p.id))).map(p => {
                  const isUsed = usedCoupons.includes(p.id)
                  const isExpired = p.expirationDate < new Date().toISOString().slice(0, 10)
                  return (
                    <div key={p.id} className={`glass-card rounded-2xl overflow-hidden border ${isUsed ? 'opacity-70 grayscale-[0.5]' : ''}`}>
                      <div className="relative h-28 bg-gradient-to-br from-secondary to-muted">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Tag className="w-8 h-8 text-muted-foreground opacity-30" /></div>
                        )}
                        <div className="absolute top-2 left-2"><DiscountBadge discount={p.discount} /></div>
                        {isUsed && (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
                            <div className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-lg border border-white/20">
                              <span className="text-white font-bold text-xs tracking-widest uppercase">Utilizado</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-foreground text-sm">{p.businessName}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5 mb-3 line-clamp-2">{p.title}</p>
                        <div className="flex gap-2">
                          {!isUsed && !isExpired ? (
                            <button onClick={() => handleUse(p)} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white btn-premium flex items-center justify-center gap-1.5 shadow-md">
                              <QrCode className="w-3.5 h-3.5" /> Ver QR
                            </button>
                          ) : isUsed ? (
                            <button onClick={() => toggleSave(p)} className="w-full py-2 rounded-xl text-xs font-medium border border-border/60 text-muted-foreground hover:text-destructive transition-colors">
                              Quitar de la billetera
                            </button>
                          ) : (
                            <div className="w-full py-2 bg-muted rounded-xl text-center text-xs font-medium text-muted-foreground">Expirado</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-20 glass-card rounded-2xl">
                <Gift className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-foreground font-medium mb-1">
                  {couponFilter === 'disponibles' ? 'No tenés cupones disponibles' : 'Aún no usaste ningún cupón'}
                </p>
                <p className="text-muted-foreground text-sm mb-5">
                  {couponFilter === 'disponibles' ? 'Explorá los beneficios para guardar tus favoritos.' : 'Cuando uses un cupón, aparecerá en esta sección.'}
                </p>
                {couponFilter === 'disponibles' && (
                  <button onClick={() => setMainView('all-promos')} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white btn-premium">
                    Explorar beneficios
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {mainView === 'household' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setMainView('home')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>
              <h2 className="font-bold text-foreground text-lg">Mi unidad</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.9fr] gap-5">
              <section className="glass-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4 text-primary" />
                  <h3 className="font-serif text-lg font-semibold text-foreground">Grupo familiar</h3>
                </div>
                {householdMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Todavia no hay usuarios asociados a tu unidad.</p>
                ) : (
                  <div className="space-y-2">
                    {householdMembers.map((member) => (
                      <div key={member.id} className="rounded-xl border border-border/40 bg-background px-4 py-3">
                        <div className="font-medium text-foreground">{member.profile?.fullName ?? 'Usuario'}</div>
                        <div className="text-xs text-muted-foreground">
                          {member.profile?.email ?? 'sin email'} · {member.relationshipType.replace('_', ' ')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="glass-card rounded-2xl p-5">
                <h3 className="font-serif text-lg font-semibold text-foreground">Agregar familiar o conviviente</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  El vecino principal puede crear hasta 4 usuarios vecinos adicionales para la misma unidad.
                </p>
                {!principalMembership ? (
                  <div className="mt-4 rounded-xl border border-dashed border-border/50 p-4 text-sm text-muted-foreground">
                    Tu usuario no esta marcado como vecino principal de una unidad.
                  </div>
                ) : !canAddHousehold ? (
                  <div className="mt-4 rounded-xl border border-dashed border-border/50 p-4 text-sm text-muted-foreground">
                    Ya alcanzaste el limite de 4 vecinos adicionales.
                  </div>
                ) : (
                  <form onSubmit={submitHouseholdNeighbor} className="mt-4 space-y-3">
                    <div className="space-y-1.5">
                      <Label>Nombre completo</Label>
                      <Input value={householdDraft.fullName} onChange={(e) => setHouseholdDraft({ ...householdDraft, fullName: e.target.value })} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input type="email" value={householdDraft.email} onChange={(e) => setHouseholdDraft({ ...householdDraft, email: e.target.value })} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Telefono</Label>
                      <Input value={householdDraft.phone} onChange={(e) => setHouseholdDraft({ ...householdDraft, phone: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Password temporal</Label>
                      <Input value={householdDraft.password} onChange={(e) => setHouseholdDraft({ ...householdDraft, password: e.target.value })} required />
                    </div>
                    <Button type="submit" className="w-full btn-premium" disabled={isAddingHousehold}>
                      {isAddingHousehold ? 'Creando...' : 'Crear usuario vecino'}
                    </Button>
                  </form>
                )}
              </section>
            </div>

            {initialData.buildingInformation.length > 0 ? (
              <section className="glass-card rounded-2xl p-5 mt-5">
                <div className="flex items-center gap-2 mb-4">
                  <Info className="w-4 h-4 text-primary" />
                  <h3 className="font-serif text-lg font-semibold text-foreground">Informacion del edificio</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {initialData.buildingInformation.map((item) => (
                    <article key={item.id} className="rounded-xl border border-border/40 bg-background p-4">
                      <div className="text-[11px] uppercase tracking-wide text-primary">{item.category}</div>
                      <h4 className="mt-1 font-medium text-foreground">{item.title}</h4>
                      <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{item.content}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}

        {/* MARKETPLACE */}
        {mainView === 'marketplace' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <button onClick={() => setMainView('home')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Volver
                </button>
                <h2 className="font-bold text-foreground text-lg">Mercado vecinal</h2>
              </div>
              <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white btn-premium">
                <Plus className="w-3.5 h-3.5" /> Publicar
              </button>
            </div>

            {filteredMarketplace.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredMarketplace.map(item => (
                  <div key={item.id} className="glass-card glass-card-hover rounded-2xl overflow-hidden">
                    <div className="h-36 bg-gradient-to-br from-secondary to-muted relative">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Package className="w-10 h-10 text-muted-foreground opacity-30" /></div>
                      )}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium bg-white/90 text-foreground">{item.condition}</span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground text-sm">{item.title}</h3>
                      <p className="text-xl font-bold text-primary mt-0.5">${item.price.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                      <div className="flex items-center gap-2 mt-3">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: 'linear-gradient(135deg,#F04E23,#C73E15)' }}>{item.sellerAvatar}</div>
                        <span className="text-xs text-muted-foreground">{item.sellerName}</span>
                        {item.sellerPhone && (
                          <a href={`tel:${item.sellerPhone}`} className="ml-auto text-xs text-primary font-medium hover:underline">Contactar</a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 glass-card rounded-2xl">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                <p className="text-foreground font-medium mb-1">Aún no hay publicaciones</p>
                <p className="text-muted-foreground text-sm mb-5">Sé el primero en publicar en tu edificio.</p>
                <button onClick={() => setShowCreateModal(true)} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white btn-premium">
                  Crear publicación
                </button>
              </div>
            )}
          </div>
        )}

        {/* COMPLAINTS */}
        {mainView === 'complaints' && (
          <NeighborCasesPanel
            building={initialData.building}
            initialReasons={initialData.complaintReasons}
            initialMentionableUsers={initialData.complaintMentionableUsers}
            initialCases={initialData.complaintCases}
            initialCaseDetails={initialData.complaintCaseDetails}
          />
        )}

        {/* STORES / UBICACIONES */}
        {mainView === 'stores' && (
          <div className="flex flex-col h-[calc(100vh-140px)]">
            <div className="flex items-center gap-3 mb-4 shrink-0">
              <button onClick={() => setMainView('home')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>
              <h2 className="font-bold text-foreground text-lg">Mapa de Locales</h2>
            </div>
            
            <div className="flex-1 rounded-2xl overflow-hidden glass-card border flex flex-col md:flex-row relative">
              <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-border/50 bg-card overflow-y-auto z-10 relative">
                <div className="p-4 pt-5 pb-2 sticky top-0 bg-card/95 backdrop-blur-md border-b border-border/50 z-20">
                  <h3 className="font-bold text-sm text-foreground mb-1">Locales por la zona</h3>
                  <p className="text-xs text-muted-foreground">Listados por cercanía a tu edificio.</p>
                </div>
                <div className="p-2 space-y-2">
                  {sortedMapBusinesses.length > 0 ? sortedMapBusinesses.map(b => (
                    <div key={b.id} className="p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-primary/20 group">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{b.name}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">{b.address || 'Sin dirección específica'}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                          {b.category}
                        </span>
                        {(b as any).distanceToBuilding !== undefined ? (
                          <span className="text-xs font-medium text-muted-foreground">
                            {((b as any).distanceToBuilding / 1000).toFixed(1)} km
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )) : (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      Aún no hay locales con ubicación en el mapa.
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 relative min-h-[300px] bg-muted/10 h-full z-0">
                <DynamicMap
                  center={initialData.building?.latitude && initialData.building?.longitude ? [initialData.building.latitude, initialData.building.longitude] : [-26.8306, -65.2038]}
                  zoom={initialData.building?.latitude && initialData.building?.longitude ? 14 : 12}
                  markers={mapMarkers}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM NAVIGATION ────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl">
        <div className="flex items-center justify-around px-2 py-2 max-w-5xl mx-auto">
          {nav.map(item => {
            const isActive = mainView === item.key
            return (
              <button key={item.key} onClick={() => setMainView(item.key as MainView)} className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all">
                <item.icon className="w-5 h-5" style={{ color: isActive ? 'var(--primary)' : 'var(--muted-foreground)' }} />
                <span className="text-[10px] font-medium" style={{ color: isActive ? 'var(--primary)' : 'var(--muted-foreground)' }}>{item.label}</span>
                {item.key === 'my-coupons' && savedCoupons.length > 0 && (
                  <span className="absolute top-0 right-0 w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center translate-x-1/4 -translate-y-1/4" style={{ background: 'var(--primary)' }}>
                    {savedCoupons.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* ── MODALS ───────────────────────────────────────────────────────── */}
      {qrPromotion && <PromotionQrModal promotion={qrPromotion} token={qrToken} loading={isLoadingQr} onClose={() => { setQrPromotion(null); setQrToken(null) }} />}
      {showCreateModal && <CreateMarketplaceModal onClose={() => setShowCreateModal(false)} onSave={createMarketplaceItem} />}

      {/* ── AI ASSISTANT ─────────────────────────────────────────────────── */}
      <ChatWidget />
    </div>
  )
}
