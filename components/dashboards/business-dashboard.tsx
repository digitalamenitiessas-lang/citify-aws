'use client'

import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  BarChart3,
  Building2,
  Camera,
  CheckCircle2,
  CircleUserRound,
  Copy,
  Gift,
  History,
  Home,
  ImagePlus,
  Plus,
  QrCode,
  ScanLine,
  ShieldAlert,
  Store,
  Tag,
  Upload,
  X,
} from 'lucide-react'
import jsQR from 'jsqr'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PromotionCard } from '@/components/promotion-card'
import { ImageUploadField } from '@/components/image-upload-field'
import { ChatWidget } from '@/components/ai/chat-widget'
import DynamicMap from '@/components/map/map-view-dynamic'
import { IMAGE_RULES, CATEGORIES } from '@/lib/constants'
import type {
  Building,
  Business,
  BusinessDashboardData,
  BusinessDashboardSection,
  BusinessScannerState,
  Promotion,
  PromotionMonthlyStatus,
  PromotionRedemptionHistoryItem,
  PromotionRedemptionValidationResult,
} from '@/lib/types'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>
}

type WindowWithBarcodeDetector = Window & {
  BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike
}

const BUSINESS_SECTION_OPTIONS: BusinessDashboardSection[] = ['home', 'promotions', 'history', 'profile']

function isBusinessDashboardSection(value: string | null): value is BusinessDashboardSection {
  return Boolean(value && BUSINESS_SECTION_OPTIONS.includes(value as BusinessDashboardSection))
}

interface PromotionFormState {
  id?: string
  title: string
  description: string
  discount: string
  category: string
  expirationDate: string
  buildingId: string | null
  publishedMonth: string
  sourcePromotionId: string | null
}

function getCurrentMonthStart() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
}

function getPreviousMonthStart(monthStart: string) {
  const date = new Date(`${monthStart}T00:00:00.000Z`)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1)).toISOString().slice(0, 10)
}

function getMonthEnd(monthStart: string) {
  const date = new Date(`${monthStart}T00:00:00.000Z`)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
}

function buildAutoRenewedPromotion(promotion: Promotion, referenceMonthStart: string): Promotion {
  const monthEnd = getMonthEnd(referenceMonthStart)
  return {
    ...promotion,
    publishedMonth: referenceMonthStart,
    expirationDate: promotion.expirationDate > monthEnd ? promotion.expirationDate : monthEnd,
    sourcePromotionId: promotion.sourcePromotionId ?? promotion.id,
  }
}

