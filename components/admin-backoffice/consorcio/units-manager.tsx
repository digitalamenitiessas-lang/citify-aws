'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, ChevronRight, Pencil, UserPlus, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { IAdminHolderKind, IAdminUnitKind, IAdminUnitWithHolders } from '@/lib/types'
import {
  createUnit,
  createUnitHolder,
  deactivateUnit,
  endUnitHolder,
  updateUnit,
} from '@/app/iadmin/consorcios/[id]/actions'

type Props = {
  propertyId: string
  units: IAdminUnitWithHolders[]
  canManageUnits: boolean
  canManageHolders: boolean
}

const UNIT_KIND_OPTIONS: Array<{ value: IAdminUnitKind; label: string }> = [
  { value: 'departamento', label: 'Departamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'local', label: 'Local' },
  { value: 'cochera', label: 'Cochera' },
  { value: 'baulera', label: 'Baulera' },
  { value: 'otro', label: 'Otro' },
]

const HOLDER_KIND_OPTIONS: Array<{ value: IAdminHolderKind; label: string }> = [
  { value: 'propietario', label: 'Propietario' },
  { value: 'inquilino', label: 'Inquilino' },
  { value: 'apoderado', label: 'Apoderado' },
  { value: 'otro', label: 'Otro' },
]

type UnitDraft = {
  code: string
  kind: IAdminUnitKind
  floor: string
  surfaceM2: string
  prorataPct: string // guardamos como "12.5" (%), se convierte a 0.125 al enviar
}

const emptyUnitDraft: UnitDraft = { code: '', kind: 'departamento', floor: '', surfaceM2: '', prorataPct: '' }

function unitToDraft(unit: IAdminUnitWithHolders): UnitDraft {
  return {
    code: unit.code,
    kind: unit.kind,
    floor: unit.floor ?? '',
    surfaceM2: unit.surfaceM2?.toString() ?? '',
    prorataPct: unit.prorataCoefficient !== null ? (unit.prorataCoefficient * 100).toString() : '',
  }
}

function parseDraft(draft: UnitDraft) {
  const surface = draft.surfaceM2.trim() ? Number(draft.surfaceM2.replace(',', '.')) : null
  const pctRaw = draft.prorataPct.trim() ? Number(draft.prorataPct.replace(',', '.')) : null
  const prorata = pctRaw !== null ? pctRaw / 100 : null

  if (surface !== null && (!Number.isFinite(surface) || surface < 0)) {
    throw new Error('Superficie invalida')
  }
  if (prorata !== null && (!Number.isFinite(prorata) || prorata < 0 || prorata > 1)) {
    throw new Error('Alicuota debe ser 0-100%')
  }
  if (!draft.code.trim()) {
    throw new Error('Codigo de unidad obligatorio')
  }

  return {
    code: draft.code.trim(),
    kind: draft.kind,
    floor: draft.floor.trim() || null,
    surfaceM2: surface,
    prorataCoefficient: prorata,
  }
}

export function UnitsManager({ propertyId, units, canManageUnits, canManageHolders }: Props) {
  const [pending, startTransition] = useTransition()
  const [creating, setCreating] = useState(false)
  const [newDraft, setNewDraft] = useState<UnitDraft>(emptyUnitDraft)
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<UnitDraft>(emptyUnitDraft)
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null)
  const [addingHolderFor, setAddingHolderFor] = useState<string | null>(null)
  const [holderDraft, setHolderDraft] = useState({
    fullName: '',
    holderKind: 'propietario' as IAdminHolderKind,
    taxId: '',
    email: '',
    phone: '',
    startDate: '',
    replaceActive: true,
  })

  function submitNewUnit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      const parsed = parseDraft(newDraft)
      startTransition(async () => {
        try {
          await createUnit({ propertyId, ...parsed })
          toast.success('Unidad creada')
          setCreating(false)
          setNewDraft(emptyUnitDraft)
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Error')
        }
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error')
    }
  }

  function submitEditUnit(event: React.FormEvent<HTMLFormElement>, unitId: string) {
    event.preventDefault()
    try {
      const parsed = parseDraft(editDraft)
      startTransition(async () => {
        try {
          await updateUnit({ unitId, ...parsed })
          toast.success('Unidad actualizada')
          setEditingUnitId(null)
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Error')
        }
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error')
    }
  }

  function handleDeactivate(unitId: string) {
    if (!window.confirm('Marcar esta unidad como inactiva? No se borra, queda fuera de liquidaciones futuras.')) return
    startTransition(async () => {
      try {
        await deactivateUnit({ unitId })
        toast.success('Unidad desactivada')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Error')
      }
    })
  }

  function resetHolderDraft() {
    setHolderDraft({
      fullName: '',
      holderKind: 'propietario',
      taxId: '',
      email: '',
      phone: '',
      startDate: '',
      replaceActive: true,
    })
    setAddingHolderFor(null)
  }

  function submitHolder(event: React.FormEvent<HTMLFormElement>, unitId: string) {
    event.preventDefault()
    if (!holderDraft.fullName.trim()) {
      toast.error('Nombre obligatorio')
      return
    }
    startTransition(async () => {
      try {
        await createUnitHolder({
          unitId,
          fullName: holderDraft.fullName.trim(),
          holderKind: holderDraft.holderKind,
          taxId: holderDraft.taxId.trim() || null,
          email: holderDraft.email.trim() || null,
          phone: holderDraft.phone.trim() || null,
          startDate: holderDraft.startDate || null,
          replaceActive: holderDraft.replaceActive,
        })
        toast.success('Titular agregado')
        resetHolderDraft()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Error')
      }
    })
  }

  function handleEndHolder(holderId: string) {
    if (!window.confirm('Finalizar este titular? Queda en historico con fecha fin de hoy.')) return
    startTransition(async () => {
      try {
        await endUnitHolder({ holderId })
        toast.success('Titular finalizado')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Error')
      }
    })
  }

  const totalProrata = units.filter((u) => u.isActive).reduce((sum, u) => sum + (u.prorataCoefficient ?? 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {units.length} unidades · suma de alicuotas activas: <span className="font-medium tabular-nums">{(totalProrata * 100).toFixed(2)}%</span>
          {totalProrata > 0 && Math.abs(totalProrata - 1) > 0.001 ? (
            <span className="ml-2 text-amber-700">⚠ deberia sumar 100%</span>
          ) : null}
        </div>
        {canManageUnits && !creating ? (
          <Button size="sm" onClick={() => setCreating(true)}>Nueva unidad</Button>
        ) : null}
      </div>

      {creating ? (
        <form onSubmit={submitNewUnit} className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground">Nueva unidad</h3>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => { setCreating(false); setNewDraft(emptyUnitDraft) }}
            >
              Cancelar
            </button>
          </div>
          <UnitFormFields draft={newDraft} onChange={setNewDraft} />
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando…' : 'Crear unidad'}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="glass-card rounded-2xl overflow-hidden">
        {units.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No hay unidades cargadas todavia.
          </div>
        ) : (
          <ul className="divide-y divide-border/30">
            {units.map((unit) => {
              const isExpanded = expandedUnitId === unit.id
              const activeHolders = unit.holders.filter((h) => h.isActive)
              const isEditing = editingUnitId === unit.id
              const isAddingHolder = addingHolderFor === unit.id

              return (
                <li key={unit.id} className={!unit.isActive ? 'opacity-60' : ''}>
                  <div
                    className="px-5 py-3 flex items-center gap-3 cursor-pointer hover:bg-muted/30"
                    onClick={() => setExpandedUnitId(isExpanded ? null : unit.id)}
                  >
                    <button type="button" className="text-muted-foreground">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{unit.code}</span>
                        <span className="text-xs text-muted-foreground capitalize">{unit.kind}</span>
                        {!unit.isActive ? <span className="text-xs bg-muted px-1.5 py-0.5 rounded">inactiva</span> : null}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {activeHolders.length > 0
                          ? activeHolders.map((h) => `${h.holderKind}: ${h.fullName}`).join(' · ')
                          : 'sin titulares activos'}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {unit.prorataCoefficient !== null ? `${(unit.prorataCoefficient * 100).toFixed(2)}%` : '—'}
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="px-5 py-4 bg-muted/20 space-y-4 border-t border-border/30">
                      <div className="flex items-center justify-between">
                        <div className="text-xs grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
                          <div><span className="text-muted-foreground">Piso:</span> {unit.floor ?? '—'}</div>
                          <div><span className="text-muted-foreground">Superficie:</span> {unit.surfaceM2 ? `${unit.surfaceM2} m²` : '—'}</div>
                          <div><span className="text-muted-foreground">Alicuota:</span> {unit.prorataCoefficient !== null ? `${(unit.prorataCoefficient * 100).toFixed(3)}%` : '—'}</div>
                          <div><span className="text-muted-foreground">Titulares:</span> {unit.holders.length}</div>
                        </div>
                        {canManageUnits && !isEditing ? (
                          <div className="flex gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              onClick={() => { setEditingUnitId(unit.id); setEditDraft(unitToDraft(unit)) }}
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1" />
                              Editar
                            </Button>
                            {unit.isActive ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={pending}
                                onClick={() => handleDeactivate(unit.id)}
                              >
                                Desactivar
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      {isEditing ? (
                        <form onSubmit={(e) => submitEditUnit(e, unit.id)} className="space-y-4 rounded-lg border border-border/40 p-4">
                          <UnitFormFields draft={editDraft} onChange={setEditDraft} />
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="ghost" size="sm" onClick={() => setEditingUnitId(null)}>
                              Cancelar
                            </Button>
                            <Button type="submit" size="sm" disabled={pending}>
                              Guardar
                            </Button>
                          </div>
                        </form>
                      ) : null}

                      {/* Holders */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-foreground">Titulares</h4>
                          {canManageHolders && !isAddingHolder ? (
                            <Button size="sm" variant="outline" onClick={() => setAddingHolderFor(unit.id)}>
                              <UserPlus className="w-3.5 h-3.5 mr-1" />
                              Agregar titular
                            </Button>
                          ) : null}
                        </div>

                        {unit.holders.length === 0 && !isAddingHolder ? (
                          <div className="text-xs text-muted-foreground italic">No hay titulares cargados.</div>
                        ) : (
                          <ul className="space-y-1.5">
                            {unit.holders.map((h) => (
                              <li key={h.id} className="flex items-center justify-between text-xs rounded-md bg-background px-3 py-2 border border-border/40">
                                <div>
                                  <div className="font-medium text-foreground">
                                    {h.fullName} <span className="text-muted-foreground capitalize font-normal">· {h.holderKind}</span>
                                  </div>
                                  <div className="text-muted-foreground">
                                    {h.isActive ? (
                                      <>desde {h.startDate ?? '—'}</>
                                    ) : (
                                      <>del {h.startDate ?? '—'} al {h.endDate ?? '—'}</>
                                    )}
                                    {h.email ? ` · ${h.email}` : ''}
                                    {h.phone ? ` · ${h.phone}` : ''}
                                  </div>
                                </div>
                                {h.isActive && canManageHolders ? (
                                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => handleEndHolder(h.id)}>
                                    <UserX className="w-3.5 h-3.5 mr-1" />
                                    Finalizar
                                  </Button>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}

                        {isAddingHolder ? (
                          <form onSubmit={(e) => submitHolder(e, unit.id)} className="mt-3 space-y-3 rounded-lg border border-border/40 p-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label>Nombre completo *</Label>
                                <Input
                                  value={holderDraft.fullName}
                                  onChange={(e) => setHolderDraft({ ...holderDraft, fullName: e.target.value })}
                                  required
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Relacion</Label>
                                <select
                                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                  value={holderDraft.holderKind}
                                  onChange={(e) => setHolderDraft({ ...holderDraft, holderKind: e.target.value as IAdminHolderKind })}
                                >
                                  {HOLDER_KIND_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1.5">
                                <Label>CUIT / DNI</Label>
                                <Input value={holderDraft.taxId} onChange={(e) => setHolderDraft({ ...holderDraft, taxId: e.target.value })} />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Fecha inicio</Label>
                                <Input type="date" value={holderDraft.startDate} onChange={(e) => setHolderDraft({ ...holderDraft, startDate: e.target.value })} />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Email</Label>
                                <Input type="email" value={holderDraft.email} onChange={(e) => setHolderDraft({ ...holderDraft, email: e.target.value })} />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Telefono</Label>
                                <Input value={holderDraft.phone} onChange={(e) => setHolderDraft({ ...holderDraft, phone: e.target.value })} />
                              </div>
                            </div>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={holderDraft.replaceActive}
                                onChange={(e) => setHolderDraft({ ...holderDraft, replaceActive: e.target.checked })}
                              />
                              Si ya hay un titular activo del mismo tipo, finalizarlo automaticamente
                            </label>
                            <div className="flex justify-end gap-2">
                              <Button type="button" size="sm" variant="ghost" onClick={resetHolderDraft}>Cancelar</Button>
                              <Button type="submit" size="sm" disabled={pending}>Agregar</Button>
                            </div>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function UnitFormFields({ draft, onChange }: { draft: UnitDraft; onChange: (next: UnitDraft) => void }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <div className="space-y-1.5">
        <Label>Codigo *</Label>
        <Input value={draft.code} onChange={(e) => onChange({ ...draft, code: e.target.value })} required />
      </div>
      <div className="space-y-1.5">
        <Label>Tipo</Label>
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={draft.kind}
          onChange={(e) => onChange({ ...draft, kind: e.target.value as IAdminUnitKind })}
        >
          {UNIT_KIND_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Piso</Label>
        <Input value={draft.floor} onChange={(e) => onChange({ ...draft, floor: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Superficie (m²)</Label>
        <Input inputMode="decimal" value={draft.surfaceM2} onChange={(e) => onChange({ ...draft, surfaceM2: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Alicuota (%)</Label>
        <Input
          inputMode="decimal"
          value={draft.prorataPct}
          onChange={(e) => onChange({ ...draft, prorataPct: e.target.value })}
          placeholder="12.50"
        />
      </div>
    </div>
  )
}
