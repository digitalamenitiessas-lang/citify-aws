-- Onboarding self-service: persistencia de leads desde la landing.
-- El form de la landing (ContactDialog) ya manda mail al team via SES;
-- agregamos persistencia para que el super admin pueda ver el funnel
-- y marcar estado (contactado / convertido / descartado).

do $$
begin
  if not exists (select 1 from pg_type where typname = 'onboarding_request_kind') then
    create type public.onboarding_request_kind as enum ('building', 'business');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'onboarding_request_status') then
    create type public.onboarding_request_status as enum (
      'pending', 'contacted', 'qualified', 'converted', 'dismissed'
    );
  end if;
end$$;

create table if not exists public.onboarding_requests (
  id uuid primary key default gen_random_uuid(),
  kind public.onboarding_request_kind not null,
  name text not null,
  email text not null,
  phone text,
  organization text,
  message text not null,
  status public.onboarding_request_status not null default 'pending',
  source_ip inet,
  user_agent text,
  honeypot_value text,
  internal_notes text,
  contacted_by_profile_id uuid references public.profiles(id) on delete set null,
  contacted_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists onboarding_requests_status_idx
  on public.onboarding_requests (status, created_at desc);
create index if not exists onboarding_requests_kind_idx
  on public.onboarding_requests (kind, created_at desc);
create index if not exists onboarding_requests_email_idx
  on public.onboarding_requests (lower(email));

create or replace function public.set_onboarding_requests_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_onboarding_requests_updated_at on public.onboarding_requests;
create trigger set_onboarding_requests_updated_at
  before update on public.onboarding_requests
  for each row execute function public.set_onboarding_requests_updated_at();
