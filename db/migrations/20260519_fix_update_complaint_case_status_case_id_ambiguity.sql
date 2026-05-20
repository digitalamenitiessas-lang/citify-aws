-- Fix "column reference 'case_id' is ambiguous" in
-- update_complaint_case_status: the OUT column case_id from RETURNS TABLE
-- shadowed the complaint_case_events.case_id reference inside the lateral
-- subquery. Qualify the event column explicitly.
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
    select ev.summary, ev.created_at
    from public.complaint_case_events ev
    where ev.case_id = cases.id
    order by ev.created_at desc
    limit 1
  ) events on true
  where cases.id = target_case_id;
end;
$$;
