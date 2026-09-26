#!/usr/bin/env node
/**
 * Transforma db/migrations/*.sql (escritas para el schema public de la RDS de
 * AWS) en migraciones que aplican limpio sobre el Postgres del VPS, donde
 * Citify comparte base con Countrify.
 *
 * La base del VPS tiene tres schemas (ver deploy/MULTI-PRODUCTO.md):
 *
 *   shared     businesses y promotions, las mismas filas para los dos productos.
 *              Es de countrify_admin; Citify NO lo crea ni le hace DDL.
 *   countrify  las tablas de Countrify.
 *   citify     las tablas de Citify (lo que en AWS era public).
 *
 * Que arregla, y por que:
 *
 *  1. public.X -> citify.X, salvo businesses/promotions -> shared.X.
 *  2. Saca el DDL de businesses/promotions (create/alter table, indices,
 *     triggers, backfills): esas tablas ya existen en shared con todas las
 *     columnas. Las referencias (FKs, selects, %rowtype) se reescriben.
 *  3. Saca el shim de Supabase (schema auth, auth.users, auth.uid(), roles
 *     anon/authenticated/service_role), handle_new_user() y su trigger, y el
 *     FK profiles.id -> auth.users(id), que ningun codigo cumplia.
 *     auth.uid() pasa a ser citify.uid(), que lee app.current_profile_id.
 *  4. Saca el RLS (enable row level security + policies). Estaba muerto:
 *     auth.uid() devolvia null fijo y la app usa pgQuery plano. La autorizacion
 *     vive en el codigo (requireProfile + capacidades iadmin).
 *  5. Acota al schema citify los chequeos de idempotencia contra el catalogo.
 *     `if not exists (select 1 from pg_type where typname = 'app_role')` mira
 *     TODOS los schemas: como countrify.app_role ya existe, sobre la base
 *     compartida el tipo de Citify nunca se crearia y la migracion siguiente
 *     fallaria (o peor, usaria el enum de Countrify). Lo mismo con pg_constraint.
 *  6. `set search_path = public` de las funciones security definer pasa a
 *     `citify, shared, public`.
 *  7. Saca `create extension pgcrypto`: la crea el superusuario en 00_roles.sql
 *     (citify_admin no puede crear extensiones).
 *
 * Uso:    node scripts/db/build-schema.mjs
 * Salida: db/bootstrap/{00_roles,01_schema,02_shared_access,03_grants}.sql
 *         db/bootstrap/migrations/*.sql
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const MIG_SRC = resolve(root, 'db/migrations')
const BOOT = resolve(root, 'db/bootstrap')
const MIG_OUT = resolve(BOOT, 'migrations')

// ---------------------------------------------------------------------------
// Split en sentencias respetando dollar-quoting ($$ ... $$ y $tag$ ... $tag$),
// strings con comillas simples, identificadores entre comillas dobles y
// comentarios de linea. Mismo enfoque que scripts/db/migrate.mjs.
// ---------------------------------------------------------------------------
function splitStatements(sql) {
  const out = []
  let buf = ''
  let i = 0
  let inSingle = false
  let inDouble = false
  let inLineComment = false
  let dollarTag = null

  while (i < sql.length) {
    const ch = sql[i]
    const rest = sql.slice(i, i + 64)

    if (inLineComment) {
      buf += ch
      if (ch === '\n') inLineComment = false
      i += 1
      continue
    }

    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        buf += dollarTag
        i += dollarTag.length
        dollarTag = null
        continue
      }
      buf += ch
      i += 1
      continue
    }

    if (inSingle) {
      buf += ch
      if (ch === "'") inSingle = false
      i += 1
      continue
    }

    if (inDouble) {
      buf += ch
      if (ch === '"') inDouble = false
      i += 1
      continue
    }

    if (sql.startsWith('--', i)) {
      inLineComment = true
      buf += ch
      i += 1
      continue
    }

    if (ch === "'") {
      inSingle = true
      buf += ch
      i += 1
      continue
    }

    if (ch === '"') {
      inDouble = true
      buf += ch
      i += 1
      continue
    }

    const dollarMatch = /^\$[A-Za-z_]*\$/.exec(rest)
    if (dollarMatch) {
      dollarTag = dollarMatch[0]
      buf += dollarTag
      i += dollarTag.length
      continue
    }

    if (ch === ';') {
      out.push(buf + ';')
      buf = ''
      i += 1
      continue
    }

    buf += ch
    i += 1
  }

  if (buf.trim()) out.push(buf)
  return out
}

/** Texto de la sentencia sin comentarios, en minuscula, para hacer matching. */
function codeOf(stmt) {
  return stmt
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n')
    .toLowerCase()
    .trim()
}

