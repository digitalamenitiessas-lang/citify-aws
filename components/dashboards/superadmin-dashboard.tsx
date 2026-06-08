'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Home,
  Mail,
  MapPin,
  Phone,
  Shield,
  Tag,
  TrendingUp,
  Users,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { toast } from 'sonner'
import { ROLE_LABELS } from '@/lib/constants'
import { ChatWidget } from '@/components/ai/chat-widget'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import DynamicMap from '@/components/map/map-view-dynamic'
import {
  addNeighborToBuilding,
  assignConsorcioAdminToBuilding,
  createBusinessWithAdmin,
  createManagedProperty,
  createPlatformUser,
  listUnitsForBuildingAction,
  updateBuilding,
} from '@/app/superadmin/actions'
import type {
  IAdminPropertyKind,
  SuperAdminConsorcioAdminOption,
  SuperAdminBuildingDetail,
  SuperAdminBusinessDetail,
  SuperAdminDashboardData,
  SuperAdminPromotionDetail,
  UserRole,
} from '@/lib/types'

type TabType = 'overview' | 'buildings' | 'users' | 'businesses' | 'promotions'

const PROPERTY_KIND_OPTIONS: Array<{ value: IAdminPropertyKind; label: string }> = [
  { value: 'consorcio', label: 'Consorcio' },
  { value: 'barrio_privado', label: 'Barrio privado' },
  { value: 'edificio', label: 'Edificio' },
  { value: 'mixto', label: 'Mixto' },
]

type ConsorcioWizardStepId = 'building' | 'admin' | 'summary'

const CONSORCIO_WIZARD_STEPS: Array<{
  id: ConsorcioWizardStepId
  label: string
  description: string
  optional?: boolean
}> = [
  { id: 'building', label: 'Edificio', description: 'Datos del edificio. La administración y la config interna son opcionales.' },
  { id: 'admin', label: 'Administrador', description: 'Cuenta que operará este consorcio.' },
  { id: 'summary', label: 'Resumen', description: 'Verificación final antes de crear.' },
]
const PIE_COLORS = ['#F04E23', '#C4733D', '#666666', '#F5A55D'] as const

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
const STAT_TONES = {
  primary: { disc: 'linear-gradient(135deg, #F04E23, #C73E15)', tint: 'rgba(240,78,35,0.06)' },
  accent: { disc: 'linear-gradient(135deg, #F5A55D, #E07B39)', tint: 'rgba(245,165,93,0.08)' },
  terra: { disc: 'linear-gradient(135deg, #C4733D, #9c4f24)', tint: 'rgba(196,115,61,0.07)' },
  green: { disc: 'linear-gradient(135deg, #16a34a, #047857)', tint: 'rgba(16,163,74,0.07)' },
  amber: { disc: 'linear-gradient(135deg, #f59e0b, #b45309)', tint: 'rgba(245,158,11,0.08)' },
} as const

type StatTone = keyof typeof STAT_TONES

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string
  value: number | string
  sub: string
  icon: typeof Shield
  tone?: StatTone
}) {
  const t = tone ? STAT_TONES[tone] : null
  return (
    <div className="glass-card rounded-xl p-5" style={t ? { background: t.tint } : undefined}>
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
        style={t ? { background: t.disc } : { background: 'rgba(156,156,156,0.15)', border: '1px solid rgba(0,0,0,0.06)' }}
      >
        <Icon className={`w-5 h-5 ${t ? 'text-white' : 'text-primary'}`} />
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-sm text-foreground mt-0.5">{label}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ children, color = 'default' }: { children: React.ReactNode; color?: 'default' | 'primary' | 'success' | 'warn' }) {
  const styles: Record<string, string> = {
    default: 'bg-muted text-muted-foreground',
    primary: 'text-white',
    success: 'bg-green-100 text-green-700',
    warn: 'bg-amber-100 text-amber-700',
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[color]}`}
      style={color === 'primary' ? { background: 'linear-gradient(135deg, #F04E23, #C73E15)' } : {}}
    >
      {children}
    </span>
  )
}

// ─── Section Header with optional back ───────────────────────────────────────
function SectionHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
      )}
      <div>
        <h2 className="font-bold text-foreground text-lg leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ─── Occupancy bar ────────────────────────────────────────────────────────────
function OccupancyBar({ rate }: { rate: number }) {
  const color = rate >= 80 ? '#22c55e' : rate >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(rate, 100)}%`, background: color }} />
      </div>
      <span className="text-xs font-medium text-muted-foreground w-9 text-right">{rate}%</span>
    </div>
  )
}

