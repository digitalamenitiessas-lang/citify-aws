-- GENERADO por scripts/db/build-schema.mjs desde db/migrations/20260926_vps_orphan_objects_and_local_auth.sql

-- ---------------------------------------------------------------------------
-- Mudanza a VPS: objetos que la app usa y que ninguna migracion creaba, mas la
-- contraseña propia que reemplaza a Cognito.
--
-- Se escribe directo contra el schema citify (ya no public): es posterior a la
-- salida de AWS y solo corre sobre la base compartida del VPS.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. push_subscriptions
--
-- Suscripciones de Web Push (VAPID). Se aplico a mano sobre la RDS y nunca se
-- versiono. El upsert de lib/db/business.ts hace
-- `on conflict (profile_id, endpoint)`, asi que ese par tiene que ser unico.
-- ---------------------------------------------------------------------------
create table if not exists citify.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references citify.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists push_subscriptions_profile_endpoint_key
  on citify.push_subscriptions (profile_id, endpoint);

-- ---------------------------------------------------------------------------
-- 2. Unicidad de email en profiles
--
-- La garantizaba Cognito (el email era el Username del pool). Sin Cognito, la
-- carga masiva de vecinos podria crear dos perfiles con el mismo email y el
-- login por email quedaria ambiguo. Va sobre lower(email) porque
-- findProfileByEmail normaliza a minusculas.
-- ---------------------------------------------------------------------------
create unique index if not exists profiles_email_lower_key
  on citify.profiles (lower(email));

-- ---------------------------------------------------------------------------
-- 3. Contraseña propia
--
-- El login verifica un hash argon2id guardado aca (lib/auth/password.ts).
-- Nullable a proposito: un profile sin hash no puede loguear, y el flujo de
-- "olvide mi contraseña" es la via para darle acceso.
-- ---------------------------------------------------------------------------
alter table citify.profiles
  add column if not exists password_hash text;

comment on column citify.profiles.password_hash is
  'Hash argon2id (formato PHC) de la contraseña. Null = la cuenta no puede iniciar sesion.';
