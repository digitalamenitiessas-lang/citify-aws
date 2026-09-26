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
