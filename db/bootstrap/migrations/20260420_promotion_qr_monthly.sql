-- GENERADO por scripts/db/build-schema.mjs desde db/migrations/20260420_promotion_qr_monthly.sql

delete from citify.promotion_redemptions pr
where exists (
  select 1
  from citify.promotion_redemptions newer
  where newer.profile_id = pr.profile_id
    and newer.promotion_id = pr.promotion_id
    and (
      newer.redeemed_at > pr.redeemed_at
      or (newer.redeemed_at = pr.redeemed_at and newer.created_at > pr.created_at)
      or (newer.redeemed_at = pr.redeemed_at and newer.created_at = pr.created_at and newer.id > pr.id)
    )
);

create unique index if not exists promotion_redemptions_profile_promotion_uidx
  on citify.promotion_redemptions (profile_id, promotion_id);

create table if not exists citify.promotion_redemption_tokens (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references shared.promotions(id) on delete cascade,
  profile_id uuid not null references citify.profiles(id) on delete cascade,
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'redeemed', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by_business_id uuid references shared.businesses(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists promotion_redemption_tokens_lookup_idx
  on citify.promotion_redemption_tokens (promotion_id, profile_id, status, expires_at desc);

create unique index if not exists promotion_redemption_tokens_pending_uidx
  on citify.promotion_redemption_tokens (promotion_id, profile_id)
  where status = 'pending';

create or replace function citify.generate_promotion_redemption_token()
returns text
language plpgsql
as $generate_token$
begin
  return upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
end;
$generate_token$;

create or replace function citify.create_promotion_redemption_token(target_promotion_id uuid)
returns table (
  id uuid,
  token text,
  qr_value text,
  expires_at timestamptz,
  promotion_id uuid,
  promotion_title text,
  business_name text
)
language plpgsql
security definer
set search_path = citify, shared, public
as $create_redemption_token$
declare
  current_profile citify.profiles%rowtype;
  promotion_row shared.promotions%rowtype;
  business_row shared.businesses%rowtype;
  existing_token citify.promotion_redemption_tokens%rowtype;
  created_token citify.promotion_redemption_tokens%rowtype;
begin
  select *
  into current_profile
  from citify.profiles p
  where p.id = citify.uid()
  limit 1;

  if current_profile.id is null then
    raise exception 'No se encontro el perfil autenticado.';
  end if;

  if current_profile.role not in ('vecino', 'super_admin') then
    raise exception 'Solo vecinos pueden solicitar cupones QR.';
  end if;

  select *
  into promotion_row
  from shared.promotions p
  where p.id = target_promotion_id
  limit 1;

  if promotion_row.id is null then
    raise exception 'La promocion no existe.';
  end if;

  if not promotion_row.is_active or promotion_row.expiration_date < current_date then
    raise exception 'La promocion ya no esta disponible.';
  end if;

  if promotion_row.building_id is not null and promotion_row.building_id <> current_profile.building_id and current_profile.role <> 'super_admin' then
    raise exception 'La promocion no esta disponible para tu edificio.';
  end if;

  if exists (
    select 1
    from citify.promotion_redemptions
    where profile_id = current_profile.id
      and promotion_id = promotion_row.id
  ) then
    raise exception 'Esta promocion ya fue usada por este vecino.';
  end if;

  update citify.promotion_redemption_tokens
  set status = 'expired'
  where profile_id = current_profile.id
    and promotion_id = promotion_row.id
    and status = 'pending'
    and expires_at <= now();

  select *
  into existing_token
  from citify.promotion_redemption_tokens
  where profile_id = current_profile.id
    and promotion_id = promotion_row.id
    and status = 'pending'
    and expires_at > now()
  order by created_at desc
  limit 1;

  select *
  into business_row
  from shared.businesses b
  where b.id = promotion_row.business_id
  limit 1;

  if existing_token.id is null then
    insert into citify.promotion_redemption_tokens (
      promotion_id,
      profile_id,
      token,
      expires_at
    )
    values (
      promotion_row.id,
      current_profile.id,
      citify.generate_promotion_redemption_token(),
      now() + interval '15 minutes'
    )
    returning *
    into created_token;
  else
    created_token := existing_token;
  end if;

  return query
  select
    created_token.id,
    created_token.token,
    'CITIFY:' || created_token.token,
    created_token.expires_at,
    promotion_row.id,
    promotion_row.title,
    coalesce(business_row.name, 'Comercio');
end;
$create_redemption_token$;

create or replace function citify.validate_promotion_redemption_token(raw_token text)
returns table (
  status text,
  message text,
  token_id uuid,
  promotion_id uuid,
  promotion_title text,
  neighbor_name text,
  redeemed_at timestamptz
)
language plpgsql
security definer
set search_path = citify, shared, public
as $validate_redemption_token$
declare
  v_normalized_token text;
  v_current_profile_id uuid;
  v_current_profile_role citify.app_role;
  v_current_profile_business_id uuid;
  v_token_id uuid;
  v_token_profile_id uuid;
  v_token_promotion_id uuid;
  v_token_status text;
  v_token_expires_at timestamptz;
  v_token_redeemed_at timestamptz;
  v_promotion_business_id uuid;
  v_promotion_title text;
  v_promotion_is_active boolean;
  v_promotion_expiration_date date;
  v_neighbor_full_name text;
  v_inserted_redemption_id uuid;
begin
  v_normalized_token := upper(trim(coalesce(raw_token, '')));
  if v_normalized_token like 'CITIFY:%' then
    v_normalized_token := substring(v_normalized_token from 8);
  end if;

  select p.id, p.role, p.business_id
  into v_current_profile_id, v_current_profile_role, v_current_profile_business_id
  from citify.profiles p
  where p.id = citify.uid()
  limit 1;

  if v_current_profile_id is null then
    return query select 'forbidden', 'No se encontro el perfil autenticado.', null::uuid, null::uuid, null::text, null::text, null::timestamptz;
    return;
  end if;

  if v_current_profile_role not in ('negocio_admin', 'super_admin') then
    return query select 'forbidden', 'Solo el negocio puede validar canjes.', null::uuid, null::uuid, null::text, null::text, null::timestamptz;
    return;
  end if;

  select
    t.id,
    t.profile_id,
    t.promotion_id,
    t.status,
    t.expires_at,
    t.redeemed_at
  into
    v_token_id,
    v_token_profile_id,
    v_token_promotion_id,
    v_token_status,
    v_token_expires_at,
    v_token_redeemed_at
  from citify.promotion_redemption_tokens t
  where t.token = v_normalized_token
  limit 1;

  if v_token_id is null then
    return query select 'not_found', 'No encontramos ese codigo.', null::uuid, null::uuid, null::text, null::text, null::timestamptz;
    return;
  end if;

  select p.business_id, p.title, p.is_active, p.expiration_date
  into v_promotion_business_id, v_promotion_title, v_promotion_is_active, v_promotion_expiration_date
  from shared.promotions p
  where p.id = v_token_promotion_id
  limit 1;

  select p.full_name
  into v_neighbor_full_name
  from citify.profiles p
  where p.id = v_token_profile_id
  limit 1;

  if v_current_profile_role = 'negocio_admin' and v_promotion_business_id <> v_current_profile_business_id then
    return query
    select
      'forbidden',
      'Ese codigo pertenece a otro negocio.',
      v_token_id,
      v_token_promotion_id,
      v_promotion_title,
      coalesce(v_neighbor_full_name, 'Vecino'),
      v_token_redeemed_at;
    return;
  end if;

  if exists (
    select 1
    from citify.promotion_redemptions pr
    where pr.profile_id = v_token_profile_id
      and pr.promotion_id = v_token_promotion_id
  ) or v_token_status = 'redeemed' then
    update citify.promotion_redemption_tokens t
    set status = 'redeemed',
        redeemed_at = coalesce(t.redeemed_at, now()),
        redeemed_by_business_id = coalesce(t.redeemed_by_business_id, v_promotion_business_id)
    where t.id = v_token_id;

    return query
    select
      'already_used',
      'Esta promocion ya habia sido canjeada por este vecino.',
      v_token_id,
      v_token_promotion_id,
      v_promotion_title,
      coalesce(v_neighbor_full_name, 'Vecino'),
      coalesce(v_token_redeemed_at, now());
    return;
  end if;

  if v_token_status <> 'pending' or v_token_expires_at <= now() then
    update citify.promotion_redemption_tokens t
    set status = 'expired'
    where t.id = v_token_id
      and t.status = 'pending';

    return query
    select
      'expired',
      'El codigo expiro. Pidele al vecino que vuelva a abrir el QR.',
      v_token_id,
      v_token_promotion_id,
      v_promotion_title,
      coalesce(v_neighbor_full_name, 'Vecino'),
      null::timestamptz;
    return;
  end if;

  if not v_promotion_is_active or v_promotion_expiration_date < current_date then
    return query
    select
      'promotion_unavailable',
      'La promocion ya no esta disponible para canje.',
      v_token_id,
      v_token_promotion_id,
      v_promotion_title,
      coalesce(v_neighbor_full_name, 'Vecino'),
      null::timestamptz;
    return;
  end if;

  insert into citify.promotion_redemptions (
    profile_id,
    promotion_id,
    status,
    redeemed_at,
    created_at
  )
  values (
    v_token_profile_id,
    v_token_promotion_id,
    'redeemed',
    now(),
    now()
  )
  on conflict (profile_id, promotion_id) do nothing
  returning id
  into v_inserted_redemption_id;

  if v_inserted_redemption_id is null then
    update citify.promotion_redemption_tokens t
    set status = 'redeemed',
        redeemed_at = coalesce(t.redeemed_at, now()),
        redeemed_by_business_id = coalesce(t.redeemed_by_business_id, v_promotion_business_id)
    where t.id = v_token_id;

    return query
    select
      'already_used',
      'Esta promocion ya habia sido canjeada por este vecino.',
      v_token_id,
      v_token_promotion_id,
      v_promotion_title,
      coalesce(v_neighbor_full_name, 'Vecino'),
      coalesce(v_token_redeemed_at, now());
    return;
  end if;

  update citify.promotion_redemption_tokens t
  set status = 'redeemed',
      redeemed_at = now(),
      redeemed_by_business_id = v_promotion_business_id
  where t.id = v_token_id;

  return query
  select
    'redeemed',
    'Canje validado correctamente.',
    v_token_id,
    v_token_promotion_id,
    v_promotion_title,
    coalesce(v_neighbor_full_name, 'Vecino'),
    now();
end;
$validate_redemption_token$;
