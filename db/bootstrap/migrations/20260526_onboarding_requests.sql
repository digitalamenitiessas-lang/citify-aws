-- GENERADO por scripts/db/build-schema.mjs desde db/migrations/20260526_onboarding_requests.sql

-- Onboarding self-service: persistencia de leads desde la landing.
-- El form de la landing (ContactDialog) ya manda mail al team via SES;
-- agregamos persistencia para que el super admin pueda ver el funnel
-- y marcar estado (contactado / convertido / descartado).

do $$
begin
  if not exists (select 1 from pg_type where typname = 'onboarding_request_kind' and typnamespace = 'citify'::regnamespace) then
    create type citify.onboarding_request_kind as enum ('building', 'business');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'onboarding_request_status' and typnamespace = 'citify'::regnamespace) then
    create type citify.onboarding_request_status as enum (
      'pending', 'contacted', 'qualified', 'converted', 'dismissed'
    );
  end if;
end$$;

create table if not exists citify.onboarding_requests (
  id uuid primary key default gen_random_uuid(),
  kind citify.onboarding_request_kind not null,
  name text not null,
  email text not null,
  phone text,
  organization text,
  message text not null,
  status citify.onboarding_request_status not null default 'pending',
  source_ip inet,
  user_agent text,
  honeypot_value text,
  internal_notes text,
  contacted_by_profile_id uuid references citify.profiles(id) on delete set null,
  contacted_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists onboarding_requests_status_idx
  on citify.onboarding_requests (status, created_at desc);

create index if not exists onboarding_requests_kind_idx
  on citify.onboarding_requests (kind, created_at desc);

create index if not exists onboarding_requests_email_idx
  on citify.onboarding_requests (lower(email));

create or replace function citify.set_onboarding_requests_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_onboarding_requests_updated_at on citify.onboarding_requests;

create trigger set_onboarding_requests_updated_at
  before update on citify.onboarding_requests
  for each row execute function citify.set_onboarding_requests_updated_at();
