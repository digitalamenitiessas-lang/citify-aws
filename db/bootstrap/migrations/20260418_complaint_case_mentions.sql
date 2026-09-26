-- GENERADO por scripts/db/build-schema.mjs desde db/migrations/20260418_complaint_case_mentions.sql

create table if not exists citify.complaint_case_message_mentions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references citify.complaint_case_messages(id) on delete cascade,
  mentioned_profile_id uuid not null references citify.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (message_id, mentioned_profile_id)
);

create index if not exists complaint_case_message_mentions_message_idx
  on citify.complaint_case_message_mentions (message_id, created_at asc);

create or replace function citify.complaint_mention_label_for_profile(target_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = citify, shared, public
as $$
  select
    case
      when role = 'consorcio_admin' then 'Consorcio · ' || coalesce(full_name, 'Consorcio')
      when coalesce(floor, '') <> '' or coalesce(unit, '') <> '' then
        coalesce(full_name, 'Vecino') || ' (' || concat_ws(' - ', nullif(floor, ''), nullif(unit, '')) || ')'
      else coalesce(full_name, 'Vecino')
    end
  from citify.profiles
  where id = target_profile_id
  limit 1
$$;

create or replace function citify.complaint_case_can_access(target_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = citify, shared, public
as $$
  select exists (
    select 1
    from citify.complaint_cases cases
    where cases.id = target_case_id
      and (
        citify.current_user_role() = 'super_admin'
        or (
          citify.current_user_role() = 'vecino'
          and cases.building_id = citify.current_user_building_id()
        )
        or (
          citify.current_user_role() = 'consorcio_admin'
          and citify.user_has_building_access(cases.building_id)
        )
      )
  )
$$;

create or replace function citify.complaint_case_can_mention_profile(target_case_id uuid, target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = citify, shared, public
as $$
  with target_case as (
    select building_id
    from citify.complaint_cases
    where id = target_case_id
    limit 1
  ),
  target_profile as (
    select id, role, building_id
    from citify.profiles
    where id = target_profile_id
    limit 1
  )
  select exists (
    select 1
    from target_case
    join target_profile on true
    where (
      target_profile.role = 'vecino'
      and target_profile.building_id = target_case.building_id
    ) or (
      target_profile.role = 'consorcio_admin'
      and exists (
        select 1
        from citify.building_admin_assignments
        where profile_id = target_profile.id
          and building_id = target_case.building_id
      )
    )
  )
$$;

create or replace function citify.get_neighbor_complaint_cases(target_building_id uuid)
returns table (
  id uuid,
  case_code text,
  building_id uuid,
  building_name text,
  title text,
  description text,
  status citify.complaint_case_status,
  other_reason_text text,
  created_at timestamptz,
  updated_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  reasons jsonb,
  messages jsonb,
  events jsonb,
  can_reply boolean,
  can_change_status boolean
)
language sql
stable
security definer
set search_path = citify, shared, public
as $$
  select
    cases.id,
    cases.case_code,
    cases.building_id,
    buildings.name as building_name,
    cases.title,
    cases.description,
    cases.status,
    cases.other_reason_text,
    cases.created_at,
    cases.updated_at,
    cases.resolved_at,
    cases.closed_at,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', reasons.id,
          'slug', reasons.slug,
          'label', reasons.label,
          'is_other', reasons.is_other
        )
        order by reasons.label
      )
      from citify.complaint_case_reasons case_reasons
      join citify.complaint_reason_catalog reasons on reasons.id = case_reasons.reason_id
      where case_reasons.case_id = cases.id
    ), '[]'::jsonb) as reasons,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', messages.id,
          'case_id', messages.case_id,
          'message', messages.message,
          'message_type', messages.message_type,
          'author_label',
            case
              when profiles.role = 'consorcio_admin' then 'Consorcio'
              when profiles.role = 'super_admin' then 'Super admin'
              else 'Vecino del edificio'
            end,
          'author_role',
            case
              when profiles.role = 'consorcio_admin' then 'consorcio'
              when profiles.role = 'super_admin' then 'super_admin'
              else 'vecino'
            end,
          'created_at', messages.created_at,
          'mentions',
            coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', mentions.id,
                  'message_id', mentions.message_id,
                  'mentioned_profile_id', mentions.mentioned_profile_id,
                  'label', citify.complaint_mention_label_for_profile(mentions.mentioned_profile_id)
                )
                order by mentions.created_at asc
              )
              from citify.complaint_case_message_mentions mentions
              where mentions.message_id = messages.id
            ), '[]'::jsonb)
        )
        order by messages.created_at asc
      )
      from citify.complaint_case_messages messages
      join citify.profiles on profiles.id = messages.author_profile_id
      where messages.case_id = cases.id
    ), '[]'::jsonb) as messages,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', events.id,
          'case_id', events.case_id,
          'event_type', events.event_type,
          'actor_label',
            case
              when events.actor_role = 'vecino' then 'Vecino del edificio'
              when events.actor_role = 'consorcio' then 'Consorcio'
              when events.actor_role = 'super_admin' then 'Super admin'
              else events.actor_label
            end,
          'actor_role', events.actor_role,
          'summary', events.summary,
          'metadata', events.metadata,
          'created_at', events.created_at
        )
        order by events.created_at asc
      )
      from citify.complaint_case_events events
      where events.case_id = cases.id
    ), '[]'::jsonb) as events,
    cases.status <> 'cerrado' as can_reply,
    false as can_change_status
  from citify.complaint_cases cases
  join citify.buildings on buildings.id = cases.building_id
  where target_building_id = citify.current_user_building_id()
    and citify.current_user_role() in ('vecino', 'super_admin')
    and cases.building_id = target_building_id
  order by cases.updated_at desc, cases.created_at desc
