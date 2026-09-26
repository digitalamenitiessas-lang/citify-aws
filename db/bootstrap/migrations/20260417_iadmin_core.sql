-- GENERADO por scripts/db/build-schema.mjs desde db/migrations/20260417_iadmin_core.sql

------------------------------------------------------------
-- 1. Tipos enumerados especificos del modulo
------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'iadmin_property_kind' and typnamespace = 'citify'::regnamespace) then
    create type citify.iadmin_property_kind as enum ('consorcio', 'barrio_privado', 'edificio', 'mixto');
  end if;

  if not exists (select 1 from pg_type where typname = 'iadmin_unit_kind' and typnamespace = 'citify'::regnamespace) then
    create type citify.iadmin_unit_kind as enum ('departamento', 'casa', 'local', 'cochera', 'baulera', 'otro');
  end if;

  if not exists (select 1 from pg_type where typname = 'iadmin_holder_kind' and typnamespace = 'citify'::regnamespace) then
    create type citify.iadmin_holder_kind as enum ('propietario', 'inquilino', 'apoderado', 'otro');
  end if;

  if not exists (select 1 from pg_type where typname = 'iadmin_period_status' and typnamespace = 'citify'::regnamespace) then
    create type citify.iadmin_period_status as enum ('open', 'locked', 'closed');
  end if;

  if not exists (select 1 from pg_type where typname = 'iadmin_expense_status' and typnamespace = 'citify'::regnamespace) then
    create type citify.iadmin_expense_status as enum ('draft', 'pending_review', 'needs_doc', 'approved', 'rejected', 'imputed');
  end if;

  if not exists (select 1 from pg_type where typname = 'iadmin_ai_extraction_status' and typnamespace = 'citify'::regnamespace) then
    create type citify.iadmin_ai_extraction_status as enum ('pending', 'suggested', 'validated', 'rejected');
  end if;

  if not exists (select 1 from pg_type where typname = 'iadmin_liquidation_status' and typnamespace = 'citify'::regnamespace) then
    create type citify.iadmin_liquidation_status as enum ('draft', 'calculated', 'issued', 'closed');
  end if;
end
$$;

------------------------------------------------------------
-- 2. Administracion (entidad raiz del modulo)
------------------------------------------------------------
create table if not exists citify.iadmin_administrations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  tax_id text,
  contact_email text,
  contact_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists iadmin_administrations_active_idx on citify.iadmin_administrations (is_active);

------------------------------------------------------------
-- 3. Catalogo de capacidades + roles operativos por administracion
------------------------------------------------------------
create table if not exists citify.iadmin_capabilities (
  code text primary key,
  description text not null
);

insert into citify.iadmin_capabilities (code, description) values
  ('portfolio.view',          'Ver cartera de consorcios administrados'),
  ('consorcio.view',          'Ver detalle operativo de un consorcio'),
  ('consorcio.edit',          'Editar datos de un consorcio'),
  ('units.manage',            'Gestionar unidades funcionales'),
  ('holders.manage',          'Gestionar titulares e inquilinos'),
  ('providers.manage',        'Gestionar proveedores'),
  ('expenses.view',           'Ver gastos'),
  ('expenses.create',         'Cargar gastos'),
  ('expenses.approve',        'Aprobar / rechazar gastos'),
  ('documents.upload',        'Subir documentos / comprobantes'),
  ('documents.validate',      'Validar extracciones de IA documental'),
  ('liquidations.view',       'Ver liquidaciones'),
  ('liquidations.create',     'Generar corridas de liquidacion'),
  ('liquidations.close',      'Cerrar liquidaciones'),
  ('collections.view',        'Ver cobranzas y deuda'),
  ('communications.send',     'Emitir comunicaciones'),
  ('reports.view',            'Ver reportes operativos'),
  ('reports.sensitive.view',  'Ver reportes financieros sensibles'),
  ('admin.settings.manage',   'Configurar parametros de la administracion')
on conflict (code) do update set description = excluded.description;

