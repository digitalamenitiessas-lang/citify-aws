-- GENERADO por scripts/db/build-schema.mjs desde db/migrations/20260421_iadmin_collections.sql

-- IAdmin Fase 4: cobranzas reales con N° de recibo secuencial
-- Idempotente. Aditiva. No rompe datos existentes.

-- ----------------------------------------------------------------------------
-- 1. Numeracion de recibos por administracion
-- ----------------------------------------------------------------------------
alter table citify.iadmin_administrations
  add column if not exists receipt_prefix text not null default '01',
  add column if not exists receipt_next_number integer not null default 1;

-- Funcion atomica que devuelve el proximo N° y lo incrementa.
-- Usa language sql para evitar el parser de plpgsql con SELECT INTO.
create or replace function citify.iadmin_next_receipt_number(admin_id uuid)
returns text
language sql
security definer
set search_path = citify, shared, public
as $$
  update citify.iadmin_administrations
    set receipt_next_number = receipt_next_number + 1
    where id = admin_id
    returning coalesce(receipt_prefix, '01') || '-' || lpad((receipt_next_number - 1)::text, 4, '0');
$$;

-- ----------------------------------------------------------------------------
-- 2. Ampliacion de iadmin_payments
-- ----------------------------------------------------------------------------
alter table citify.iadmin_payments
  add column if not exists administration_id uuid references citify.iadmin_administrations(id) on delete cascade,
  add column if not exists managed_property_id uuid references citify.iadmin_managed_properties(id) on delete cascade,
  add column if not exists cash_account_id uuid references citify.iadmin_cash_accounts(id) on delete set null,
  add column if not exists bank_movement_id uuid references citify.iadmin_bank_movements(id) on delete set null,
  add column if not exists liquidation_run_id uuid references citify.iadmin_liquidation_runs(id) on delete set null,
  add column if not exists receipt_number text,
  add column if not exists due_label text,
  add column if not exists surcharge_amount numeric(14,2) not null default 0,
  add column if not exists notes text,
  add column if not exists is_void boolean not null default false,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references citify.profiles(id) on delete set null,
  add column if not exists void_reason text,
  add column if not exists created_by uuid references citify.profiles(id) on delete set null;

-- Unique receipt_number por administracion cuando no es void
create unique index if not exists iadmin_payments_receipt_unique
  on citify.iadmin_payments (administration_id, receipt_number)
  where receipt_number is not null and is_void = false;

create index if not exists iadmin_payments_item_idx
  on citify.iadmin_payments (liquidation_item_id)
  where is_void = false;

create index if not exists iadmin_payments_unit_idx
  on citify.iadmin_payments (unit_id, paid_at desc);

create index if not exists iadmin_payments_admin_idx
  on citify.iadmin_payments (administration_id, paid_at desc);

-- ----------------------------------------------------------------------------
-- 4. Capacidades nuevas
-- ----------------------------------------------------------------------------
insert into citify.iadmin_capabilities (code, description) values
  ('collections.register', 'Registrar pagos de vecinos'),
  ('collections.void',     'Anular pagos')
on conflict (code) do update set description = excluded.description;
