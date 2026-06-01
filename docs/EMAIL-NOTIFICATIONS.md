# Sistema de notificaciones por mail

Tracking del trabajo de implementación. Si se interrumpe la sesión, este doc
permite retomar sin contexto previo. Última actualización al final.

---

## Objetivo

Construir un sistema de mails transaccionales y notificaciones de actividad
para los actores de Citify (vecinos, propietarios, consorcio admins, super
admins, negocio admins), con:

- Branding consistente (layout HTML + plaintext fallback).
- Audit log completo en DB.
- Idempotencia + dedup por `idempotency_key`.
- Preferencias granulares por tipo (opt-out por categoría).
- Manejo automático de bounces y complaints (kill-switch).
- Sin SaaS externo: SES + SNS directo.

## Stack

- **Sender**: **Resend** (AWS no aprobó SES producción → migramos). Dominio
  `citify.com.ar` verificado en Resend con SPF + DKIM. SES queda como
  fallback seleccionable.
- **Selector de proveedor**: `lib/email/provider.ts` decide Resend vs SES
  según `EMAIL_PROVIDER` (o auto: Resend si hay `RESEND_API_KEY`). Tanto
  `lib/aws/ses.ts#sendEmail` como `lib/email/resend.ts#sendEmail` comparten
  la firma `SendEmailInput → { messageId }`, así `sendNotificationEmail` no
  cambia.
- **Eventos**: Resend → webhook `POST /api/email/resend-webhook` (firma Svix
  con `RESEND_WEBHOOK_SECRET`) → tabla `email_events`. El viejo
  `POST /api/email/ses-webhook` (SNS) queda inactivo mientras `EMAIL_PROVIDER`
  no sea `ses`.
- **From**: `RESEND_FROM_ADDRESS` (ej. `Citify <noreply@citify.com.ar>`).
- **Templates**: strings + helpers en `lib/email/templates/`, layout
  compartido en `lib/email/layout.ts` (sin cambios).
- **Reset de password**: flujo propio con magic link, tabla
  `password_reset_tokens` (token hasheado, TTL 24h, single-use).

### Variables de entorno (Resend)

| Var | Requerida | Default | Notas |
|---|---|---|---|
| `RESEND_API_KEY` | sí | — | API key del dashboard de Resend. |
| `RESEND_FROM_ADDRESS` | no | `Citify <noreply@citify.com.ar>` | From verificado. Cae a `EMAIL_FROM_ADDRESS` / `SES_FROM_ADDRESS`. |
| `RESEND_WEBHOOK_SECRET` | sí (prod) | — | `whsec_...` del webhook en Resend. Verifica firma Svix. |
| `EMAIL_PROVIDER` | no | auto | `resend` \| `ses`. Auto = Resend si hay API key. |
| `ALLOW_UNSIGNED_EMAIL_WEBHOOK` | no | — | `1` en dev para saltear verificación de firma. |

### Setup en Resend (una vez)

1. Crear cuenta y agregar dominio `citify.com.ar` en Resend → Domains.
2. Cargar los registros DNS (SPF/DKIM/`return-path` MX) que indica el panel
   en la zona de `citify.com.ar`. Esperar estado **Verified**.
3. Crear API key (scope full o sending) → `RESEND_API_KEY`.
4. En Webhooks, agregar endpoint `https://<dominio>/api/email/resend-webhook`
   con eventos `email.bounced`, `email.complained`, `email.delivered`.
   Copiar el signing secret → `RESEND_WEBHOOK_SECRET`.
5. Probar: disparar un welcome a un inbox real y verificar `email_events`.

## Decisiones tomadas

| Decisión | Elección |
|---|---|
| Reset password | Flujo propio con magic-link (no Cognito ForgotPassword) |
| Templates | Strings + helpers (no react-email) |
| Preferencias | Granular por tipo (`complaints`, `liquidations`, `announcements`, `promotions`) |
| Orden | Foundation primero, después auth, después consorcio |

## Estado del envío

- **Proveedor activo: Resend** (migrado desde SES). Code-side ya está listo
  (`lib/email/resend.ts` + `lib/email/provider.ts` + webhook). Falta el setup
  operativo: verificar dominio en Resend, cargar las env vars y probar a un
  inbox real.
- **SES**: queda como fallback (`EMAIL_PROVIDER=ses`). Sigue en **SANDBOX**
  (AWS no aprobó producción, case `177930958100136`), por eso no es el default.
  Dominio `citify.com.ar` VERIFIED + DKIM `SUCCESS` en SES.
- Addresses verificadas para testing histórico en sandbox SES:
  - `digitalamenitiessas@gmail.com`
  - `lucianobonilla27@gmail.com`

---

## Fases

### ✅ Phase 1 — Foundation (DONE, commit `daec01e`)

- [x] Migration `20260520_email_notifications_foundation`:
  - `email_events` (audit log + idempotency)
  - `profiles.email_notifications` jsonb (toggles por categoría)
  - `profiles.email_blocked` + reason + at (kill-switch)
  - `password_reset_tokens` (token hasheado, TTL, single-use)
