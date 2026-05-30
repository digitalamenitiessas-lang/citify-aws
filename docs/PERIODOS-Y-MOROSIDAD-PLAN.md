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
- [x] **B.3 (parcial — ver caveat)** Recargos abiertos de períodos
  anteriores se suman al `previous_balance` del nuevo período en
  `emitAndNotify` y en el preview de Mesa sin run. Nuevo helper
  `sumOpenLateFeesByUnitPriorPeriodsFromPostgres`.
- [ ] **B.5** Cron diario que materialice recargos para todos los admins.

#### Caveat conocido de B.3 — DOUBLE-COUNT en overview SQL

Al absorber los recargos viejos en `previous_balance` del período nuevo, las
entries `recargo_mora` originales quedan `open` en el ledger atadas a su run
original. Como no las voideamos ni les pisamos status, **se cuentan dos veces
en `getIAdminPortfolioOverview`**:

1. Dentro de `late_fee_overdue` (CTE B.2) las cuenta como recargo open.
2. Dentro de `historical_item_overdue` las cuenta de nuevo, ahora embebidas
   en el `previous_balance` del item del período siguiente.

Por qué no las voideamos: el materializer (`materializeLateFeesForUnit...`)
calcula `delta = targetAmount - existingAssessed` y sólo considera entries
con `status <> 'void'`. Si voideáramos, en la próxima corrida del
materializer (que se dispara al abrir Mesa, Inicio, Cobranzas, etc.) las
re-generaría → loop infinito de recargos.

Opciones para resolver en próxima iteración:
- **Opción A (preferida):** Migración `alter table iadmin_unit_ledger_entries
  add column superseded_by_item_id uuid null`. Al absorber, setearlo. El
  materializer ignora entries con `superseded_by_item_id is not null`. El
  CTE `late_fee_overdue` filtra `superseded_by_item_id is null`.
- **Opción B:** Cambiar status a 'paid' con `metadata.absorbed_into_run_id`.
  El materializer ya cuenta entries non-void en `existing_surcharge` así que
  no las regenera. El overview SQL filtra por `status in ('open',
  'partially_paid')` — los absorbidos en status='paid' no cuentan. Riesgo:
  cuando se re-emita el período viejo, `voidLedgerEntriesForRunInPostgres`
  pasa los absorbidos a 'void' y luego el materializer los re-crea.
  Necesita un guard en el re-emit que detecte y preserve los absorbidos.
- **Opción C (workaround sin migración):** En el SQL del overview, en el CTE
  `late_fee_overdue` filtrar recargos cuyos `liquidation_item_id` ya estén
  "supersedidos" por un `previous_balance > 0` en un item posterior del
  mismo unit. Heurística frágil.

**Mientras tanto**, mitigación parcial: la lógica FIFO de aplicación de
pagos resuelve el saldo real correctamente, pero el dashboard de Inicio
puede mostrar morosidad inflada hasta resolver esto. Avisar al usuario si
nota el síntoma.

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
- B.3 deja un agujero en `getIAdminPortfolioOverview` (double-count en
  morosidad). Ver caveat más arriba para resolver en próxima sesión.
- Para validar B.2 + B.3 en datos reales: emitir período N con vencimiento
  vencido, verificar que aparezca recargo en Cobranzas, luego emitir N+1
  y chequear que el recibo del vecino arrastra el recargo en
  `previous_balance`.

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
  `sumOpenLateFeesByUnitPriorPeriodsFromPostgres` (con docstring del caveat).
- `app/iadmin/consorcios/[id]/planilla/actions.ts` — `emitAndNotify`
  materializa antes y suma recargos previos al `previousBalanceByUnit`.
- `lib/data.ts` — mismo arrastre en el branch sin run del `getIAdminMesaState`.
