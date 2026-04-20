'use client'

import { useMemo, useState } from 'react'
import { BarChart3, Building2, Plus, Tag, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PromotionCard } from '@/components/promotion-card'
import { ImageUploadField } from '@/components/image-upload-field'
import { IMAGE_RULES, CATEGORIES } from '@/lib/constants'
import type { Building, Business, BusinessDashboardData, Promotion } from '@/lib/types'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { ChatWidget } from '@/components/ai/chat-widget'
import DynamicMap from '@/components/map/map-view-dynamic'
import { MapPin } from 'lucide-react'

interface PromotionFormState {
  id?: string
  title: string
  description: string
  discount: string
  category: string
  expirationDate: string
  buildingId: string | null
}

function emptyPromotionState(): PromotionFormState {
  return {
    title: '',
    description: '',
    discount: '',
    category: CATEGORIES[1],
    expirationDate: '',
    buildingId: null,
  }
}

function buildStoragePath(kind: 'business' | 'promotion', ownerId: string, recordId: string, file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const timestamp = Date.now()
  if (kind === 'business') {
    return `business/${ownerId}/logo-${timestamp}.${extension}`
  }
  return `promotion/${ownerId}/${recordId}-${timestamp}.${extension}`
}

async function uploadFile(bucket: string, path: string, file: File) {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    throw new Error('Supabase no esta configurado.')
  }

  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
  if (error) {
    throw error
  }

  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