- [x] `lib/email/types.ts` — registry de templates y preference keys.
- [x] `lib/email/layout.ts` — wrapper HTML branded + plaintext.
- [x] `lib/email/send.ts` — `sendNotificationEmail()` con dedup, prefs check,
  audit log automático.
- [x] `lib/aws/ses.ts` — expone `messageId` y `ConfigurationSetName`.
- [x] `app/api/email/ses-webhook` — handler SNS (Subscription, Bounce,
  Complaint, Delivery).
- [x] AWS: SNS topic `citify-ses-events`, configuration set `citify-default`,
  task def rev 30 con `SES_CONFIGURATION_SET=citify-default`.

### ✅ Phase 2 — Auth flows (DONE)

- [x] Template `lib/email/templates/welcome.ts` — onboarding con credenciales
  temporales, contextualizado por edificio o negocio.
- [x] Template `lib/email/templates/password-reset.ts` — magic link, expira
  en 24h, muestra IP de origen.
- [x] Helper `lib/email/notifications/welcome.ts` — wrapper para enviar
  welcome sin que el caller arme el template a mano. Best-effort: no
  bloquea el alta si SES falla. Dedup por `welcome:{profileId}:{reason}`.
- [x] `lib/aws/cognito.ts` — `adminSetCognitoPassword()` para consumir el
  magic link.
- [x] `POST /api/auth/forgot-password` — genera token random 32-byte
  base64url, lo guarda hasheado SHA-256 en `password_reset_tokens` con
  TTL 24h. Respuesta uniforme + pausa 350ms si el email no existe (anti
  enumeration). Invalida tokens previos del mismo profile.
- [x] `POST /api/auth/reset-password` — valida token (no usado, no
  expirado, profile activo), llama `AdminSetUserPassword`, marca el
  token como `used_at`.
- [x] `GET /api/auth/reset-password?token=...` — chequea validez sin
  consumir (para que el form pueda decidir mostrar "expirado" antes de
  pedir la pwd).
- [x] `app/reset/[token]/page.tsx` + `components/reset-password-form.tsx`
  — UI completa: loading, invalid, success, form con validación.
- [x] `components/login-form.tsx` — link "Olvidé mi contraseña" abre
  modal con email, envía request, muestra confirmación.
- [x] Hook welcome en `createPlatformUser` (`reason: platform_user_created`).
- [x] Hook welcome en `addNeighborToBuilding` (`reason: neighbor_added`).
- [x] Hook welcome en `confirmInitialOccupancyImport` con batch
  fire-and-forget + throttle 1.1s/email (`reason: bulk_imported`).
- [x] Hook welcome en `bulkImportInitialOccupancy` igual que arriba.
- [x] Hook welcome en `createBusinessWithAdmin`
  (`reason: business_admin_created`).
- [x] `findOrCreatePlatformProfile()` ahora devuelve `{ profileId, created }`
  para que solo mandemos welcome a creaciones reales (no re-altas).
- [x] `app/configuracion/page.tsx` — UI accesible para cualquier rol
  autenticado en `/configuracion`. Contiene:
  - Banner amber si `password_must_change=true`.
  - Sección "Contraseña" con `ChangePasswordForm` (in-session).
  - Sección "Notificaciones por mail" con toggles granulares.

### ✅ Phase 2.1 — Hotfixes auth (DONE, commit `09f1e8d`)

- [x] **Bug del modal de "Olvidé mi contraseña"**: el `<form>` del modal
  estaba anidado dentro del `<form>` del login → HTML inválido, el
  browser des-anidaba y el submit del modal se procesaba como submit del
  login (cerraba el modal sin avisar nada). Fix: modal a nivel sibling,
  botones `type="button"` con `onClick` + handler de Enter en el input.
  Agrega estado `forgotError` para mostrar feedback explícito.
- [x] **First-login forced change**: nueva migración
  `20260521_password_must_change_flag` con columna
  `profiles.password_must_change` (default `false`).
  `findOrCreatePlatformProfile` la setea `true` solo en creaciones
  reales (no en re-altas). El login API expone el flag, la LoginForm
  redirige a `/cambiar-password?first=1`, y `requireProfile()` enforza
  el redirect server-side para que no se bypassee por navegación
  directa. `/cambiar-password` y `/configuracion` opt-out con
  `{ allowMustChange: true }`.
- [x] **In-session change password**: `POST /api/auth/change-password`
  acepta `currentPassword` + `newPassword`. Si el flag must-change está
  on, la actual es opcional (recién logueado, ya autenticado). Si no,
  la verifica con `signInWithCognitoPassword` antes de pisarla con
  `adminSetCognitoPassword`. Limpia el flag con
  `clearPasswordMustChange()`.
- [x] Componente compartido `components/change-password-form.tsx` para
  ambos casos, controlado por prop `requireCurrent`.

### ✅ Phase 3 — Consorcio notifications (DONE)

**Expedientes (DONE):**
- [x] Templates: `complaint-created.ts`, `complaint-message.ts`,
  `complaint-status-changed.ts`.
