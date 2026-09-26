-- GENERADO por scripts/db/build-schema.mjs desde db/migrations/20260416b_building_complaints.sql

do $$
begin
  if not exists (select 1 from pg_type where typname = 'complaint_status' and typnamespace = 'citify'::regnamespace) then
    create type citify.complaint_status as enum ('sin_completar', 'en_desarrollo', 'resuelto');
  end if;
end
$$;

create table if not exists citify.building_complaints (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references citify.buildings(id) on delete cascade,
  author_profile_id uuid not null references citify.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  status citify.complaint_status not null default 'sin_completar',
  is_anonymous boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists building_complaints_building_idx
  on citify.building_complaints (building_id, created_at desc);

create index if not exists building_complaints_author_idx
  on citify.building_complaints (author_profile_id);

create or replace function citify.get_neighbor_building_complaints(target_building_id uuid)
returns table (
  id uuid,
  building_id uuid,
  title text,
  description text,
  status citify.complaint_status,
  is_anonymous boolean,
  created_at timestamptz,
  updated_at timestamptz,
  resolved_at timestamptz,
  author_label text,
  author_unit text
)
language sql
stable
security definer
set search_path = citify, shared, public
as $$
  select
    complaints.id,
    complaints.building_id,
    complaints.title,
    complaints.description,
    complaints.status,
    complaints.is_anonymous,
    complaints.created_at,
    complaints.updated_at,
    complaints.resolved_at,
    case
      when complaints.is_anonymous then 'Vecino anonimo'
      else coalesce(profiles.full_name, 'Vecino')
    end as author_label,
    case
      when complaints.is_anonymous then null
      else nullif(concat_ws(' - ', nullif(profiles.floor, ''), nullif(profiles.unit, '')), '')
    end as author_unit
  from citify.building_complaints as complaints
  join citify.profiles on profiles.id = complaints.author_profile_id
  where complaints.building_id = target_building_id
    and (
      citify.current_user_role() = 'super_admin'
      or (
        citify.current_user_role() = 'vecino'
        and target_building_id = citify.current_user_building_id()
      )
      or (
        citify.current_user_role() = 'consorcio_admin'
        and citify.user_has_building_access(target_building_id)
      )
    )
  order by complaints.created_at desc
$$;

create or replace function citify.enforce_complaint_status_update()
returns trigger
language plpgsql
set search_path = citify, shared, public
as $$
begin
  if citify.current_user_role() = 'consorcio_admin' then
    if new.building_id <> old.building_id
      or new.author_profile_id <> old.author_profile_id
      or new.title <> old.title
      or new.description <> old.description
      or new.is_anonymous <> old.is_anonymous
      or new.created_at <> old.created_at
    then
      raise exception 'Consorcio admin solo puede actualizar el estado de la queja.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists set_building_complaints_updated_at on citify.building_complaints;

create trigger set_building_complaints_updated_at
before update on citify.building_complaints
for each row execute function citify.set_updated_at();

drop trigger if exists enforce_complaint_status_update on citify.building_complaints;

create trigger enforce_complaint_status_update
before update on citify.building_complaints
for each row execute function citify.enforce_complaint_status_update();
