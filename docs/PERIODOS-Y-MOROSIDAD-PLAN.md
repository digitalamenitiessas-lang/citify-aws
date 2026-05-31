# Plan: Liquidar cualquier mes + Intereses por morosidad

Documento de seguimiento. Si retomamos en otra sesión, leer la sección
"Estado actual" y continuar desde el primer ítem sin tildar.

---

## Contexto rápido (TL;DR)

**Problema 1 — Mesa del mes sólo permite liquidar el mes calendario actual.**
El backend (`emitAndNotify`, `upsertMonthlyCell`) acepta `year/month` pero la
UI siempre pasa el mes en curso. La página de Mesa toma
`grid.months[length-1]` que sale de `getIAdminMonthlyGrid` con `new Date()`.

**Problema 2 — Los intereses por morosidad están sub-aplicados.** Existe
`materializeLateFeesForUnitInPostgres` que funciona correctamente (mira
`due_dates` del run, encuentra el `surchargePct` máximo ya vencido, inserta
asiento `recargo_mora` en el ledger). Pero sólo se invoca desde Cobranzas,
Reportes y account-statement. El portfolio overview de Inicio **no incluye
recargos en `overdue_amount`**, Mesa no materializa al abrirse, y al re-emitir
el mes siguiente el `previousBalance` arrastra capital pero no recargos.

---

## Estado actual

Marcar con `[x]` cada ítem al completarlo. Si un ítem queda a medias, anotar
debajo qué falta.

### Bloque A — Mesa del mes con selector de período ✅

- [x] **A.1** `getIAdminMonthlyGrid` acepta `targetYear/targetMonth` y ancla
  la ventana al mes objetivo (no a `new Date()`). `isCurrent` se calcula
  contra la fecha real para que el admin distinga el mes calendario, y se
  agregó `isPivot` para marcar el mes activo.
- [x] **A.2** `getIAdminMonthlyGrid` devuelve `availablePeriods` (períodos
  contables existentes + mes actual + mes siguiente) y `isFuturePeriod`.
- [x] **A.3** `app/iadmin/consorcios/[id]/page.tsx` lee `?period=YYYY-MM` y
  lo pasa al grid. `dynamic = 'force-dynamic'`.
- [x] **A.4** El `PeriodPicker` se montó en el header del Mesa
  (`mesa-header.tsx`) leyendo `grid.selectedPeriod`/`grid.availablePeriods`.
  Al cambiar hace `router.push('?period=YYYY-MM')` preservando otros params.
- [x] **A.5** Guards:
  - Badge "Mes futuro" / "Mes histórico" cuando `!current.isCurrent`.
  - `handleRequestPredictions` toastea "sólo aplica al mes en curso o
    siguiente" si el período activo está en el pasado.
  - El subnav del consorcio no tenía tabs reales → nada que preservar.

### Bloque B — Intereses por morosidad

- [x] **B.1** Llamar `materializeLateFeesForAdministrationInPostgres` antes
  de leer estado en `getIAdminMesaState` y en `getIAdminPortfolioOverview`.
- [x] **B.2** Nuevo CTE `late_fee_overdue` en `iadmin-core.ts` que suma
  `recargo_mora` abiertos por propiedad (excluyendo el período en curso) y
  los agrega al `overdue_amount` del overview.
- [x] **B.4** `IAdminMesaUnitLine.lateFee` agregado y populado. La tabla de
  cobranzas-por-unidad muestra `+X mora` bajo el total. El neighbor-drawer
  ya lo mostraba.
- [x] **B.3** Recargos abiertos de períodos anteriores se suman al
  `previous_balance` del nuevo período en `emitAndNotify` y en el preview
  de Mesa sin run. Nuevo helper
  `sumOpenLateFeesByUnitPriorPeriodsFromPostgres`. **Caveat de
  double-counting resuelto en B.3.1** (ver abajo).
- [x] **B.3.1** Migración `superseded_by_item_id` + helper
  `markLateFeesAbsorbedByItemInPostgres` + restauración en
  `deleteLiquidationItemsForRunInPostgres`. Cierra el agujero de
  double-count en el overview SQL y en el ledger.
