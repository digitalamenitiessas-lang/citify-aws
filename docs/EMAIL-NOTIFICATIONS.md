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

- **Sender**: AWS SES v2, dominio `citify.com.ar` verificado + DKIM.
- **Eventos**: SES → SNS topic `citify-ses-events` → webhook
  `POST /api/email/ses-webhook` → tabla `email_events`.
- **Config set**: `citify-default` (publica BOUNCE/COMPLAINT/DELIVERY).
- **From**: `noreply@citify.com.ar`.
- **Templates**: strings + helpers en `lib/email/templates/`, layout
  compartido en `lib/email/layout.ts`.
- **Reset de password**: flujo propio con magic link, tabla
  `password_reset_tokens` (token hasheado, TTL 24h, single-use).

## Decisiones tomadas

| Decisión | Elección |
|---|---|
| Reset password | Flujo propio con magic-link (no Cognito ForgotPassword) |
| Templates | Strings + helpers (no react-email) |
| Preferencias | Granular por tipo (`complaints`, `liquidations`, `announcements`, `promotions`) |
| Orden | Foundation primero, después auth, después consorcio |

## Estado SES

- Dominio `citify.com.ar`: **VERIFIED**, DKIM `SUCCESS`.
- Cuenta: **SANDBOX** (200/día, 1/s). Producción solicitada — case
  `177930958100136` denied una vez, respondido con detalle. Pendiente
  re-review.
- Addresses verificadas para testing en sandbox:
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
- [x] `app/configuracion/page.tsx` — UI mínima de preferencias accesible
  para cualquier rol autenticado en `/configuracion`. Toggles: complaints,
  liquidations, announcements, promotions. Persiste en
  `profiles.email_notifications`.

### 🔜 Phase 3 — Consorcio notifications

- [ ] `complaint_created` → consorcio_admin del building.
- [ ] `complaint_message` → creador + mencionados (debounce 10min).
- [ ] `complaint_status_changed` → creador.
- [ ] `liquidation_issued` → propietarios con link público (share token).
- [ ] `liquidation_closed` → consorcio_admin.

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
