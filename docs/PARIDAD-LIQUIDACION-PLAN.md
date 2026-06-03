# Plan: Paridad con liquidación real (Estudio GS) + UX "mejor que el Excel"

Documento de seguimiento. Si retomamos en otra sesión, leer **"Estado actual"**
y continuar desde el primer ítem sin tildar. Marcar `[x]` al completar cada
ítem; si queda a medias, anotar debajo qué falta.

**Directiva transversal (aplica a TODOS los bloques):** todo tiene que ser
**super fácil e intuitivo**. El objetivo no es solo igualar el PDF de la otra
administración — es que usar Citify sea *mejor* que mantener ese Excel. Cada
feature se valida no cuando "funciona", sino cuando un admin no técnico lo usa
sin instrucciones.

---

## Contexto rápido (TL;DR)

Referencia: PDF real de **Estudio GS / GS Administración de Consorcios**
(ALTOS DE CEVIL 2, período 03/2026, 284 lotes). Estructura del PDF:

1. Carátula con branding (logo + foto del edificio).
2. **Detalle por unidad / Boletín de expensas**: grilla con saldo apertura
   (01/mes), recibos de pago (fecha/número/importe, varios por unidad), saldo
   cierre (31/mes), expensa, extraordinaria, otros, interés, total. Colores por
   estado de morosidad (MORA / CONVENIO / ABOGADOS / JUICIO).
3. **Detalle de caja**: saldo inicial → ingresos → egresos por categoría con
   comprobante (tipo/número/proveedor/descripción) → caja actual + arqueo.
4. **Presupuesto de gastos** por categoría con gráfico de torta, pasivos, y
   **particulares** (cargos por unidad: VERIFICACION_OBRA $3.300,
   APROBACION_PLANO $93.000).

### Lo que el sistema YA hace (no reconstruir)

- `components/admin-backoffice/liquidaciones/printable-liquidation.tsx` ya
  genera **boletín consolidado** (Hoja 1, `ConsorcistasTable`) y **estado de
  caja** (Hoja 2, `cashStatement`). Punto de partida, no desde cero.
- Modelo `IAdminLiquidationRunDetail` (`lib/types.ts:1425`) ya trae `items`,
  `expenseLines` (con `category`), `cashStatement`, `dueDates`.

### Descartado explícitamente

- **Bonificación / pronto-pago.** Decisión del dueño: es lo mismo que el
  esquema de vencimientos con recargo, dicho de otra forma. NO se implementa.

---

## Estado actual

### Bloque B — Cargos particulares por unidad  ✅ (completo)

Objetivo: poder cargar un gasto a **una unidad específica** (no prorrateado),
que aparezca en "OTROS" del boletín y sume al total de esa unidad.

