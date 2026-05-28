-- ============================================================================
-- DIAGNÓSTICO — NO MODIFICA NADA
-- ============================================================================
-- Lista qué tiene asignado digitalamenitiessas@gmail.com:
-- profiles, role_grants, building_admin_assignments, managed_properties.
-- Útil para entender por qué no ve un edificio que se asignó desde superadmin.
-- ============================================================================

DO $diag$
DECLARE
  v_profile_id uuid;
  v_email text := 'digitalamenitiessas@gmail.com';
  r record;
  v_count int;
BEGIN
  RAISE NOTICE '[diag] Buscando profile: %', v_email;

  SELECT id INTO v_profile_id
    FROM public.profiles
   WHERE lower(email) = lower(v_email);

  IF v_profile_id IS NULL THEN
    RAISE NOTICE '[diag] ❌ Profile NO ENCONTRADO con email %', v_email;
    -- Buscar emails parecidos
    RAISE NOTICE '[diag] Buscando emails similares (LIKE %%digitalamenities%%)...';
    FOR r IN
      SELECT id, email, full_name, role
        FROM public.profiles
       WHERE lower(email) LIKE '%digitalamenities%'
       LIMIT 10
    LOOP
      RAISE NOTICE '[diag]   sim: % | % | % | %', r.id, r.email, r.full_name, r.role;
    END LOOP;
    RETURN;
  END IF;

  -- Datos del profile
  FOR r IN
    SELECT id, email, full_name, role, building_id, created_at::text
      FROM public.profiles
     WHERE id = v_profile_id
  LOOP
    RAISE NOTICE '[diag] Profile:';
    RAISE NOTICE '[diag]   id:        %', r.id;
    RAISE NOTICE '[diag]   email:     %', r.email;
    RAISE NOTICE '[diag]   full_name: %', r.full_name;
    RAISE NOTICE '[diag]   role:      %', r.role;
    RAISE NOTICE '[diag]   building:  %', COALESCE(r.building_id::text, '(none)');
    RAISE NOTICE '[diag]   created:   %', r.created_at;
  END LOOP;

  -- role_grants
  SELECT count(*) INTO v_count FROM public.iadmin_role_grants WHERE profile_id = v_profile_id;
  RAISE NOTICE '[diag] iadmin_role_grants count: %', v_count;
  FOR r IN
    SELECT g.administration_id,
           g.operational_role,
           g.is_primary,
           a.name AS admin_name,
           a.is_active AS admin_is_active
      FROM public.iadmin_role_grants g
      LEFT JOIN public.iadmin_administrations a ON a.id = g.administration_id
     WHERE g.profile_id = v_profile_id
     ORDER BY g.created_at
  LOOP
    RAISE NOTICE '[diag]   grant: admin=% (%) role=% primary=% active=%',
      r.admin_name, r.administration_id, r.operational_role, r.is_primary, r.admin_is_active;
  END LOOP;

  -- building_admin_assignments
  SELECT count(*) INTO v_count FROM public.building_admin_assignments WHERE profile_id = v_profile_id;
  RAISE NOTICE '[diag] building_admin_assignments count: %', v_count;
  FOR r IN
    SELECT baa.building_id,
           baa.is_primary,
           b.name AS building_name,
           b.address AS building_address
      FROM public.building_admin_assignments baa
      LEFT JOIN public.buildings b ON b.id = baa.building_id
     WHERE baa.profile_id = v_profile_id
     ORDER BY baa.created_at
  LOOP
    RAISE NOTICE '[diag]   assignment: % @ % (id=%, primary=%)',
      r.building_name, r.building_address, r.building_id, r.is_primary;
  END LOOP;

  -- managed_properties de las administraciones del user
  RAISE NOTICE '[diag] managed_properties accesibles via role_grants:';
  v_count := 0;
  FOR r IN
    SELECT mp.id AS property_id,
           mp.display_name,
           mp.building_id,
           b.name AS building_name,
           b.address AS building_address,
           mp.is_active
      FROM public.iadmin_managed_properties mp
      INNER JOIN public.iadmin_role_grants g ON g.administration_id = mp.administration_id
      LEFT JOIN public.buildings b ON b.id = mp.building_id
     WHERE g.profile_id = v_profile_id
     ORDER BY mp.created_at
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '[diag]   property: % (id=%) bldg=% [%] active=%',
      COALESCE(r.display_name, r.building_name), r.property_id,
      r.building_name, r.building_id, r.is_active;
  END LOOP;
  IF v_count = 0 THEN
    RAISE NOTICE '[diag]   (ninguna)';
  END IF;

  RAISE NOTICE '[diag] OK ✓';
END
$diag$;
