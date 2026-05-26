# Vincular vecino existente a unidad — implementación Citify

Port de la spec compartida con Countrify (commit `ed07941` en `countrify-aws`).
Cierra el hueco entre **superadmin crea usuario** e **iadmin lo asigna a una unidad**.

> Spec original: `digitalamenitiessas-lang/countrify-aws → docs/LINK-EXISTING-USER-TO-UNIT.md`.

---

## Checklist de avance

- [x] **1. Auditoría del estado actual en Citify** — schema SQL, capabilities, helpers que ya existen. _(ver "Hallazgos auditoría" abajo)_
- [x] **2. Query `listLinkableProfilesByBuildingFromPostgres`** — agregada en `lib/db/iadmin-reads.ts`.
- [x] **3. Wrapper `getIAdminLinkableProfiles` + tipo `IAdminLinkableProfile`** — `lib/data.ts` + `lib/types.ts`.
- [x] **4. Server action `linkExistingProfileToUnit`** — `app/iadmin/consorcios/[id]/actions.ts`.
- [x] **5. Helper para leer profile por id** — reutiliza `findProfileById` (`lib/db/profiles.ts`).
- [x] **6. UI combobox "Vincular vecino existente"** — `components/admin-backoffice/consorcio/units-manager.tsx` (búsqueda por nombre/email + select de relación + checkbox propietario principal, separador "o crear nuevo" y debajo el form de creación existente).
- [x] **7. Wiring en `gestion/page.tsx`** — `getIAdminLinkableProfiles(detail.property.buildingId)` + prop pasada por `ConsorcioDetail` → `UnitsManager`.
- [ ] **8. Validación end-to-end** según los 7 criterios de aceptación. _(falta probar manualmente)_

## Hallazgos auditoría (2026-05-26)

- **Schema**: Citify usa `public.*` (no `citify.*` como dice la spec original). Todas las queries van con `public.`.
- **Tabla `unit_profile_memberships`** existe en `db/migrations/20260425_units_roles_building_info.sql:13` con todas las columnas que necesita la spec (`unit_id`, `building_id`, `profile_id`, `relationship_type`, `is_primary`, `active`, `created_by_profile_id`).
- **Capability `holders.manage`** ya está en `lib/iadmin/capabilities.ts:10`.
- **Helpers de unidades / memberships / holders / audit** ya existen en `lib/db/iadmin-writes.ts`:
  - `getUnitFullScopeFromPostgres` (line 840) — devuelve `{ unitId, unitCode, managedPropertyId, administrationId, buildingId }`.
  - `deactivateActivePrincipalMembershipsInPostgres` (line 904).
  - `findUnitProfileMembershipFromPostgres` (line 911).
  - `upsertUnitProfileMembershipInPostgres` (line 923).
  - `findOwnerHolderForProfileFromPostgres` (line 975).
  - `insertOwnerHolderInPostgres` (line 986).
  - `insertIAdminAuditLogInPostgres` está en `lib/db/iadmin-core.ts:1265`.
- **`findProfileById`** ya existe en `lib/db/profiles.ts:101` (devuelve `Profile` mapeado: `buildingId`, `fullName`, `phone`, etc.). No hace falta crear `getProfileByIdFromPostgres`; reusamos `findProfileById` y comparamos `target.buildingId === scope.buildingId`.
- **`createUnitUser`** (`app/iadmin/consorcios/[id]/actions.ts:426`) es la referencia exacta — la nueva action es el mismo flujo sin Cognito / sin `upsertProfile`.
- **`gestion/page.tsx`**: ya carga `getIAdminConsorcioDetail` + `getIAdminUnitsWithHolders` en `Promise.all`. `detail.property.buildingId` está disponible (`IAdminManagedProperty` lo expone).
- **`UnitProfileRelationship`** enum ya definido en `lib/types.ts` (lo usa `createUnitUser`).

---

## Contexto

```
SUPERADMIN              IADMIN (admin del consorcio)         VECINO
──────────              ─────────────────────────────         ──────
crea profile      →     ve lista de vecinos del         →    ve "Mi unidad"
+ buildingId            building sin unidad asignada         + grupo familiar
                        + los vincula a unidades
                        + ve unidades a cargo
```

Hoy en Citify el iadmin solo puede vincular un vecino si **tipea el email exacto** en el form de creación (`createUnitUser`). No hay forma de listar vecinos del building todavía sin membership.

## Modelo de datos relevante

Dos tablas paralelas por unidad:

- `iadmin_unit_holders` — titulares contables/legales (propietario / inquilino / apoderado). **No requieren cuenta**, son solo registro.
- `unit_profile_memberships` — vínculo a `profiles` con login Cognito.
  `relationship_type ∈ { 'propietario', 'vecino_principal', 'vecino_adicional' }`.

Un `profile` con `building_id = X` y rol `vecino` / `propietario` que **no tiene fila activa en `unit_profile_memberships`** es un **vecino huérfano** — hoy invisible para el iadmin.