**Decisiones del dueño (2026-06-03):**
- Se carga **desde la sección Gastos** (mismo alta de gasto, con opción "es de
  una unidad"). No desde la Mesa ni desde la cuenta de la unidad.
- En la liquidación impacta **solo a la unidad cargada** (no se prorratea).
- Concepto: **texto libre** (el campo `description` que ya existe).

**Diseño técnico:** un gasto particular es un `iadmin_expenses` normal con
`unit_id` seteado. `unit_id = null` → prorrateado (comportamiento actual);
`unit_id` con valor → va entero a esa unidad como cargo "particular/otros".

- [x] **B.1** Migración `db/migrations/20260603_iadmin_expense_unit_charge.sql`:
  `iadmin_expenses.unit_id uuid null` (+ índice parcial) +
  `iadmin_liquidation_items.particular_amount numeric(14,2) default 0` +
  valor de enum `cargo_particular` en `iadmin_ledger_entry_type`.
  `scripts/generated-rds-schema.sql` actualizado.
- [x] **B.2** Backend gastos: `createExpenseSchema` + `createExpenseImpl`
  (valida que la unidad pertenezca al consorcio) + `insertExpenseInPostgres`
  aceptan `unitId` opcional y lo persisten.
- [x] **B.3** UI Gastos (`new-expense-form.tsx`): checkbox "Es un gasto de una
  unidad particular" + selector de unidad (solo si el consorcio tiene unidades).
  Default = gasto común (prorrateado). `page.tsx` arma `unitsByProperty`.
- [x] **B.4** `listImputedExpensesAmountsByPeriodFromPostgres` y
  `listImputedExpensesByPeriodFromPostgres` devuelven `unit_id`. Ambos caminos
  de cálculo (`emitAndNotify` y `calculateLiquidation`) separan prorrateables vs
  particulares, suman particular por unidad y lo pasan como `particular_amount`
  del item. `bulkInsertLiquidationItemsInPostgres` persiste la columna.
- [x] **B.5** `createLedgerEntriesForIssuedRunInPostgres` inserta asiento
  `cargo_particular` por unidad cuando `particular_amount > 0` (entra al saldo y
  arrastra como deuda igual que las expensas). Los lectores de deuda basados en
  ledger (cobranzas, saldo anterior) lo incluyen automáticamente.
- [x] **B.6** Reader `getIAdminLiquidationRunDetail` (lib/data.ts) + tipo
  `IAdminLiquidationItem` (`particularAmount`) + vista pública `/l/[token]` +
  dashboard del propietario + CTE `historical_item_overdue` (lib/db/iadmin-core)
  incluyen `particularAmount` en el subtotal. Mensaje del vecino en
  `emitAndNotify` suma el particular.
- [x] **B.7** Boletín `printable-liquidation.tsx`: columna "Otros" =
  `particularAmount`, sumada por fila y en la fila TOTAL.
- [x] **B.8** Validación: `npx tsc --noEmit` limpio (solo 10 errores de baseline
  preexistentes, ninguno en archivos tocados). Prueba manual pendiente de correr
  la migración en el entorno.

**Decisión adicional (2026-06-03):** al **"Repetir gastos del mes anterior"**,
los gastos particulares **NO se arrastran** (suelen ser cargos únicos/eventuales).
`listExpensesForPeriodFromPostgres` filtra `unit_id is null`. Si un cargo
particular se repite todos los meses, se vuelve a cargar a mano desde Gastos.

### Bloque C — Caja dinámica + egresos por categoría/comprobante  ✅ (completo)

Objetivo ampliado por el dueño: que los egresos estén **conectados con las
cuentas cargadas** (banco/caja), formando una **caja dinámica** real, y que el
detalle de egresos del boletín se agrupe por categoría con comprobante.

**Decisiones del dueño (2026-06-03):**
- **El gasto elige la cuenta**: al cargar un gasto se puede elegir desde qué
  cuenta se paga (+ fecha de pago). Eso genera el movimiento `expense_payment`
  en esa cuenta automáticamente (la caja queda al día). Es opcional.
- **Caja en sección propia**: la pantalla `consorcios/[id]/cuentas` se convierte
  en la Caja (saldo por cuenta + total + libro de movimientos), además de la
  Hoja 2 del boletín conectada a esos datos.
- **Comprobante = tipo + número**: campos nuevos en el gasto (Factura A/B/C,
  Recibo, Ticket, Nota de crédito, Otro) que aparecen en el detalle de egresos.

**Infra reutilizada:** ya existían `iadmin_cash_accounts` (saldo de apertura,
una activa por consorcio) e `iadmin_bank_movements` (`movement_kind`:
opening/collection/expense_payment/transfer/adjustment/manual; saldo = suma de
movimientos). El flujo `payExpense` ya creaba el movimiento `expense_payment`.

- [x] **C.1** Migración `20260603_iadmin_expense_comprobante.sql`:
  `iadmin_expenses.document_type` + `document_number`. `generated-rds-schema.sql`
  actualizado. (El link gasto↔cuenta se modela con el `bank_movement` existente.)
- [x] **C.2** Backend gastos: `insertExpenseInPostgres` persiste comprobante.
  `createExpenseSchema`/`Impl` aceptan `documentType`, `documentNumber`,
  `cashAccountId`, `paidAt`; si hay cuenta, crea el movimiento `expense_payment`
  (valida que la cuenta sea del consorcio y que el gasto no esté ya pagado). Si
  el pago falla, el gasto igual se carga (queda "no pagado") + audit log.
- [x] **C.3** UI Gastos (`new-expense-form.tsx`): selector de tipo + nº de
  comprobante; bloque "Pagar desde una cuenta" (selector opcional + fecha).
  `page.tsx` arma `accountsByProperty`.
- [x] **C.4** Caja propia (`cash-accounts-manager.tsx` + `cuentas/page.tsx`):
  total en caja, saldo vivo + nº de movimientos por cuenta, **libro de
  movimientos** (fecha/cuenta/concepto/tipo/monto con color +/−, filtro por
  cuenta) y alta rápida de movimiento manual (ingreso/egreso). Reusa
  `getIAdminCashMovements` y `addManualMovement`.
- [x] **C.5** Hoja 2 boletín (`printable-liquidation.tsx`): egresos **agrupados
  por categoría** con subtotal por rubro + total, y columna de **comprobante**
  (tipo + número) por línea. `IAdminExpenseLineInRun` y la query
  `listImputedExpenseLinesByPeriodFromPostgres` traen `document_type/number`.
- [x] **C.6** Validación: `npx tsc --noEmit` = 10 errores baseline preexistentes,
  ninguno en archivos tocados. Prueba manual pendiente (correr migración).

### Bloque D — Presupuesto de gastos con gráfico  ⬜

- [ ] **D.1** Resumen de egresos por categoría (%) en la liquidación.
- [ ] **D.2** Gráfico de torta (recharts ya está en el proyecto / confirmar).
- [ ] **D.3** Validación.

### Bloque E — Estados legales de morosidad en el boletín  ⬜

MORA / CONVENIO / ABOGADOS / JUICIO con color, más leyenda de referencias.

- [ ] **E.1** Confirmar de dónde sale el estado legal por unidad (ya existe
  `PERIODOS-Y-MOROSIDAD-PLAN.md` — revisar reuso).
- [ ] **E.2** Pintar fila/badge en boletín + leyenda.
- [ ] **E.3** Validación.

### Bloque F — Detalle de recibos + saldos fechados  ⬜

- [ ] **F.1** Desglose de recibos por unidad (fecha/número/importe).
- [ ] **F.2** Etiquetar "Saldo al 01/mes" y "Saldo al 31/mes".
- [ ] **F.3** Validación.

### Bloque G — Branding (logo + foto del edificio)  ⬜

- [ ] **G.1** Subir/almacenar logo de administración y foto del edificio.
- [ ] **G.2** Insertar en encabezado del PDF.
- [ ] **G.3** Validación.

---

## Bitácora de avances

Anotar acá cada sesión qué se cerró y qué quedó pendiente.

- **2026-06-03** — Creado el plan. Confirmado con el dueño: descartar
  bonificación, arrancar por el resto. Pendiente: confirmar arranque y esquema
  de cargos particulares (Bloque B) antes de tocar código.
- **2026-06-03** — **Bloque B completo (cargos particulares) end-to-end.**
  Migración + backend de gastos + UI con checkbox/selector de unidad + ambos
  caminos de cálculo + asiento `cargo_particular` en el ledger + columna "Otros"
  en el boletín + propagación de `particularAmount` a todos los lectores
  (run-detail, vista pública, dashboard propietario, CTE de morosidad). `tsc`
  limpio (10 errores baseline preexistentes, ninguno en archivos tocados).
  Decisión del dueño: el "repetir mes anterior" excluye particulares
  (`unit_id is null`). **Pendiente:** correr la migración en el entorno y prueba
  manual (cargar gasto particular → emitir → ver "Otros" en boletín). Siguiente
  bloque a confirmar con el dueño antes de empezar: C (egresos por categoría +
  comprobante en caja).
- **2026-06-03** — **Bloque C completo (caja dinámica + egresos por categoría/
  comprobante).** El dueño amplió el alcance: los egresos quedan conectados a las
  cuentas cargadas. Implementado: comprobante (tipo+nº) en el gasto; "el gasto
  elige la cuenta" (genera el movimiento `expense_payment` automático); pantalla
  de Caja con total + saldos vivos + libro de movimientos + alta manual; Hoja 2
  del boletín con egresos agrupados por categoría y comprobante por línea. Reusé
  `iadmin_cash_accounts`/`iadmin_bank_movements`/`payExpense`. `tsc` = 10 errores
  baseline, ninguno en archivos tocados. **Pendiente:** correr las dos
  migraciones (`20260603_iadmin_expense_unit_charge.sql` y
  `20260603_iadmin_expense_comprobante.sql`) + prueba manual. Próximos bloques a
  confirmar con el dueño: D (presupuesto con torta), E (estados legales de
  morosidad), F (recibos + saldos fechados), G (branding).
