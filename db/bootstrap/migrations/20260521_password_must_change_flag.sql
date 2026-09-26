-- GENERADO por scripts/db/build-schema.mjs desde db/migrations/20260521_password_must_change_flag.sql

-- Flag para forzar cambio de contrasena en el primer login del usuario.
-- Default false: usuarios existentes (cargados antes de este sistema) no se
-- ven afectados. Para usuarios nuevos, findOrCreatePlatformProfile setea
-- explicitamente true al insertar.
alter table citify.profiles
  add column if not exists password_must_change boolean not null default false;