- [x] **B.5** Cron endpoint `/api/cron/materialize-late-fees` (mismo
  patrón que `/api/cron/generate-reminders`, auth por `X-Cron-Secret`).
  Falta agendar la invocación externa (EventBridge / Vercel Cron /
  similar) — decisión de infra del usuario.

#### Resolución del caveat B.3 (implementada en B.3.1)

Se implementó la **Opción A**: nueva columna
`superseded_by_item_id uuid references iadmin_liquidation_items(id) on
delete set null` en `iadmin_unit_ledger_entries`
(migración `20260530_iadmin_ledger_superseded_by_item.sql`).

Flujo completo (sin double-count):

1. **Al emitir período N+1**, `emitAndNotify` materializa recargos,
   computa `previousBalanceByUnit` sumando capital impago + recargos
   abiertos de períodos anteriores, inserta los items nuevos y llama
   `markLateFeesAbsorbedByItemInPostgres` por cada unidad con recargos
   absorbidos. El helper:
   - `balance_open = 0`
   - `status = 'paid'` (saca al entry del FIFO de pagos sin que el
     materializer lo re-genere — `existing_surcharge` cuenta status
     `<> 'void'`, así sigue tomando el `amount` como assessed)
   - `superseded_by_item_id = newItemId`
   - guarda `metadata.pre_absorbed_balance_open` para auditoría.
2. **Las queries de morosidad/arrastre** filtran
   `superseded_by_item_id is null` para no contar los absorbidos
   (overview SQL `late_fee_overdue`,
   `sumOpenLateFeesByUnitForRunFromPostgres`,
   `sumOpenLateFeesByUnitPriorPeriodsFromPostgres`).
3. **Al re-emitir período N+1**, `deleteLiquidationItemsForRunInPostgres`
   restaura `balance_open = amount` y `status = 'open'` de los recargos
   absorbidos por items de ese run ANTES de borrar los items. Luego el
   `on delete set null` del FK los deja con
   `superseded_by_item_id = null`. El emit calcula de nuevo
   `previousBalanceByUnit` (que ahora ve los recargos liberados) y vuelve
   a absorberlos con los `newItemId` nuevos. ✅

Asunción: los recargos absorbidos no reciben pagos parciales mientras
están en status='paid' (FIFO los salta). Si en el futuro se permitiera
modificar manualmente entries en status='paid', la restauración perdería
ese pago — guardar `pre_absorbed_balance_open` en metadata permite
reconstruir.

---

## Notas de implementación

A medida que avanza el trabajo, anotar acá decisiones no obvias, edge cases
descubiertos, comandos útiles, etc.

- **Compatibilidad de `getIAdminMonthlyGrid`**: la firma vieja `{ year,
  monthsCount }` sigue funcionando (compat); para anclar la ventana al mes
  pivote hay que usar `targetYear/targetMonth`. Si solo se pasa `year`, el
  pivote sigue siendo el mes calendario.
- El `PeriodPicker` ya hace `router.push('?period=YYYY-MM')`. El page de
  Mesa tiene `dynamic = 'force-dynamic'` para evitar caching del SSR.
- Las predicciones (`generateMonthPredictions`) sólo tienen sentido para el
  mes actual o futuro. El guard está en `handleRequestPredictions`. Si en
  el futuro se quiere mostrar el botón disabled en vez de toastear, pasar
  `canPredict` como prop al `MesaAssistant`.
- B.3 + B.3.1 cierran el ciclo de absorción de recargos al re-emitir.
  Para validar end-to-end:
  1. Emitir período N con vencimiento ya pasado → debe accruir recargo
     en Cobranzas.
  2. Emitir N+1 → el recibo del vecino debe arrastrar el recargo en
     `previous_balance`. En el ledger el recargo viejo queda `paid` con
     `superseded_by_item_id` apuntando al item nuevo.
  3. El card "Morosidad acumulada" en Inicio debe coincidir con la suma
     de saldos pendientes; sin double-count.
  4. Re-emitir N+1 → los recargos vuelven a `open` antes del delete, se
     recalcula `previous_balance` (idéntico) y vuelven a marcarse como
     absorbidos. Idempotente.
