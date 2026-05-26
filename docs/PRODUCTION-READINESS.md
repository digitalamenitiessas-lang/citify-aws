# Production Readiness

Tracking de los gaps para salir a producción. Si la sesión se interrumpe,
abrir este doc da el estado de cada item.

Última actualización: 2026-05-26

---

## Sprint 0 — Bloqueantes hard (no salir sin esto)

- [ ] **SES production access** o switch a Resend/Postmark. Sandbox:
  200/día, solo a 4 addresses verificadas. Case `177930958100136`
  DENIED 2 veces. Pendiente de respuesta del bump enviado.
- [x] **Secretos fuera de plaintext en task def** ✅
  - 4 secretos creados en AWS Secrets Manager:
    `citify/prod/db-password`, `citify/prod/app-session-secret`,
    `citify/prod/vapid-private-key`, `citify/prod/openrouter-api-key`.
  - IAM policy `CitifyProdSecretsAccess` adjunta a
    `ecsTaskExecutionRole` con `secretsmanager:GetSecretValue` solo
    sobre esos ARNs.
  - Task def `citify-prod-web:35` registrada: los 4 valores movidos
    de `environment` a `secrets` con `valueFrom`. El resto de env
    sigue como estaba (no son sensibles: DB host/port/user, cognito
    ids, region, etc.).
  - Smoke test: login + GET / devuelven 200 con la nueva config.
- [x] **Rate limiting en `/api/auth/*`** ✅
  - `lib/rate-limit.ts` con fixed-window in-memory + sweep
    opportunistico. Funciona en single-task (estado actual).
    Multi-task necesitará mover a Redis.
  - Aplicado en las 4 rutas:
    - `/api/auth/login`: 10 intentos/min por IP.
    - `/api/auth/forgot-password`: 10/h por IP + 3/h por email.
    - `/api/auth/reset-password`: 10/min por IP.
    - `/api/auth/change-password`: 5/min por profile + 20/h por IP.
  - Devuelve 429 con header `Retry-After` y mensaje en español.
- [x] **Páginas legales** ✅ (placeholders pendientes de revisión legal)
  - `app/legal/layout.tsx` con tabs entre las 3 páginas.
  - `app/legal/terminos/page.tsx` — Términos y Condiciones.
  - `app/legal/privacidad/page.tsx` — Política de Privacidad (cubre
    Ley 25.326).
  - `app/legal/cookies/page.tsx` — Política de Cookies (citify usa
    solo cookies estrictamente necesarias).
  - Links en `components/home/site-footer.tsx` (footer del landing
    actual). En el commit de cleanup también se borró la landing
    vieja huérfana (`components/landing/` entero), los videos
    `public/edificios{,-mobile}.mp4` y los scripts `encode-video*.mjs`.
  - Marcadas como "Borrador inicial — pendiente de revisión legal"
    para que el abogado vea el banner y reemplace los `[PLACEHOLDER]`.
- [x] **Error pages** ✅
  - `app/not-found.tsx`: 404 branded con CTA "Volver al inicio".
  - `app/error.tsx`: errores en route segments. Muestra el `digest`
    para que el user pueda referenciar al soporte. Logueado a console
    (consumirá Sentry cuando se integre).
  - `app/global-error.tsx`: fallback cuando falla el root layout.
    Inline styles para que funcione sin design system disponible.
- [ ] **Sentry o error tracker**. Solo CloudWatch logs hoy. Necesita
  account creation del lado del user (free tier de Sentry alcanza).

## Sprint 1 — Operacionales (te queman post-launch)

