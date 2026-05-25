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
- [ ] CI/CD con GitHub Actions (build + test + push al merge a main)
- [ ] Restore test de RDS snapshot (nunca se hizo)
- [ ] Service worker cache busting (DEPLOY.md menciona el problema)
- [ ] Dashboard / alarma de bounce rate SES (>5% suspende sending)
- [ ] Comunicados (DB + UI + email — feature gap clave)
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
