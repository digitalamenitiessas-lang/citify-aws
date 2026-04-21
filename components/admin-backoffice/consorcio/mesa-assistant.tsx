'use client'

import { useState, useTransition } from 'react'
import {
  AlertTriangle,
  Copy,
  FileUp,
  Loader2,
  MessageSquare,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  extractExpenseFromFile,
  type ExtractExpenseFromFileResult,
} from '@/app/iadmin/gastos/ai-actions'
import {
  generateAnnouncement,
  type AnnouncementDraft,
} from '@/app/iadmin/comunicaciones/actions'

type Props = {
  propertyId: string
  administrationId: string
  year: number
  month: number
  hasPredictions: boolean
  onRequestPredictions: () => Promise<void>
  onClose: () => void
}

type Tab = 'menu' | 'extract' | 'predict' | 'announce'

const MONTH_LABELS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

export function MesaAssistant({
  propertyId,
  administrationId,
  year,
  month,
  hasPredictions,
  onRequestPredictions,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>('menu')
  const [pending, startTransition] = useTransition()

  const [extractResult, setExtractResult] = useState<ExtractExpenseFromFileResult | null>(null)
  const [extractError, setExtractError] = useState<string | null>(null)

  const [announceTopic, setAnnounceTopic] = useState('')
  const [announceDraft, setAnnounceDraft] = useState<AnnouncementDraft | null>(null)

  const monthLabel = `${MONTH_LABELS_ES[month - 1]} ${year}`

  function handlePredict() {
    startTransition(async () => {
      try {
        await onRequestPredictions()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Error')
      }
    })
  }

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setExtractError(null)
    setExtractResult(null)

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        setExtractError('No se pudo leer el archivo')
        return
      }
      const base64 = result.split(',')[1] ?? ''
      if (!base64) {
        setExtractError('Archivo vacío')
        return
      }
      startTransition(async () => {
        try {
          const r = await extractExpenseFromFile({
            administrationId,
            managedPropertyId: propertyId,
            fileBase64: base64,
            mimeType: file.type || 'application/pdf',
            fileName: file.name,
          })
          setExtractResult(r)
        } catch (error) {
          setExtractError(error instanceof Error ? error.message : 'Error al extraer')
        }
      })
    }
    reader.onerror = () => setExtractError('Error leyendo el archivo')
    reader.readAsDataURL(file)
  }

  function handleGenerateAnnouncement() {
    if (announceTopic.trim().length < 5) {
      toast.error('Describí un poco más el tema')
      return
    }
    startTransition(async () => {
      try {
        const draft = await generateAnnouncement({
          administrationId,
          managedPropertyId: propertyId,
          topic: announceTopic.trim(),
        })
        setAnnounceDraft(draft)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Error al redactar')
      }
    })
  }

  async function handleCopy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copiado`)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  return (
    <aside className="mesa-card overflow-hidden mesa-fade-in">
      <header className="px-5 py-3 border-b border-border/30 flex items-center justify-between bg-gradient-to-r from-primary/8 to-primary/0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-serif text-base font-semibold text-foreground">Asistente</h3>
          <span className="text-[10px] text-muted-foreground">
            {tab === 'menu' ? `· ${monthLabel}` : null}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {tab !== 'menu' ? (
            <Button size="sm" variant="ghost" onClick={() => setTab('menu')} className="text-xs">
              ← Volver
            </Button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 hover:bg-muted text-muted-foreground"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {tab === 'menu' ? (
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-2">
          <AssistantCard
            icon={TrendingUp}
            title="Sugerir montos del mes"
            description={
              hasPredictions
                ? 'Ya hay sugerencias aplicadas. Podés volver a pedirlas.'
                : 'La IA analiza el historial y sugiere un monto por proveedor.'
            }
            onClick={handlePredict}
            pending={pending}
          />
          <AssistantCard
            icon={FileUp}
            title="Extraer de documento"
            description="Subí una factura PDF o imagen y la IA te devuelve los campos listos para cargar."
            onClick={() => setTab('extract')}
          />
          <AssistantCard
            icon={MessageSquare}
            title="Redactar comunicado"
            description="La IA te genera un borrador (email, cartelera, WhatsApp)."
            onClick={() => setTab('announce')}
          />
        </div>
      ) : null}

      {tab === 'extract' ? (
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Subí una factura (PDF o imagen). La IA extrae proveedor, monto y fecha. Después copiás los
            datos en la planilla.
          </p>
          <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground hover:bg-muted/30 w-full justify-center">
            <FileUp className="w-4 h-4" />
            {pending ? 'Procesando…' : 'Seleccionar archivo'}
            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={handleFile}
              disabled={pending}
            />
          </label>

          {extractError ? (
            <div className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5" />
              <span>{extractError}</span>
            </div>
          ) : null}

          {extractResult ? (
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-sm space-y-1">
              <div className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
                <span className="text-muted-foreground">Proveedor:</span>
                <span className="font-medium">{extractResult.suggestion.provider_name ?? '—'}</span>
                <span className="text-muted-foreground">Monto:</span>
                <span className="font-medium tabular-nums">
                  {extractResult.suggestion.amount
                    ? Number(extractResult.suggestion.amount).toLocaleString('es-AR')
                    : '—'}
                </span>
                <span className="text-muted-foreground">Emisión:</span>
                <span className="font-medium">{extractResult.suggestion.issued_at ?? '—'}</span>
                <span className="text-muted-foreground">Vencimiento:</span>
                <span className="font-medium">{extractResult.suggestion.due_at ?? '—'}</span>
              </div>
              {extractResult.anomalies && extractResult.anomalies.length > 0 ? (
                <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
                  {extractResult.anomalies.map((a, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-amber-900">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{a.message}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <p className="text-[10px] text-muted-foreground pt-2">
                Modelo: {extractResult.model}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'announce' ? (
        <div className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tema</Label>
            <Textarea
              rows={3}
              value={announceTopic}
              onChange={(e) => setAnnounceTopic(e.target.value)}
              placeholder="Ej. Aumento de expensas por actualización paritaria de encargado"
            />
          </div>
          <Button size="sm" onClick={handleGenerateAnnouncement} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Redactando…
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generar borrador
              </>
            )}
          </Button>

          {announceDraft ? (
            <div className="space-y-2">
              <DraftBlock
                title="WhatsApp"
                body={announceDraft.whatsapp}
                onCopy={() => handleCopy(announceDraft.whatsapp, 'WhatsApp')}
              />
              <DraftBlock
                title="Email"
                subject={announceDraft.subjectSuggestion}
                body={announceDraft.email}
                onCopy={() => handleCopy(announceDraft.email, 'Email')}
              />
              <DraftBlock
                title="Cartelera / formal"
                body={announceDraft.formal}
                onCopy={() => handleCopy(announceDraft.formal, 'Formal')}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <footer className="px-4 py-2 border-t border-border/30 text-[10px] text-muted-foreground text-center italic">
        La IA sugiere, vos decidís. Nada se guarda sin tu confirmación.
      </footer>
    </aside>
  )
}

function AssistantCard({
  icon: Icon,
  title,
  description,
  onClick,
  pending,
}: {
  icon: typeof Sparkles
  title: string
  description: string
  onClick: () => void
  pending?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-left rounded-xl border border-border/40 bg-background p-3 hover:border-primary/40 hover:bg-muted/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
        </div>
        <span className="font-medium text-sm">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </button>
  )
}

function DraftBlock({
  title,
  subject,
  body,
  onCopy,
}: {
  title: string
  subject?: string
  body: string
  onCopy: () => void
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium">{title}</span>
        <button
          type="button"
          onClick={onCopy}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <Copy className="w-3 h-3" /> Copiar
        </button>
      </div>
      {subject ? (
        <p className="text-[11px] text-muted-foreground mb-1">
          <span className="font-medium">Asunto:</span> {subject}
        </p>
      ) : null}
      <pre className="text-xs whitespace-pre-wrap font-sans text-foreground max-h-48 overflow-y-auto">
        {body}
      </pre>
    </div>
  )
}