$$;

create or replace function citify.post_complaint_case_message(
  target_case_id uuid,
  message_body text,
  message_kind citify.complaint_case_message_type default 'comment',
  mentioned_profile_ids uuid[] default '{}'::uuid[]
)
returns table (
  id uuid,
  case_id uuid,
  message text,
  message_type citify.complaint_case_message_type,
  author_label text,
  author_role citify.complaint_case_actor_role,
  mentions jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = citify, shared, public
as $$
declare
  target_building uuid;
  v_current_role citify.app_role;
  inserted_id uuid;
  actor_label text;
  actor_role citify.complaint_case_actor_role;
  valid_mention_ids uuid[];
begin
  select building_id
  into target_building
  from citify.complaint_cases
  where complaint_cases.id = target_case_id
    and status <> 'cerrado'
  limit 1;

  if target_building is null then
    raise exception 'El expediente no existe o esta cerrado.';
  end if;

  v_current_role := citify.current_user_role();

  if not (
    v_current_role = 'super_admin'
    or (v_current_role = 'vecino' and target_building = citify.current_user_building_id())
    or (v_current_role = 'consorcio_admin' and citify.user_has_building_access(target_building))
  ) then
    raise exception 'No tenes acceso para comentar en este expediente.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(mentioned_profile_ids, '{}'::uuid[])) as profile_id
    where not citify.complaint_case_can_mention_profile(target_case_id, profile_id)
  ) then
    raise exception 'Una o mas menciones no pertenecen al edificio o al consorcio asignado.';
  end if;

  select coalesce(array_agg(distinct profile_id), '{}'::uuid[])
  into valid_mention_ids
  from unnest(coalesce(mentioned_profile_ids, '{}'::uuid[])) as profile_id;

  insert into citify.complaint_case_messages (
    case_id,
    author_profile_id,
    message,
    message_type
  )
  values (
    target_case_id,
    citify.uid(),
    trim(message_body),
    message_kind
  )
  returning complaint_case_messages.id into inserted_id;

  insert into citify.complaint_case_message_mentions (message_id, mentioned_profile_id)
  select inserted_id, profile_id
  from unnest(valid_mention_ids) as profile_id
  on conflict do nothing;

  actor_role := citify.complaint_actor_role_for_profile(citify.uid());
  actor_label := case
    when v_current_role = 'vecino' then 'Vecino del edificio'
    when actor_role = 'consorcio' then 'Consorcio'
    when actor_role = 'super_admin' then 'Super admin'
    else citify.complaint_actor_label_for_profile(citify.uid())
  end;

  return query
  select
    inserted_id,
    target_case_id,
    trim(message_body),
    message_kind,
    actor_label,
    actor_role,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', mentions.id,
          'message_id', mentions.message_id,
          'mentioned_profile_id', mentions.mentioned_profile_id,
          'label', citify.complaint_mention_label_for_profile(mentions.mentioned_profile_id)
        )
        order by mentions.created_at asc
      )
      from citify.complaint_case_message_mentions mentions
      where mentions.message_id = inserted_id
    ), '[]'::jsonb),
    now();
end;
$$;
