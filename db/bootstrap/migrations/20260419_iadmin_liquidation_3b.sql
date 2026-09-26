-- GENERADO por scripts/db/build-schema.mjs desde db/migrations/20260419_iadmin_liquidation_3b.sql

-- IAdmin Fase 3b: paridad de datos con liquidacion real
-- Idempotente. No rompe queries existentes.
-- Cambios:
--   * expense_kind (ordinaria | extraordinaria) en gastos
--   * legal_info JSONB en administraciones y en managed_properties (banco, seguros, horarios, amenities, notas)
--   * en liquidation_runs: due_dates JSONB, previous_balance, ordinary_total, extraordinary_total
--   * en liquidation_items: ordinary_amount, extraordinary_amount, previous_balance
--   * tabla iadmin_unit_groups (agrupa unidades como unidad de cobro, ej. depto+cochera)

-- ----------------------------------------------------------------------------
-- 1. expense_kind
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'iadmin_expense_kind' and typnamespace = 'citify'::regnamespace) then
    create type citify.iadmin_expense_kind as enum ('ordinaria', 'extraordinaria');
  end if;
end
$$;

alter table citify.iadmin_expenses
  add column if not exists expense_kind citify.iadmin_expense_kind not null default 'ordinaria';

create index if not exists iadmin_expenses_kind_idx on citify.iadmin_expenses (expense_kind);

-- ----------------------------------------------------------------------------
-- 2. legal_info JSONB en administracion y en managed_property
--    Estructura sugerida (no forzada):
--    {
--      "bank": { "name": "Macro", "cbu": "...", "alias": "...", "account": "..." },
--      "contact": { "phone": "...", "email": "...", "accountant_name": "..." },
--      "insurance": [{ "company": "Galicia", "policy": "...", "coverage": "...", "from": "...", "to": "..." }],
--      "amenities": [{ "name": "Quincho", "price": "..." }],
--      "collection_schedule": "Jueves 10-11hs / Miercoles 15-16hs",
--      "footer_notes": "texto libre"
--    }
-- ----------------------------------------------------------------------------
alter table citify.iadmin_administrations
  add column if not exists legal_info jsonb not null default '{}'::jsonb;

alter table citify.iadmin_managed_properties
  add column if not exists legal_info jsonb not null default '{}'::jsonb;

-- ----------------------------------------------------------------------------
-- 3. Liquidation runs enriquecidos
-- ----------------------------------------------------------------------------
alter table citify.iadmin_liquidation_runs
  add column if not exists due_dates jsonb not null default '[]'::jsonb,
  add column if not exists previous_balance numeric(14,2) not null default 0,
  add column if not exists ordinary_total numeric(14,2) not null default 0,
  add column if not exists extraordinary_total numeric(14,2) not null default 0,
  add column if not exists issued_at timestamptz,
  add column if not exists issued_by uuid references citify.profiles(id) on delete set null;

-- ----------------------------------------------------------------------------
-- 4. Liquidation items enriquecidos
-- ----------------------------------------------------------------------------
alter table citify.iadmin_liquidation_items
  add column if not exists ordinary_amount numeric(14,2) not null default 0,
  add column if not exists extraordinary_amount numeric(14,2) not null default 0,
  add column if not exists previous_balance numeric(14,2) not null default 0;

-- Backfill: si ya hay items con amount pero sin ordinary_amount, los copiamos
update citify.iadmin_liquidation_items
set ordinary_amount = amount
where ordinary_amount = 0 and amount > 0;

-- ----------------------------------------------------------------------------
-- 5. iadmin_unit_groups (agrupa unidades como unidad de cobro)
-- ----------------------------------------------------------------------------
create table if not exists citify.iadmin_unit_groups (
  id uuid primary key default gen_random_uuid(),
  managed_property_id uuid not null references citify.iadmin_managed_properties(id) on delete cascade,
  display_code text not null,                -- ej. "2A-C13"
  primary_unit_id uuid references citify.iadmin_units(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (managed_property_id, display_code)
);

create index if not exists iadmin_unit_groups_property_idx
  on citify.iadmin_unit_groups (managed_property_id);

create table if not exists citify.iadmin_unit_group_members (
  group_id uuid not null references citify.iadmin_unit_groups(id) on delete cascade,
  unit_id uuid not null references citify.iadmin_units(id) on delete cascade,
  primary key (group_id, unit_id),
  unique (unit_id)                           -- una unit puede estar en a lo sumo 1 group
);

-- Trigger updated_at
do $$
begin
  execute 'drop trigger if exists set_iadmin_unit_groups_updated_at on citify.iadmin_unit_groups';
  execute 'create trigger set_iadmin_unit_groups_updated_at before update on citify.iadmin_unit_groups for each row execute function citify.set_updated_at()';
end
$$;

-- ----------------------------------------------------------------------------
-- 7. Capacidades nuevas (groups y legal)
-- ----------------------------------------------------------------------------
insert into citify.iadmin_capabilities (code, description) values
  ('unit_groups.manage',    'Agrupar unidades como unidad de cobro'),
  ('consorcio.legal.edit',  'Editar datos legales del consorcio'),
  ('admin.legal.edit',      'Editar datos legales de la administracion')
on conflict (code) do update set description = excluded.description;
