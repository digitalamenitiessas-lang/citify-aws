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
