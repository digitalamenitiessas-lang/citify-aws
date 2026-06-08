-- ============================================================================
-- Fix: el trigger iadmin_mp_default_accounts (20260422) crea DOS cuentas de
-- caja activas ('Caja operativa' + 'Banco principal') al dar de alta una
-- propiedad. Pero 20260529 agregó el índice único parcial
-- iadmin_cash_accounts_one_active_per_property = solo UNA cuenta activa por
-- propiedad.
--
-- Resultado: desde el 29/05 toda creación de consorcio falla con
--   duplicate key value violates unique constraint
--   "iadmin_cash_accounts_one_active_per_property"
-- porque el segundo insert del trigger ('Banco principal' activa) viola el
-- índice y aborta toda la transacción del alta.
--
-- Fix: redefinir el trigger para que cree 'Caja operativa' como ACTIVA y
-- 'Banco principal' como INACTIVA. El admin puede completar los datos
-- bancarios y activarla luego desde Cuentas (lo que desactiva la caja).
-- Idempotente: create or replace + on conflict do nothing.
-- ============================================================================

create or replace function public.iadmin_create_default_cash_accounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.iadmin_cash_accounts (managed_property_id, name, kind, is_active, notes)
  values
    (new.id, 'Caja operativa', 'cash',  true,  'Cuenta creada automaticamente al dar de alta el consorcio.'),
    (new.id, 'Banco principal', 'bank', false, 'Cuenta creada automaticamente. Completa los datos bancarios y activala desde Cuentas.')
  on conflict (managed_property_id, name) do nothing;
  return new;
end;
$$;
