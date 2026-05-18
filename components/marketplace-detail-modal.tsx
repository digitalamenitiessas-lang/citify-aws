'use client'

import { useEffect, useState } from 'react'
import { Loader2, MessageCircle, Phone, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { MarketplaceCondition, MarketplaceItem } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const CONDITIONS: MarketplaceCondition[] = ['Nuevo', 'Como Nuevo', 'Buen Estado', 'Usado']

const MAX_TOTAL_IMAGES = 4

type UploadResult = { imagePath: string; imageUrl: string }

async function uploadMarketplaceImage(itemId: string, file: File): Promise<UploadResult> {
  const response = await fetch('/api/uploads/marketplace-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId, fileName: file.name, contentType: file.type || 'application/octet-stream' }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.uploadUrl || !payload?.objectKey || !payload?.publicUrl) {
    throw new Error(payload?.error ?? 'No pudimos preparar la imagen para subir.')
  }
  const put = await fetch(payload.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  })
  if (!put.ok) throw new Error('No pudimos subir la imagen a S3.')
  return { imagePath: payload.objectKey as string, imageUrl: payload.publicUrl as string }
}

export function MarketplaceDetailModal({
  item,
  isOwner,
  onClose,
  onContact,
  onUpdated,
  onDeleted,
}: {
  item: MarketplaceItem
  isOwner: boolean
  onClose: () => void
  onContact?: (item: MarketplaceItem) => void
  onUpdated?: (item: MarketplaceItem) => void
  onDeleted?: (id: string) => void
}) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [activeImage, setActiveImage] = useState(0)

  // Edit form state
  const [title, setTitle] = useState(item.title)
  const [price, setPrice] = useState(String(item.price))
  const [description, setDescription] = useState(item.description)
  const [condition, setCondition] = useState<MarketplaceCondition>(item.condition)
  const [imagePath, setImagePath] = useState<string | null>(item.imagePath)
  const [imageUrls, setImageUrls] = useState<string[]>(item.imageUrls?.length ? item.imageUrls : (item.imageUrl ? [item.imageUrl] : []))
  const [imagePaths, setImagePaths] = useState<string[]>(item.imagePaths ?? (item.imagePath ? [item.imagePath] : []))
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    setActiveImage((prev) => (prev >= imageUrls.length ? 0 : prev))
  }, [imageUrls.length])

  async function handleAddImage(file: File) {
    if (imagePaths.length >= MAX_TOTAL_IMAGES) {
      toast.error(`Máximo ${MAX_TOTAL_IMAGES} fotos por publicación.`)
      return
    }
    setUploading(true)
    try {
      const uploaded = await uploadMarketplaceImage(item.id, file)
      const nextPaths = [...imagePaths, uploaded.imagePath]
      const nextUrls = [...imageUrls, uploaded.imageUrl]
      setImagePaths(nextPaths)
      setImageUrls(nextUrls)
      if (!imagePath) setImagePath(uploaded.imagePath)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No pudimos subir la imagen.')
    } finally {
      setUploading(false)
    }
  }

  function handleRemoveImage(index: number) {
    const nextPaths = imagePaths.filter((_, i) => i !== index)
    const nextUrls = imageUrls.filter((_, i) => i !== index)
    setImagePaths(nextPaths)
    setImageUrls(nextUrls)
    setImagePath(nextPaths[0] ?? null)
  }

  async function handleSave() {
    if (!title.trim() || !description.trim() || !condition.trim()) {
      toast.error('Completá título, descripción y condición.')
      return
    }
    const numericPrice = Number(price)
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      toast.error('Precio inválido.')
      return
    }
    setSaving(true)
    try {
      const mainPath = imagePaths[0] ?? null
      const extras = imagePaths.slice(1)
      const response = await fetch(`/api/consumer/marketplace-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          condition,
          price: numericPrice,
          imagePath: mainPath,
          extraImagePaths: extras,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'No se pudo guardar.')
      toast.success('Publicación actualizada.')
      onUpdated?.({
        ...item,
        title: title.trim(),
        description: description.trim(),
        condition,
        price: numericPrice,
        imagePath: mainPath,
        imagePaths,
        imageUrls,
        imageUrl: imageUrls[0] ?? null,
      })
      setMode('view')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate() {
    if (!window.confirm('¿Dar de baja esta publicación? No se eliminará pero dejará de mostrarse.')) return
    setDeleting(true)
    try {
      const response = await fetch(`/api/consumer/marketplace-items/${item.id}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'No se pudo dar de baja.')
      toast.success('Publicación dada de baja.')
      onDeleted?.(item.id)
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo dar de baja.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(10,6,2,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="glass-card relative w-full max-w-3xl overflow-y-auto rounded-2xl p-6 max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Galería de imágenes */}
          <div className="flex flex-col gap-3">
            <div className="aspect-square overflow-hidden rounded-xl border border-border/40 bg-secondary/20">
              {imageUrls[activeImage] ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={imageUrls[activeImage]} alt={item.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground text-sm">
                  Sin foto
                </div>
              )}
            </div>
            {imageUrls.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {imageUrls.map((url, i) => (
                  <button
                    key={url}
                    onClick={() => setActiveImage(i)}
                    className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 ${i === activeImage ? 'border-primary' : 'border-border/40'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {mode === 'edit' && isOwner && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveImage(i) }}
                        className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-600"
                        aria-label="Quitar foto"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </button>
                ))}
                {mode === 'edit' && isOwner && imagePaths.length < MAX_TOTAL_IMAGES && (
                  <label className="flex h-16 w-16 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border/60 text-xs text-muted-foreground hover:border-primary hover:text-primary">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : '+'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleAddImage(f)
                        e.target.value = ''
                      }}
                    />
                  </label>
                )}
              </div>
            )}
            {mode === 'edit' && isOwner && imagePaths.length === 0 && (
              <label className="flex h-12 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground hover:border-primary hover:text-primary">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Agregar primera foto'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleAddImage(f)
                    e.target.value = ''
                  }}
                />
              </label>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col gap-4">
            {mode === 'view' ? (
              <>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{item.condition}</p>
                  <h2 className="font-serif text-2xl font-bold text-foreground">{item.title}</h2>
                  <p className="mt-2 text-3xl font-bold text-primary">${item.price.toLocaleString('es-AR')}</p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Descripción</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{item.description || '—'}</p>
                </div>

                <div className="rounded-lg border border-border/30 bg-secondary/20 p-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Vendedor</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ background: 'linear-gradient(135deg, #F04E23, #C73E15)' }}
                    >
                      {item.sellerAvatar || item.sellerName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-foreground">{item.sellerName}</p>
                      {item.sellerPhone && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {item.sellerPhone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {isOwner ? (
                    <>
                      <Button variant="outline" onClick={() => setMode('edit')}>Editar</Button>
                      <Button
                        variant="destructive"
                        onClick={handleDeactivate}
                        disabled={deleting}
                        className="gap-2"
                      >
                        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Dar de baja
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="btn-premium gap-2"
                      onClick={() => onContact?.(item)}
                    >
                      <MessageCircle className="h-4 w-4" />
                      Contactar al vecino
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <h2 className="font-serif text-xl font-bold text-foreground">Editar publicación</h2>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Artículo</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Precio ($)</Label>
                      <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Condición</Label>
                      <select
                        value={condition}
                        onChange={(e) => setCondition(e.target.value as MarketplaceCondition)}
                        className="w-full rounded-lg border border-border/50 bg-input/50 px-3 py-2 text-sm text-foreground"
                      >
                        {CONDITIONS.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Descripción</Label>
                    <textarea
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full resize-none rounded-lg border border-border/50 bg-input/50 px-3 py-2 text-sm text-foreground outline-none"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Podés agregar hasta {MAX_TOTAL_IMAGES} fotos. La primera es la principal.
                  </p>
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setMode('view')} disabled={saving}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar cambios'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
