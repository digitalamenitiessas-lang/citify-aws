-- Flag para forzar cambio de contrasena en el primer login del usuario.
-- Default false: usuarios existentes (cargados antes de este sistema) no se
-- ven afectados. Para usuarios nuevos, findOrCreatePlatformProfile setea
-- explicitamente true al insertar.
alter table public.profiles
  add column if not exists password_must_change boolean not null default false;
