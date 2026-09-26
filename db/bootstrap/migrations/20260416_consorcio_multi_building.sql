-- GENERADO por scripts/db/build-schema.mjs desde db/migrations/20260416_consorcio_multi_building.sql

create table if not exists citify.building_admin_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references citify.profiles(id) on delete cascade,
  building_id uuid not null references citify.buildings(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (profile_id, building_id)
);

create index if not exists building_admin_assignments_profile_idx
  on citify.building_admin_assignments (profile_id);

create index if not exists building_admin_assignments_building_idx
  on citify.building_admin_assignments (building_id);

insert into citify.building_admin_assignments (profile_id, building_id, is_primary)
select
  profiles.id,
  profiles.building_id,
  true
from citify.profiles
where profiles.role = 'consorcio_admin'
  and profiles.building_id is not null
on conflict (profile_id, building_id) do nothing;

create or replace function citify.current_user_primary_building_id()
returns uuid
language sql
stable
security definer
set search_path = citify, shared, public
as $$
  select building_id
  from citify.building_admin_assignments
  where profile_id = citify.uid()
  order by is_primary desc, created_at asc
  limit 1
$$;

create or replace function citify.user_has_building_access(target_building_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = citify, shared, public
as $$
declare
  v_current_role citify.app_role;
begin
  v_current_role := citify.current_user_role();

  if v_current_role = 'super_admin' then
    return true;
  end if;

  if v_current_role = 'consorcio_admin' then
    return exists (
      select 1
      from citify.building_admin_assignments
      where profile_id = citify.uid()
        and building_id = target_building_id
    );
  end if;

  if v_current_role = 'vecino' then
    return citify.current_user_building_id() = target_building_id;
  end if;

  return false;
end;
$$;
