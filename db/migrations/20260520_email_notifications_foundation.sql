-- Foundation para sistema de notificaciones por mail.
--   * email_events: audit log + idempotencia + tracking de bounces/complaints.
--   * profiles.email_notifications: preferencias granulares (toggles por tipo).
--   * profiles.email_blocked: kill-switch automatico cuando el address bouncea
--     duro o se queja (lo setea el webhook SNS de SES).

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  to_email text not null,
  to_profile_id uuid references public.profiles(id) on delete set null,
  subject text not null,
  idempotency_key text unique,
  status text not null default 'sent' check (status in ('sent','delivered','bounced','complained','failed','suppressed')),
  ses_message_id text,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  delivered_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz
);

create index if not exists email_events_to_profile_idx on public.email_events(to_profile_id);
create index if not exists email_events_to_email_idx on public.email_events(to_email);
create index if not exists email_events_status_idx on public.email_events(status) where status in ('bounced','complained','failed');
create index if not exists email_events_template_idx on public.email_events(template_key, sent_at desc);
create index if not exists email_events_ses_msg_idx on public.email_events(ses_message_id) where ses_message_id is not null;

-- Preferencias granulares: que tipos de notificacion acepta recibir el usuario.
-- Los mails transaccionales (welcome, password_reset, security_alert) ignoran
-- esto y siempre se mandan. Los demas tipos chequean su key aca.
alter table public.profiles
  add column if not exists email_notifications jsonb not null default jsonb_build_object(
    'complaints', true,
    'liquidations', true,
    'announcements', true,
    'promotions', false
  );

-- Kill switch automatico: si el address bouncea duro o se queja, este flag se
-- prende desde el webhook y bloquea todo envio futuro hasta que un admin lo
-- limpie.
alter table public.profiles
  add column if not exists email_blocked boolean not null default false;
alter table public.profiles
  add column if not exists email_blocked_reason text;
alter table public.profiles
  add column if not exists email_blocked_at timestamptz;

-- Tokens para magic-link de reset de password.
create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  requested_ip inet,
  user_agent text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_tokens_profile_idx on public.password_reset_tokens(profile_id);
create index if not exists password_reset_tokens_expires_idx on public.password_reset_tokens(expires_at) where used_at is null;