-- Granularidad por administracion: un mismo profile puede tener distintos
-- operational_role en distintas administraciones. operational_role es texto
-- libre para no obligar a un enum; los presets viven en TS (lib/iadmin/capabilities.ts)
-- y la materializacion efectiva se hace via iadmin_role_capabilities.
create table if not exists citify.iadmin_role_grants (
  id uuid primary key default gen_random_uuid(),
  administration_id uuid not null references citify.iadmin_administrations(id) on delete cascade,
  profile_id uuid not null references citify.profiles(id) on delete cascade,
  operational_role text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (administration_id, profile_id)
);

create index if not exists iadmin_role_grants_profile_idx on citify.iadmin_role_grants (profile_id);

create index if not exists iadmin_role_grants_admin_idx on citify.iadmin_role_grants (administration_id);

-- Capacidades efectivas por (administration, role). Permite override por administracion
-- sin tener que cambiar el preset global. Se rellena por trigger desde TS si hace falta;
-- en el SQL la dejamos vacia y delegamos al chequeo TS para presets, pero el helper SQL
-- consulta esta tabla cuando hay overrides explicitos.
create table if not exists citify.iadmin_role_capabilities (
  administration_id uuid not null references citify.iadmin_administrations(id) on delete cascade,
  operational_role text not null,
  capability_code text not null references citify.iadmin_capabilities(code) on delete cascade,
  granted boolean not null default true,
  primary key (administration_id, operational_role, capability_code)
);

------------------------------------------------------------
-- 4. Cartera de consorcios administrados (envoltorio de buildings)
------------------------------------------------------------
create table if not exists citify.iadmin_managed_properties (
  id uuid primary key default gen_random_uuid(),
  administration_id uuid not null references citify.iadmin_administrations(id) on delete cascade,
  building_id uuid not null references citify.buildings(id) on delete restrict,
  display_name text,                -- override opcional sobre buildings.name
  property_kind citify.iadmin_property_kind not null default 'consorcio',
  tax_id text,
  managed_since date,
  management_fee_pct numeric(6,3),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (administration_id, building_id)
);

create index if not exists iadmin_managed_properties_admin_idx on citify.iadmin_managed_properties (administration_id);

create index if not exists iadmin_managed_properties_building_idx on citify.iadmin_managed_properties (building_id);

------------------------------------------------------------
-- 5. Unidades funcionales y titulares
------------------------------------------------------------
create table if not exists citify.iadmin_units (
  id uuid primary key default gen_random_uuid(),
  managed_property_id uuid not null references citify.iadmin_managed_properties(id) on delete cascade,
  code text not null,                       -- ej. "1A", "Lote 23"
  kind citify.iadmin_unit_kind not null default 'departamento',
  floor text,
  surface_m2 numeric(10,2),
  prorata_coefficient numeric(10,6),         -- alicuota
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (managed_property_id, code)
);

create index if not exists iadmin_units_property_idx on citify.iadmin_units (managed_property_id);