// ---------------------------------------------------------------------------
// Reglas de descarte
// ---------------------------------------------------------------------------
const SHARED = '(?:public|citify)\\.(?:businesses|promotions)\\b'
const onShared = new RegExp(`\\bon\\s+(?:only\\s+)?${SHARED}`)

const DROP_RULES = [
  { name: 'extension: pgcrypto (la crea 00_roles.sql)', test: (c) => /^create extension/.test(c) },
  { name: 'shim: do-block auth/extensions/roles', test: (c) => c.startsWith('do $$') && c.includes("nspname = 'auth'") },
  { name: 'shim: create table auth.users', test: (c) => /^create table if not exists auth\.users/.test(c) },
  { name: 'shim: function auth.uid()', test: (c) => /^create or replace function auth\.uid\(\)/.test(c) },
  { name: 'shim: function handle_new_user', test: (c) => /^create or replace function (public|citify)\.handle_new_user\(\)/.test(c) },
  { name: 'shim: trigger on auth.users', test: (c) => /\bon auth\.users\b/.test(c) },
  { name: 'shim: supabase storage (buckets/objects)', test: (c) => /^(insert into|update|delete from) storage\./.test(c) || /\bon storage\.objects\b/.test(c) },
  { name: 'rls: enable/disable row level security', test: (c) => /^alter table .* (enable|disable|force) row level security/.test(c) },
  { name: 'rls: create/drop/alter policy', test: (c) => /^(create|drop|alter) policy/.test(c) },
  { name: 'rls: do-block que genera policies', test: (c) => c.startsWith('do $$') && /create policy/.test(c) && !/create (table|type|function|index)/.test(c) },
  { name: 'rls: grant a roles de supabase', test: (c) => /^grant [\s\S]*?\bto\b[\s\S]*?\b(anon|authenticated|service_role)\b/.test(c) },
  // --- businesses / promotions: viven en shared, las administra Countrify ---
  { name: 'shared: create table businesses/promotions', test: (c) => new RegExp(`^create table (if not exists )?${SHARED}`).test(c) },
  { name: 'shared: alter table businesses/promotions', test: (c) => new RegExp(`^alter table (if exists )?(only )?${SHARED}`).test(c) },
  { name: 'shared: backfill sobre businesses/promotions', test: (c) => new RegExp(`^(update|insert into|delete from) ${SHARED}`).test(c) },
  { name: 'shared: indices/triggers sobre businesses/promotions', test: (c) => /^(create|drop) (unique )?(index|trigger)/.test(c) && onShared.test(c) },
  { name: 'shared: comment on businesses/promotions', test: (c) => new RegExp(`^comment on (table|column) ${SHARED}`).test(c) },
]