- **Pendiente operativo de B.5:** agendar el POST a
  `/api/cron/materialize-late-fees` con header `X-Cron-Secret` (frecuencia
  recomendada: diaria al amanecer). El endpoint ya está listo y replica
  el patrón de `/api/cron/generate-reminders`.
- **Pendiente de testing manual:** correr la migración
  `20260530_iadmin_ledger_superseded_by_item.sql` en el RDS antes de
  desplegar. El código de absorción tolera la columna no existente
  durante el rollout? No — falla al setear `superseded_by_item_id`. La
  migración debe aplicarse ANTES del deploy.

---

## Archivos tocados

Listar acá los archivos modificados/creados para que un agente nuevo pueda
verificar rápidamente qué cambió.

**Bloque A:**
- `lib/types.ts` — `IAdminMonthlyGrid` ahora trae `selectedPeriod`,
  `availablePeriods`, `isFuturePeriod`, y cada mes tiene `isPivot`.
- `lib/data.ts` — `getIAdminMonthlyGrid` acepta `targetYear/targetMonth`,
  ancla la ventana al pivote, popula los nuevos campos.
- `app/iadmin/consorcios/[id]/page.tsx` — parsea `?period=YYYY-MM`.
- `components/admin-backoffice/consorcio/mesa-header.tsx` — monta
  `PeriodPicker`, badge mes futuro/histórico.
- `components/admin-backoffice/consorcio/monthly-planilla.tsx` — guard en
  `handleRequestPredictions`.

**Bloque B.1 + B.2:**
- `lib/data.ts` — `materializeLateFeesForAdministrationInPostgres` se llama
  al inicio de `getIAdminMesaState` y `getIAdminPortfolioOverview`.
- `lib/db/iadmin-core.ts` — nuevo CTE `late_fee_overdue` + suma al
  `overdue_amount` del overview, con join nuevo `left join late_fee_overdue`.

**Bloque B.4:**
- `lib/types.ts` — `IAdminMesaUnitLine.lateFee: number`.
- `lib/data.ts` — `sumOpenLateFeesByUnitForRunFromPostgres` populando
  `lateFee` por unidad y sumándolo al `subtotal` del Mesa.
- `lib/db/iadmin-reads.ts` — helper `sumOpenLateFeesByUnitForRunFromPostgres`.
- `components/admin-backoffice/cobranzas/collections-by-unit-view.tsx` —
  sub-texto `+X mora` en la columna Total.

**Bloque B.3:**
- `lib/db/iadmin-reads.ts` — helper
  `sumOpenLateFeesByUnitPriorPeriodsFromPostgres` (filtra
  `superseded_by_item_id is null`).
- `app/iadmin/consorcios/[id]/planilla/actions.ts` — `emitAndNotify`
  materializa antes, suma recargos previos al `previousBalanceByUnit` y
  llama `markLateFeesAbsorbedByItemInPostgres` por cada unidad después de
  insertar items.
- `lib/data.ts` — mismo arrastre en el branch sin run del
  `getIAdminMesaState`.

**Bloque B.3.1 (cierre del caveat):**
- `db/migrations/20260530_iadmin_ledger_superseded_by_item.sql` — nueva
  columna `superseded_by_item_id uuid` con FK `on delete set null` + index
  parcial.
- `lib/db/iadmin-writes.ts` — helper
  `markLateFeesAbsorbedByItemInPostgres` y restauración dentro de
  `deleteLiquidationItemsForRunInPostgres`.
- `lib/db/iadmin-core.ts` — CTE `late_fee_overdue` filtra
  `superseded_by_item_id is null`.
- `lib/db/iadmin-reads.ts` — `sumOpenLateFeesByUnitForRunFromPostgres`
  filtra `superseded_by_item_id is null`.

**Bloque B.5:**
- `app/api/cron/materialize-late-fees/route.ts` — endpoint POST con
  auth `X-Cron-Secret`. Hay que agendar la invocación externa.