create table if not exists citify.iadmin_unit_holders (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references citify.iadmin_units(id) on delete cascade,
  profile_id uuid references citify.profiles(id) on delete set null,
  full_name text not null,
  tax_id text,
  email text,
  phone text,
  holder_kind citify.iadmin_holder_kind not null default 'propietario',
  start_date date,
  end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists iadmin_unit_holders_unit_idx on citify.iadmin_unit_holders (unit_id);

------------------------------------------------------------
-- 6. Proveedores
------------------------------------------------------------
create table if not exists citify.iadmin_providers (
  id uuid primary key default gen_random_uuid(),
  administration_id uuid not null references citify.iadmin_administrations(id) on delete cascade,
  name text not null,
  tax_id text,
  category text,
  email text,
  phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists iadmin_providers_admin_idx on citify.iadmin_providers (administration_id);

------------------------------------------------------------
-- 7. Periodos contables
------------------------------------------------------------
create table if not exists citify.iadmin_accounting_periods (
  id uuid primary key default gen_random_uuid(),
  managed_property_id uuid not null references citify.iadmin_managed_properties(id) on delete cascade,
  period_year integer not null check (period_year between 2000 and 2100),
  period_month integer not null check (period_month between 1 and 12),
  status citify.iadmin_period_status not null default 'open',
  closed_at timestamptz,
  closed_by uuid references citify.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (managed_property_id, period_year, period_month)
);

create index if not exists iadmin_periods_property_idx on citify.iadmin_accounting_periods (managed_property_id);

------------------------------------------------------------
-- 8. Gastos
------------------------------------------------------------
create table if not exists citify.iadmin_expenses (
  id uuid primary key default gen_random_uuid(),
  administration_id uuid not null references citify.iadmin_administrations(id) on delete cascade,
  managed_property_id uuid not null references citify.iadmin_managed_properties(id) on delete cascade,
  accounting_period_id uuid references citify.iadmin_accounting_periods(id) on delete set null,
  provider_id uuid references citify.iadmin_providers(id) on delete set null,
  category text,
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'ARS',
  issued_at date,
  due_at date,
  status citify.iadmin_expense_status not null default 'draft',
  created_by uuid references citify.profiles(id) on delete set null,
  approved_by uuid references citify.profiles(id) on delete set null,
  approved_at timestamptz,
  rejected_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists iadmin_expenses_property_idx on citify.iadmin_expenses (managed_property_id);

create index if not exists iadmin_expenses_period_idx on citify.iadmin_expenses (accounting_period_id);

create index if not exists iadmin_expenses_status_idx on citify.iadmin_expenses (status);

------------------------------------------------------------
-- 9. Documentos del gasto + extraccion IA
------------------------------------------------------------
create table if not exists citify.iadmin_expense_documents (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references citify.iadmin_expenses(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes integer,
  uploaded_by uuid references citify.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create index if not exists iadmin_expense_documents_expense_idx on citify.iadmin_expense_documents (expense_id);

create table if not exists citify.iadmin_ai_document_extractions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references citify.iadmin_expense_documents(id) on delete cascade,
  status citify.iadmin_ai_extraction_status not null default 'pending',
  provider text,                          -- ej. 'manual', 'openai-vision', etc.
  raw_payload jsonb,                      -- respuesta cruda del proveedor
  suggested_fields jsonb,                 -- {provider_id, amount, currency, issued_at, category, description}
  confidence numeric(5,2),
  validated_by uuid references citify.profiles(id) on delete set null,
  validated_at timestamptz,
  validation_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id)
);

create index if not exists iadmin_ai_extractions_status_idx on citify.iadmin_ai_document_extractions (status);

------------------------------------------------------------
-- 10. Liquidaciones (esqueleto)
------------------------------------------------------------
create table if not exists citify.iadmin_liquidation_runs (
  id uuid primary key default gen_random_uuid(),
  administration_id uuid not null references citify.iadmin_administrations(id) on delete cascade,
  managed_property_id uuid not null references citify.iadmin_managed_properties(id) on delete cascade,
  accounting_period_id uuid not null references citify.iadmin_accounting_periods(id) on delete cascade,
  status citify.iadmin_liquidation_status not null default 'draft',
  total_expenses numeric(14,2) not null default 0,
  total_units integer not null default 0,
  generated_by uuid references citify.profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  closed_by uuid references citify.profiles(id) on delete set null,
  closed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (managed_property_id, accounting_period_id)
);

create index if not exists iadmin_liquidations_property_idx on citify.iadmin_liquidation_runs (managed_property_id);

create table if not exists citify.iadmin_liquidation_items (
  id uuid primary key default gen_random_uuid(),
  liquidation_run_id uuid not null references citify.iadmin_liquidation_runs(id) on delete cascade,
  unit_id uuid not null references citify.iadmin_units(id) on delete restrict,
  prorata_coefficient numeric(10,6) not null,
  amount numeric(14,2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists iadmin_liquidation_items_run_idx on citify.iadmin_liquidation_items (liquidation_run_id);

------------------------------------------------------------
-- 11. Placeholders estructurales (cobranzas, banco, comunicaciones, auditoria)
------------------------------------------------------------
create table if not exists citify.iadmin_payments (
  id uuid primary key default gen_random_uuid(),
  liquidation_item_id uuid references citify.iadmin_liquidation_items(id) on delete set null,
  unit_id uuid references citify.iadmin_units(id) on delete set null,
  amount numeric(14,2) not null check (amount >= 0),
  paid_at timestamptz not null default now(),
  method text,
  reference text,
  created_at timestamptz not null default now()
);

create table if not exists citify.iadmin_bank_movements (
  id uuid primary key default gen_random_uuid(),
  administration_id uuid not null references citify.iadmin_administrations(id) on delete cascade,
  managed_property_id uuid references citify.iadmin_managed_properties(id) on delete set null,
  movement_date date not null,
  description text,
  amount numeric(14,2) not null,
  balance numeric(14,2),
  external_ref text,
  reconciled_payment_id uuid references citify.iadmin_payments(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists citify.iadmin_notifications (
  id uuid primary key default gen_random_uuid(),
  administration_id uuid not null references citify.iadmin_administrations(id) on delete cascade,
  audience text,
  subject text not null,
  body text,
  status text not null default 'queued',
  created_by uuid references citify.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists citify.iadmin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  administration_id uuid references citify.iadmin_administrations(id) on delete set null,
  actor_profile_id uuid references citify.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists iadmin_audit_admin_idx on citify.iadmin_audit_logs (administration_id);

------------------------------------------------------------
-- 12. Triggers de updated_at (reusa citify.set_updated_at del initial)
------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'iadmin_administrations',
    'iadmin_managed_properties',
    'iadmin_units',
    'iadmin_unit_holders',
    'iadmin_providers',
    'iadmin_accounting_periods',
    'iadmin_expenses',
    'iadmin_ai_document_extractions',
    'iadmin_liquidation_runs'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists set_%I_updated_at on citify.%I', t, t);
    execute format('create trigger set_%I_updated_at before update on citify.%I for each row execute function citify.set_updated_at()', t, t);
  end loop;
end
$$;

------------------------------------------------------------
-- 13. Helpers SQL para RLS
------------------------------------------------------------
create or replace function citify.iadmin_user_administration_ids()
returns setof uuid
language sql
stable
security definer
set search_path = citify, shared, public
as $$
  select case
    when citify.current_user_role() = 'super_admin' then a.id
    else g.administration_id
  end
  from citify.iadmin_administrations a
  left join citify.iadmin_role_grants g
    on g.administration_id = a.id
   and g.profile_id = citify.uid()
  where citify.current_user_role() = 'super_admin' or g.profile_id = citify.uid()
$$;

create or replace function citify.iadmin_user_belongs_to(target_admin_id uuid)
returns boolean
language sql
stable
security definer
set search_path = citify, shared, public
as $$
  select case
    when citify.current_user_role() = 'super_admin' then true
    else exists (
      select 1 from citify.iadmin_role_grants
      where administration_id = target_admin_id
        and profile_id = citify.uid()
    )
  end
$$;

-- Capacidad efectiva: si hay row en iadmin_role_capabilities, gana ese override.
-- Si no hay override explicito, devolvemos true para super_admin y true cuando el
-- usuario tiene alguna grant en la administracion (los presets se aplican en TS,
-- el SQL es permisivo por defecto y la UI/server actions hacen el gating fino).
-- Nota: usamos asignaciones con subqueries (var := (SELECT ...)) en lugar de
-- `SELECT col INTO var FROM ...` porque algunos editores SQL lo interpretan
-- erroneamente como `SELECT INTO table`.
create or replace function citify.iadmin_user_has_capability(target_admin_id uuid, target_capability text)
returns boolean
language plpgsql
stable
security definer
set search_path = citify, shared, public
as $$
declare
  v_role text;
  v_override boolean;
begin
  if citify.current_user_role() = 'super_admin' then
    return true;
  end if;

  v_role := (
    select g.operational_role
    from citify.iadmin_role_grants g
    where g.administration_id = target_admin_id
      and g.profile_id = citify.uid()
    limit 1
  );

  if v_role is null then
    return false;
  end if;

  v_override := (
    select rc.granted
    from citify.iadmin_role_capabilities rc
    where rc.administration_id = target_admin_id
      and rc.operational_role = v_role
      and rc.capability_code = target_capability
    limit 1
  );

  if v_override is not null then
    return v_override;
  end if;

  -- sin override explicito: permitimos por default (los presets aplican en TS).
  return true;
end;
$$;
