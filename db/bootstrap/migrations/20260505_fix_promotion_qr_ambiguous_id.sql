-- GENERADO por scripts/db/build-schema.mjs desde db/migrations/20260505_fix_promotion_qr_ambiguous_id.sql

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
  v_current_building_id uuid;
begin
  select *
  into current_profile
  from citify.profiles p
  where p.id = citify.uid()
  limit 1;

  if current_profile.id is null then
    raise exception 'No se encontro el perfil autenticado.';
  end if;

  if current_profile.role::text not in ('vecino', 'super_admin') then
    raise exception 'Solo vecinos pueden solicitar cupones QR.';
  end if;

  v_current_building_id := citify.current_user_building_id();

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

  if promotion_row.building_id is not null and promotion_row.building_id <> v_current_building_id and current_profile.role::text <> 'super_admin' then
    raise exception 'La promocion no esta disponible para tu edificio.';
  end if;

  if exists (
    select 1
    from citify.promotion_redemptions pr
    where pr.profile_id = current_profile.id
      and pr.promotion_id = promotion_row.id
  ) then
    raise exception 'Esta promocion ya fue usada por este vecino.';
  end if;

  update citify.promotion_redemption_tokens t
  set status = 'expired'
  where t.profile_id = current_profile.id
    and t.promotion_id = promotion_row.id
    and t.status = 'pending'
    and t.expires_at <= now();

  select *
  into existing_token
  from citify.promotion_redemption_tokens t
  where t.profile_id = current_profile.id
    and t.promotion_id = promotion_row.id
    and t.status = 'pending'
    and t.expires_at > now()
  order by t.created_at desc
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
