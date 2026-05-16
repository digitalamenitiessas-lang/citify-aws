# Migración Vercel + Supabase → AWS

Checklist vivo del estado de la migración. Marcamos `[x]` lo terminado y `[ ]` lo pendiente. Las secciones grandes terminan con notas de lo que aún arrastra deuda técnica.

---

## 0. Infra base AWS

- [x] Cuenta AWS y usuario IAM `citify-cli` (us-east-1)
- [x] Cognito User Pool `citify-prod-users` (`us-east-1_qcmuRiMh1`) + App Client `citify-web`
- [x] RDS Postgres `citify-prod-db` (`citify` DB, usuario `citify_admin`)
- [x] S3 bucket `citify-prod-assets` + base URL pública
- [x] ECR repo `citify/citify-web-prod`
- [x] ECS Fargate cluster `citify-prod-cluster` + service `citify-prod-service`
- [x] Task role `citify-prod-task-role` con permisos S3 + Cognito (AdminCreateUser/SetUserPassword/GetUser/UpdateUserAttributes/Disable/Enable)
- [x] ECS Exec habilitado en el service (para ejecutar SQL one-off via `aws ecs run-task`)
- [x] Variables de entorno completas en task definition (DB_*, AWS_COGNITO_*, S3, APP_SESSION_SECRET, VAPID, OpenRouter)

