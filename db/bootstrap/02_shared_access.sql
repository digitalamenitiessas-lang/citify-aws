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
