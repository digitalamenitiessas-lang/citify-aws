-- Fix "column reference 'resolved_at' is ambiguous" when consorcio admins
-- change a complaint case status. The original function declared
-- resolved_at / closed_at as OUT columns via RETURNS TABLE, which shadowed
-- the table columns inside the UPDATE ... SET expressions. Alias the target
-- table so the RHS references are unambiguous.
create or replace function public.update_complaint_case_status(
  target_case_id uuid,
  next_status public.complaint_case_status
)
returns table (
  case_id uuid,
  status public.complaint_case_status,
  updated_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  latest_event_summary text,
  latest_event_created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_building uuid;
begin
  select building_id
  into target_building
  from public.complaint_cases
  where complaint_cases.id = target_case_id
  limit 1;

  if target_building is null then
    raise exception 'Expediente no encontrado.';
  end if;

  if not (
    public.current_user_role() = 'super_admin'
    or (
      public.current_user_role() = 'consorcio_admin'
      and public.user_has_building_access(target_building)
    )
  ) then
    raise exception 'No tenes permisos para cambiar el estado.';
  end if;

  update public.complaint_cases as cc
  set
    status = next_status,
    resolved_at = case
      when next_status = 'resuelto' then coalesce(cc.resolved_at, now())
      when next_status <> 'resuelto' then null
      else cc.resolved_at
    end,
    closed_at = case
      when next_status = 'cerrado' then coalesce(cc.closed_at, now())
      when next_status <> 'cerrado' then null
      else cc.closed_at
    end
  where cc.id = target_case_id;

  return query
  select
    cases.id,
    cases.status,
    cases.updated_at,
    cases.resolved_at,
    cases.closed_at,
    events.summary,
    events.created_at
  from public.complaint_cases cases
  left join lateral (
    select summary, created_at
    from public.complaint_case_events
    where case_id = cases.id
    order by created_at desc
    limit 1
  ) events on true
  where cases.id = target_case_id;
end;
$$;
