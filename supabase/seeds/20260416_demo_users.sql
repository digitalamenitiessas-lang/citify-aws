-- Demo seed for local/staging testing in Supabase
-- Run this after the main migration:
--   supabase/migrations/20260415_initial.sql
--
-- Test password for every seeded user:
--   Test1234!

create extension if not exists "pgcrypto";

do $$
declare
  torre_id uuid;
  central_id uuid;
  bistro_id uuid;
  tech_id uuid;
  super_admin_id uuid;
  negocio_admin_id uuid;
  consorcio_admin_id uuid;
  vecino_1_id uuid;
  vecino_2_id uuid;
begin
  insert into public.buildings (name, address, total_units)
  values
    ('Torre del Parque', 'Av. Libertador 1234, CABA', 120),
    ('Edificio Central', 'Calle Corrientes 500, CABA', 85)
  on conflict do nothing;

  select id into torre_id from public.buildings where name = 'Torre del Parque' limit 1;
  select id into central_id from public.buildings where name = 'Edificio Central' limit 1;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  select
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    seed.email,
    crypt('Test1234!', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', seed.full_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  from (
    values
      ('superadmin@citify.test', 'Super Admin CITIFY'),
      ('negocio@citify.test', 'Admin Negocio Demo'),
      ('consorcio@citify.test', 'Admin Consorcio Demo'),
      ('vecino1@citify.test', 'Vecina Demo Uno'),
      ('vecino2@citify.test', 'Vecino Demo Dos')
  ) as seed(email, full_name)
  where not exists (
    select 1
    from auth.users existing
    where lower(existing.email) = lower(seed.email)
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    created_at,
    updated_at,
    last_sign_in_at
  )
  select
    gen_random_uuid(),
    users.id,
    jsonb_build_object('sub', users.id::text, 'email', users.email),
    'email',
    users.email,
    now(),
    now(),
    now()
  from auth.users as users
  where users.email in (
    'superadmin@citify.test',
    'negocio@citify.test',
    'consorcio@citify.test',
    'vecino1@citify.test',
    'vecino2@citify.test'
  )
  on conflict (provider, provider_id) do nothing;

  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_text
  )
  select
    users.id,
    users.email,
    coalesce(users.raw_user_meta_data ->> 'full_name', split_part(users.email, '@', 1)),
    upper(left(coalesce(users.raw_user_meta_data ->> 'full_name', split_part(users.email, '@', 1), 'U'), 2))
  from auth.users as users
  where users.email in (
    'superadmin@citify.test',
    'negocio@citify.test',
    'consorcio@citify.test',
    'vecino1@citify.test',
    'vecino2@citify.test'
  )
  on conflict (id) do nothing;

  select id into super_admin_id from auth.users where email = 'superadmin@citify.test' limit 1;
  select id into negocio_admin_id from auth.users where email = 'negocio@citify.test' limit 1;
  select id into consorcio_admin_id from auth.users where email = 'consorcio@citify.test' limit 1;
  select id into vecino_1_id from auth.users where email = 'vecino1@citify.test' limit 1;
  select id into vecino_2_id from auth.users where email = 'vecino2@citify.test' limit 1;

  insert into public.businesses (name, category, description, owner_profile_id)
  values
    ('Urban Bistro', 'Gastronomia', 'Restaurante demo para pruebas de promociones y carga de imagenes.', negocio_admin_id),
    ('Tech Haven', 'Tecnologia', 'Comercio demo adicional para poblar la plataforma.', negocio_admin_id)
  on conflict do nothing;

  select id into bistro_id from public.businesses where name = 'Urban Bistro' limit 1;
  select id into tech_id from public.businesses where name = 'Tech Haven' limit 1;

  update public.businesses
  set owner_profile_id = negocio_admin_id
  where id in (bistro_id, tech_id);

  update public.profiles
  set
    full_name = 'Super Admin CITIFY',
    role = 'super_admin',
    avatar_text = 'SA'
  where id = super_admin_id;

  update public.profiles
  set
    full_name = 'Admin Negocio Demo',
    role = 'negocio_admin',
    avatar_text = 'ND',
    business_id = bistro_id
  where id = negocio_admin_id;

  update public.profiles
  set
    full_name = 'Admin Consorcio Demo',
    role = 'consorcio_admin',
    avatar_text = 'CD',
    building_id = torre_id
  where id = consorcio_admin_id;

  insert into public.building_admin_assignments (profile_id, building_id, is_primary)
  values
    (consorcio_admin_id, torre_id, true),
    (consorcio_admin_id, central_id, false)
  on conflict (profile_id, building_id) do update
  set is_primary = excluded.is_primary;

  update public.profiles
  set
    full_name = 'Vecina Demo Uno',
    role = 'vecino',
    avatar_text = 'V1',
    building_id = torre_id,
    floor = '4',
    unit = 'B',
    phone = '+54 11 4000-1001'
  where id = vecino_1_id;

  update public.profiles
  set
    full_name = 'Vecino Demo Dos',
    role = 'vecino',
    avatar_text = 'V2',
    building_id = central_id,
    floor = '7',
    unit = 'A',
    phone = '+54 11 4000-1002'
  where id = vecino_2_id;

  insert into public.promotions (
    business_id,
    building_id,
    title,
    description,
    discount,
    category,
    expiration_date,
    is_active
  )
  values
    (
      bistro_id,
      null,
      '20% en brunch de fin de semana',
      'Promocion general para probar la landing, el panel de negocio y la billetera de cupones.',
      '20%',
      'Gastronomia',
      current_date + interval '90 days',
      true
    ),
    (
      bistro_id,
      torre_id,
      '2x1 exclusivo Torre del Parque',
      'Promocion exclusiva para validar RLS por edificio y vista vecinal filtrada.',
      '2x1',
      'Gastronomia',
      current_date + interval '60 days',
      true
    ),
    (
      tech_id,
      null,
      '10% en accesorios',
      'Promocion secundaria para poblar la grilla publica y el panel super admin.',
      '10%',
      'Tecnologia',
      current_date + interval '120 days',
      true
    )
  on conflict do nothing;

  insert into public.marketplace_items (
    seller_profile_id,
    building_id,
    title,
    description,
    price,
    condition,
    is_active
  )
  values
    (
      vecino_1_id,
      torre_id,
      'Silla ergonomica demo',
      'Publicacion de prueba para validar marketplace e imagenes.',
      45000,
      'Como Nuevo',
      true
    )
  on conflict do nothing;
end
$$;

select
  email,
  role,
  full_name,
  building_id,
  business_id
from public.profiles
where email like '%@citify.test'
order by email;
