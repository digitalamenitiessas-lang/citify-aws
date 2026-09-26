-- GENERADO por scripts/db/build-schema.mjs desde db/migrations/20260529_iadmin_payment_claims.sql

-- Payment claims: el vecino reporta que pagó (transferencia/efectivo) y sube un
-- comprobante. El admin del consorcio luego valida y, al validar, se crea el
-- pago real en iadmin_payments. Mientras está pendiente, no afecta el saldo.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'iadmin_payment_claim_status' and typnamespace = 'citify'::regnamespace) then
    create type citify.iadmin_payment_claim_status as enum (
      'pending',
      'validated',
      'rejected'
    );
  end if;
end
$$;

create table if not exists citify.iadmin_payment_claims (
  id uuid primary key default gen_random_uuid(),
  administration_id uuid not null references citify.iadmin_administrations(id) on delete cascade,
  managed_property_id uuid not null references citify.iadmin_managed_properties(id) on delete cascade,
  unit_id uuid not null references citify.iadmin_units(id) on delete cascade,
  liquidation_item_id uuid references citify.iadmin_liquidation_items(id) on delete set null,
  reporter_profile_id uuid not null references citify.profiles(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  paid_at_claimed date not null,
  method text,
  reference text,
  notes text,
  document_object_key text,
  status citify.iadmin_payment_claim_status not null default 'pending',
  validated_by uuid references citify.profiles(id) on delete set null,
  validated_at timestamptz,
  rejected_reason text,
  payment_id uuid references citify.iadmin_payments(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists iadmin_payment_claims_admin_pending_idx
  on citify.iadmin_payment_claims (administration_id, status, created_at desc);

create index if not exists iadmin_payment_claims_unit_idx
  on citify.iadmin_payment_claims (unit_id, created_at desc);

create index if not exists iadmin_payment_claims_reporter_idx
  on citify.iadmin_payment_claims (reporter_profile_id, created_at desc);