- [ ] Staging environment (task def + RDS de staging)
- [x] **CI/CD con GitHub Actions** ✅
  - OIDC provider `token.actions.githubusercontent.com` creado en IAM.
  - IAM role `citify-github-actions-deploy` con trust restringido a
    `repo:digitalamenitiessas-lang/citify-aws:*`. Inline policy
    `CitifyDeployPolicy` con permisos mínimos (ECR push limitado al
    repo `citify/citify-web-prod`, ECS update/describe/run-task,
    `iam:PassRole` solo a las roles de ECS task, S3 PutObject solo
    en `_tmp/`, logs read).
  - `.github/workflows/deploy.yml`: dispara en push a main (ignora
    docs/, **/*.md, scripts/.*). Build con Buildx + cache GHA, push
    a ECR :3730a83, force-new-deployment, wait services-stable, smoke
    test GET / → 200. `concurrency: deploy-prod` evita carreras.
  - `.github/workflows/migrate.yml`: workflow_dispatch manual con
    input del archivo `.sql`. Upload a S3, ECS run-task contra la
    task def activa del service, espera exit code 0.
  - Primer run real verificado: digest `0675d6ae…` deployado y
    smoke test OK.
  - DEPLOY.md sigue siendo la referencia para el fallback manual
    (Docker Desktop local) si Actions cae.
- [ ] Restore test de RDS snapshot (nunca se hizo)
- [x] **Service worker cache busting** ✅
  - `next.config.mjs` sirve `/sw.js` con `Cache-Control: no-cache, no-store,
    must-revalidate` + `Service-Worker-Allowed: /`.
  - `components/pwa/pwa-init.tsx` registra el SW con
    `updateViaCache: 'none'`, dispara `reg.update()` al volver el foco a la
    tab (`visibilitychange`) y recarga la página en `controllerchange` para
    que las tabs abiertas adopten la nueva versión inmediatamente.
  - `public/sw.js` agrega constante `SW_VERSION` (bumpear para forzar
    update aunque no haya byte-diff de lógica), cleanup defensivo de
    caches viejas en `activate`, y postMessage `sw-activated` a las tabs.
  - Resultado: ya no hace falta cerrar todas las tabs después de un
    deploy del PWA. DEPLOY.md actualizado.
- [x] **Dashboard / alarma de bounce rate SES** ✅
  - `scripts/setup-ses-alarms.mjs`: corre con `ALERT_EMAIL=... node …`,
    crea SNS topic `citify-ses-reputation-alerts`, suscribe el mail y
    arma 2 alarmas CloudWatch sobre `AWS/SES`: `Reputation.BounceRate`
    ≥ 3% (SES suspende >5%) y `Reputation.ComplaintRate` ≥ 0.05%
    (SES suspende >0.1%). Idempotente. **Pendiente: correrlo en AWS
    una vez y confirmar la subscripción SNS desde el mail.**
  - `lib/db/email-metrics.ts`: queries sobre `email_events` para
    summary (24h/7d/30d), top addresses con bounces y health por
    template.
  - `app/superadmin/email-health/page.tsx`: dashboard accesible en
    `/superadmin/email-health` con tabs de ventana, KPIs con tone
    (verde/amarillo/rojo), tabla por template y top bouncing
    addresses. Marca breach interno (3% bounce, 0.05% complaint)
    antes de que SES nos suspenda.
- [x] **Comunicados** ✅
  - Migración `20260525_building_announcements`:
    - `building_announcements` (id, building_id, author_profile_id,
      title, body, pinned, expires_at, published_at, timestamps).
    - `building_announcement_reads` (PK compuesta + read_at) para
      tracking de lectura por vecino.
    - Índices: building+published_at desc, pinned partial,
      reads por profile.
  - `lib/db/announcements.ts` con reads (admin con read counts,
    vecino con is_read, count de no leídos, recipients filtrados
    por preference + email_blocked) y writes (insert / update /
    delete / mark-read idempotente).
  - Server actions:
    - `publishAnnouncement` valida que el building esté en la
      administración del admin, audita, dispara mail fire-and-forget.
    - `updateAnnouncement` / `deleteAnnouncement` con audit.
    - `markAnnouncementReadAction` para el vecino (idempotente).
  - Email template `announcement.ts` branded + helper
    `notifyAnnouncementPublished` que filtra recipients por preference
    `'announcements'` + dedup por (announcementId, recipientId).
  - Admin UI en `/iadmin/comunicaciones`: 3 secciones — Publicar,
    Historial (con read counts + delete), AI composer (existente,
    como helper opcional).
  - Vecino UI: nueva mainView `'announcements'` en consumer
    dashboard + entrada en desktopExtraNav + link "Comunicados" en
    header mobile menu. Panel con cards expandibles, pinned arriba,
    auto mark-as-read al entrar a la sección.
- [x] **Onboarding self-service form** ✅
  - Migración `20260526_onboarding_requests`: tabla `onboarding_requests`
    + enums `onboarding_request_kind` (building / business) y
    `onboarding_request_status` (pending / contacted / qualified /
    converted / dismissed). Tracking de `contacted_by_profile_id`,
    `contacted_at`, `converted_at` para funnel real.
  - `lib/db/onboarding.ts` con insert, list (filtra status + kind),
    update de status (auto-setea contacted_at/converted_at).
  - `/api/contact` extendido (sin romper el flow de mail existente):
    rate limit 5/h por IP, honeypot field (`website`), persistencia
    best-effort antes de mandar mail.
  - `components/home/contact-dialog.tsx`: agrega honeypot input
    posicionado off-screen + `aria-hidden` para que bots lo llenen.
  - `/superadmin/onboarding`: lista con filtros por status + kind,
    cards expandibles con mensaje + meta, botones de transición
    (Contactado / Calificar / Convertir / Descartar / Reabrir),
    textarea de notas internas opcional.
  - Link en superadmin dashboard junto a Email health.
- [x] **Reminders cron + UI** ✅
  - `lib/iadmin/reminder-generator.ts`: helper puro
    `generateRemindersForAdmin({ administrationId, managedPropertyId?, daysBeforeDue? })`
    extraído del server action — comparte código entre el botón manual
    del admin y el cron de sistema. Computa candidatos
    (`pre_due` / `overdue_first` / `overdue_second` / `overdue_heavy`)
    a partir de items con saldo > 0 y vencimientos, e inserta en
    `iadmin_reminders` (unique index daily evita duplicados).
  - `app/iadmin/recordatorios/actions.ts`: `generateReminders` ahora
    delega al helper. Nueva action `sendReminderByEmail({ reminderId })`
    con capability `reminders.send`: envía mail al propietario +
    vecino_principal de la unidad, marca el reminder como `sent` y
    audita.
  - `lib/email/templates/reminder.ts` + `lib/email/notifications/reminders.ts`:
    template con badge por tipo de reminder + monto + due label, deep
    link al `/l/[token]` público de la liquidación si hay token vigente.
    Dedup por `reminder:${id}:${profileId}` idempotency key.
  - `lib/email/types.ts`: agregadas `reminder` template + `reminders`
    preference key.
  - `components/admin-backoffice/recordatorios/reminders-inbox.tsx`:
    botón "Mail" junto a WhatsApp en cada row pending. Toast diferenciado
    cuando hay 0 destinatarios (sin propietario con mail o desactivado).
  - `app/api/cron/generate-reminders/route.ts`: POST endpoint con
    header `X-Cron-Secret`, itera todas las `iadmin_administrations` y
    corre el generador. Devuelve totals + per-admin results.
  - Pendiente operativo (no código): crear `CRON_SECRET` en Secrets
    Manager, agregarlo a la task def, y crear EventBridge schedule
    diario ~9 AM ART que haga POST al endpoint.
- [x] **Mobile responsive en `/iadmin/*`** ✅ (primera pasada)
  - `components/admin-backoffice/shell/iadmin-mobile-topbar.tsx`
    (client): hamburger sticky abajo del navbar global, abre drawer
    izquierdo con `IAdminNav`. Cierra en cambio de ruta, en Esc, y
    lock del body scroll. Visible solo `<lg`.
  - `iadmin-shell.tsx`: monta el topbar mobile, reduce padding
    (`px-4 md:px-6`, `py-4 md:py-6`), breadcrumb con
    `overflow-x-auto` para no romper, gap menor en mobile.
  - `payments-table.tsx` y `liquidations-table.tsx`: tabla envuelta
    en `overflow-x-auto` con `min-w` para que en mobile haga scroll
    horizontal en vez de squishearse.
  - Próxima iteración cubrirá: heros con padding mas grande, formularios
    de expedientes/comunicaciones, vista `/iadmin/consorcios/[id]`
    (la mas densa), y el wizard de creación de consorcio.

Adicional: link a `/superadmin/email-health` agregado al header del
superadmin dashboard (antes solo era accesible via URL directa).

## Sprint 2 — Features gaps

- [x] **PDF de liquidación verificado E2E** ✅ (vista pública)
  - Dependencia nueva: `@react-pdf/renderer` (pure JS, sin chromium,
    funciona en ECS Fargate sin pasos extra de container).
  - `lib/iadmin/public-liquidation-pdf.tsx`: componente del documento
    A4 con header de la propiedad, monto destacado (con estado
    "Mes al día" si está pago), desglose (ordinarias / extras /
    saldo anterior / cobrado), tabla de vencimientos con recargos,
    pagos registrados, datos bancarios (banco / CBU / alias / cuenta)
    y datos del contador. Branding Citify (naranja + neutros).
  - `app/l/[token]/pdf/route.tsx`: GET pública gateada por token —
    si el token está revocado o expiró, 404. `renderToBuffer` →
    `Content-Type: application/pdf` + filename con propiedad+unidad+
    período. Filename normalizado sin acentos para compatibilidad
    cross-OS.
  - Botón "Descargar PDF" agregado al header de `/l/[token]` (visible
    desde el celular del propietario).
  - Verificado E2E con `next build`: la ruta aparece en el listing,
    bundle ok, sin errores de tipo.
  - El admin sigue usando `/print/liquidaciones/[id]` (HTML imprimible
    landscape para print → PDF via browser) porque es multi-página,
    multi-unidad y le sirve como reporte interno. La vista pública
    cubre el flow del propietario que es donde estaba el gap real.
- [x] **Reportes / morosos / export CSV en cobranzas** ✅
  - Nuevo read `listMorososByAdminFromPostgres` en
    `lib/db/iadmin-reads.ts`: agrega los items abiertos por unidad,
    calcula buckets de aging (al día / 0-30 / 31-60 / 61-90 / +90) en
    una sola query con CTEs, incluye titular elegido, último pago y
    vencimiento más viejo.
  - Nueva página `app/iadmin/cobranzas/reportes/page.tsx` gateada por
    capability `reports.view`: KPIs de cabecera (unidades con deuda,
    total a cobrar, mora > 30 días) + tabla `MorososTable` con búsqueda
    por unidad/titular y filtro por consorcio. Colores por severidad
    (rosa para +90 días, naranja para 61-90, ámbar para 31-60).
  - Helper `lib/iadmin/csv.ts`: `buildCsv` con escape RFC 4180 + BOM
    UTF-8 (Excel ES-AR abre sin garabatos), `csvResponseHeaders` con
    `Content-Disposition: attachment` y filename con fecha,
    `formatMoneyAr` para columnas numéricas.
  - Dos rutas de export:
    - `GET /iadmin/cobranzas/reportes/export-morosos`: dump completo de
      morosos por unidad, 14 columnas (consorcio, unidad, titular, mail,
      teléfono, items abiertos, total, buckets, vencimiento más viejo,
      último pago).
    - `GET /iadmin/cobranzas/reportes/export-pagos?...`: dump de pagos
      respetando los mismos filtros del payments-table (period,
      unitId, status, method). Cap a 5000 rows. 16 columnas (recibo,
      fecha, consorcio, unidad, titular, período, monto, recargo,
      método, ref, cuenta, estado, motivo anulación, anulado por/el,
      cargado por).
  - Link "Ver reportes" agregado al header de `/iadmin/cobranzas`
    (visible si `reports.view`).
- [ ] Multi-tenant Countrify limpiar (`lib/aws/cognito.ts` con pool por hostname)
- [x] **Conciliación bancaria CSV import** ✅ (ya estaba, agregada
  discoverabilidad)
  - El feature ya estaba implementado: parser XLSX/CSV en
    `components/admin-backoffice/consorcio/reconciliation-wizard.tsx`
    (XLSX.read + auto-detección de columnas fecha/desc/monto/ref),
    server actions `analyzeBankStatement` + `applyReconciliation` en
    `app/iadmin/consorcios/[id]/conciliacion/actions.ts` (matching
    fuzzy por nombre + monto contra items abiertos y gastos pendientes,
    aplica como bank movements + payments atómicos).
  - Lo que faltaba era discoverabilidad: el wizard solo se llegaba via
    `/iadmin/consorcios/[id]/configuracion` → tab "Conciliación
    bancaria". Agregado link directo en el header de `/iadmin/cobranzas`
    "Conciliación bancaria" que va al listing de consorcios para que el
    admin elija el que quiere conciliar.
  - Capability gate: `collections.register` (tanto en page load como en
    las actions de analyze/apply).
- [x] **Restaurar / asignar `iadmin_unit_holders` desde UI** ✅ (ya estaba)
  - Auditoría confirmó que el feature está completo:
    `components/admin-backoffice/consorcio/units-manager.tsx` tiene
    listado de titulares activos por unidad, form "Agregar titular"
    (con kind propietario/inquilino/apoderado/otro + checkbox "reemplazar
    activo del mismo tipo"), y botón "Finalizar" para soft-delete con
    `end_date`.
  - Server actions `createUnitHolder` + `endUnitHolder` en
    `app/iadmin/consorcios/[id]/actions.ts`, gateadas por
    `holders.manage`, con audit log.
  - UI accesible desde `/iadmin/consorcios/[id]/gestion` → expandir
    unidad → sección "Titulares".

## Roadmap v1.5+

- WhatsApp Business API (hoy solo genera `wa.me?text=` link)
- Pasarela de pago en `/l/[token]` (MercadoPago/Stripe)
- Reportes con gráficos (recharts ya está)
- AI assistance en flows normales (helpers ya existen)

---

## Estado de ejecución de Sprint 0

(Ningún item completado todavía — empezando ahora)