- [x] Helper `lib/email/notifications/complaints.ts` con
  `notifyComplaintCreated`, `notifyComplaintMessage`,
  `notifyComplaintStatusChanged`. Deep-links auto-resuelven al panel del
  rol del recipient (`/usuario?view=complaints&caseId=...` o
  `/iadmin/expedientes?caseId=...`).
- [x] Hook en `POST /api/complaints/neighbor/cases` → admins del edificio.
- [x] Hook en `POST /api/complaints/cases/[id]/messages` → autor del
  expediente + admins + mencionados (excluye al autor del mensaje;
  marca isMention=true en su mail con copy distinto).
- [x] Hook en `POST /api/complaints/cases/[id]/status` → autor del
  expediente cuando un admin cambia el estado. Captura previousStatus
  antes del UPDATE para incluirlo en el mail.
- Idempotencia: `complaint_created:{caseId}:{recipientId}`,
  `complaint_message:{messageId}:{recipientId}`,
  `complaint_status:{caseId}:{from}->{to}` — retries no duplican.

**Liquidaciones (DONE):**
- [x] Template `liquidation-issued.ts` con desglose ARS (ordinarias,
  extraordinarias, saldo previo, total) + link público al share token.
- [x] Template `liquidation-closed.ts` para el admin del edificio.
- [x] Helper `lib/email/notifications/liquidations.ts`:
  - `notifyLiquidationIssued(runId)`: para cada item, busca propietarios
    activos (`unit_profile_memberships.relationship_type='propietario'
    AND active=true`) + token vigente
    (`iadmin_item_share_tokens.revoked_at IS NULL`) y manda mail con
    link `SITE_URL/l/{token}`. Skipea items sin token.
  - `notifyLiquidationClosed(runId, closedByProfileId)`: notifica a los
    consorcio_admins del edificio (excluye al que cerró).
- [x] Hook en `changeLiquidationStatus` (`app/iadmin/liquidaciones/actions.ts`):
  cuando `nextStatus === 'issued'` → `notifyLiquidationIssued`;
  cuando `nextStatus === 'closed'` → `notifyLiquidationClosed`.
- Idempotencia: `liquidation_issued:{runId}:{unitId}:{ownerId}` y
  `liquidation_closed:{runId}:{adminId}` — re-emisión / re-cierre no
  duplica mails al mismo recipient para el mismo evento.

### ✅ Phase 2.2 — Forzar cambio de pwd en re-onboardings (DONE)

Problema original: el admin tipeaba un "Password temporal" en
/superadmin pero si el profile ya existía en DB, `findOrCreatePlatformProfile`
no llegaba a Cognito y el password no se aplicaba. Adicionalmente, el
flag `password_must_change` solo se seteaba en INSERTs nuevos.

- [x] `findOrCreatePlatformProfile` ahora SIEMPRE llama
  `adminCreateCognitoUser` (que internamente rota la pwd con
  `AdminSetUserPassword` aunque el usuario ya exista en Cognito).
- [x] Helper `markPasswordMustChange(profileId)` en `lib/db/profiles.ts`
  para forzar el flag en profiles que ya existían (ON CONFLICT del
  upsert no tocaba esa columna).
- [x] Tras el upsert, si `created=false`, llamamos
  `markPasswordMustChange` explícitamente.

### ✅ Navbar (DONE)

- [x] Desktop: pill del nombre ahora linkea a `/configuracion` (antes
  iba a `ROLE_HOME[role]`). Agregamos un botón "Mi panel" al lado para
  no perder ese acceso.
- [x] Mobile menu: nuevo botón "Configuración" debajo de "Ir a mi
  panel".

### 🔜 Phase 4 — Opcionales

- [ ] `promotion_new` → vecinos del edificio (opt-in, default off).
- [ ] Comunicados (cuando exista el sistema).
- [ ] Digest semanal.

---

## Referencias rápidas

- Send: `import { sendNotificationEmail } from '@/lib/email/send'`
- Layout: `import { renderEmailLayout } from '@/lib/email/layout'`
- SNS topic ARN: `arn:aws:sns:us-east-1:351885857894:citify-ses-events`
- SES configuration set: `citify-default`
- Templates registrados: `lib/email/types.ts` (`EmailTemplateKey`)

## Cómo probar en sandbox

1. Verificar address de destino en SES:
   `aws sesv2 create-email-identity --email-identity test@ejemplo.com`
2. Confirmar link en el mail recibido.
3. Disparar el flow desde la UI.
4. Verificar:
   - `select * from email_events order by sent_at desc limit 5` — debe
     aparecer con `status='sent'` y luego `'delivered'`.
   - El mail llega con branding correcto.
5. Para probar bounce: usar address inválida tipo
   `bounce@simulator.amazonses.com` (SES mailbox simulator).
6. Para probar complaint: `complaint@simulator.amazonses.com`.

## Salir de sandbox

`reviewStatus` en `aws sesv2 get-account` debe pasar a `GRANTED`. El case
`177930958100136` está respondido. Cuando se apruebe, no hay cambios de
código necesarios — solo se levanta el rate limit.