---

## 1. Query nueva — `lib/db/iadmin-reads.ts`

```ts
export async function listLinkableProfilesByBuildingFromPostgres(
  buildingId: string,
): Promise<Array<{
  id: string
  email: string
  full_name: string
  role: 'vecino' | 'propietario'
  phone: string | null
  active_memberships_count: number
}>> {
  const result = await pgQuery(
    `
      select
        p.id,
        p.email,
        p.full_name,
        p.role,
        p.phone,
        coalesce(m.active_count, 0)::int as active_memberships_count
      from citify.profiles p
      left join (
        select profile_id, count(*) as active_count
        from citify.unit_profile_memberships
        where building_id = $1 and active = true
        group by profile_id
      ) m on m.profile_id = p.id
      where p.building_id = $1
        and p.role in ('vecino', 'propietario')
      order by coalesce(m.active_count, 0) asc, p.full_name asc
    `,
    [buildingId],
  )
  return result.rows
}
```

> **Verificar al portar**: confirmar que el schema es `citify.` (no `public.`).
> Confirmar nombres de columnas en `profiles` (`full_name`, `building_id`, `phone`).

## 2. Wrapper + tipo

`lib/types.ts`:

```ts
export type IAdminLinkableProfile = {
  id: string
  email: string
  fullName: string
  role: 'vecino' | 'propietario'
  phone: string | null
  activeMembershipsCount: number
}
```

`lib/data.ts`:

```ts
export async function getIAdminLinkableProfiles(buildingId: string): Promise<IAdminLinkableProfile[]> {
  const rows = await listLinkableProfilesByBuildingFromPostgres(buildingId)
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    fullName: r.full_name,
    role: r.role,
    phone: r.phone,
    activeMembershipsCount: r.active_memberships_count,
  }))
}
```

## 3. Server action — `app/iadmin/consorcios/[id]/actions.ts`

```ts
const linkExistingProfileSchema = z.object({
  unitId: z.string().uuid(),
  profileId: z.string().uuid(),
  relationshipType: z.enum(['propietario', 'vecino_principal', 'vecino_adicional']),
  isPrimaryOwner: z.boolean().optional().default(false),
})

export async function linkExistingProfileToUnit(input: z.input<typeof linkExistingProfileSchema>) {
  const parsed = linkExistingProfileSchema.parse(input)

  const scope = await getUnitFullScopeFromPostgres(parsed.unitId)
  if (!scope) throw new Error('Unidad no encontrada')

  const { profile: actor } = await requireIAdmin({
    capability: 'holders.manage',
    administrationId: scope.administrationId,
  })

  const target = await getProfileByIdFromPostgres(parsed.profileId)
  if (!target) throw new Error('Vecino no encontrado')
  if (target.building_id !== scope.buildingId) {
    throw new Error('El vecino no pertenece a este consorcio')
  }

  if (parsed.relationshipType === 'vecino_principal') {
    await deactivateActivePrincipalMembershipsInPostgres(scope.unitId)
  }

  const existing = await findUnitProfileMembershipFromPostgres({
    unitId: scope.unitId,
    profileId: parsed.profileId,
    relationshipType: parsed.relationshipType,
  })

  await upsertUnitProfileMembershipInPostgres({
    membershipId: existing?.id ?? null,
    unitId: scope.unitId,
    buildingId: scope.buildingId,
    profileId: parsed.profileId,
    relationshipType: parsed.relationshipType,
    isPrimary: parsed.relationshipType === 'propietario' ? parsed.isPrimaryOwner : false,
    createdByProfileId: actor.id,
  })

  if (parsed.relationshipType === 'propietario') {
    const existingHolder = await findOwnerHolderForProfileFromPostgres({
      unitId: scope.unitId,
      profileId: parsed.profileId,
    })
    if (!existingHolder) {
      await insertOwnerHolderInPostgres({
        unitId: scope.unitId,
        profileId: parsed.profileId,
        fullName: target.full_name,
        email: target.email.toLowerCase(),
        phone: target.phone ?? null,
      })
    }
  }

  await insertIAdminAuditLogInPostgres({
    administrationId: scope.administrationId,
    actorProfileId: actor.id,
    entityType: 'unit_profile_memberships',
    entityId: scope.unitId,
    action: 'unit_user.linked_existing',
    metadata: {
      unit_code: scope.unitCode,
      profile_id: parsed.profileId,
      relationship_type: parsed.relationshipType,
    },
  })

  revalidatePath(`/iadmin/consorcios/${scope.managedPropertyId}`)
  return { profileId: parsed.profileId }
}
```

Diferencia clave con `createUnitUser`: **no toca Cognito ni `profiles`**, asume que el profile ya existe.

Si `getProfileByIdFromPostgres` no existe en `lib/db/profiles.ts`:

```ts
export async function getProfileByIdFromPostgres(id: string) {
  const result = await pgQuery(
    `select id, email, full_name, role, building_id, phone from citify.profiles where id = $1 limit 1`,
    [id],
  )
  return result.rows[0] ?? null
}
```

## 4. UI — `components/admin-backoffice/consorcio/units-manager.tsx`

En el drawer/sección "Agregar usuario a la unidad" agregar arriba una sección "Vincular vecino existente":

- Combobox / `Command` de shadcn filtrable por nombre o email.
- Subtítulo: `email · {activeMembershipsCount === 0 ? 'sin unidad' : `${activeMembershipsCount} unidad(es)`}`.
- Select `relationshipType` (3 valores).
- Checkbox `isPrimaryOwner` si la relación es `propietario`.
- Botón "Vincular" → llama `linkExistingProfileToUnit`.

Separador "o", y debajo el form actual de creación nueva.

Prop nueva: `linkableProfiles: IAdminLinkableProfile[]`.

## 5. Wiring — `app/iadmin/consorcios/[id]/gestion/page.tsx`

```ts
const detail = await getIAdminConsorcioDetail(id)
const [unitsWithHolders, linkableProfiles] = await Promise.all([
  getIAdminUnitsWithHolders(id),
  getIAdminLinkableProfiles(detail.property.buildingId),
])
```

Pasar `linkableProfiles` por props hasta `<UnitsManager>`.

---

## Criterios de aceptación

1. Como superadmin creo un profile con `role = vecino` y `buildingId = B1`. **No lo vinculo.**
2. Entro como iadmin del consorcio cuyo building es B1, voy a Gestión → unidad U1 → "Agregar usuario".
3. Veo al vecino del paso 1 en el selector "Vincular vecino existente", con badge "sin unidad".
4. Lo selecciono, elijo `vecino_principal`, click Vincular.
5. El vecino entra a Citify y ve U1 en "Mi unidad".
6. Vuelvo al iadmin: el selector ya no muestra a ese vecino como "sin unidad" (ahora dice "1 unidad").
7. Audit log: aparece la acción `unit_user.linked_existing` con `profile_id` y `unit_code`.

---

## Fuera de scope (deuda separada)

- Editar / desactivar / resetear password de usuarios desde superadmin.
- Drill-down "ver usuarios de este consorcio" dentro del detalle de un consorcio en superadmin.
- Mover un profile entre buildings.

## Diferencias Countrify ↔ Citify a chequear

- **Schema SQL**: `countrify.*` → `citify.*` en todas las queries.
- **Cognito pool**: Countrify usa dual-pool; en esta feature no se toca Cognito.
- **Roles**: confirmar `UserRole` en `lib/types.ts`.
- **Capability `holders.manage`**: confirmar que existe en `lib/iadmin/capabilities.ts` con el mismo nombre.

---

## Bitácora de implementación

> Notas y commits a medida que avanzamos.

- **2026-05-26** — Spec portada desde countrify-aws. Pendiente: arrancar auditoría (paso 1).
- **2026-05-26** — Auditoría completa. Citify usa `public.*` (no `citify.*`). Todos los helpers de write/audit ya existen (`getUnitFullScope`, `upsertUnitProfileMembership`, `deactivate/find/insert OwnerHolder`, `insertIAdminAuditLog`). Capability `holders.manage` ya en `capabilities.ts`. `findProfileById` ya existe en `profiles.ts` y se reutiliza en vez de crear un helper nuevo.
- **2026-05-26** — Implementación end-to-end mergeada en branch `luciano`:
  - `lib/db/iadmin-reads.ts`: nueva query `listLinkableProfilesByBuildingFromPostgres`.
  - `lib/types.ts`: nuevo tipo `IAdminLinkableProfile`.
  - `lib/data.ts`: nuevo wrapper `getIAdminLinkableProfiles` + import del query.
  - `app/iadmin/consorcios/[id]/actions.ts`: nueva action `linkExistingProfileToUnit` (no toca Cognito, valida `target.buildingId === scope.buildingId`, hace upsert de membership + owner holder + audit log `unit_user.linked_existing`).
  - `components/admin-backoffice/consorcio/units-manager.tsx`: nueva sección "Vincular vecino existente" con search box, lista filtrada (max 8) con badge `sin unidad` / `N unidades`, select de relación, checkbox `isPrimaryOwner` y botón Vincular. Separador "o crear nuevo" arriba del form actual.
  - `components/admin-backoffice/consorcio/consorcio-detail.tsx`: pasa `linkableProfiles` por props.
  - `app/iadmin/consorcios/[id]/gestion/page.tsx`: carga `getIAdminLinkableProfiles(detail.property.buildingId)`.
  - `npx tsc --noEmit` no reporta errores nuevos en los archivos tocados (los errores que aparecen son pre-existentes del repo).
- **Pendiente**: validación manual end-to-end siguiendo los 7 criterios de aceptación.
