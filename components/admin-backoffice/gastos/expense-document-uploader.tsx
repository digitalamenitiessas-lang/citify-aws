'use client'

import { useRef, useState, useTransition } from 'react'
import { UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { attachExpenseDocument } from '@/app/iadmin/gastos/actions'

const BUCKET = 'iadmin-expense-documents'
const MAX_MB = 15

type Props = {
  expenseId: string
  administrationId: string
  disabled?: boolean
}

function randomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120)
}

export function ExpenseDocumentUploader({ expenseId, administrationId, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()

  async function onFileChosen(file: File) {
    if (file.size === 0) {
      toast.error('El archivo esta vacio')
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`El archivo supera ${MAX_MB}MB`)
      return
    }

    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      toast.error('Supabase no configurado')
      return
    }

    setUploading(true)
    try {
      const safeName = sanitizeFileName(file.name)
      const storagePath = `${administrationId}/${expenseId}/${randomId()}-${safeName}`

      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      startTransition(async () => {
        try {
          await attachExpenseDocument({
            expenseId,
            storagePath,
            fileName: file.name,
            mimeType: file.type || null,
            sizeBytes: file.size,
          })
          toast.success('Documento cargado. Extraccion IA pendiente de validacion.')
        } catch (error) {
          // revertir el upload si el insert a la DB fallo
          await supabase.storage.from(BUCKET).remove([storagePath])
          toast.error(error instanceof Error ? error.message : 'No se pudo registrar el documento')
        }
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fallo la subida')
    } finally {
      setUploading(false)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const busy = uploading || pending

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="application/pdf,image/*"
        disabled={disabled || busy}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            void onFileChosen(file)
          }
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
        {busy ? 'Subiendo…' : 'Subir comprobante'}
      </Button>
    </div>
  )
}