**Pendiente infra**:
- [ ] **Sacar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` del task definition** — ya no se usan en runtime (sólo el build los necesita por los `ARG` del Dockerfile)
- [ ] **IaC** (Terraform o CDK) — hoy todo está creado a mano; armar definición declarativa para poder reproducir el stack en otra cuenta o región
- [ ] **Pipeline CI/CD** — actualmente el deploy es manual (build local → push ECR → register task def → update service). Sumar GitHub Actions u otro runner que dispare en push a `main`/`luciano`
- [ ] **Backups RDS automáticos** + retención (verificar config actual)
- [ ] **CloudWatch alarms** — al menos para CPU/memoria del task, errores 5xx, conexiones RDS

---

## 1. Schema RDS

- [x] Schema base sincronizado (`scripts/generated-rds-schema.sql`) con todas las tablas iadmin, profiles, businesses, promotions, complaints, marketplace, etc.
- [x] FK `profiles.id → auth.users(id)` **dropeada** (era residuo Supabase, bloqueaba creación de usuarios via Cognito sub)
- [x] `auth.uid()` redefinida para leer `current_setting('app.current_profile_id', true)` — permite que las RPCs `security definer` resuelvan el usuario autenticado por Cognito
- [x] Función `public.superadmin_create_consorcio` operativa (la usa createManagedProperty)
- [x] Función `public.iadmin_next_receipt_number` operativa (cobranzas)
- [x] Función `public.generate_promotion_redemption_token` operativa (vecino genera QR)
- [x] Sync de datos iniciales desde Supabase con `scripts/sync-rds-iadmin-core.js`

**Pendiente schema**:
- [ ] Auditar que TODAS las tablas referenciadas por la app existen y tienen los datos sincronizados (no solo iadmin core; también complaints, marketplace, saved_promotions, push_subscriptions, etc.)
- [ ] Definir migrations propias (sin depender del archivo Supabase) — un sistema tipo `node-pg-migrate` o `drizzle-kit` para evolucionar el schema desde acá

---

## 2. Auth (Cognito)

- [x] Login con Cognito (`USER_PASSWORD_AUTH`)
- [x] Sessions con cookie firmada HMAC (`APP_SESSION_SECRET`, 12 h TTL)
- [x] `findProfileByEmail` / `findProfileById` desde Postgres
- [x] Helpers admin: `adminCreateCognitoUser` (AdminCreateUser + SetPassword permanente + GetUser para sub) — idempotente, tolera `UsernameExistsException`
- [x] `upsertProfile` en Postgres usa el sub de Cognito como id
- [x] Health checks `/api/health/cognito` y `/api/health/rds`

**Pendiente auth**:
- [ ] **Migración de los Supabase auth users existentes a Cognito**: hoy quien se loguee con email registrado en Supabase pero NO en Cognito recibirá error. `scripts/sync-cognito-users.js` existe pero verificar que cubre todos los usuarios de prod
- [ ] **Reset de contraseña**: el flow de "olvidé mi contraseña" actualmente no está implementado contra Cognito (`ForgotPassword` + `ConfirmForgotPassword`)
- [ ] **MFA / verificación email**: opcional, evaluar si interesa
- [ ] **Refresh tokens**: el sistema de sessions actual es opaco — revisar si hace falta exponer `refresh_token` para apps móviles a futuro

---

## 3. Server Actions migradas a RDS + Cognito

### iadmin (consorcio admin diario)

- [x] `iadmin/proveedores/actions.ts` (CRUD proveedores)
- [x] `iadmin/consorcios/[id]/actions.ts` (managed property edit, units CRUD, holders, memberships, building info, accounting periods, **createUnitUser via Cognito**)
- [x] `iadmin/consorcios/[id]/cuentas/actions.ts` (cash accounts, movements, payExpense)
- [x] `iadmin/consorcios/[id]/conciliacion/actions.ts` (analyzeBankStatement, applyReconciliation)
- [x] `iadmin/consorcios/[id]/importar/actions.ts` (XLSX bulk units + holders con AI mapping)
- [x] `iadmin/consorcios/[id]/proyecciones/actions.ts` (projection IA)
- [x] `iadmin/consorcios/[id]/planilla/actions.ts` (cell upsert, addRubro, quickPay, emitAndNotify, getUnitStatement)
- [x] `iadmin/consorcios/[id]/planilla/predict-actions.ts` (predict IA + acceptAndEmit)
- [x] `iadmin/consorcios/[id]/planilla/import-actions.ts` (suggest match, import expense, duplicate check)
- [x] `iadmin/gastos/actions.ts` (createExpense, status, attachDoc, signed URL, validate AI extraction)
- [x] `iadmin/gastos/recurring-actions.ts` (cloneRecurringExpenses)
- [x] `iadmin/gastos/ai-actions.ts` (no usa supabase — solo IA)
- [x] `iadmin/cobranzas/actions.ts` (registerCollection, voidCollection)
- [x] `iadmin/liquidaciones/actions.ts` (generate, transition)
- [x] `iadmin/liquidaciones/share-actions.ts` (createShareToken)
- [x] `iadmin/comunicaciones/actions.ts` (generateAnnouncement IA)
- [x] `iadmin/recordatorios/actions.ts` (generate, status, bulk update)

### superadmin (creación de plataforma)

- [x] `createPlatformUser` (Cognito + RDS)
- [x] `createManagedProperty` (RPC Postgres)
- [x] `createBusinessWithAdmin` (Cognito + RDS)
- [x] `analyzeInitialOccupancyFile` / `confirmInitialOccupancyImport` / `bulkImportInitialOccupancy` (XLSX/CSV)
- [x] **`getSupabaseAdminClient` ya NO se importa en `superadmin/actions.ts`**

### vecino / propietario

- [x] `usuario/actions.ts` (`createHouseholdNeighbor` via Cognito + RDS)

---

## 4. API endpoints migrados

- [x] `/api/business/profile` (PATCH: logo, address, lat/lng)
- [x] `/api/business/promotions` (POST create/update)
- [x] `/api/business/promotions/[id]` (DELETE)
- [x] `/api/business/redemptions/validate` (negocio escanea cupón — reescrita en TS, no más RPC con `auth.uid()`)
- [x] `/api/consumer/saved-promotions/toggle`
- [x] `/api/consumer/marketplace-items` (POST publicar item)
- [x] `/api/consumer/redemptions/status`
- [x] `/api/consumer/redemptions/token` (vecino genera QR — reescrita en TS)
- [x] `/api/uploads/business-asset-url` (S3 directo, no usaba supabase admin)
- [x] `/api/uploads/marketplace-url` (S3 directo)
- [x] `/api/uploads/expense-document-url` (lookup gasto por Postgres)
- [x] `/api/complaints/neighbor/cases` (POST crear caso — usa RPC original via `pgQueryAsProfile`)
- [x] `/api/complaints/cases/[id]/status` (POST cambiar estado)
- [x] `/api/complaints/cases/[id]/messages` (POST comentar)
- [x] `/api/push/subscribe`
- [x] `/api/push/send`
- [x] `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- [x] Health: `/api/health/cognito`, `/api/health/rds`

**Resultado**: ningún endpoint API debería tirar `"Supabase admin no esta configurado."` en runtime. Si pasa, es bug puntual — reportar.

---

## 5. Reads en `lib/data.ts` (lecturas de páginas)

Patrón: `if (isPostgresConfigured()) { try { ... } catch { /* fallback */ } } /* sigue Supabase */`. Esto vive con doble código por seguridad.

- [x] `getSuperAdminDashboardData` (RDS)
- [x] `getIAdminPortfolio` / `getIAdminPortfolioOverview` / `getIAdminExpensesInbox` / `getIAdminProviders` (RDS)
- [x] `getIAdminPropertyDetail`, `getIAdminUnitAccountStatement` (parcial RDS)
- [x] `getConsumerDashboardData` (consumer / vecino dashboard) — Codex
- [x] `getOwnerDashboardData` (propietario) — Codex
- [x] `getPublicPromotions`, `getAllBusinesses`, `getBusinessById` (RDS)
- [x] `getProfileById` (RDS)

