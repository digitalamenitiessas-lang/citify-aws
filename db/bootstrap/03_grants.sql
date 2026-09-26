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
