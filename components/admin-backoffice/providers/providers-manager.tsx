'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { IAdminProvider } from '@/lib/types'
import { createProvider, setProviderActive, updateProvider } from '@/app/iadmin/proveedores/actions'

type Props = {
  administrationId: string
  providers: IAdminProvider[]
  canManage: boolean
}

const emptyDraft = {
  name: '',
  taxId: '',
  category: '',
  email: '',
  phone: '',
  notes: '',
}

type Draft = typeof emptyDraft

export function ProvidersManager({ administrationId, providers, canManage }: Props) {
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [pending, startTransition] = useTransition()

  function resetDraft() {
    setDraft(emptyDraft)
    setCreating(false)
    setEditingId(null)
  }

  function openEdit(provider: IAdminProvider) {
    setDraft({
      name: provider.name,
      taxId: provider.taxId ?? '',
      category: provider.category ?? '',
      email: provider.email ?? '',
      phone: provider.phone ?? '',
      notes: provider.notes ?? '',
    })
    setEditingId(provider.id)
    setCreating(false)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.name.trim()) {
      toast.error('El nombre es obligatorio')
      return
    }

    startTransition(async () => {
      try {
        if (editingId) {
          await updateProvider({
            providerId: editingId,
            name: draft.name,
            taxId: draft.taxId || null,
            category: draft.category || null,
            email: draft.email || null,
            phone: draft.phone || null,
            notes: draft.notes || null,
          })
          toast.success('Proveedor actualizado')
        } else {
          await createProvider({
            administrationId,
            name: draft.name,
            taxId: draft.taxId || null,
            category: draft.category || null,
            email: draft.email || null,
            phone: draft.phone || null,
            notes: draft.notes || null,
          })
          toast.success('Proveedor creado')
        }
        resetDraft()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Error al guardar')
      }
    })
  }

  function handleToggle(provider: IAdminProvider) {
    startTransition(async () => {
      try {
        await setProviderActive({ providerId: provider.id, isActive: !provider.isActive })
        toast.success(provider.isActive ? 'Proveedor archivado' : 'Proveedor reactivado')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Error')
      }
    })
  }

  return (
    <div className="space-y-4">
      {canManage ? (
        !creating && !editingId ? (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setCreating(true)}>Nuevo proveedor</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-foreground">
                {editingId ? 'Editar proveedor' : 'Nuevo proveedor'}
              </h3>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={resetDraft}
              >
                Cancelar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Fld label="Nombre" required>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Fld>
              <Fld label="CUIT / Tax ID">
                <Input value={draft.taxId} onChange={(e) => setDraft({ ...draft, taxId: e.target.value })} />
              </Fld>
              <Fld label="Categoria">
                <Input
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  placeholder="Mantenimiento, seguridad, limpieza..."
                />
              </Fld>
              <Fld label="Email">
                <Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              </Fld>
              <Fld label="Telefono">
                <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
              </Fld>
              <Fld label="Notas" span>
                <Textarea rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </Fld>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear proveedor'}
              </Button>
            </div>
          </form>
        )
      ) : null}

      <div className="glass-card rounded-2xl overflow-hidden">
        {providers.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No hay proveedores cargados todavia.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground uppercase tracking-wider border-b border-border/40 bg-muted/30">
                <th className="text-left px-5 py-3 font-medium">Proveedor</th>
                <th className="text-left px-5 py-3 font-medium">Categoria</th>
                <th className="text-left px-5 py-3 font-medium">CUIT</th>
                <th className="text-left px-5 py-3 font-medium">Contacto</th>
                <th className="text-left px-5 py-3 font-medium">Estado</th>
                {canManage ? <th className="text-right px-5 py-3 font-medium">Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr key={provider.id} className="border-b border-border/30 last:border-0 hover:bg-muted/40">
                  <td className="px-5 py-3 font-medium text-foreground">{provider.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{provider.category ?? '—'}</td>
                  <td className="px-5 py-3 text-muted-foreground">{provider.taxId ?? '—'}</td>
                  <td className="px-5 py-3 text-muted-foreground text-xs">
                    {provider.email ? <div>{provider.email}</div> : null}
                    {provider.phone ? <div>{provider.phone}</div> : null}
                    {!provider.email && !provider.phone ? '—' : null}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        provider.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {provider.isActive ? 'Activo' : 'Archivado'}
                    </span>
                  </td>
                  {canManage ? (
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" disabled={pending} onClick={() => openEdit(provider)}>
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => handleToggle(provider)}
                        >
                          {provider.isActive ? 'Archivar' : 'Reactivar'}
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Fld({ label, children, required, span }: { label: string; children: React.ReactNode; required?: boolean; span?: boolean }) {
  return (
    <div className={`space-y-1.5 ${span ? 'md:col-span-2' : ''}`}>
      <Label>
        {label} {required ? <span className="text-primary">*</span> : null}
      </Label>
      {children}
    </div>
  )
}
