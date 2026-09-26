-- GENERADO por scripts/db/build-schema.mjs desde db/migrations/20260415_initial.sql

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role' and typnamespace = 'citify'::regnamespace) then
    create type citify.app_role as enum ('super_admin', 'negocio_admin', 'consorcio_admin', 'vecino');
  end if;
end
$$;

create table if not exists citify.buildings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  total_units integer not null default 0 check (total_units >= 0),
  created_at timestamptz not null default now()
);

create table if not exists citify.profiles (
  id uuid primary key,
  email text not null,
  full_name text,
  role citify.app_role not null default 'vecino',
  avatar_text text,
  building_id uuid references citify.buildings(id) on delete set null,
  business_id uuid,
  floor text,
  unit text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'citify'
      and table_name = 'profiles'
      and constraint_name = 'profiles_business_id_fkey'
  ) then
    alter table citify.profiles
      add constraint profiles_business_id_fkey
      foreign key (business_id)
      references shared.businesses(id)
      on delete set null;
  end if;
end
$$;

create table if not exists citify.marketplace_items (
  id uuid primary key default gen_random_uuid(),
  seller_profile_id uuid not null references citify.profiles(id) on delete cascade,
  building_id uuid not null references citify.buildings(id) on delete cascade,
  title text not null,
  description text not null default '',
  price numeric(12,2) not null check (price >= 0),
  condition text not null check (condition in ('Nuevo', 'Como Nuevo', 'Buen Estado', 'Usado')),
  image_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists citify.saved_promotions (
  profile_id uuid not null references citify.profiles(id) on delete cascade,
  promotion_id uuid not null references shared.promotions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, promotion_id)
);

create table if not exists citify.promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references citify.profiles(id) on delete cascade,
  promotion_id uuid not null references shared.promotions(id) on delete cascade,
  status text not null default 'redeemed',
  redeemed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create or replace function citify.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on citify.profiles;

create trigger set_profiles_updated_at before update on citify.profiles for each row execute function citify.set_updated_at();

drop trigger if exists set_marketplace_updated_at on citify.marketplace_items;

create trigger set_marketplace_updated_at before update on citify.marketplace_items for each row execute function citify.set_updated_at();

create or replace function citify.current_user_role()
returns citify.app_role
language sql
stable
security definer
set search_path = citify, shared, public
as $$
  select role
  from citify.profiles
  where id = citify.uid()
  limit 1
$$;

create or replace function citify.current_user_business_id()
returns uuid
language sql
stable
security definer
set search_path = citify, shared, public
as $$
  select business_id
  from citify.profiles
  where id = citify.uid()
  limit 1
$$;

create or replace function citify.current_user_building_id()
returns uuid
language sql
stable
security definer
set search_path = citify, shared, public
as $$
  select building_id
  from citify.profiles
  where id = citify.uid()
  limit 1
$$;
