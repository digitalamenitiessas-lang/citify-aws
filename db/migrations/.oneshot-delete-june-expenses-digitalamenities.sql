-- One-shot: borra los gastos de 06/2026 del admin de consorcio
-- digitalamenitiessas@gmail.com (para hacer una prueba limpia de "repetir
-- gastos del mes anterior").
--
-- Las tablas dependientes referencian iadmin_expenses con FK
-- on delete cascade / on delete set null, así que el delete se limpia solo.
--
-- Ejecutar desde un entorno con acceso a la BD (VPC / bastion / psql).
-- Está envuelto en una transacción: revisá el SELECT de preview y, si está
-- bien, dejá el COMMIT. Para abortar, cambiá COMMIT por ROLLBACK.

begin;

-- CTE con los ids a borrar: gastos del período 06/2026 cuyo administration_id
-- pertenece al admin con ese email (vía iadmin_role_grants).
create temporary table _june_expense_ids on commit drop as
  select e.id
    from public.iadmin_expenses e
    inner join public.iadmin_accounting_periods ap on ap.id = e.accounting_period_id
    inner join public.iadmin_administrations a on a.id = e.administration_id
    inner join public.iadmin_role_grants g on g.administration_id = a.id
    inner join public.profiles p on p.id = g.profile_id
   where lower(p.email) = lower('digitalamenitiessas@gmail.com')
     and ap.period_year = 2026
     and ap.period_month = 6;

-- Preview: qué se va a borrar.
select e.id,
       e.description,
       e.amount,
       e.currency,
       e.status,
       e.expense_kind,
       e.managed_property_id
  from public.iadmin_expenses e
 where e.id in (select id from _june_expense_ids)
 order by e.managed_property_id, e.created_at asc;

-- Borrado.
delete from public.iadmin_expenses
 where id in (select id from _june_expense_ids);

-- Si el preview y el row count del DELETE son correctos, confirmá:
commit;
-- Para abortar en su lugar: rollback;