// ---------------------------------------------------------------------------
// Reescrituras (sobre la sentencia original, respetando mayusculas)
// ---------------------------------------------------------------------------
function rewrite(stmt) {
  return (
    stmt
      // 1. schema
      .replace(/\bpublic\.(businesses|promotions)\b/g, 'shared.$1')
      .replace(/\bpublic\.(?=[A-Za-z_"%])/g, 'citify.')
      // 3. shim de Supabase
      .replace(/\s+references auth\.users\s*\(id\)\s*on delete cascade/gi, '')
      .replace(/\bauth\.uid\(\)/g, 'citify.uid()')
      .replace(/\s*,\s*(anon|authenticated|service_role)\b/g, '')
      // 5. chequeos de catalogo acotados al schema
      .replace(
        /(from\s+pg_type\s+where\s+typname\s*=\s*'[^']+')/gi,
        "$1 and typnamespace = 'citify'::regnamespace",
      )
      .replace(
        /(from\s+pg_constraint\s+where\s+conname\s*=\s*'[^']+')/gi,
        "$1 and connamespace = 'citify'::regnamespace",
      )
      .replace(/(table_schema\s*=\s*)'public'/gi, "$1'citify'")
      .replace(/(schemaname\s*=\s*)'public'/gi, "$1'citify'")
      // 6. search_path de las funciones
      .replace(/set search_path\s*=\s*public\b(?!\s*,)/gi, 'set search_path = citify, shared, public')
  )
}

function transform(sql) {
  const statements = splitStatements(sql)
  const dropped = new Map()
  const kept = []

  for (const stmt of statements) {
    const code = codeOf(stmt)
    if (!code || code === ';') continue
    const rule = DROP_RULES.find((r) => r.test(code))
    if (rule) {
      dropped.set(rule.name, (dropped.get(rule.name) ?? 0) + 1)
      continue
    }
    kept.push(rewrite(stmt).trim())
  }

  // Red de seguridad: si algo quedo apuntando a public o al shim, que falle el
  // build y no el deploy.
  const leftovers = kept.filter((s) => /\bpublic\.[a-z_]/i.test(codeOf(s)) || /\bauth\.(users|uid)\b/.test(codeOf(s)))
  if (leftovers.length) {
    throw new Error(`quedaron referencias a public./auth. sin reescribir:\n${leftovers.map((s) => s.slice(0, 200)).join('\n---\n')}`)
  }

  return { kept, dropped, total: statements.length }
}

// ---------------------------------------------------------------------------
// Archivos fijos
// ---------------------------------------------------------------------------
const ROLES = `
-- ---------------------------------------------------------------------------
-- Roles de Citify. Correr como superusuario sobre la base compartida.
-- GENERADO por scripts/db/build-schema.mjs. No editar a mano.
--
--   psql -d <base> -v db=<base> -v admin_pw="'...'" -v app_pw="'...'" -f 00_roles.sql
-- ---------------------------------------------------------------------------

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'citify_admin') then
    create role citify_admin login;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'citify_app') then
    create role citify_app login;
  end if;
end
$roles$;

alter role citify_admin password :admin_pw;
alter role citify_app   password :app_pw;

-- citify_admin crea el schema citify y es DUEÑO de todo lo que hay adentro.
-- Si el bootstrap corriera como superusuario, todo quedaria owned by postgres y
-- citify_admin no podria correr la primera migracion futura.
grant create, connect on database :"db" to citify_admin;
grant connect on database :"db" to citify_app;

-- gen_random_uuid() viene con pgcrypto (y desde PG13 tambien en core).
create extension if not exists pgcrypto;

-- search_path por rol: vale para psql, para migrate.mjs y para la app.
alter role citify_admin set search_path = citify, shared, public;
alter role citify_app   set search_path = citify, shared, public;
`.trim()

const SCHEMA = `
-- ---------------------------------------------------------------------------
-- Schema citify. Correr como citify_admin.
-- GENERADO por scripts/db/build-schema.mjs. No editar a mano.
-- ---------------------------------------------------------------------------

create schema if not exists citify;

-- Reemplazo de auth.uid() del shim de Supabase. Devuelve el profile seteado por
-- pgQueryAsProfile (lib/db/postgres.ts); fuera de eso, NULL.
create or replace function citify.uid()
returns uuid
language sql
stable
as $fn$
  select nullif(current_setting('app.current_profile_id', true), '')::uuid
$fn$;
`.trim()

// Lo corre countrify_admin, que es el dueño de shared. Va ANTES de las
// migraciones: citify_admin necesita REFERENCES para crear los FKs
// (profiles.business_id, saved_promotions, promotion_redemptions, ...) y
// SELECT/DML para las funciones security definer que tocan promociones.
const SHARED_ACCESS = `
-- ---------------------------------------------------------------------------
-- Acceso de Citify al schema shared. Correr como countrify_admin (dueño de
-- shared), ANTES de las migraciones de Citify.
-- GENERADO por scripts/db/build-schema.mjs. No editar a mano.
-- ---------------------------------------------------------------------------

grant usage on schema shared to citify_admin, citify_app;

grant select, insert, update, delete, references
  on all tables in schema shared to citify_admin;
grant select, insert, update, delete
  on all tables in schema shared to citify_app;
grant usage, select on all sequences in schema shared to citify_admin, citify_app;

-- Y sobre lo que Countrify cree en shared de aca en adelante.
alter default privileges in schema shared
  grant select, insert, update, delete, references on tables to citify_admin;
alter default privileges in schema shared
  grant select, insert, update, delete on tables to citify_app;
alter default privileges in schema shared
  grant usage, select on sequences to citify_admin, citify_app;
`.trim()

const GRANTS = `
-- ---------------------------------------------------------------------------
-- Permisos del usuario de runtime. Solo DML: la app nunca hace DDL.
-- Correr como citify_admin (dueño del schema) despues de cada migracion.
-- GENERADO por scripts/db/build-schema.mjs. No editar a mano.
-- ---------------------------------------------------------------------------

grant usage on schema citify to citify_app;

grant select, insert, update, delete on all tables    in schema citify to citify_app;
grant usage, select                 on all sequences  in schema citify to citify_app;
grant execute                       on all functions  in schema citify to citify_app;

alter default privileges in schema citify
  grant select, insert, update, delete on tables to citify_app;
alter default privileges in schema citify
  grant usage, select on sequences to citify_app;
alter default privileges in schema citify
  grant execute on functions to citify_app;
`.trim()

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
rmSync(MIG_OUT, { recursive: true, force: true })
mkdirSync(MIG_OUT, { recursive: true })

writeFileSync(resolve(BOOT, '00_roles.sql'), ROLES + '\n')
writeFileSync(resolve(BOOT, '01_schema.sql'), SCHEMA + '\n')
writeFileSync(resolve(BOOT, '02_shared_access.sql'), SHARED_ACCESS + '\n')
writeFileSync(resolve(BOOT, '03_grants.sql'), GRANTS + '\n')

// Los archivos con punto inicial NO son migraciones: son borrados masivos de
// datos de una sola vez (.oneshot-wipe-*.sql).
const migrations = readdirSync(MIG_SRC).filter((f) => f.endsWith('.sql') && !f.startsWith('.')).sort()

for (const name of migrations) {
  // CRLF -> LF: con checkout en Windows el \r final impide que `--.*$` saque
  // los comentarios, y las reglas de descarte dejan de matchear.
  const t = transform(readFileSync(resolve(MIG_SRC, name), 'utf8').replace(/\r\n/g, '\n'))
  writeFileSync(
    resolve(MIG_OUT, name),
    `-- GENERADO por scripts/db/build-schema.mjs desde db/migrations/${name}\n\n` + t.kept.join('\n\n') + '\n',
  )
  const drops = [...t.dropped].map(([n, c]) => `${c} ${n}`).join(', ')
  console.log(`${name}: ${t.total} -> ${t.kept.length}${drops ? `  (fuera: ${drops})` : ''}`)
}

console.log(`\n${migrations.length} migraciones -> db/bootstrap/migrations/`)