function AdminLoadBadge({ label, loaded, count }: { label: string; loaded: boolean; count: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
        loaded ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
      }`}
      title={loaded ? `${count} cargado${count !== 1 ? 's' : ''}` : 'Sin cargar por el admin'}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${loaded ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
      {label}
      {loaded ? ` ${count}` : ''}
    </span>
  )
}

function getRoleCreationCopy(role: string) {
  switch (role) {
    case 'consorcio_admin':
      return {
        title: 'Admin consorcio con alcance multi-edificio',
        body: 'Esta cuenta puede administrar varios consorcios. Crea el usuario primero y asigna sus edificios despues desde el wizard de alta de consorcio.',
      }
    case 'negocio_admin':
      return {
        title: 'Admin de negocio',
        body: 'Asocialo a un negocio para dejar lista la operacion comercial desde el panel de negocio.',
      }
    case 'vecino':
      return {
        title: 'Vecino',
        body: 'Puede quedar vinculado a un edificio para completar luego la unidad y el grupo familiar.',
      }
    default:
      return {
        title: 'Usuario de plataforma',
        body: 'Crea la cuenta base y completa luego cualquier relacion operativa especifica.',
      }
  }
}

function describeAdminAssignment(admin: SuperAdminConsorcioAdminOption | null) {
  if (!admin) {
    return 'Selecciona un admin para ver como quedara la asignacion inicial.'
  }

  if (admin.assignedBuildingsCount === 0) {
    return 'Este sera su primer consorcio. La asignacion quedara como principal y se sincronizara su edificio base.'
  }

  if (admin.primaryBuildingName) {
    return `Ya administra ${admin.assignedBuildingsCount} consorcio${admin.assignedBuildingsCount === 1 ? '' : 's'}. Este nuevo edificio quedara como adicional y no reemplazara ${admin.primaryBuildingName} como primario.`
  }

  return `Ya administra ${admin.assignedBuildingsCount} consorcio${admin.assignedBuildingsCount === 1 ? '' : 's'}. Este nuevo edificio se agregara como adicional.`
}

// ─── CONSORCIOS LIST ──────────────────────────────────────────────────────────
function BuildingsList({
  buildings,
  onSelect,
}: {
  buildings: SuperAdminBuildingDetail[]
  onSelect: (b: SuperAdminBuildingDetail) => void
}) {
  return (
    <div>
      <SectionHeader
        title="Consorcios"
        subtitle={`${buildings.length} edificio${buildings.length !== 1 ? 's' : ''} adherido${buildings.length !== 1 ? 's' : ''}`}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {buildings.map((building) => (
          <button
            key={building.id}
            onClick={() => onSelect(building)}
            className="glass-card glass-card-hover rounded-xl p-5 text-left group transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(156,156,156,0.15)', border: '1px solid rgba(0,0,0,0.06)' }}
                >
                  <Home className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                    {building.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {building.address}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-foreground">{building.adminLoadedUnitsCount || building.totalUnits}</div>
                <div className="text-xs text-muted-foreground">Unidades</div>
              </div>
              <div>
                <div className="text-lg font-bold text-foreground">{building.registeredNeighbors}</div>
                <div className="text-xs text-muted-foreground">Vecinos</div>
              </div>
              <div>
                <div className="text-lg font-bold text-foreground">{building.admins.length}</div>
                <div className="text-xs text-muted-foreground">Admin{building.admins.length !== 1 ? 's' : ''}</div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
              <AdminLoadBadge label="Info edificio" loaded={building.adminLoadedBuildingInfoCount > 0} count={building.adminLoadedBuildingInfoCount} />
              <AdminLoadBadge label="Unidades" loaded={building.adminLoadedUnitsCount > 0} count={building.adminLoadedUnitsCount} />
              <AdminLoadBadge label="Vecinos" loaded={building.registeredNeighbors > 0} count={building.registeredNeighbors} />
              <AdminLoadBadge label="Gastos" loaded={building.adminLoadedExpensesCount > 0} count={building.adminLoadedExpensesCount} />
            </div>

            <div className="mt-3">
              <OccupancyBar rate={building.occupancyRate} />
            </div>
          </button>
        ))}

        {buildings.length === 0 && (
          <div className="col-span-2 text-center py-12 text-muted-foreground text-sm">
            No hay consorcios registrados.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CONSORCIO DETAIL ─────────────────────────────────────────────────────────
function BuildingDetail({
  building,
  consorcioAdmins,
  onBack,
}: {
  building: SuperAdminBuildingDetail
  consorcioAdmins: SuperAdminConsorcioAdminOption[]
  onBack: () => void
}) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [addNeighborOpen, setAddNeighborOpen] = useState(false)
  const [addAdminOpen, setAddAdminOpen] = useState(false)
  const [editPending, startEditTransition] = useTransition()
  const [neighborPending, startNeighborTransition] = useTransition()
  const [adminPending, startAdminTransition] = useTransition()
  // 'existing' = asignar un admin ya creado · 'new' = crearlo en el momento.
  const [adminMode, setAdminMode] = useState<'existing' | 'new'>('existing')
  const [adminForm, setAdminForm] = useState({
    profileId: '',
    fullName: '',
    email: '',
    phone: '',
    password: 'Citify2026!',
  })
  // Admins que todavía no están asignados a este edificio.
  const assignedAdminIds = new Set(building.admins.map((admin) => admin.profileId))
  const availableAdmins = consorcioAdmins.filter((admin) => !assignedAdminIds.has(admin.profileId))

  function submitAddAdmin() {
    if (adminMode === 'existing') {
      if (!adminForm.profileId) {
        toast.error('Selecciona un admin para asignar.')
        return
      }
      startAdminTransition(async () => {
        try {
          await assignConsorcioAdminToBuilding({ buildingId: building.id, profileId: adminForm.profileId })
          toast.success('Admin asignado al consorcio.')
          setAddAdminOpen(false)
          setAdminForm({ profileId: '', fullName: '', email: '', phone: '', password: 'Citify2026!' })
          router.refresh()
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'No se pudo asignar el admin.')
        }
      })
      return
    }

    if (!adminForm.fullName.trim() || !adminForm.email.trim() || adminForm.password.trim().length < 8) {
      toast.error('Completá nombre, email y una contraseña de al menos 8 caracteres.')
      return
    }
    startAdminTransition(async () => {
      try {
        await createPlatformUser({
          fullName: adminForm.fullName.trim(),
          email: adminForm.email.trim(),
          phone: adminForm.phone.trim() || null,
          password: adminForm.password,
          role: 'consorcio_admin',
          buildingId: building.id,
        })
        toast.success('Admin creado y asignado al consorcio.')
        setAddAdminOpen(false)
        setAdminForm({ profileId: '', fullName: '', email: '', phone: '', password: 'Citify2026!' })
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No se pudo crear el admin.')
      }
    })
  }
  const [editForm, setEditForm] = useState({
    name: building.name,
    address: building.address,
    totalUnits: String(building.totalUnits ?? 0),
    latitude: building.latitude !== null ? String(building.latitude) : '',
    longitude: building.longitude !== null ? String(building.longitude) : '',
  })
  const [editGeocoding, setEditGeocoding] = useState(false)
  const [editRecenterToken, setEditRecenterToken] = useState(0)
  const editMapInitialCenter = useMemo<[number, number]>(() => [-26.8306, -65.2038], [])
  const editMapLocation = useMemo<[number, number] | null>(() => {
    const lat = Number(editForm.latitude.replace(',', '.'))
    const lng = Number(editForm.longitude.replace(',', '.'))
    if (!editForm.latitude || !editForm.longitude) return null
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return [lat, lng]
  }, [editForm.latitude, editForm.longitude])

  async function locateEditAddress() {
    if (!editForm.address.trim()) {
      toast.error('Ingresa una direccion antes de ubicar el edificio.')
      return
    }
    setEditGeocoding(true)
    toast.loading('Buscando direccion...', { id: 'edit-building-geocode' })
    try {
      const query = encodeURIComponent(`${editForm.address}, San Miguel de Tucuman, Argentina`)
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`)
      const data = await response.json()
      if (Array.isArray(data) && data.length > 0) {
        setEditForm((current) => ({
          ...current,
          latitude: String(parseFloat(data[0].lat)),
          longitude: String(parseFloat(data[0].lon)),
        }))
        setEditRecenterToken((t) => t + 1)
        toast.success('Ubicacion aproximada encontrada.', { id: 'edit-building-geocode' })
      } else {
        toast.error('No pudimos ubicarla. Puedes marcar el punto manualmente en el mapa.', { id: 'edit-building-geocode' })
      }
    } catch {
      toast.error('Error buscando la direccion.', { id: 'edit-building-geocode' })
    } finally {
      setEditGeocoding(false)
    }
  }
  const [neighborForm, setNeighborForm] = useState<{
    fullName: string
    email: string
    phone: string
    password: string
    unitId: string
    relationshipType: '' | 'vecino_principal' | 'vecino_adicional'
  }>({
    fullName: '',
    email: '',
    phone: '',
    password: 'Citify2026!',
    unitId: '',
    relationshipType: '',
  })
  const [buildingUnits, setBuildingUnits] = useState<Array<{ id: string; code: string; floor: string | null }>>([])
  const [unitsLoading, setUnitsLoading] = useState(false)

  useEffect(() => {
    if (!addNeighborOpen) return
    setUnitsLoading(true)
    listUnitsForBuildingAction(building.id)
      .then((units) => setBuildingUnits(units))
      .catch(() => setBuildingUnits([]))
      .finally(() => setUnitsLoading(false))
  }, [addNeighborOpen, building.id])

  function submitEdit() {
    startEditTransition(async () => {
      try {
        await updateBuilding({
          buildingId: building.id,
          name: editForm.name.trim(),
          address: editForm.address.trim(),
          totalUnits: Number(editForm.totalUnits) || 0,
          latitude: editForm.latitude.trim() ? Number(editForm.latitude) : null,
          longitude: editForm.longitude.trim() ? Number(editForm.longitude) : null,
        })
        toast.success('Edificio actualizado.')
        setEditOpen(false)
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el edificio.')
      }
    })
  }

  function submitAddNeighbor() {
    if (!neighborForm.fullName.trim() || !neighborForm.email.trim() || !neighborForm.password.trim()) {
      toast.error('Completá nombre, email y password.')
      return
    }
    if ((neighborForm.unitId && !neighborForm.relationshipType) || (!neighborForm.unitId && neighborForm.relationshipType)) {
      toast.error('Elegí unidad y rol juntos (o ninguno para solo asignarlo al edificio).')
      return
    }
    startNeighborTransition(async () => {
      try {
        await addNeighborToBuilding({
          buildingId: building.id,
          fullName: neighborForm.fullName.trim(),
          email: neighborForm.email.trim(),
          phone: neighborForm.phone.trim() || null,
          password: neighborForm.password,
          unitId: neighborForm.unitId || null,
          relationshipType: neighborForm.relationshipType || null,
        })
        toast.success(neighborForm.unitId ? 'Vecino agregado y vinculado a la unidad.' : 'Vecino agregado al edificio.')
        setAddNeighborOpen(false)
        setNeighborForm({ fullName: '', email: '', phone: '', password: 'Citify2026!', unitId: '', relationshipType: '' })
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No se pudo agregar el vecino.')
      }
    })
  }

  return (
    <div>
      <SectionHeader
        title={building.name}
        subtitle={building.address}
        onBack={onBack}
      />

      <div className="flex flex-wrap gap-2 mb-6">
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          Editar edificio
        </Button>
        <Button size="sm" onClick={() => setAddNeighborOpen(true)}>
          Agregar vecino
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setAdminMode(availableAdmins.length === 0 ? 'new' : 'existing')
            setAddAdminOpen(true)
          }}
        >
          Agregar admin
        </Button>
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditOpen(false)}>
          <div className="glass-card w-full max-w-3xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-serif text-xl font-bold text-foreground mb-4">Editar edificio</h2>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Nombre</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Ubicación
                </Label>
                <p className="text-xs text-muted-foreground">
                  Busca la dirección y, si hace falta, corrige el punto haciendo click en el mapa.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    placeholder="Ej. Av. Sarmiento 2555"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={locateEditAddress}
                    disabled={editGeocoding || !editForm.address.trim()}
                  >
                    {editGeocoding ? 'Ubicando...' : 'Ubicar'}
                  </Button>
                </div>
                <div className="overflow-hidden rounded-2xl border border-border/60 bg-background">
                  <div className="h-[320px]">
                    <DynamicMap
                      center={editMapLocation ?? editMapInitialCenter}
                      zoom={editMapLocation ? 17 : 13}
                      recenterKey={editRecenterToken}
                      interactive
                      selectedLocation={editMapLocation}
                      onLocationSelect={(lat, lng) =>
                        setEditForm((current) => ({
                          ...current,
                          latitude: String(lat),
                          longitude: String(lng),
                        }))
                      }
                    />
                  </div>
                </div>
                {editMapLocation && (
                  <p className="text-xs text-muted-foreground">
                    Coordenadas: {editMapLocation[0].toFixed(5)}, {editMapLocation[1].toFixed(5)}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editPending}>Cancelar</Button>
              <Button onClick={submitEdit} disabled={editPending}>{editPending ? 'Guardando…' : 'Guardar cambios'}</Button>
            </div>
          </div>
        </div>
      )}

      {addNeighborOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAddNeighborOpen(false)}>
          <div className="glass-card w-full max-w-md rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-serif text-xl font-bold text-foreground mb-4">Agregar vecino al edificio</h2>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Nombre completo</Label>
                <Input value={neighborForm.fullName} onChange={(e) => setNeighborForm({ ...neighborForm, fullName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={neighborForm.email} onChange={(e) => setNeighborForm({ ...neighborForm, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Teléfono (opcional)</Label>
                <Input value={neighborForm.phone} onChange={(e) => setNeighborForm({ ...neighborForm, phone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Password inicial</Label>
                <Input type="text" value={neighborForm.password} onChange={(e) => setNeighborForm({ ...neighborForm, password: e.target.value })} />
                <p className="text-[11px] text-muted-foreground">El vecino la podrá cambiar después de su primer ingreso.</p>
              </div>

              <div className="rounded-lg border border-border/30 p-3 space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vínculo con unidad (opcional)</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Dejar vacío para solo asignarlo al edificio.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Unidad</Label>
                    <select
                      value={neighborForm.unitId}
                      onChange={(e) => setNeighborForm({ ...neighborForm, unitId: e.target.value })}
                      className="w-full rounded-lg border border-border/50 bg-input/50 px-3 py-2 text-sm text-foreground"
                      disabled={unitsLoading}
                    >
                      <option value="">{unitsLoading ? 'Cargando…' : '— sin unidad —'}</option>
                      {buildingUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.code}{u.floor ? ` · piso ${u.floor}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Rol en la unidad</Label>
                    <select
                      value={neighborForm.relationshipType}
                      onChange={(e) => setNeighborForm({ ...neighborForm, relationshipType: e.target.value as typeof neighborForm.relationshipType })}
                      className="w-full rounded-lg border border-border/50 bg-input/50 px-3 py-2 text-sm text-foreground"
                    >
                      <option value="">— sin rol —</option>
                      <option value="vecino_principal">Vecino principal</option>
                      <option value="vecino_adicional">Vecino adicional</option>
                    </select>
                  </div>
                </div>
                {buildingUnits.length === 0 && !unitsLoading && (
                  <p className="text-[11px] text-amber-600">Este edificio aún no tiene unidades cargadas. Importalas primero desde el wizard.</p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddNeighborOpen(false)} disabled={neighborPending}>Cancelar</Button>
              <Button onClick={submitAddNeighbor} disabled={neighborPending}>{neighborPending ? 'Creando…' : 'Crear vecino'}</Button>
            </div>
          </div>
        </div>
      )}

      {addAdminOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAddAdminOpen(false)}>
          <div className="glass-card w-full max-w-md rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-serif text-xl font-bold text-foreground mb-4">Agregar admin al consorcio</h2>

            <div className="mb-4 inline-flex rounded-lg border border-border/50 bg-background/60 p-1">
              <button
                type="button"
                onClick={() => setAdminMode('existing')}
                disabled={availableAdmins.length === 0}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
                  adminMode === 'existing' ? 'bg-primary/10 text-foreground' : 'text-muted-foreground'
                }`}
              >
                Asignar existente
              </button>
              <button
                type="button"
                onClick={() => setAdminMode('new')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  adminMode === 'new' ? 'bg-primary/10 text-foreground' : 'text-muted-foreground'
                }`}
              >
                Crear nuevo
              </button>
            </div>

            {adminMode === 'existing' ? (
              <div className="space-y-2">
                <Label>Admin consorcio</Label>
                <select
                  value={adminForm.profileId}
                  onChange={(e) => setAdminForm({ ...adminForm, profileId: e.target.value })}
                  className="w-full rounded-lg border border-border/50 bg-input/50 px-3 py-2 text-sm text-foreground"
                >
                  <option value="">Seleccionar admin</option>
                  {availableAdmins.map((admin) => (
                    <option key={admin.profileId} value={admin.profileId}>
                      {admin.fullName} · {admin.email}
                    </option>
                  ))}
                </select>
                {availableAdmins.length === 0 && (
                  <p className="text-[11px] text-amber-600">No hay otros admins disponibles. Crea uno nuevo.</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Nombre completo</Label>
                  <Input value={adminForm.fullName} onChange={(e) => setAdminForm({ ...adminForm, fullName: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input type="email" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Teléfono (opcional)</Label>
                  <Input value={adminForm.phone} onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Password inicial</Label>
                  <Input type="text" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} />
                  <p className="text-[11px] text-muted-foreground">El admin la podrá cambiar después de su primer ingreso.</p>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddAdminOpen(false)} disabled={adminPending}>Cancelar</Button>
              <Button onClick={submitAddAdmin} disabled={adminPending}>
                {adminPending ? 'Guardando…' : adminMode === 'existing' ? 'Asignar admin' : 'Crear admin'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Unidades cargadas', value: building.adminLoadedUnitsCount || building.totalUnits },
          { label: 'Vecinos registrados', value: building.registeredNeighbors },
          { label: 'Administradores', value: building.admins.length },
          { label: 'Ocupación', value: `${building.occupancyRate}%` },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-xl p-4 text-center">
            <div className="text-xl font-bold text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Carga del admin consorcio */}
      <div className="glass-card rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-foreground">Carga del admin consorcio</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {building.adminLastActivityAt
                ? `Última actividad: ${new Date(building.adminLastActivityAt).toLocaleString('es-AR')}`
                : 'Aún no registró actividad en su panel.'}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <AdminLoadBadge label="Info edificio" loaded={building.adminLoadedBuildingInfoCount > 0} count={building.adminLoadedBuildingInfoCount} />
            <AdminLoadBadge label="Unidades" loaded={building.adminLoadedUnitsCount > 0} count={building.adminLoadedUnitsCount} />
            <AdminLoadBadge label="Vecinos" loaded={building.registeredNeighbors > 0} count={building.registeredNeighbors} />
            <AdminLoadBadge label="Gastos" loaded={building.adminLoadedExpensesCount > 0} count={building.adminLoadedExpensesCount} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Admins */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">
              Usuario Encargado del Consorcio
            </h3>
          </div>
          {building.admins.length === 0 ? (
            <div className="px-5 py-8 text-center text-muted-foreground text-sm">
              Sin administrador asignado
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {building.admins.map((admin) => (
                <div key={admin.profileId} className="px-5 py-4 flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                    style={{ background: 'linear-gradient(135deg, #F04E23, #C73E15)' }}
                  >
                    {admin.fullName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">{admin.fullName}</span>
                      {admin.isPrimary && <Badge color="primary">Principal</Badge>}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Mail className="w-3 h-3" />
                      {admin.email}
                    </div>
                    {admin.phone && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Phone className="w-3 h-3" />
                        {admin.phone}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Occupancy */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Nivel de Ocupación</h3>
          </div>
          <div className="px-5 py-6 flex flex-col items-center justify-center gap-4">
            <div className="relative w-28 h-28">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/30" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke="#F04E23" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${Math.min(building.occupancyRate, 100) * 2.51} 251`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-foreground">{building.occupancyRate}%</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm text-foreground font-medium">
                {building.registeredNeighbors} de {building.totalUnits} unidades ocupadas
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">según vecinos registrados</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Configuración del consorcio</h3>
          </div>
          {!building.managedProperty ? (
            <div className="px-5 py-8 text-center text-muted-foreground text-sm">
              Este edificio todavía no tiene una capa IAdmin configurada.
            </div>
          ) : (
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Nombre a mostrar</p>
                <p className="mt-1 font-medium text-foreground">{building.managedProperty.displayName ?? building.name}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Tipo</p>
                <p className="mt-1 font-medium capitalize text-foreground">{building.managedProperty.propertyKind.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">CUIT</p>
                <p className="mt-1 text-foreground">{building.managedProperty.taxId ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Inicio de gestión</p>
                <p className="mt-1 text-foreground">{building.managedProperty.managedSince ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Fee administración</p>
                <p className="mt-1 text-foreground">
                  {building.managedProperty.managementFeePct !== null ? `${building.managedProperty.managementFeePct}%` : '—'}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Notas</p>
                <p className="mt-1 text-foreground">{building.managedProperty.notes ?? 'Sin notas cargadas.'}</p>
              </div>
            </div>
          )}
        </div>

        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
            <Home className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Administración asociada</h3>
          </div>
          {!building.administration ? (
            <div className="px-5 py-8 text-center text-muted-foreground text-sm">
              Sin administración asociada todavía.
            </div>
          ) : (
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Nombre</p>
                <p className="mt-1 font-medium text-foreground">{building.administration.name}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Razón social</p>
                <p className="mt-1 text-foreground">{building.administration.legalName ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">CUIT</p>
                <p className="mt-1 text-foreground">{building.administration.taxId ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Email</p>
                <p className="mt-1 text-foreground">{building.administration.contactEmail ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Teléfono</p>
                <p className="mt-1 text-foreground">{building.administration.contactPhone ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Estado</p>
                <p className="mt-1 text-foreground">{building.administration.isActive ? 'Activa' : 'Inactiva'}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Residents table */}
      <div className="glass-card rounded-xl overflow-hidden mt-6">
        <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">
            Vecinos Registrados ({building.registeredNeighbors})
          </h3>
        </div>
        {building.neighbors.length === 0 ? (
          <div className="px-5 py-8 text-center text-muted-foreground text-sm">
            No hay vecinos registrados en este edificio.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50" style={{ background: 'rgba(0,0,0,0.03)' }}>
                  {['Nombre', 'Email', 'Piso', 'Unidad', 'Teléfono'].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {building.neighbors.map((neighbor) => (
                  <tr key={neighbor.id} className="border-b border-border/30 last:border-0 hover:bg-secondary/30">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #F04E23, #C73E15)' }}
                        >
                          {neighbor.avatarText}
                        </div>
                        <span className="font-medium text-foreground">{neighbor.fullName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{neighbor.email}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{neighbor.floor ?? '—'}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{neighbor.unit ?? '—'}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{neighbor.phone ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── NEGOCIOS LIST ────────────────────────────────────────────────────────────
function BusinessesList({
  businesses,
  onSelect,
}: {
  businesses: SuperAdminBusinessDetail[]
  onSelect: (b: SuperAdminBusinessDetail) => void
}) {
  return (
    <div>
      <SectionHeader
        title="Negocios"
        subtitle={`${businesses.length} negocio${businesses.length !== 1 ? 's' : ''} afiliado${businesses.length !== 1 ? 's' : ''}`}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {businesses.map((business) => (
          <button
            key={business.id}
            onClick={() => onSelect(business)}
            className="glass-card glass-card-hover rounded-xl p-5 text-left group transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden border border-border/60 bg-background flex items-center justify-center flex-shrink-0">
                  {business.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={business.logoUrl} alt={business.name} className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                    {business.name}
                  </h3>
                  <Badge>{business.category}</Badge>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
            </div>

            <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{business.description}</p>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-foreground">{business.promotions.length}</div>
                <div className="text-xs text-muted-foreground">Cupones</div>
              </div>
              <div>
                <div className="text-lg font-bold text-foreground">{business.totalRedemptions}</div>
                <div className="text-xs text-muted-foreground">Canjes</div>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-foreground truncate">
                  {business.topBuilding ?? '—'}
                </div>
                <div className="text-xs text-muted-foreground">Top edificio</div>
              </div>
            </div>

            <div className="mt-3">
              <Badge color={business.monthlyStatus?.isCompliant ? 'success' : 'warn'}>
                {business.monthlyStatus?.isCompliant ? 'Al dia este mes' : 'Pendiente este mes'}
              </Badge>
            </div>
          </button>
        ))}

        {businesses.length === 0 && (
          <div className="col-span-2 text-center py-12 text-muted-foreground text-sm">
            No hay negocios registrados.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── NEGOCIO DETAIL ───────────────────────────────────────────────────────────
function BusinessDetail({ business, onBack }: { business: SuperAdminBusinessDetail; onBack: () => void }) {
  return (
    <div>
      <SectionHeader title={business.name} subtitle={business.category} onBack={onBack} />

      {/* Header card */}
      <div className="glass-card rounded-xl p-5 mb-6 flex items-start gap-5">
        <div className="w-16 h-16 rounded-xl overflow-hidden border border-border/60 bg-background flex items-center justify-center flex-shrink-0">
          {business.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.logoUrl} alt={business.name} className="w-full h-full object-cover" />
          ) : (
            <Building2 className="w-7 h-7 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-foreground text-lg">{business.name}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{business.description}</p>
          {business.ownerEmail ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Mail asociado: <span className="font-medium text-foreground">{business.ownerEmail}</span>
            </p>
          ) : null}
          <div className="flex items-center gap-3 mt-3">
            <Badge>{business.category}</Badge>
            <Badge color={business.monthlyStatus?.isCompliant ? 'success' : 'warn'}>
              {business.monthlyStatus?.isCompliant ? 'Promocion mensual cumplida' : 'Promocion mensual pendiente'}
            </Badge>
            {business.topBuilding && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Más activo en: <strong className="text-foreground ml-1">{business.topBuilding}</strong>
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-center flex-shrink-0">
          <div className="glass-card rounded-lg px-4 py-3">
            <div className="text-xl font-bold text-foreground">{business.promotions.length}</div>
            <div className="text-xs text-muted-foreground">Cupones</div>
          </div>
          <div className="glass-card rounded-lg px-4 py-3">
            <div className="text-xl font-bold text-foreground">{business.totalRedemptions}</div>
            <div className="text-xs text-muted-foreground">Canjes</div>
          </div>
        </div>
      </div>

      {/* Promotions */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
          <Tag className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">
            Cupones y Promociones ({business.promotions.length})
          </h3>
        </div>

        {business.promotions.length === 0 ? (
          <div className="px-5 py-8 text-center text-muted-foreground text-sm">
            Este negocio no tiene promociones cargadas.
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {business.promotions.map((promotion) => (
              <PromotionRow key={promotion.id} promotion={promotion} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PROMOTION ROW (expandable) ───────────────────────────────────────────────
function PromotionRow({ promotion }: { promotion: SuperAdminPromotionDetail }) {
  const [expanded, setExpanded] = useState(false)
  const isExpired = promotion.expirationDate < new Date().toISOString().slice(0, 10)

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-5 py-4 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg overflow-hidden border border-border/60 bg-background flex items-center justify-center flex-shrink-0">
            {promotion.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={promotion.imageUrl} alt={promotion.title} className="w-full h-full object-cover" />
            ) : (
              <Tag className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-foreground text-sm">{promotion.title}</p>
                <p className="text-xs text-primary font-medium mt-0.5">{promotion.discount}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isExpired ? (
                  <Badge color="warn">Vencido</Badge>
                ) : (
                  <Badge color="success">Activo</Badge>
                )}
                <ChevronRight
                  className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
                />
              </div>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-xs text-muted-foreground">
                {promotion.usageCount} canje{promotion.usageCount !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-muted-foreground">
                Vence: {promotion.expirationDate}
              </span>
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 pt-0">
          <div className="rounded-lg p-4" style={{ background: 'rgba(0,0,0,0.03)' }}>
            {promotion.redemptionsByBuilding.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center">Sin canjes registrados todavía.</p>
            ) : (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Uso por edificio
                </p>
                <div className="space-y-2">
                  {promotion.redemptionsByBuilding.map((item) => {
                    const maxCount = promotion.redemptionsByBuilding[0].count
                    const pct = Math.round((item.count / maxCount) * 100)
                    return (
                      <div key={item.buildingId} className="flex items-center gap-3">
                        <div className="w-32 text-xs text-foreground font-medium truncate">{item.buildingName}</div>
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #F04E23, #D4784E)' }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground w-14 text-right">
                          {item.count} canje{item.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
interface DashboardStats {
  usersByRole: { role: string; label: string; count: number }[]
  avgOccupancy: number
  activePromotions: number
  expiredPromotions: number
  totalRedemptions: number
  buildingsWithoutAdmin: number
  top5Buildings: { name: string; occupancyRate: number }[]
  top5Businesses: { name: string; totalRedemptions: number }[]
}

function computeDashboardStats(data: SuperAdminDashboardData): DashboardStats {
  const roleCounts = data.users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1
    return acc
  }, {})

  const usersByRole = (['vecino', 'consorcio_admin', 'negocio_admin'] as const).map((role) => ({
    role,
    label: ROLE_LABELS[role],
    count: roleCounts[role] ?? 0,
  }))

  const avgOccupancy =
    data.buildings.length === 0
      ? 0
      : Math.round(data.buildings.reduce((sum, b) => sum + b.occupancyRate, 0) / data.buildings.length)

  const today = new Date().toISOString().slice(0, 10)
  const activePromotions = data.promotions.filter((p) => p.expirationDate >= today).length
  const expiredPromotions = data.promotions.length - activePromotions

  const totalRedemptions = data.promotions.reduce((sum, p) => sum + p.usageCount, 0)

  const buildingsWithoutAdmin = data.buildings.filter((b) => b.admins.length === 0).length

  const top5Buildings = [...data.buildings]
    .sort((a, b) => b.occupancyRate - a.occupancyRate)
    .slice(0, 5)
    .map((b) => ({ name: b.name, occupancyRate: b.occupancyRate }))

  const top5Businesses = [...data.businesses]
    .sort((a, b) => b.totalRedemptions - a.totalRedemptions)
    .slice(0, 5)
    .map((b) => ({ name: b.name, totalRedemptions: b.totalRedemptions }))

  return { usersByRole, avgOccupancy, activePromotions, expiredPromotions, totalRedemptions, buildingsWithoutAdmin, top5Buildings, top5Businesses }
}

// ─── Platform Health Row ──────────────────────────────────────────────────────
function PlatformHealthRow({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="Ocupación promedio" value={stats.avgOccupancy} sub="% promedio plataforma" icon={TrendingUp} tone="accent" />
      <StatCard label="Promociones activas" value={stats.activePromotions} sub={`${stats.expiredPromotions} vencidas`} icon={Tag} tone="terra" />
      <StatCard label="Canjes totales" value={stats.totalRedemptions} sub="registros acumulados" icon={CheckCircle} tone="green" />
      <StatCard label="Sin administrador" value={stats.buildingsWithoutAdmin} sub="consorcios sin encargado" icon={AlertTriangle} tone="amber" />
    </div>
  )
}

// ─── Users by Role Chart ──────────────────────────────────────────────────────
function UsersByRoleChart({ data }: { data: DashboardStats['usersByRole'] }) {
  return (
    <div className="glass-card rounded-xl p-5">
      <h3 className="font-semibold text-foreground text-sm mb-4">Usuarios por Rol</h3>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
              {data.map((entry, index) => (
                <Cell key={entry.role} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [value, name]}
              contentStyle={{ background: '#FFFFFF', border: '1px solid rgba(240, 78, 35,0.14)', borderRadius: 8, fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {data.map((entry, index) => (
          <div key={entry.role} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: PIE_COLORS[index % PIE_COLORS.length] }} />
            <span className="text-xs text-muted-foreground">
              {entry.label} <span className="font-medium text-foreground">{entry.count}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Top Buildings Chart ──────────────────────────────────────────────────────
function TopBuildingsChart({ data }: { data: DashboardStats['top5Buildings'] }) {
  const fmt = (v: string) => (v.length > 14 ? v.slice(0, 13) + '…' : v)
  return (
    <div className="glass-card rounded-xl p-5">
      <h3 className="font-semibold text-foreground text-sm mb-4">Top Consorcios por Ocupación</h3>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#666666' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={110} tickFormatter={fmt} tick={{ fontSize: 11, fill: '#1A1A1A' }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value: number) => [`${value}%`, 'Ocupación']}
              contentStyle={{ background: '#FFFFFF', border: '1px solid rgba(240, 78, 35,0.14)', borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="occupancyRate" fill="#F04E23" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Top Businesses Chart ─────────────────────────────────────────────────────
function TopBusinessesChart({ data }: { data: DashboardStats['top5Businesses'] }) {
  const fmt = (v: string) => (v.length > 14 ? v.slice(0, 13) + '…' : v)
  return (
    <div className="glass-card rounded-xl p-5">
      <h3 className="font-semibold text-foreground text-sm mb-4">Top Negocios por Canjes</h3>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 11, fill: '#666666' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={110} tickFormatter={fmt} tick={{ fontSize: 11, fill: '#1A1A1A' }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value: number) => [value, 'Canjes']}
              contentStyle={{ background: '#FFFFFF', border: '1px solid rgba(240, 78, 35,0.14)', borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="totalRedemptions" fill="#C4733D" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export function SuperAdminDashboard({ data }: { data: SuperAdminDashboardData }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [userDraft, setUserDraft] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: 'Citify2026!',
    role: 'vecino',
    buildingId: '',
    businessId: '',
  })
  const [businessDraft, setBusinessDraft] = useState({
    businessName: '',
    category: '',
    description: '',
    address: '',
    adminFullName: '',
    adminEmail: '',
    adminPhone: '',
    adminPassword: 'Citify2026!',
  })
  const [consorcioDraft, setConsorcioDraft] = useState({
    buildingName: '',
    buildingAddress: '',
    totalUnits: '',
    latitude: '',
    longitude: '',
    administrationName: '',
    administrationLegalName: '',
    administrationTaxId: '',
    administrationContactEmail: '',
    administrationContactPhone: '',
    displayName: '',
    propertyKind: 'consorcio' as IAdminPropertyKind,
    propertyTaxId: '',
    managedSince: '',
    managementFeePct: '',
    notes: '',
    adminProfileId: '',
    newAdminFullName: '',
    newAdminEmail: '',
    newAdminPhone: '',
    newAdminPassword: 'Citify2026!',
  })
  // 'existing' = elegir un admin ya creado · 'new' = crearlo en este mismo paso.
  const [consorcioAdminMode, setConsorcioAdminMode] = useState<'existing' | 'new'>('existing')
  // Sección opcional (administración + config CITIFY) plegada dentro del paso Edificio.
  const [consorcioAdvancedOpen, setConsorcioAdvancedOpen] = useState(false)
  const [consorcioStepIndex, setConsorcioStepIndex] = useState(0)
  // "Arma" el botón Crear recién unos ms después de llegar al resumen, para
  // evitar que un doble-click sobre "Continuar" (que cambia de botón bajo el
  // cursor) dispare la creación sin querer.
  const [createArmed, setCreateArmed] = useState(false)
  const [administrationNameTouched, setAdministrationNameTouched] = useState(false)
  const [consorcioLocationSearching, setConsorcioLocationSearching] = useState(false)
  // Centro inicial fijo del mapa de "crear consorcio". Solo cambia cuando
  // bumpeamos el token (después de geocodificar dirección), nunca con un click.
  const consorcioInitialCenter = useMemo<[number, number]>(() => [-26.8306, -65.2038], [])
  const [consorcioRecenterToken, setConsorcioRecenterToken] = useState(0)

  const totalUsage = data.promotions.reduce((sum, p) => sum + p.usageCount, 0)
  const consorcioAdmins = data.consorcioAdminOptions

  // Si no hay ningún admin consorcio cargado, forzamos el modo "crear nuevo"
  // para que el wizard no quede bloqueado en el paso del administrador.
  useEffect(() => {
    if (consorcioAdmins.length === 0) {
      setConsorcioAdminMode('new')
    }
  }, [consorcioAdmins.length])
  // Al entrar al paso resumen, desarmamos el botón Crear y lo rearmamos tras un
  // breve retardo (anti doble-click accidental al avanzar).
  useEffect(() => {
    if (CONSORCIO_WIZARD_STEPS[consorcioStepIndex]?.id !== 'summary') {
      setCreateArmed(false)
      return
    }
    setCreateArmed(false)
    const timer = setTimeout(() => setCreateArmed(true), 450)
    return () => clearTimeout(timer)
  }, [consorcioStepIndex])
  const activeTabParam = searchParams.get('tab')
  // Si la URL no trae ?tab=..., caemos al último tab guardado en localStorage.
  const fallbackTab: TabType = (() => {
    if (typeof window === 'undefined') return 'overview'
    const stored = window.localStorage.getItem('citify-superadmin-tab-v1')
    return stored && ['buildings', 'users', 'businesses', 'promotions', 'overview'].includes(stored)
      ? (stored as TabType)
      : 'overview'
  })()
  const activeTab: TabType = ['buildings', 'users', 'businesses', 'promotions'].includes(activeTabParam ?? '')
    ? (activeTabParam as TabType)
    : fallbackTab
  const selectedBuildingId = searchParams.get('buildingId')
  const selectedBusinessId = searchParams.get('businessId')
  const selectedBuilding =
    activeTab === 'buildings' && selectedBuildingId
      ? data.buildings.find((building) => building.id === selectedBuildingId) ?? null
      : null
  const selectedBusiness =
    activeTab === 'businesses' && selectedBusinessId
      ? data.businesses.find((business) => business.id === selectedBusinessId) ?? null
      : null
  const isConsorcioAdminDraft = userDraft.role === 'consorcio_admin'
  const needsDirectBuilding = userDraft.role === 'vecino'
  const needsBusiness = userDraft.role === 'negocio_admin'
  const roleCreationCopy = getRoleCreationCopy(userDraft.role)
  const currentConsorcioStep = CONSORCIO_WIZARD_STEPS[consorcioStepIndex]
  const selectedConsorcioAdmin =
    consorcioAdmins.find((admin) => admin.profileId === consorcioDraft.adminProfileId) ?? null
  const consorcioMapLocation =
    consorcioDraft.latitude && consorcioDraft.longitude
      ? [Number(consorcioDraft.latitude.replace(',', '.')), Number(consorcioDraft.longitude.replace(',', '.'))] as [number, number]
      : null
  const administrationSummaryName = consorcioDraft.administrationName.trim() || consorcioDraft.buildingName.trim()
  const hasAdministrationCustomData =
    administrationNameTouched ||
    Boolean(
      consorcioDraft.administrationLegalName.trim() ||
        consorcioDraft.administrationTaxId.trim() ||
        consorcioDraft.administrationContactEmail.trim() ||
        consorcioDraft.administrationContactPhone.trim(),
    )
  const stats = computeDashboardStats(data)

  const tabs: { key: TabType; label: string; icon: typeof Shield }[] = [
    { key: 'overview', label: 'Resumen', icon: Shield },
    { key: 'buildings', label: 'Consorcios', icon: Home },
    { key: 'users', label: 'Usuarios', icon: Users },
    { key: 'businesses', label: 'Negocios', icon: Building2 },
    { key: 'promotions', label: 'Promociones', icon: Tag },
  ]

  function navigate(tab: TabType, options?: { buildingId?: string; businessId?: string }) {
    const params = new URLSearchParams()
    if (tab !== 'overview') {
      params.set('tab', tab)
    }
    if (tab === 'buildings' && options?.buildingId) {
      params.set('buildingId', options.buildingId)
    }
    if (tab === 'businesses' && options?.businessId) {
      params.set('businessId', options.businessId)
    }
    const query = params.toString()
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('citify-superadmin-tab-v1', tab)
    }
    router.replace(query ? `/superadmin?${query}` : '/superadmin')
  }

  function handleTabChange(tab: TabType) {
    navigate(tab)
  }

  function resetConsorcioDraft() {
    setConsorcioDraft({
      buildingName: '',
      buildingAddress: '',
      totalUnits: '',
      latitude: '',
      longitude: '',
      administrationName: '',
      administrationLegalName: '',
      administrationTaxId: '',
      administrationContactEmail: '',
      administrationContactPhone: '',
      displayName: '',
      propertyKind: 'consorcio',
      propertyTaxId: '',
      managedSince: '',
      managementFeePct: '',
      notes: '',
      adminProfileId: '',
      newAdminFullName: '',
      newAdminEmail: '',
      newAdminPhone: '',
      newAdminPassword: 'Citify2026!',
    })
    setAdministrationNameTouched(false)
    setConsorcioAdminMode(consorcioAdmins.length === 0 ? 'new' : 'existing')
    setConsorcioStepIndex(0)
  }

  function updateBuildingName(value: string) {
    setConsorcioDraft((current) => ({
      ...current,
      buildingName: value,
      administrationName: administrationNameTouched ? current.administrationName : value,
    }))
  }

  function updateUserRole(nextRole: string) {
    setUserDraft((current) => ({
      ...current,
      role: nextRole,
      buildingId: nextRole === 'vecino' ? current.buildingId : '',
      businessId: nextRole === 'negocio_admin' ? current.businessId : '',
    }))
  }

  async function locateConsorcioAddress() {
    if (!consorcioDraft.buildingAddress.trim()) {
      toast.error('Ingresa una direccion antes de ubicar el edificio.')
      return
    }

    setConsorcioLocationSearching(true)
    toast.loading('Buscando direccion...', { id: 'consorcio-geocode' })

    try {
      const query = encodeURIComponent(`${consorcioDraft.buildingAddress}, San Miguel de Tucuman, Argentina`)
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`)
      const data = await response.json()

      if (Array.isArray(data) && data.length > 0) {
        setConsorcioDraft((current) => ({
          ...current,
          latitude: String(parseFloat(data[0].lat)),
          longitude: String(parseFloat(data[0].lon)),
        }))
        setConsorcioRecenterToken((t) => t + 1)
        toast.success('Ubicacion aproximada encontrada.', { id: 'consorcio-geocode' })
      } else {
        toast.error('No pudimos ubicarla. Puedes marcar el punto manualmente en el mapa.', { id: 'consorcio-geocode' })
      }
    } catch {
      toast.error('Error buscando la direccion.', { id: 'consorcio-geocode' })
    } finally {
      setConsorcioLocationSearching(false)
    }
  }

  function getConsorcioStepError(stepIndex = consorcioStepIndex) {
    const step = CONSORCIO_WIZARD_STEPS[stepIndex]

    if (step.id === 'building') {
      if (!consorcioDraft.buildingName.trim()) return 'Completa el nombre del edificio.'
      if (!consorcioDraft.buildingAddress.trim()) return 'Completa la direccion del edificio.'

      if (consorcioDraft.latitude && !Number.isFinite(Number(consorcioDraft.latitude.replace(',', '.')))) {
        return 'La latitud es invalida.'
      }

      if (consorcioDraft.longitude && !Number.isFinite(Number(consorcioDraft.longitude.replace(',', '.')))) {
        return 'La longitud es invalida.'
      }

      if (consorcioDraft.managementFeePct) {
        const fee = Number(consorcioDraft.managementFeePct.replace(',', '.'))
        if (!Number.isFinite(fee) || fee < 0 || fee > 100) {
          return 'El fee de administracion debe estar entre 0 y 100.'
        }
      }
    }

    if (step.id === 'admin') {
      if (consorcioAdminMode === 'new') {
        if (!consorcioDraft.newAdminFullName.trim()) return 'Completa el nombre del nuevo admin.'
        if (!isValidEmail(consorcioDraft.newAdminEmail)) return 'Completa un email valido para el nuevo admin.'
        if (consorcioDraft.newAdminPassword.trim().length < 8) {
          return 'La contrasena del admin debe tener al menos 8 caracteres.'
        }
      } else {
        if (consorcioAdmins.length === 0) return 'No hay admins existentes. Crea uno nuevo en este paso.'
        if (!consorcioDraft.adminProfileId) return 'Selecciona el administrador inicial.'
      }
    }

    return null
  }

  function goToConsorcioStep(targetIndex: number) {
    if (targetIndex <= consorcioStepIndex) {
      setConsorcioStepIndex(targetIndex)
      return
    }

    for (let index = 0; index < targetIndex; index += 1) {
      const error = getConsorcioStepError(index)
      if (error) {
        toast.error(error)
        setConsorcioStepIndex(index)
        return
      }
    }

    setConsorcioStepIndex(targetIndex)
  }

  function nextConsorcioStep() {
    const error = getConsorcioStepError()
    if (error) {
      toast.error(error)
      return
    }

    setConsorcioStepIndex((current) => Math.min(current + 1, CONSORCIO_WIZARD_STEPS.length - 1))
  }

  function previousConsorcioStep() {
    setConsorcioStepIndex((current) => Math.max(current - 1, 0))
  }

  function submitUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      try {
        await createPlatformUser({
          fullName: userDraft.fullName,
          email: userDraft.email,
          phone: userDraft.phone || null,
          password: userDraft.password,
          role: userDraft.role as UserRole,
          buildingId: needsDirectBuilding ? userDraft.buildingId || null : null,
          businessId: needsBusiness ? userDraft.businessId || null : null,
        })
        toast.success(
          userDraft.role === 'consorcio_admin'
            ? 'Admin consorcio creado. Puedes asignarle edificios desde el alta de consorcio.'
            : 'Usuario creado',
        )
        setUserDraft({ fullName: '', email: '', phone: '', password: 'Citify2026!', role: 'vecino', buildingId: '', businessId: '' })
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Error')
      }
    })
  }

  function submitBusiness(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      try {
        await createBusinessWithAdmin({
          businessName: businessDraft.businessName,
          category: businessDraft.category,
          description: businessDraft.description,
          address: businessDraft.address || null,
          adminFullName: businessDraft.adminFullName,
          adminEmail: businessDraft.adminEmail,
          adminPhone: businessDraft.adminPhone || null,
          adminPassword: businessDraft.adminPassword,
        })
        toast.success('Negocio y administrador creados')
        setBusinessDraft({
          businessName: '',
          category: '',
          description: '',
          address: '',
          adminFullName: '',
          adminEmail: '',
          adminPhone: '',
          adminPassword: 'Citify2026!',
        })
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Error')
      }
    })
  }

  function submitConsorcio(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // Guardia anti-Enter: si el user presiona Enter en cualquier input antes
    // de llegar al paso "summary", el form se submitearía saltando la
    // validación final. En vez de crear el consorcio, avanzamos al siguiente
    // paso si la validación del paso actual pasa.
    if (currentConsorcioStep.id !== 'summary') {
      nextConsorcioStep()
      return
    }

    // Anti doble-click: si el botón Crear todavía no está "armado" (recién
    // llegamos al resumen), ignoramos este submit accidental.
    if (!createArmed) {
      return
    }

    startTransition(async () => {
      try {
        const latitude = consorcioDraft.latitude ? Number(consorcioDraft.latitude.replace(',', '.')) : null
        const longitude = consorcioDraft.longitude ? Number(consorcioDraft.longitude.replace(',', '.')) : null
        const managementFeePct = consorcioDraft.managementFeePct
          ? Number(consorcioDraft.managementFeePct.replace(',', '.'))
          : null

        if (latitude !== null && !Number.isFinite(latitude)) {
          throw new Error('La latitud es invalida.')
        }

        if (longitude !== null && !Number.isFinite(longitude)) {
          throw new Error('La longitud es invalida.')
        }

        if (managementFeePct !== null && (!Number.isFinite(managementFeePct) || managementFeePct < 0 || managementFeePct > 100)) {
          throw new Error('El fee de administracion debe estar entre 0 y 100.')
        }

        const result = await createManagedProperty({
          building: {
            name: consorcioDraft.buildingName,
            address: consorcioDraft.buildingAddress,
            totalUnits: 0,
            latitude,
            longitude,
          },
          administration: {
            name: consorcioDraft.administrationName.trim() || consorcioDraft.buildingName,
            legalName: consorcioDraft.administrationLegalName.trim() || null,
            taxId: consorcioDraft.administrationTaxId.trim() || null,
            contactEmail: consorcioDraft.administrationContactEmail.trim() || null,
            contactPhone: consorcioDraft.administrationContactPhone.trim() || null,
          },
          managedProperty: {
            displayName: consorcioDraft.displayName || null,
            propertyKind: consorcioDraft.propertyKind,
            taxId: consorcioDraft.propertyTaxId || null,
            managedSince: consorcioDraft.managedSince || null,
            managementFeePct,
            notes: consorcioDraft.notes || null,
          },
          ...(consorcioAdminMode === 'new'
            ? {
                newAdmin: {
                  fullName: consorcioDraft.newAdminFullName.trim(),
                  email: consorcioDraft.newAdminEmail.trim(),
                  phone: consorcioDraft.newAdminPhone.trim() || null,
                  password: consorcioDraft.newAdminPassword,
                },
              }
            : { adminProfileId: consorcioDraft.adminProfileId }),
        })

        if ('error' in result) {
          toast.error(`No se pudo crear (${result.stage}): ${result.error}`)
          return
        }

        toast.success('Consorcio creado y listo para IAdmin')
        resetConsorcioDraft()
        navigate('buildings', { buildingId: result.buildingId })
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Error')
      }
    })
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
      <div className="flex gap-6">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-6 flex flex-col gap-1">
            <div className="px-3 pb-3 mb-1 flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #F04E23, #C73E15)' }}
              >
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-primary/80 font-semibold">Super administrador</div>
                <div className="text-sm font-semibold text-foreground truncate leading-tight">CITIFY</div>
              </div>
            </div>
            <nav className="flex flex-col gap-px">
              {tabs.map((tab) => {
                const active = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    onClick={() => handleTabChange(tab.key)}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                      active ? 'bg-primary/10 text-foreground font-medium' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    }`}
                  >
                    <tab.icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                )
              })}
            </nav>
            <div className="mt-4 px-3 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Comunicaciones</div>
            </div>
            <nav className="flex flex-col gap-px mt-0.5">
              <Link
                href="/superadmin/email-health"
                className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
              >
                <Activity className="w-4 h-4 shrink-0" />
                <span className="truncate">Email health</span>
              </Link>
              <Link
                href="/superadmin/onboarding"
                className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
              >
                <Mail className="w-4 h-4 shrink-0" />
                <span className="truncate">Onboarding</span>
              </Link>
            </nav>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1">
          {/* Nav móvil */}
          <div className="lg:hidden -mx-4 mb-4 overflow-x-auto border-b border-border/40 px-4">
            <nav className="flex w-max gap-1 pb-2">
              {tabs.map((tab) => {
                const active = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    onClick={() => handleTabChange(tab.key)}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                      active ? 'bg-primary/10 text-foreground font-medium' : 'text-muted-foreground hover:bg-muted/60'
                    }`}
                  >
                    <tab.icon className="w-4 h-4 shrink-0" />
                    {tab.label}
                  </button>
                )
              })}
              <Link
                href="/superadmin/email-health"
                className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] text-muted-foreground hover:bg-muted/60"
              >
                <Activity className="w-4 h-4" />
                Email
              </Link>
              <Link
                href="/superadmin/onboarding"
                className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] text-muted-foreground hover:bg-muted/60"
              >
                <Mail className="w-4 h-4" />
                Onboarding
              </Link>
            </nav>
          </div>

          {/* Header */}
          <div className="glass-card rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-primary" />
              <p className="text-xs text-primary font-medium tracking-wider uppercase">Panel de super administrador</p>
            </div>
            <h1 className="font-serif text-2xl font-bold text-foreground">Resumen operativo de la plataforma</h1>
            <p className="text-muted-foreground text-sm mt-1">Datos en tiempo real.</p>
          </div>

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Usuarios" value={data.users.length} sub={`${data.users.filter((u) => u.role === 'vecino').length} vecinos`} icon={Users} tone="primary" />
            <StatCard label="Consorcios" value={data.buildings.length} sub="Edificios adheridos" icon={Home} tone="accent" />
            <StatCard label="Negocios" value={data.businesses.length} sub={`${data.users.filter((u) => u.role === 'negocio_admin').length} admins`} icon={Building2} tone="terra" />
            <StatCard label="Canjes registrados" value={totalUsage} sub="Desde promotion_redemptions" icon={TrendingUp} tone="green" />
          </div>

          {/* Usuarios por consorcio */}
          <div className="glass-card rounded-xl overflow-hidden mb-8">
            <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm text-foreground">Usuarios por consorcio</h3>
            </div>
            {data.buildings.length === 0 ? (
              <div className="px-5 py-8 text-center text-muted-foreground text-sm">No hay consorcios registrados.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      {['Consorcio', 'Vecinos', 'Residentes', 'Admins', 'Ocupación'].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.buildings]
                      .map((building) => ({
                        building,
                        vecinos: data.users.filter((u) => u.buildingId === building.id && u.role === 'vecino').length,
                      }))
                      .sort((a, b) => b.vecinos - a.vecinos)
                      .map(({ building, vecinos }) => (
                        <tr key={building.id} className="border-b border-border/30 last:border-0 hover:bg-secondary/30">
                          <td className="px-5 py-3.5 font-medium text-foreground">{building.name}</td>
                          <td className="px-5 py-3.5 text-muted-foreground">{vecinos}</td>
                          <td className="px-5 py-3.5 text-muted-foreground">{building.registeredNeighbors}</td>
                          <td className="px-5 py-3.5 text-muted-foreground">{building.admins.length}</td>
                          <td className="px-5 py-3.5 w-48">
                            <OccupancyBar rate={building.occupancyRate} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'buildings', label: 'Consorcios', desc: `${data.buildings.length} edificios adheridos`, icon: Home },
              { key: 'users', label: 'Usuarios', desc: `${data.users.length} cuentas registradas`, icon: Users },
              { key: 'businesses', label: 'Negocios', desc: `${data.businesses.length} negocios adheridos`, icon: Building2 },
              { key: 'promotions', label: 'Promociones', desc: `${data.promotions.length} promociones cargadas`, icon: Tag },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => handleTabChange(item.key as TabType)}
                className="glass-card glass-card-hover rounded-xl p-5 text-left group flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(156,156,156,0.15)', border: '1px solid rgba(0,0,0,0.06)' }}
                  >
                    <item.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground text-sm">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.desc}</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>

          {/* Salud de la Plataforma */}
          <div className="mt-8">
            <h3 className="font-semibold text-foreground text-sm mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Salud de la Plataforma
            </h3>
            <PlatformHealthRow stats={stats} />
          </div>

          {/* Análisis de Plataforma */}
          <div className="mt-6">
            <h3 className="font-semibold text-foreground text-sm mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Análisis de Plataforma
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <UsersByRoleChart data={stats.usersByRole} />
              <TopBuildingsChart data={stats.top5Buildings} />
              <TopBusinessesChart data={stats.top5Businesses} />
            </div>
          </div>
        </div>
      )}

      {/* CONSORCIOS */}
      {activeTab === 'buildings' && !selectedBuilding && (
        <div className="space-y-5">
          <form onSubmit={submitConsorcio} className="glass-card rounded-xl p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-primary">Wizard de alta</div>
                <h3 className="mt-1 text-sm font-semibold text-foreground">Nuevo consorcio / edificio</h3>
                <p className="sr-only">
                Crea el edificio, la administración, la propiedad IAdmin y deja asignado el admin de consorcio en una sola acción.
              </p>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                  Crea el edificio, la administracion y la configuracion IAdmin con un flujo guiado y deja asignado el admin
                  consorcio en una sola accion.
                </p>
              </div>
              <div className="rounded-full border border-border/40 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
                Paso {consorcioStepIndex + 1} de {CONSORCIO_WIZARD_STEPS.length}
              </div>
            </div>

            <div className="mt-5 grid gap-2 md:grid-cols-3">
              {CONSORCIO_WIZARD_STEPS.map((step, index) => {
                const isActive = index === consorcioStepIndex
                const isCompleted = index < consorcioStepIndex

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => goToConsorcioStep(index)}
                    className={`rounded-xl border px-3 py-3 text-left transition-all ${
                      isActive
                        ? 'border-primary/40 bg-primary/10'
                        : isCompleted
                          ? 'border-border/60 bg-background/80'
                          : 'border-border/40 bg-background/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="flex items-center gap-2">
                        {step.optional && <Badge color="default">Opcional</Badge>}
                        {isCompleted && <Badge color="success">Listo</Badge>}
                      </div>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-foreground">{step.label}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
                  </button>
                )
              })}
            </div>

            <div className="mt-5 space-y-5 rounded-2xl border border-border/40 bg-background/70 p-4">
              <div className="mb-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-primary">{currentConsorcioStep.label}</p>
                  {currentConsorcioStep.optional && <Badge color="default">Opcional</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{currentConsorcioStep.description}</p>
              </div>
              {currentConsorcioStep.id === 'building' && (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Edificio</p>
                    <p className="text-xs text-muted-foreground">
                      Carga el nombre, la direccion y marca la ubicacion en el mapa para dejar el consorcio listo desde el alta.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <Input
                      placeholder="Nombre del edificio"
                      value={consorcioDraft.buildingName}
                      onChange={(e) => updateBuildingName(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Las unidades las cargará el administrador del consorcio desde su panel cuando empiece a operar.
                    </p>
                  </div>

                  <div className="glass-card rounded-2xl p-4 overflow-hidden relative">
                    <div className="flex flex-col gap-6 lg:flex-row">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-primary" />
                          Ubicacion del edificio
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Busca la direccion y, si hace falta, corrige manualmente el punto haciendo click en el mapa.
                        </p>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Direccion</Label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Input
                                value={consorcioDraft.buildingAddress}
                                onChange={(event) =>
                                  setConsorcioDraft({ ...consorcioDraft, buildingAddress: event.target.value })
                                }
                                placeholder="Ej. Av. Sarmiento 2555"
                                required
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={locateConsorcioAddress}
                                disabled={consorcioLocationSearching || !consorcioDraft.buildingAddress.trim()}
                              >
                                {consorcioLocationSearching ? 'Ubicando...' : 'Ubicar'}
                              </Button>
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground">
                            Si no encontramos la direccion exacta, puedes elegir la ubicacion manualmente sobre el mapa.
                          </p>
                        </div>
                      </div>

                      <div className="flex-[1.35] overflow-hidden rounded-2xl border border-border/60 bg-background">
                        <div className="h-[320px]">
                          <DynamicMap
                            center={consorcioMapLocation ?? consorcioInitialCenter}
                            zoom={consorcioMapLocation ? 17 : 13}
                            recenterKey={consorcioRecenterToken}
                            interactive
                            selectedLocation={consorcioMapLocation}
                            onLocationSelect={(lat, lng) =>
                              setConsorcioDraft((current) => ({
                                ...current,
                                latitude: String(lat),
                                longitude: String(lng),
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/50 bg-background/40">
                    <button
                      type="button"
                      onClick={() => setConsorcioAdvancedOpen((open) => !open)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left"
                    >
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Avanzado (opcional)
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Datos de la administración y configuración del consorcio. Si los dejas vacíos, CITIFY usa el nombre del edificio.
                        </p>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                          consorcioAdvancedOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {consorcioAdvancedOpen && (
                      <div className="space-y-5 border-t border-border/50 px-4 py-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                            Quién administra
                          </p>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <Input
                              placeholder="Nombre de la administración"
                              value={consorcioDraft.administrationName}
                              onChange={(event) => {
                                setAdministrationNameTouched(true)
                                setConsorcioDraft({ ...consorcioDraft, administrationName: event.target.value })
                              }}
                            />
                            <Input
                              placeholder="Razón social"
                              value={consorcioDraft.administrationLegalName}
                              onChange={(event) =>
                                setConsorcioDraft({ ...consorcioDraft, administrationLegalName: event.target.value })
                              }
                            />
                            <Input
                              placeholder="CUIT"
                              value={consorcioDraft.administrationTaxId}
                              onChange={(event) =>
                                setConsorcioDraft({ ...consorcioDraft, administrationTaxId: event.target.value })
                              }
                            />
                            <Input
                              placeholder="Email"
                              type="email"
                              value={consorcioDraft.administrationContactEmail}
                              onChange={(event) =>
                                setConsorcioDraft({ ...consorcioDraft, administrationContactEmail: event.target.value })
                              }
                            />
                            <Input
                              placeholder="Teléfono"
                              value={consorcioDraft.administrationContactPhone}
                              onChange={(event) =>
                                setConsorcioDraft({ ...consorcioDraft, administrationContactPhone: event.target.value })
                              }
                            />
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                            Configuración del consorcio
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <input
                              className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm"
                              placeholder="Nombre a mostrar (opcional)"
                              value={consorcioDraft.displayName}
                              onChange={(e) => setConsorcioDraft({ ...consorcioDraft, displayName: e.target.value })}
                            />
                            <select
                              className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm"
                              value={consorcioDraft.propertyKind}
                              onChange={(e) => setConsorcioDraft({ ...consorcioDraft, propertyKind: e.target.value as IAdminPropertyKind })}
                            >
                              {PROPERTY_KIND_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                            <input
                              className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm"
                              placeholder="CUIT del consorcio"
                              value={consorcioDraft.propertyTaxId}
                              onChange={(e) => setConsorcioDraft({ ...consorcioDraft, propertyTaxId: e.target.value })}
                            />
                            <input
                              className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm"
                              placeholder="Inicio de gestión"
                              type="date"
                              value={consorcioDraft.managedSince}
                              onChange={(e) => setConsorcioDraft({ ...consorcioDraft, managedSince: e.target.value })}
                            />
                            <input
                              className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm"
                              placeholder="Fee administración (%)"
                              inputMode="decimal"
                              value={consorcioDraft.managementFeePct}
                              onChange={(e) => setConsorcioDraft({ ...consorcioDraft, managementFeePct: e.target.value })}
                            />
                            <textarea
                              className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none md:col-span-3"
                              rows={2}
                              placeholder="Notas iniciales"
                              value={consorcioDraft.notes}
                              onChange={(e) => setConsorcioDraft({ ...consorcioDraft, notes: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {currentConsorcioStep.id === 'admin' && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Administrador inicial</p>

                <div className="mb-4 inline-flex rounded-lg border border-border/50 bg-background/60 p-1">
                  <button
                    type="button"
                    onClick={() => setConsorcioAdminMode('existing')}
                    disabled={consorcioAdmins.length === 0}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
                      consorcioAdminMode === 'existing' ? 'bg-primary/10 text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    Elegir existente
                  </button>
                  <button
                    type="button"
                    onClick={() => setConsorcioAdminMode('new')}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      consorcioAdminMode === 'new' ? 'bg-primary/10 text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    Crear nuevo admin
                  </button>
                </div>

                {consorcioAdminMode === 'existing' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                    <select
                      className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm"
                      value={consorcioDraft.adminProfileId}
                      onChange={(e) => setConsorcioDraft({ ...consorcioDraft, adminProfileId: e.target.value })}
                    >
                      <option value="">Seleccionar admin consorcio</option>
                      {consorcioAdmins.map((admin) => (
                        <option key={admin.profileId} value={admin.profileId}>
                          {admin.fullName} · {admin.email}
                        </option>
                      ))}
                    </select>
                    <div className="md:col-span-2 rounded-lg border border-border/40 bg-background/60 px-3 py-3 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">
                        {selectedConsorcioAdmin ? selectedConsorcioAdmin.fullName : 'Sin admin seleccionado'}
                      </p>
                      <p className="mt-1">{describeAdminAssignment(selectedConsorcioAdmin)}</p>
                      {selectedConsorcioAdmin && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge color="default">
                            {selectedConsorcioAdmin.assignedBuildingsCount} edificio
                            {selectedConsorcioAdmin.assignedBuildingsCount === 1 ? '' : 's'}
                          </Badge>
                          {selectedConsorcioAdmin.primaryBuildingName && (
                            <Badge color="primary">Primario: {selectedConsorcioAdmin.primaryBuildingName}</Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Se creará la cuenta con rol admin consorcio y quedará asignada como administrador de este consorcio.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        placeholder="Nombre completo del admin"
                        value={consorcioDraft.newAdminFullName}
                        onChange={(e) => setConsorcioDraft({ ...consorcioDraft, newAdminFullName: e.target.value })}
                      />
                      <Input
                        type="email"
                        placeholder="Email del admin"
                        value={consorcioDraft.newAdminEmail}
                        onChange={(e) => setConsorcioDraft({ ...consorcioDraft, newAdminEmail: e.target.value })}
                      />
                      <Input
                        placeholder="Teléfono (opcional)"
                        value={consorcioDraft.newAdminPhone}
                        onChange={(e) => setConsorcioDraft({ ...consorcioDraft, newAdminPhone: e.target.value })}
                      />
                      <Input
                        type="text"
                        placeholder="Password inicial"
                        value={consorcioDraft.newAdminPassword}
                        onChange={(e) => setConsorcioDraft({ ...consorcioDraft, newAdminPassword: e.target.value })}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      El admin podrá cambiar la contraseña después de su primer ingreso.
                    </p>
                  </div>
                )}
              </div>
              )}

              {currentConsorcioStep.id === 'summary' && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resumen y confirmacion</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Revisa todo antes de crear. Si algo no esta bien, puedes volver al paso anterior sin perder lo cargado.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-border/40 bg-background/60 p-4">
                      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Edificio</div>
                      <div className="mt-2 text-sm font-semibold text-foreground">{consorcioDraft.buildingName || 'Sin nombre'}</div>
                      <p className="mt-1 text-xs text-muted-foreground">{consorcioDraft.buildingAddress || 'Sin direccion'}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Ubicacion:{' '}
                        {consorcioMapLocation
                          ? `${consorcioMapLocation[0].toFixed(5)}, ${consorcioMapLocation[1].toFixed(5)}`
                          : 'sin coordenadas seleccionadas'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/40 bg-background/60 p-4">
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Quién administra
                        </div>
                        <Badge color="default">Opcional</Badge>
                      </div>
                      <div className="mt-2 text-sm font-semibold text-foreground">
                        {administrationSummaryName || 'Se usará el nombre del edificio'}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {hasAdministrationCustomData
                          ? 'Se guardarán los datos cargados para la administración.'
                          : 'Si no completas este paso, se creará automáticamente con el nombre del edificio.'}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {consorcioDraft.administrationContactEmail.trim() || 'Sin email'}
                        {consorcioDraft.administrationContactPhone.trim()
                          ? ` · ${consorcioDraft.administrationContactPhone.trim()}`
                          : ''}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {consorcioDraft.administrationLegalName.trim() || 'Sin razón social'}
                        {consorcioDraft.administrationTaxId.trim()
                          ? ` · CUIT ${consorcioDraft.administrationTaxId.trim()}`
                          : ''}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/40 bg-background/60 p-4">
                      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Datos del consorcio en CITIFY
                      </div>
                      <div className="mt-2 text-sm font-semibold text-foreground">
                        {consorcioDraft.displayName || consorcioDraft.buildingName || 'Se usara el nombre del edificio'}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Tipo: {PROPERTY_KIND_OPTIONS.find((option) => option.value === consorcioDraft.propertyKind)?.label}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {consorcioDraft.managedSince ? `Gestion desde ${consorcioDraft.managedSince}` : 'Sin fecha inicial'}
                        {consorcioDraft.managementFeePct ? ` · Fee ${consorcioDraft.managementFeePct}%` : ''}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/40 bg-background/60 p-4">
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Administrador inicial
                        </div>
                        {consorcioAdminMode === 'new' && <Badge color="primary">Nuevo</Badge>}
                      </div>
                      {consorcioAdminMode === 'new' ? (
                        <>
                          <div className="mt-2 text-sm font-semibold text-foreground">
                            {consorcioDraft.newAdminFullName.trim() || 'Sin nombre'}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {consorcioDraft.newAdminEmail.trim() || 'Sin email'}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Se creará la cuenta y quedará como admin de este consorcio.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="mt-2 text-sm font-semibold text-foreground">
                            {selectedConsorcioAdmin?.fullName || 'Sin admin seleccionado'}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {selectedConsorcioAdmin?.email || 'Debes seleccionar un admin consorcio'}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">{describeAdminAssignment(selectedConsorcioAdmin)}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-border/40 pt-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <button
                  type="button"
                  onClick={resetConsorcioDraft}
                  className="rounded-lg border border-border/50 px-3 py-2 text-xs font-semibold text-muted-foreground"
                >
                  Limpiar wizard
                </button>
                {getConsorcioStepError() && <p className="text-xs text-amber-700">{getConsorcioStepError()}</p>}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {consorcioStepIndex > 0 && (
                  <button
                    type="button"
                    onClick={previousConsorcioStep}
                    className="rounded-lg border border-border/50 px-4 py-2 text-sm font-semibold text-foreground"
                  >
                    Volver
                  </button>
                )}
                {currentConsorcioStep.id !== 'summary' ? (
                  <button
                    type="button"
                    onClick={nextConsorcioStep}
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-white btn-premium"
                  >
                    Continuar
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={pending || !createArmed}
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-white btn-premium disabled:opacity-60"
                  >
                    {pending ? 'Creando...' : 'Crear consorcio'}
                  </button>
                )}
              </div>
            </div>
          </form>

          <BuildingsList buildings={data.buildings} onSelect={(building) => navigate('buildings', { buildingId: building.id })} />
        </div>
      )}
      {activeTab === 'buildings' && selectedBuilding && (
        <BuildingDetail building={selectedBuilding} consorcioAdmins={consorcioAdmins} onBack={() => navigate('buildings')} />
      )}

      {/* USUARIOS */}
      {activeTab === 'users' && (
        <div>
          <SectionHeader title="Usuarios" subtitle={`${data.users.length} cuentas registradas`} />
          <form onSubmit={submitUser} className="glass-card rounded-xl p-5 mb-5">
            <div className="mb-4">
              <h3 className="font-semibold text-foreground text-sm">Crear usuario manual</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Crea la cuenta base y despues completa sus vinculos operativos segun el rol. Para vecinos, la
                asociacion fina a la unidad se termina desde IAdmin.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm" placeholder="Nombre completo" value={userDraft.fullName} onChange={(e) => setUserDraft({ ...userDraft, fullName: e.target.value })} required />
              <input className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm" placeholder="Email" type="email" value={userDraft.email} onChange={(e) => setUserDraft({ ...userDraft, email: e.target.value })} required />
              <input className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm" placeholder="Telefono" value={userDraft.phone} onChange={(e) => setUserDraft({ ...userDraft, phone: e.target.value })} />
              <select className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm" value={userDraft.role} onChange={(e) => updateUserRole(e.target.value)}>
                <option value="vecino">Vecino</option>
                <option value="consorcio_admin">Admin consorcio</option>
                <option value="negocio_admin">Admin negocio</option>
                <option value="super_admin">Super admin</option>
              </select>
              {needsDirectBuilding && (
                <select className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm" value={userDraft.buildingId} onChange={(e) => setUserDraft({ ...userDraft, buildingId: e.target.value })}>
                  <option value="">Sin edificio directo</option>
                  {data.buildings.map((building) => (
                    <option key={building.id} value={building.id}>{building.name}</option>
                  ))}
                </select>
              )}
              {needsBusiness && (
                <select className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm" value={userDraft.businessId} onChange={(e) => setUserDraft({ ...userDraft, businessId: e.target.value })}>
                  <option value="">Seleccionar negocio</option>
                  {data.businesses.map((business) => (
                    <option key={business.id} value={business.id}>{business.name}</option>
                  ))}
                </select>
              )}
              <input className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm" placeholder="Password temporal" value={userDraft.password} onChange={(e) => setUserDraft({ ...userDraft, password: e.target.value })} required />
            </div>
            <div className="mt-4 rounded-xl border border-border/40 bg-background/60 p-4">
              <div className="text-xs font-medium uppercase tracking-wider text-primary">{roleCreationCopy.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{roleCreationCopy.body}</p>
              {isConsorcioAdminDraft && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Esta vista ya no te pide un edificio unico para el admin. La asignacion de cada consorcio se hace despues
                  desde la creacion del edificio.
                </p>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button type="submit" disabled={pending} className="rounded-lg px-4 py-2 text-sm font-semibold text-white btn-premium">
                {pending ? 'Creando...' : 'Crear usuario'}
              </button>
            </div>
          </form>
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50" style={{ background: 'rgba(0,0,0,0.03)' }}>
                    {['Usuario', 'Email', 'Rol', 'Teléfono'].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user) => (
                    <tr key={user.id} className="border-b border-border/30 last:border-0 hover:bg-secondary/30">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #F04E23, #C73E15)' }}
                          >
                            {user.avatarText}
                          </div>
                          <span className="font-medium text-foreground">{user.fullName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">{user.email}</td>
                      <td className="px-5 py-3.5">
                        <Badge color={user.role === 'super_admin' ? 'primary' : 'default'}>
                          {ROLE_LABELS[user.role]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">{user.phone ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* NEGOCIOS */}
      {activeTab === 'businesses' && !selectedBusiness && (
        <div>
          <form onSubmit={submitBusiness} className="glass-card rounded-xl p-5 mb-5">
            <div className="mb-4">
              <h3 className="font-semibold text-foreground text-sm">Crear negocio con administrador</h3>
              <p className="text-xs text-muted-foreground mt-0.5">El negocio queda listo con un usuario `negocio_admin` asociado.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm" placeholder="Nombre negocio" value={businessDraft.businessName} onChange={(e) => setBusinessDraft({ ...businessDraft, businessName: e.target.value })} required />
              <input className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm" placeholder="Categoria" value={businessDraft.category} onChange={(e) => setBusinessDraft({ ...businessDraft, category: e.target.value })} required />
              <input className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm" placeholder="Direccion" value={businessDraft.address} onChange={(e) => setBusinessDraft({ ...businessDraft, address: e.target.value })} />
              <input className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm" placeholder="Descripcion" value={businessDraft.description} onChange={(e) => setBusinessDraft({ ...businessDraft, description: e.target.value })} />
              <input className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm" placeholder="Nombre admin" value={businessDraft.adminFullName} onChange={(e) => setBusinessDraft({ ...businessDraft, adminFullName: e.target.value })} required />
              <input className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm" placeholder="Email admin" type="email" value={businessDraft.adminEmail} onChange={(e) => setBusinessDraft({ ...businessDraft, adminEmail: e.target.value })} required />
              <input className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm" placeholder="Telefono admin" value={businessDraft.adminPhone} onChange={(e) => setBusinessDraft({ ...businessDraft, adminPhone: e.target.value })} />
              <input className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm" placeholder="Password temporal" value={businessDraft.adminPassword} onChange={(e) => setBusinessDraft({ ...businessDraft, adminPassword: e.target.value })} required />
              <button type="submit" disabled={pending} className="md:col-span-4 rounded-lg px-4 py-2 text-sm font-semibold text-white btn-premium">
                {pending ? 'Creando...' : 'Crear negocio y admin'}
              </button>
            </div>
          </form>
          <BusinessesList businesses={data.businesses} onSelect={(business) => navigate('businesses', { businessId: business.id })} />
        </div>
      )}
      {activeTab === 'businesses' && selectedBusiness && (
        <BusinessDetail business={selectedBusiness} onBack={() => navigate('businesses')} />
      )}

      {/* PROMOCIONES */}
      {activeTab === 'promotions' && (
        <div>
          <SectionHeader title="Promociones" subtitle={`${data.promotions.length} promociones cargadas`} />
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="divide-y divide-border/30">
              {data.promotions.map((promotion) => (
                <PromotionRow key={promotion.id} promotion={promotion as SuperAdminPromotionDetail} />
              ))}
              {data.promotions.length === 0 && (
                <div className="px-5 py-8 text-center text-muted-foreground text-sm">
                  No hay promociones cargadas.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

          <ChatWidget />
        </main>
      </div>
    </div>
  )
}