function applyPromotionAutoRenewal(promotions: Promotion[], referenceMonthStart: string): Promotion[] {
  const currentByBusiness = new Set(
    promotions.filter((promotion) => promotion.publishedMonth === referenceMonthStart).map((promotion) => promotion.businessId),
  )

  const latestActiveByBusiness = new Map<string, Promotion>()
  for (const promotion of [...promotions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    if (!promotion.isActive || currentByBusiness.has(promotion.businessId) || latestActiveByBusiness.has(promotion.businessId)) continue
    latestActiveByBusiness.set(promotion.businessId, promotion)
  }

  if (latestActiveByBusiness.size === 0) {
    return promotions
  }

  return promotions.map((promotion) => {
    const fallbackPromotion = latestActiveByBusiness.get(promotion.businessId)
    if (!fallbackPromotion || fallbackPromotion.id !== promotion.id) {
      return promotion
    }
    return buildAutoRenewedPromotion(promotion, referenceMonthStart)
  })
}

function formatMonthLabel(monthStart: string) {
  return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${monthStart}T00:00:00.000Z`))
}

function buildMonthlyStatus(promotions: Promotion[], referenceMonthStart: string): PromotionMonthlyStatus {
  const effectivePromotions = applyPromotionAutoRenewal(promotions, referenceMonthStart)
  const previousMonthStart = getPreviousMonthStart(referenceMonthStart)
  const promotionsThisMonth = effectivePromotions.filter((promotion) => promotion.publishedMonth === referenceMonthStart)
  const lastMonthPromotion =
    [...effectivePromotions]
      .filter((promotion) => promotion.publishedMonth === previousMonthStart)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  const autoRenewedPromotion =
    promotionsThisMonth.find((promotion) => {
      const original = promotions.find((item) => item.id === promotion.id)
      return original ? original.publishedMonth !== referenceMonthStart : false
    }) ?? null

  return {
    monthStart: referenceMonthStart,
    monthLabel: formatMonthLabel(referenceMonthStart),
    isCompliant: promotionsThisMonth.length > 0,
    promotionsThisMonth: promotionsThisMonth.length,
    lastMonthPromotion,
    isAutoRenewed: Boolean(autoRenewedPromotion),
    autoRenewedPromotion,
  }
}

function emptyPromotionState(monthStart: string): PromotionFormState {
  return {
    title: '',
    description: '',
    discount: '',
    category: CATEGORIES[1],
    expirationDate: getMonthEnd(monthStart),
    buildingId: null,
    publishedMonth: monthStart,
    sourcePromotionId: null,
  }
}

function duplicatePromotionState(promotion: Promotion, monthStart: string): PromotionFormState {
  return {
    title: promotion.title,
    description: promotion.description,
    discount: promotion.discount,
    category: promotion.category,
    expirationDate: getMonthEnd(monthStart),
    buildingId: promotion.buildingId,
    publishedMonth: monthStart,
    sourcePromotionId: promotion.id,
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

function MonthBadge({ monthStart }: { monthStart: string }) {
  return (
    <span className="inline-flex rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary">
      {formatMonthLabel(monthStart)}
    </span>
  )
}

function SectionHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      {onBack ? (
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
      ) : null}
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
    </div>
  )
}

function ValidationResultCard({ result }: { result: PromotionRedemptionValidationResult }) {
  const tone = result.status === 'redeemed' ? 'success' : result.status === 'already_used' ? 'warn' : 'error'

  return (
    <div
      className={`rounded-2xl border p-4 ${
        tone === 'success'
          ? 'border-emerald-200 bg-emerald-50/80'
          : tone === 'warn'
            ? 'border-amber-200 bg-amber-50/80'
            : 'border-rose-200 bg-rose-50/80'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${
            tone === 'success' ? 'bg-emerald-100 text-emerald-700' : tone === 'warn' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
          }`}
        >
          {tone === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{result.message}</p>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            {result.promotionTitle ? <p>Promocion: {result.promotionTitle}</p> : null}
            {result.neighborName ? <p>Vecino: {result.neighborName}</p> : null}
            {result.redeemedAt ? <p>Fecha: {new Date(result.redeemedAt).toLocaleString('es-AR')}</p> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function PromotionModal({
  buildings,
  initial,
  mode,
  monthLabel,
  onClose,
  onSave,
}: {
  buildings: Building[]
  initial: PromotionFormState
  mode: 'create' | 'edit' | 'duplicate'
  monthLabel: string
  onClose: () => void
  onSave: (state: PromotionFormState, file: File | null) => Promise<void>
}) {
  const [form, setForm] = useState<PromotionFormState>(initial)
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

  const title = mode === 'edit' ? 'Editar promocion' : mode === 'duplicate' ? 'Repetir promocion del mes anterior' : 'Nueva promocion del mes'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(10,6,2,0.75)', backdropFilter: 'blur(6px)' }}>
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border/60 bg-background shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Cerrar modal"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="border-b border-border/60 px-7 pb-5 pt-7">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <MonthBadge monthStart={form.publishedMonth} />
            {form.sourcePromotionId ? (
              <span className="inline-flex rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                Copia editable
              </span>
            ) : null}
          </div>
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === 'duplicate'
              ? `Tomamos la promo anterior como base para ${monthLabel}. Puedes ajustarla antes de publicarla.`
              : `Publica una promocion para ${monthLabel} con imagen, alcance y vencimiento persistidos en Supabase.`}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-7 py-6">
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
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <select
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
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
              <Input type="date" value={form.expirationDate} min={form.publishedMonth} onChange={(event) => setForm((prev) => ({ ...prev, expirationDate: event.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Edificio exclusivo</Label>
              <select
                value={form.buildingId ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, buildingId: event.target.value || null }))}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
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
            valueUrl={null}
            onFileChange={setImageFile}
          />

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 btn-premium" disabled={loading}>
              {loading ? 'Guardando...' : mode === 'edit' ? 'Guardar cambios' : 'Publicar promocion'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ScannerStatusCopy({ state }: { state: BusinessScannerState }) {
  const copy: Record<BusinessScannerState, string> = {
    idle: 'Abre la camara para leer un QR del vecino o usa el codigo manual.',
    starting: 'Preparando la camara del dispositivo...',
    scanning: 'Apunta al QR del vecino. Cuando detectemos el codigo frenamos el scanner automaticamente.',
    unsupported: 'Este navegador no permite escanear QR de forma nativa. Puedes validar el canje escribiendo el codigo.',
    permission_denied: 'No pudimos acceder a la camara. Revisa permisos o continua con el codigo manual.',
    validating: 'Validando el canje detectado...',
    error: 'Ocurrio un problema con el scanner. Puedes volver a intentar o usar el codigo manual.',
  }

  return <p className="text-xs leading-5 text-muted-foreground">{copy[state]}</p>
}

function BusinessQrScanner({
  open,
  scannerState,
  onStateChange,
  onCodeDetected,
}: {
  open: boolean
  scannerState: BusinessScannerState
  onStateChange: (next: BusinessScannerState) => void
  onCodeDetected: (code: string) => Promise<void>
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const isHandlingRef = useRef(false)
  const sessionRef = useRef(0)
  const emitStateChange = useEffectEvent((next: BusinessScannerState) => {
    onStateChange(next)
  })
  const emitDetectedCode = useEffectEvent(async (code: string) => {
    await onCodeDetected(code)
  })

  useEffect(() => {
    if (!open) {
      stopScanner()
      emitStateChange('idle')
      return
    }

    if (streamRef.current) {
      return
    }

    const windowWithDetector = window as WindowWithBarcodeDetector
    if (!navigator.mediaDevices?.getUserMedia) {
      emitStateChange('unsupported')
      return
    }

    sessionRef.current += 1
    const currentSession = sessionRef.current
    const detector = windowWithDetector.BarcodeDetector ? new windowWithDetector.BarcodeDetector({ formats: ['qr_code'] }) : null

    async function start() {
      try {
        emitStateChange('starting')
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
          },
        })
        if (currentSession !== sessionRef.current) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        emitStateChange('scanning')
        scanLoop(detector)
      } catch (error) {
        if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')) {
          emitStateChange('permission_denied')
          return
        }
        emitStateChange('error')
      }
    }

    async function scanLoop(detectorInstance: BarcodeDetectorLike | null) {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return

      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) {
        emitStateChange('error')
        return
      }

      const step = async () => {
        if (!videoRef.current || !canvasRef.current || !streamRef.current) {
          return
        }

        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !isHandlingRef.current) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          context.drawImage(video, 0, 0, canvas.width, canvas.height)

          try {
            let detectedCode: string | null = null

            if (detectorInstance) {
              const results = await detectorInstance.detect(canvas)
              detectedCode = results.find((result) => typeof result.rawValue === 'string' && result.rawValue.trim().length > 0)?.rawValue?.trim() ?? null
            } else {
              const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
              const result = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert',
              })
              detectedCode = result?.data?.trim() ?? null
            }

            if (detectedCode) {
              isHandlingRef.current = true
              emitStateChange('validating')
              stopScanner()
              await emitDetectedCode(detectedCode)
              return
            }
          } catch {
            emitStateChange('error')
            stopScanner()
            return
          }
        }

        animationFrameRef.current = window.requestAnimationFrame(step)
      }

      animationFrameRef.current = window.requestAnimationFrame(step)
    }

    void start()

    return () => {
      if (currentSession === sessionRef.current) {
        stopScanner()
        isHandlingRef.current = false
      }
    }

    function stopScanner() {
      sessionRef.current += 1
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      const video = videoRef.current
      if (video) {
        video.pause()
        video.srcObject = null
      }
    }
  }, [open])

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <div className="aspect-[4/3] w-full bg-[radial-gradient(circle_at_top,rgba(240, 78, 35,0.12),transparent_45%),linear-gradient(180deg,rgba(18,18,18,0.92),rgba(34,34,34,0.98))]">
          {scannerState === 'scanning' || scannerState === 'starting' || scannerState === 'validating' ? (
            <div className="relative h-full w-full">
              <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-40 w-40 rounded-[2rem] border border-white/40 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                  <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 bg-cyan-300/90 shadow-[0_0_14px_rgba(103,232,249,0.9)]" />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <ScanLine className="h-10 w-10 text-primary/80" />
              <p className="text-sm font-semibold text-white">Scanner QR CITIFY</p>
              <p className="max-w-xs text-xs leading-5 text-white/70">Si el navegador no soporta el escaneo o bloquea la cámara, sigue disponible la validación manual por código.</p>
            </div>
          )}
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <ScannerStatusCopy state={scannerState} />
    </div>
  )
}

function RedemptionHub({
  scannerState,
  validationCode,
  validatingCode,
  validationResult,
  onValidationCodeChange,
  onValidateRedemption,
  onStartScanner,
  onDetectedCode,
}: {
  scannerState: BusinessScannerState
  validationCode: string
  validatingCode: boolean
  validationResult: PromotionRedemptionValidationResult | null
  onValidationCodeChange: (value: string) => void
  onValidateRedemption: () => Promise<void>
  onStartScanner: (next: BusinessScannerState) => void
  onDetectedCode: (code: string) => Promise<void>
}) {
  const scannerOpen = scannerState !== 'idle'

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <QrCode className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">Validar canje</h3>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Escanea el QR del vecino o ingresa el código manualmente. Ambos caminos validan el mismo canje y respetan el uso único por promoción.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => onStartScanner('starting')}
            className="glass-card glass-card-hover flex items-center gap-3 rounded-2xl p-4 text-left"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Escanear QR</p>
              <p className="text-xs text-muted-foreground">Usa la cámara y valida el canje en el momento.</p>
            </div>
          </button>

          <div className="glass-card rounded-2xl p-4">
            <p className="text-sm font-semibold text-foreground">Ingresar código</p>
            <p className="mt-1 text-xs text-muted-foreground">Fallback instantáneo si no hay cámara o el vecino comparte el token.</p>
          </div>
        </div>

        {scannerOpen ? (
          <div className="mt-5 space-y-4 rounded-2xl border border-border/60 bg-background/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Escaner activo</p>
              <button onClick={() => onStartScanner('idle')} className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                Cerrar
              </button>
            </div>
            <BusinessQrScanner open={scannerOpen} scannerState={scannerState} onStateChange={onStartScanner} onCodeDetected={onDetectedCode} />
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          <Label>Codigo de canje</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={validationCode}
              onChange={(event) => onValidationCodeChange(event.target.value.toUpperCase())}
              placeholder="Ej: CITIFY:AB12CD34EF56"
              className="sm:flex-1"
            />
            <Button onClick={() => void onValidateRedemption()} className="btn-premium sm:min-w-40" disabled={validatingCode}>
              {validatingCode ? 'Validando...' : 'Confirmar canje'}
            </Button>
          </div>
        </div>

        {validationResult ? <div className="mt-4"><ValidationResultCard result={validationResult} /></div> : null}
      </div>
    </div>
  )
}

function PromoSection({
  title,
  emptyTitle,
  emptyBody,
  promotions,
  onCreate,
  onEdit,
  onDelete,
}: {
  title: string
  emptyTitle: string
  emptyBody: string
  promotions: Promotion[]
  onCreate?: () => void
  onEdit: (promotion: Promotion) => void
  onDelete: (id: string) => void
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">{title}</h3>
        </div>
        {onCreate ? (
          <Button size="sm" onClick={onCreate} className="btn-premium gap-2">
            <Plus className="h-4 w-4" />
            Nueva
          </Button>
        ) : null}
      </div>

      {promotions.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {promotions.map((promotion) => (
            <div key={promotion.id} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <MonthBadge monthStart={promotion.publishedMonth} />
                {promotion.sourcePromotionId ? (
                  <span className="inline-flex rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    Repetida
                  </span>
                ) : null}
              </div>
              <PromotionCard promotion={promotion} showAnalytics onEdit={onEdit} onDelete={onDelete} />
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-8 text-center">
          <p className="font-medium text-foreground">{emptyTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{emptyBody}</p>
        </div>
      )}
    </section>
  )
}

function RedemptionHistorySection({
  title,
  subtitle,
  items,
}: {
  title: string
  subtitle?: string
  items: PromotionRedemptionHistoryItem[]
}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>

      {items.length > 0 ? (
        <div className="glass-card overflow-hidden rounded-2xl">
          <div className="divide-y divide-border/60">
            {items.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{item.neighborName}</p>
                    {item.neighborUnitLabel ? (
                      <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {item.neighborUnitLabel}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Canjeo <span className="font-medium text-foreground">{item.promotionTitle}</span>
                    {item.promotionDiscount ? ` · ${item.promotionDiscount}` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{new Date(item.redeemedAt).toLocaleString('es-AR')}</span>
                    {item.buildingName ? <span>{item.buildingName}</span> : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    {item.status === 'redeemed' ? 'Canjeado' : item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-8 text-center">
          <p className="font-medium text-foreground">Todavia no hay canjes registrados.</p>
          <p className="mt-1 text-sm text-muted-foreground">Cuando empieces a validar QRs, aqui vas a poder ver que vecino uso cada promocion.</p>
        </div>
      )}
    </section>
  )
}

export function BusinessDashboard({
  initialData,
  profileId,
}: {
  initialData: BusinessDashboardData
  profileId: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const rawSection = searchParams.get('section')
  const urlSection: BusinessDashboardSection = isBusinessDashboardSection(rawSection) ? rawSection : 'home'
  const [business, setBusiness] = useState<Business | null>(initialData.business)
  const [promotions, setPromotions] = useState<Promotion[]>(initialData.promotions)
  const [activeSection, setActiveSection] = useState<BusinessDashboardSection>(urlSection)
  const [showModal, setShowModal] = useState(false)
  const [modalState, setModalState] = useState<PromotionFormState | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'duplicate'>('create')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [validationCode, setValidationCode] = useState('')
  const [validatingCode, setValidatingCode] = useState(false)
  const [validationResult, setValidationResult] = useState<PromotionRedemptionValidationResult | null>(null)
  const [scannerState, setScannerState] = useState<BusinessScannerState>('idle')
  const [redemptionHistory, setRedemptionHistory] = useState<PromotionRedemptionHistoryItem[]>(initialData.redemptionHistory)
  const [mapLocation, setMapLocation] = useState<[number, number] | null>(
    business?.latitude && business?.longitude ? [business.latitude, business.longitude] : null,
  )
  const [address, setAddress] = useState(business?.address ?? '')
  const [locationSaving, setLocationSaving] = useState(false)

  useEffect(() => {
    if (activeSection !== urlSection) {
      setActiveSection(urlSection)
    }
  }, [activeSection, urlSection])

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (activeSection === 'home') {
      params.delete('section')
    } else {
      params.set('section', activeSection)
    }

    const nextQuery = params.toString()
    const currentQuery = searchParams.toString()
    if (nextQuery !== currentQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
    }
  }, [activeSection, pathname, router, searchParams])

  const referenceMonthStart = initialData.monthlyStatus?.monthStart ?? getCurrentMonthStart()
  const effectivePromotions = useMemo(() => applyPromotionAutoRenewal(promotions, referenceMonthStart), [promotions, referenceMonthStart])
  const monthlyStatus = useMemo(() => buildMonthlyStatus(promotions, referenceMonthStart), [promotions, referenceMonthStart])
  const totalUsage = useMemo(() => effectivePromotions.reduce((sum, promotion) => sum + promotion.usageCount, 0), [effectivePromotions])
  const thisMonthPromotions = useMemo(
    () => effectivePromotions.filter((promotion) => promotion.publishedMonth === monthlyStatus.monthStart),
    [effectivePromotions, monthlyStatus.monthStart],
  )
  const previousPromotions = useMemo(
    () => effectivePromotions.filter((promotion) => promotion.publishedMonth !== monthlyStatus.monthStart),
    [effectivePromotions, monthlyStatus.monthStart],
  )
  const activePromotionsCount = useMemo(
    () => effectivePromotions.filter((promotion) => promotion.isActive && promotion.expirationDate >= new Date().toISOString().slice(0, 10)).length,
    [effectivePromotions],
  )
  const thisMonthRedemptions = useMemo(
    () => redemptionHistory.filter((item) => item.redeemedAt.slice(0, 7) === monthlyStatus.monthStart.slice(0, 7)).length,
    [redemptionHistory, monthlyStatus.monthStart],
  )
  const recentRedemptions = useMemo(() => redemptionHistory.slice(0, 5), [redemptionHistory])

  function openCreateModal() {
    setModalMode('create')
    setModalState(emptyPromotionState(monthlyStatus.monthStart))
    setShowModal(true)
  }

  function openDuplicateModal() {
    if (!monthlyStatus.lastMonthPromotion) {
      toast.error('No hay una promocion del mes anterior para repetir.')
      return
    }
    setModalMode('duplicate')
    setModalState(duplicatePromotionState(monthlyStatus.lastMonthPromotion, monthlyStatus.monthStart))
    setShowModal(true)
  }

  function openEditModal(promotion: Promotion) {
    setModalMode('edit')
    setModalState({
      id: promotion.id,
      title: promotion.title,
      description: promotion.description,
      discount: promotion.discount,
      category: promotion.category,
      expirationDate: promotion.expirationDate,
      buildingId: promotion.buildingId,
      publishedMonth: promotion.publishedMonth,
      sourcePromotionId: promotion.sourcePromotionId,
    })
    setShowModal(true)
  }

  async function handlePromotionSave(form: PromotionFormState, file: File | null) {
    const supabase = getSupabaseBrowserClient()
    if (!supabase || !business) {
      toast.error('Supabase no esta configurado o el negocio no esta asociado.')
      return
    }

    const recordId = form.id ?? crypto.randomUUID()
    const currentPromotion = promotions.find((promotion) => promotion.id === form.id) ?? null
    let imagePath = currentPromotion?.imagePath ?? null
    let imageUrl = currentPromotion?.imageUrl ?? null

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
      usageCount: currentPromotion?.usageCount ?? 0,
      buildingId: form.buildingId,
      createdAt: currentPromotion?.createdAt ?? new Date().toISOString(),
      publishedMonth: form.publishedMonth,
      sourcePromotionId: form.sourcePromotionId,
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
      if (error) throw error
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
      toast.error('Selecciona una ubicacion en el mapa.')
      return
    }

    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      toast.error('Supabase no esta configurado.')
      return
    }

    setLocationSaving(true)
    try {
      const { error } = await supabase
        .from('businesses')
        .update({
          address,
          latitude: mapLocation[0],
          longitude: mapLocation[1],
        })
        .eq('id', business.id)

      if (error) throw error

      setBusiness({ ...business, address, latitude: mapLocation[0], longitude: mapLocation[1] })
      toast.success('Ubicacion actualizada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la ubicacion.')
    } finally {
      setLocationSaving(false)
    }
  }

  async function runValidation(rawCode: string) {
    const code = rawCode.trim()
    if (!code) {
      toast.error('Ingresa el codigo del cupon.')
      return
    }

    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      toast.error('Supabase no esta configurado.')
      return
    }

    setValidatingCode(true)
    const { data, error } = await supabase.rpc('validate_promotion_redemption_token', {
      raw_token: code,
    })
    setValidatingCode(false)

    if (error) {
      setScannerState('error')
      toast.error(error.message)
      return
    }

    const row = Array.isArray(data) ? data[0] : null
    if (!row) {
      setScannerState('error')
      toast.error('No se pudo validar el codigo.')
      return
    }

    const nextResult: PromotionRedemptionValidationResult = {
      status: row.status,
      message: row.message,
      tokenId: row.token_id ?? null,
      promotionId: row.promotion_id ?? null,
      promotionTitle: row.promotion_title ?? null,
      neighborName: row.neighbor_name ?? null,
      redeemedAt: row.redeemed_at ?? null,
    }

    setValidationResult(nextResult)
    setValidationCode('')
    setScannerState('idle')

    if (row.status === 'redeemed' && row.promotion_id) {
      setPromotions((current) =>
        current.map((promotion) =>
          promotion.id === row.promotion_id ? { ...promotion, usageCount: promotion.usageCount + 1 } : promotion,
        ),
      )
      setRedemptionHistory((current) => [
        {
          id: row.token_id ?? crypto.randomUUID(),
          promotionId: row.promotion_id,
          promotionTitle: row.promotion_title ?? 'Promocion',
          promotionDiscount: promotions.find((promotion) => promotion.id === row.promotion_id)?.discount ?? null,
          profileId: '',
          neighborName: row.neighbor_name ?? 'Vecino',
          neighborUnitLabel: null,
          buildingName: null,
          status: row.status,
          redeemedAt: row.redeemed_at ?? new Date().toISOString(),
          createdAt: row.redeemed_at ?? new Date().toISOString(),
        },
        ...current,
      ])
      toast.success('Canje validado correctamente.')
      return
    }

    toast(nextResult.message)
  }

  if (!business) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="glass-card rounded-2xl p-8">
          <h2 className="mb-2 font-serif text-2xl font-bold text-foreground">Todavia no tienes un negocio asociado</h2>
          <p className="text-muted-foreground">
            El usuario esta autenticado, pero su perfil no tiene `business_id`. Asignalo en Supabase para habilitar este panel.
          </p>
        </div>
      </div>
    )
  }

  const navItems: Array<{ key: BusinessDashboardSection; label: string; icon: typeof Home }> = [
    { key: 'home', label: 'Inicio', icon: Home },
    { key: 'promotions', label: 'Promos', icon: Gift },
    { key: 'history', label: 'Historial', icon: History },
    { key: 'profile', label: 'Perfil', icon: CircleUserRound },
  ]

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--background)' }}>
      {activeSection === 'home' ? (
        <div className="relative overflow-hidden border-b border-border/60 bg-background px-5 pt-4 pb-4">
          <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-60" style={{ background: 'radial-gradient(circle, rgba(240,78,35,0.18), transparent 70%)' }} />

          <div className="relative z-10">
            <div className="flex items-baseline flex-wrap gap-x-2 gap-y-0.5">
              <h1 className="text-foreground text-xl font-semibold tracking-tight leading-tight">
                Hola, {business.name} <span aria-hidden>👋</span>
              </h1>
              {business.category && (
                <span className="inline-flex items-center gap-1 text-muted-foreground text-xs font-medium">
                  <Store className="w-3 h-3" />
                  {business.category}
                </span>
              )}
            </div>
            <p className="mt-1 text-muted-foreground text-xs">
              <span className="font-semibold text-primary">{activePromotionsCount} promos activas</span>
              {' · '}
              <span className={monthlyStatus.isCompliant ? 'font-semibold text-primary' : 'font-semibold text-amber-600'}>
                {monthlyStatus.isAutoRenewed
                  ? `${monthlyStatus.monthLabel} auto-renovada`
                  : monthlyStatus.isCompliant
                    ? `${monthlyStatus.monthLabel} al día`
                    : `${monthlyStatus.monthLabel} pendiente`}
              </span>
            </p>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-5xl px-4 pt-5">
        {activeSection === 'home' ? (
          <div className="space-y-8">
            <section>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Canjes', value: totalUsage, icon: BarChart3 },
                  { label: 'Canjes mes', value: thisMonthRedemptions, icon: Store },
                  { label: 'Promos activas', value: activePromotionsCount, icon: Tag },
                ].map((stat) => (
                  <div key={stat.label} className="glass-card rounded-2xl p-4 text-center">
                    <stat.icon className="mx-auto mb-1 h-5 w-5 text-primary" />
                    <div className="text-xl font-bold text-foreground">{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <RedemptionHub
                scannerState={scannerState}
                validationCode={validationCode}
                validatingCode={validatingCode}
                validationResult={validationResult}
                onValidationCodeChange={setValidationCode}
                onValidateRedemption={() => runValidation(validationCode)}
                onStartScanner={setScannerState}
                onDetectedCode={runValidation}
              />
            </section>

            <section>
              <div className="glass-card rounded-2xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Promocion mensual</p>
                    <h2 className="mt-2 font-serif text-2xl text-foreground">Estado de {monthlyStatus.monthLabel}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Tu negocio debe publicar al menos una promoción nueva por mes. Si este mes no cargaste una, CITIFY mantiene activa automáticamente la última promo disponible para que el beneficio no se corte.
                    </p>
                  </div>
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                      monthlyStatus.isCompliant ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'
                    }`}
                  >
                    {monthlyStatus.isAutoRenewed ? 'Auto-renovada' : monthlyStatus.isCompliant ? 'Cumplido' : 'Pendiente'}
                  </div>
                </div>

                {monthlyStatus.isAutoRenewed && monthlyStatus.autoRenewedPromotion ? (
                  <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                    Este mes se reutilizó automáticamente <span className="font-semibold">{monthlyStatus.autoRenewedPromotion.title}</span> para que tu promo siga visible mientras cargas una nueva.
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  <Button onClick={openCreateModal} className="btn-premium gap-2">
                    <Plus className="h-4 w-4" />
                    Crear promocion del mes
                  </Button>
                  <Button variant="outline" onClick={openDuplicateModal} className="gap-2" disabled={!monthlyStatus.lastMonthPromotion}>
                    <Copy className="h-4 w-4" />
                    Repetir la del mes anterior
                  </Button>
                </div>

                {monthlyStatus.lastMonthPromotion ? (
                  <div className="mt-4 rounded-2xl border border-border/60 bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Base sugerida</p>
                    <div className="mt-2 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{monthlyStatus.lastMonthPromotion.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{formatMonthLabel(monthlyStatus.lastMonthPromotion.publishedMonth)}</p>
                      </div>
                      <span className="rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
                        {monthlyStatus.lastMonthPromotion.discount}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <PromoSection
              title={`Publicadas en ${monthlyStatus.monthLabel}`}
              emptyTitle="Todavia no publicaste una promocion este mes."
              emptyBody="Crea una nueva o reutiliza la del mes anterior para cumplir rapidamente con la carga mensual."
              promotions={thisMonthPromotions}
              onCreate={openCreateModal}
              onEdit={openEditModal}
              onDelete={handleDelete}
            />

            <section>
              <div className="glass-card rounded-2xl p-6 overflow-hidden relative">
                <div className="flex flex-col gap-6 lg:flex-row">
                  <div className="flex-1">
                    <h3 className="font-serif text-xl font-bold text-foreground mb-2 flex items-center gap-2">
                      <Store className="w-5 h-5 text-primary" />
                      Ubicacion del negocio
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Ajusta la direccion y el punto en el mapa para que los vecinos encuentren tu local con mas facilidad.
                    </p>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Direccion</Label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Ej. Av. Sarmiento 2555" />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={async () => {
                              if (!address.trim()) return
                              toast.loading('Buscando direccion...', { id: 'geoco' })
                              try {
                                const q = encodeURIComponent(`${address}, San Miguel de Tucuman, Argentina`)
                                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`)
                                const data = await res.json()
                                if (data && data.length > 0) {
                                  setMapLocation([parseFloat(data[0].lat), parseFloat(data[0].lon)])
                                  toast.success('Ubicacion aproximada encontrada.', { id: 'geoco' })
                                } else {
                                  toast.error('No pudimos ubicarla. Puedes marcar el punto manualmente en el mapa.', { id: 'geoco' })
                                }
                              } catch {
                                toast.error('Error buscando la direccion.', { id: 'geoco' })
                              }
                            }}
                          >
                            Ubicar
                          </Button>
                        </div>
                      </div>

                      <Button onClick={handleLocationSave} className="w-full btn-premium" disabled={locationSaving || !mapLocation}>
                        {locationSaving ? 'Guardando ubicacion...' : 'Guardar ubicacion y direccion'}
                      </Button>
                    </div>
                  </div>

                  <div className="flex-[1.35] overflow-hidden rounded-2xl border border-border/60 bg-background">
                    <div className="h-[320px]">
                      <DynamicMap
                        center={mapLocation ?? [-26.8306, -65.2038]}
                        zoom={mapLocation ? 16 : 13}
                        interactive
                        selectedLocation={mapLocation}
                        onLocationSelect={(lat, lng) => setMapLocation([lat, lng])}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <RedemptionHistorySection
              title="Ultimos canjes"
              subtitle="Un vistazo rapido de que vecinos ya usaron promociones de tu negocio."
              items={recentRedemptions}
            />
          </div>
        ) : null}

        {activeSection === 'promotions' ? (
          <div>
            <SectionHeader title="Promociones del negocio" onBack={() => setActiveSection('home')} />
            <div className="space-y-8">
              <PromoSection
                title={`Promos del mes · ${monthlyStatus.monthLabel}`}
                emptyTitle="Todavia no hay promociones en el mes actual."
                emptyBody="Publica una promo nueva o repite la del mes pasado para mantener tu negocio activo dentro de CITIFY."
                promotions={thisMonthPromotions}
                onCreate={openCreateModal}
                onEdit={openEditModal}
                onDelete={handleDelete}
              />
            </div>
          </div>
        ) : null}

        {activeSection === 'history' ? (
          <div>
            <SectionHeader title="Historial del negocio" onBack={() => setActiveSection('home')} />
            <div className="space-y-8">
              <RedemptionHistorySection
                title="Canjes registrados"
                subtitle="Aqui ves que vecino canjeo cada promocion y cuando se valido."
                items={redemptionHistory}
              />
              <PromoSection
                title="Promociones anteriores"
                emptyTitle="Aun no hay historico para mostrar."
                emptyBody="Cuando cierres un mes con promociones publicadas, apareceran aqui para reutilizarlas despues."
                promotions={previousPromotions}
                onEdit={openEditModal}
                onDelete={handleDelete}
              />
            </div>
          </div>
        ) : null}

        {activeSection === 'profile' ? (
          <div>
            <SectionHeader title="Perfil del negocio" onBack={() => setActiveSection('home')} />
            <div className="space-y-6">
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Identidad comercial</p>
                    <h2 className="font-serif text-3xl font-bold text-foreground">{business.name}</h2>
                    <p className="mt-2 text-muted-foreground">{business.description}</p>
                    <div className="mt-3 inline-flex rounded-full bg-secondary/80 px-3 py-1 text-xs font-medium text-secondary-foreground">
                      {business.category}
                    </div>
                  </div>

                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-background">
                    {business.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={business.logoUrl} alt={business.name} className="h-full w-full object-cover" />
                    ) : (
                      <Building2 className="h-10 w-10 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-2xl p-6">
                <div className="mb-4 flex items-center gap-2">
                  <ImagePlus className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-foreground">Logo y presencia visual</h3>
                </div>
                <ImageUploadField
                  label={IMAGE_RULES.businessLogo.label}
                  helpText={IMAGE_RULES.businessLogo.recommended}
                  maxSizeMb={IMAGE_RULES.businessLogo.maxSizeMb}
                  minWidth={IMAGE_RULES.businessLogo.minWidth}
                  minHeight={IMAGE_RULES.businessLogo.minHeight}
                  valueUrl={business.logoUrl}
                  onFileChange={setLogoFile}
                />
                <Button onClick={handleLogoUpload} className="mt-4 w-full btn-premium gap-2" disabled={logoUploading}>
                  <Upload className="h-4 w-4" />
                  {logoUploading ? 'Subiendo logo...' : 'Actualizar logo'}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const isActive = activeSection === item.key
            return (
              <button key={item.key} onClick={() => setActiveSection(item.key)} className="relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-all">
                <item.icon className="h-5 w-5" style={{ color: isActive ? 'var(--primary)' : 'var(--muted-foreground)' }} />
                <span className="text-[10px] font-medium" style={{ color: isActive ? 'var(--primary)' : 'var(--muted-foreground)' }}>{item.label}</span>
                {item.key === 'home' && !monthlyStatus.isCompliant ? (
                  <span className="absolute right-0 top-0 h-2.5 w-2.5 -translate-y-1/4 translate-x-1/4 rounded-full bg-amber-500" />
                ) : null}
              </button>
            )
          })}
        </div>
      </nav>

      {showModal && modalState ? (
        <PromotionModal
          buildings={initialData.availableBuildings}
          initial={modalState}
          mode={modalMode}
          monthLabel={monthlyStatus.monthLabel}
          onClose={() => setShowModal(false)}
          onSave={handlePromotionSave}
        />
      ) : null}

      <ChatWidget />
    </div>
  )
}