function PromotionModal({
  buildings,
  initial,
  onClose,
  onSave,
}: {
  buildings: Building[]
  initial?: Promotion | null
  onClose: () => void
  onSave: (state: PromotionFormState, file: File | null) => Promise<void>
}) {
  const [form, setForm] = useState<PromotionFormState>(
    initial
      ? {
          id: initial.id,
          title: initial.title,
          description: initial.description,
          discount: initial.discount,
          category: initial.category,
          expirationDate: initial.expirationDate,
          buildingId: initial.buildingId,
        }
      : emptyPromotionState(),
  )
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    try {
      await onSave(form, imageFile)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(10,6,2,0.75)', backdropFilter: 'blur(6px)' }}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="px-7 pt-7 pb-5 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">{initial ? 'Editar promocion' : 'Nueva promocion'}</h2>
          <p className="text-sm text-gray-500 mt-1">Crea promociones reales con imagen, alcance y vencimiento persistidos en Supabase.</p>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 flex flex-col gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Titulo</Label>
              <Input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Descuento</Label>
              <Input value={form.discount} onChange={(event) => setForm((prev) => ({ ...prev, discount: event.target.value }))} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descripcion</Label>
            <textarea
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              rows={4}
              required
              className="w-full rounded-xl px-4 py-3 text-sm bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <select
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                className="w-full rounded-xl px-4 py-3 text-sm bg-white border border-gray-200"
              >
                {CATEGORIES.filter((category) => category !== 'Todas').map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Vencimiento</Label>
              <Input type="date" value={form.expirationDate} onChange={(event) => setForm((prev) => ({ ...prev, expirationDate: event.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Edificio exclusivo</Label>
              <select
                value={form.buildingId ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, buildingId: event.target.value || null }))}
                className="w-full rounded-xl px-4 py-3 text-sm bg-white border border-gray-200"
              >
                <option value="">Toda la red CITIFY</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <ImageUploadField
            label={IMAGE_RULES.promotion.label}
            helpText={IMAGE_RULES.promotion.recommended}
            maxSizeMb={IMAGE_RULES.promotion.maxSizeMb}
            minWidth={IMAGE_RULES.promotion.minWidth}
            minHeight={IMAGE_RULES.promotion.minHeight}
            valueUrl={initial?.imageUrl ?? null}
            onFileChange={setImageFile}
          />

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 btn-premium" disabled={loading}>
              {loading ? 'Guardando...' : initial ? 'Guardar cambios' : 'Crear promocion'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function BusinessDashboard({
  initialData,
  profileId,
}: {
  initialData: BusinessDashboardData
  profileId: string
}) {
  const [business, setBusiness] = useState<Business | null>(initialData.business)
  const [promotions, setPromotions] = useState<Promotion[]>(initialData.promotions)
  const [showModal, setShowModal] = useState(false)
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)

  const [mapLocation, setMapLocation] = useState<[number, number] | null>(
    business?.latitude && business?.longitude ? [business.latitude, business.longitude] : null,
  )
  const [address, setAddress] = useState(business?.address ?? '')
  const [locationSaving, setLocationSaving] = useState(false)

  const totalUsage = useMemo(() => promotions.reduce((sum, promotion) => sum + promotion.usageCount, 0), [promotions])

  async function handlePromotionSave(form: PromotionFormState, file: File | null) {
    const supabase = getSupabaseBrowserClient()
    if (!supabase || !business) {
      toast.error('Supabase no esta configurado o el negocio no esta asociado.')
      return
    }

    const recordId = form.id ?? crypto.randomUUID()
    let imagePath = editingPromotion?.imagePath ?? null
    let imageUrl = editingPromotion?.imageUrl ?? null

    if (file) {
      imagePath = buildStoragePath('promotion', business.id, recordId, file)
      imageUrl = await uploadFile('promotion-images', imagePath, file)
    }

    const payload = {
      id: recordId,
      business_id: business.id,
      title: form.title,
      description: form.description,
      discount: form.discount,
      category: form.category,
      expiration_date: form.expirationDate,
      building_id: form.buildingId,
      image_path: imagePath,
      is_active: true,
    }

    const { error } = form.id
      ? await supabase.from('promotions').update(payload).eq('id', form.id)
      : await supabase.from('promotions').insert(payload)

    if (error) {
      toast.error(error.message)
      return
    }

    const nextPromotion: Promotion = {
      id: recordId,
      businessId: business.id,
      businessName: business.name,
      title: form.title,
      description: form.description,
      discount: form.discount,
      category: form.category,
      expirationDate: form.expirationDate,
      usageCount: editingPromotion?.usageCount ?? 0,
      buildingId: form.buildingId,
      createdAt: editingPromotion?.createdAt ?? new Date().toISOString(),
      imagePath,
      imageUrl,
      isActive: true,
    }

    setPromotions((prev) => (form.id ? prev.map((promotion) => (promotion.id === form.id ? nextPromotion : promotion)) : [nextPromotion, ...prev]))
    toast.success(form.id ? 'Promocion actualizada.' : 'Promocion creada.')
  }

  async function handleDelete(id: string) {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      toast.error('Supabase no esta configurado.')
      return
    }

    const { error } = await supabase.from('promotions').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
      return
    }

    setPromotions((prev) => prev.filter((promotion) => promotion.id !== id))
    toast.success('Promocion eliminada.')
  }

  async function handleLogoUpload() {
    if (!business || !logoFile) {
      toast.error('Selecciona una imagen antes de subirla.')
      return
    }

    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      toast.error('Supabase no esta configurado.')
      return
    }

    setLogoUploading(true)
    try {
      const logoPath = buildStoragePath('business', business.id, profileId, logoFile)
      const logoUrl = await uploadFile('business-logos', logoPath, logoFile)
      const { error } = await supabase.from('businesses').update({ logo_path: logoPath }).eq('id', business.id)
      if (error) {
        throw error
      }

      setBusiness({ ...business, logoPath, logoUrl })
      toast.success('Logo actualizado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo subir el logo.')
    } finally {
      setLogoUploading(false)
    }
  }

  async function handleLocationSave() {
    if (!business || !mapLocation) {
      toast.error('Selecciona una ubicación en el mapa.')
      return
    }

    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      toast.error('Supabase no esta configurado.')
      return
    }

    setLocationSaving(true)
    try {
      const { error } = await supabase.from('businesses').update({
        address,
        latitude: mapLocation[0],
        longitude: mapLocation[1],
      }).eq('id', business.id)

      if (error) throw error

      setBusiness({ ...business, address, latitude: mapLocation[0], longitude: mapLocation[1] })
      toast.success('Ubicación actualizada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la ubicación.')
    } finally {
      setLocationSaving(false)
    }
  }

  if (!business) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="glass-card rounded-2xl p-8">
          <h2 className="font-serif text-2xl font-bold text-foreground mb-2">Todavia no tienes un negocio asociado</h2>
          <p className="text-muted-foreground">
            El usuario esta autenticado, pero su perfil no tiene `business_id`. Asignalo en Supabase para habilitar este panel.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] mb-8">
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Panel del negocio</p>
              <h1 className="font-serif text-3xl font-bold text-foreground">{business.name}</h1>
              <p className="text-muted-foreground mt-2">{business.description}</p>
              <div className="mt-3 inline-flex rounded-full px-3 py-1 text-xs font-medium bg-secondary/80 text-secondary-foreground">
                {business.category}
              </div>
            </div>

            <div className="w-24 h-24 rounded-2xl overflow-hidden border border-border/60 bg-background flex items-center justify-center">
              {business.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={business.logoUrl} alt={business.name} className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-10 h-10 text-muted-foreground" />
              )}
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <ImageUploadField
            label={IMAGE_RULES.businessLogo.label}
            helpText={IMAGE_RULES.businessLogo.recommended}
            maxSizeMb={IMAGE_RULES.businessLogo.maxSizeMb}
            minWidth={IMAGE_RULES.businessLogo.minWidth}
            minHeight={IMAGE_RULES.businessLogo.minHeight}
            valueUrl={business.logoUrl}
            onFileChange={setLogoFile}
          />
          <Button onClick={handleLogoUpload} className="w-full mt-4 btn-premium gap-2" disabled={logoUploading}>
            <Upload className="w-4 h-4" />
            {logoUploading ? 'Subiendo logo...' : 'Actualizar logo'}
          </Button>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 mb-8 overflow-hidden relative">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <h3 className="font-serif text-xl font-bold text-foreground mb-2 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Ubicación del Negocio
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Selecciona tu ubicación en el mapa para que los vecinos puedan encontrarte fácilmente.
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Dirección</Label>
                <div className="flex gap-2">
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Ej. Av. Sarmiento 2555"
                  />
                  <Button variant="secondary" onClick={async () => {
                    if (!address) return
                    toast.loading('Buscando...', { id: 'geoco' })
                    try {
                      // Agregar tucuman al query
                      const q = encodeURIComponent(address + ', San Miguel de Tucumán, Argentina')
                      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`)
                      const data = await res.json()
                      if (data && data.length > 0) {
                        setMapLocation([parseFloat(data[0].lat), parseFloat(data[0].lon)])
                        toast.success('Ubicación aproximada encontrada.', { id: 'geoco' })
                      } else {
                        toast.error('No se pudo ubicar con exactitud. Por favor marcá el punto en el mapa a mano.', { id: 'geoco' })
                      }
                    } catch {
                      toast.error('Error buscando dirección.', { id: 'geoco' })
                    }
                  }}>
                    Ubicar en mapa
                  </Button>
                </div>
              </div>
              <Button onClick={handleLocationSave} className="w-full btn-premium gap-2" disabled={locationSaving || !mapLocation}>
                {locationSaving ? 'Guardando...' : 'Guardar ubicación y dirección'}
              </Button>
            </div>
          </div>
          <div className="flex-[2] rounded-xl overflow-hidden relative z-0 h-[300px]">
            <DynamicMap
              center={mapLocation ?? [-26.8306, -65.2038]} // Default San Miguel de Tucumán
              zoom={mapLocation ? 16 : 13}
              interactive={true}
              selectedLocation={mapLocation}
              onLocationSelect={(lat, lng) => setMapLocation([lat, lng])}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Promociones activas', value: promotions.length, icon: Tag },
          { label: 'Canjes totales', value: totalUsage, icon: BarChart3 },
          { label: 'Vecinos registrados', value: initialData.consumersCount, icon: Building2 },
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

      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="font-serif text-2xl font-bold text-foreground">Promociones del negocio</h2>
          <p className="text-sm text-muted-foreground">CRUD real sobre Supabase con soporte de imagenes.</p>
        </div>
        <Button
          onClick={() => {
            setEditingPromotion(null)
            setShowModal(true)
          }}
          className="btn-premium gap-2"
        >
          <Plus className="w-4 h-4" />
          Nueva promocion
        </Button>
      </div>

      {promotions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {promotions.map((promotion) => (
            <PromotionCard
              key={promotion.id}
              promotion={promotion}
              showAnalytics
              onEdit={(value) => {
                setEditingPromotion(value)
                setShowModal(true)
              }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-10 text-center">
          <p className="text-foreground font-medium">Todavia no hay promociones creadas.</p>
          <p className="text-muted-foreground text-sm mt-1">La base esta vacia por diseño, asi que este panel es el primer punto de carga real.</p>
        </div>
      )}

      {showModal ? (
        <PromotionModal
          buildings={initialData.availableBuildings}
          initial={editingPromotion}
          onClose={() => setShowModal(false)}
          onSave={handlePromotionSave}
        />
      ) : null}

      <ChatWidget />
    </div>
  )
}