**Reads en `lib/data.ts`** — ✅ **100% sobre RDS** (ningún import de `@/lib/supabase/*`):
- ✅ Todas las funciones iadmin (cash accounts, movements, reminders, expense detail, units with holders, liquidation run detail, consorcio dashboard, unit account statement, mesa state, monthly grid, closing checklist, liquidation runs)
- ✅ Dashboards (super admin, consorcio, business, consumer, owner)
- ✅ Home / promotions

**Pendiente reads en otros archivos**:
- [ ] `lib/auth.ts` (3 referencias residuales en `getIAdminContext`)
- [ ] `lib/ai/context-builders.ts`, `lib/iadmin/expense-anomalies.ts`, `lib/iadmin/public-liquidation.ts` (siguen importando `@/lib/supabase/*`)

---

## 6. Páginas (server components con guard de Supabase)

Algunas páginas tienen `if (!isSupabaseConfigured()) return <SetupNotice />`. Hay que sacarlos.

- [x] `app/consorcio/page.tsx` (Codex lo limpió)
- [ ] `app/page.tsx`
- [ ] `app/admin/page.tsx`
- [ ] `app/superadmin/page.tsx`
- [ ] `app/usuario/page.tsx`
- [ ] `app/propietario/page.tsx`
- [ ] `app/iadmin/layout.tsx`
- [ ] `app/print/liquidaciones/[id]/page.tsx`

---

## 7. Storage de archivos

- [x] S3 + presigned URLs para upload de logos / fotos negocio / promotions
- [x] S3 private/ para comprobantes de gastos
- [x] CloudFront / public base URL para assets públicos
- [x] `getExpenseDocumentSignedUrl` lee desde S3 (sacó el fallback `supabase.storage`)

**Pendiente storage**:
- [ ] **Migrar archivos legacy**: si todavía hay imágenes hosteadas en Supabase Storage referenciadas por `image_path` o `logo_path` antiguos, necesitan ser copiadas a S3 + actualizar las filas
- [ ] Política de lifecycle del bucket (eliminar comprobantes viejos, etc.)

---

## 8. Limpieza final (cuando todo esté validado en prod)

- [ ] Eliminar carpeta `lib/supabase/` (admin.ts, server.ts, client.ts, middleware.ts, env.ts)
- [ ] Eliminar `components/setup-notice.tsx`
- [ ] Quitar `@supabase/supabase-js` y `@supabase/ssr` de `package.json` + `pnpm install`
- [ ] Sacar los `ARG NEXT_PUBLIC_SUPABASE_URL` y `ARG NEXT_PUBLIC_SUPABASE_ANON_KEY` del `Dockerfile`
- [ ] Sacar `COPY supabase ./supabase` del Dockerfile (o decidir si la carpeta `supabase/migrations` se mantiene como histórico)
- [ ] Eliminar las env vars `NEXT_PUBLIC_SUPABASE_*` y `SUPABASE_SERVICE_ROLE_KEY` del task definition ECS y del `.env.local`
- [ ] Marcar el proyecto Supabase como "archived" o pausado en el dashboard
- [ ] Borrar `scripts/sync-rds-*.js` y `scripts/sync-cognito-users.js` (se vuelven obsoletos una vez completada la migración de datos)
- [ ] Borrar `scripts/create-consorcio-admin.js` (era ad-hoc para destrabar el primer admin)

---

## 9. Próximos pasos sugeridos (orden recomendado)

1. **Sacar fallbacks Supabase de `lib/data.ts` y `lib/auth.ts`** una vez validado que las páginas funcionan con RDS solo. Riesgo bajo si dejamos un branch de rollback.
2. **Migrar referencias residuales** en `lib/ai/context-builders.ts`, `lib/iadmin/expense-anomalies.ts`, `lib/iadmin/public-liquidation.ts` — son lecturas chicas.
3. **Limpiar guards `isSupabaseConfigured()`** en las páginas (sección 6).
4. **Sacar `lib/supabase/*` y dependencia npm** (sección 8). Una vez hecho, ya no hay forma de volver fácil — momento ideal para correr una smoke test exhaustiva.
5. **CI/CD pipeline** para que los deploys dejen de ser manuales.
6. **IaC** para que la infra esté declarada.
7. **Pausar / archivar el proyecto Supabase**.

---

## 10. Notas operativas

- **Deploy manual actual**: build local con docker → push ECR → register new task def revision → update service → wait. Helper en `scripts/.tail-logs.js` para leer logs ECS.
- **Acceso a RDS**: subnet privada. Para queries one-off, usar `aws ecs run-task` con override de comando (la task hereda el security group + las env vars).
- **Ejemplo run-task**: ver el flow usado para dropear `profiles_id_fkey` y para redefinir `auth.uid()` durante la migración.
- **Cognito**: el `sub` se usa como `profiles.id`. Si en algún flujo aparece `null` para `auth.uid()`, asegurate de envolver la query en `pgQueryAsProfile(profileId, ...)`.
