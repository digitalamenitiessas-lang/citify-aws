# Production Readiness

Tracking de los gaps para salir a producción. Si la sesión se interrumpe,
abrir este doc da el estado de cada item.

Última actualización: 2026-05-25

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
- [ ] Service worker cache busting (DEPLOY.md menciona el problema)
- [ ] Dashboard / alarma de bounce rate SES (>5% suspende sending)
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
- [ ] Onboarding self-service form ("quiero sumar mi consorcio")
- [ ] Reminders cron + UI (tabla `iadmin_reminders` ya existe)
- [ ] Mobile responsive en `/iadmin/*` (built para desktop)

## Sprint 2 — Features gaps

- [ ] PDF de liquidación / recibo verificado E2E
- [ ] Reportes / morosos / export CSV en cobranzas
- [ ] Multi-tenant Countrify limpiar (`lib/aws/cognito.ts` con pool por hostname)
- [ ] Conciliación bancaria CSV import
- [ ] Restaurar / asignar `iadmin_unit_holders` desde UI

## Roadmap v1.5+

- WhatsApp Business API (hoy solo genera `wa.me?text=` link)
- Pasarela de pago en `/l/[token]` (MercadoPago/Stripe)
- Reportes con gráficos (recharts ya está)
- AI assistance en flows normales (helpers ya existen)

---

## Estado de ejecución de Sprint 0

(Ningún item completado todavía — empezando ahora)
