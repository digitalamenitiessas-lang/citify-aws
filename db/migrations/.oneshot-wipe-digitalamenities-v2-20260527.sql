-- ============================================================================
-- ONE-SHOT WIPE v2 — NO ES UNA MIGRACIÓN ESTRUCTURAL
-- ============================================================================
-- v1 falló: la tabla se llama iadmin_role_grants, no iadmin_administration_members.
-- Resetea TODOS los datos operativos del admin digitalamenitiessas@gmail.com,
-- dejando solo su profile + sus administraciones (vacías) + role grants.
-- ============================================================================

BEGIN;

DO $wipe$
DECLARE
  v_profile_id uuid;
  v_admin_ids uuid[];
  v_property_ids uuid[];
  v_building_ids uuid[];
  v_deleted int;
  v_count int;
BEGIN
  -- ─── 1. Resolver profile target ──────────────────────────────────────────
  SELECT id INTO v_profile_id
    FROM public.profiles
   WHERE lower(email) = lower('digitalamenitiessas@gmail.com');

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile digitalamenitiessas@gmail.com no encontrado';
  END IF;
  RAISE NOTICE '[wipe] Profile target: %', v_profile_id;

  -- ─── 2. Administraciones del user (via iadmin_role_grants) ──────────────
  SELECT array_agg(administration_id) INTO v_admin_ids
    FROM public.iadmin_role_grants
   WHERE profile_id = v_profile_id;

  IF v_admin_ids IS NULL THEN
    RAISE NOTICE '[wipe] El profile no tiene role grants. Solo limpio building_id.';
    UPDATE public.profiles SET building_id = NULL WHERE id = v_profile_id;
    RETURN;
  END IF;
  RAISE NOTICE '[wipe] Administraciones: %', array_length(v_admin_ids, 1);

  -- ─── 3. Properties y buildings ──────────────────────────────────────────
  SELECT array_agg(id), array_agg(DISTINCT building_id) FILTER (WHERE building_id IS NOT NULL)
    INTO v_property_ids, v_building_ids
    FROM public.iadmin_managed_properties
   WHERE administration_id = ANY(v_admin_ids);

  v_property_ids := COALESCE(v_property_ids, ARRAY[]::uuid[]);
  v_building_ids := COALESCE(v_building_ids, ARRAY[]::uuid[]);
  RAISE NOTICE '[wipe] managed_properties: %, buildings: %',
    COALESCE(array_length(v_property_ids, 1), 0),
    COALESCE(array_length(v_building_ids, 1), 0);

  -- ─── 4. Capa iadmin ──────────────────────────────────────────────────────

  DELETE FROM public.iadmin_audit_logs WHERE administration_id = ANY(v_admin_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE '[wipe] iadmin_audit_logs: %', v_deleted;

  BEGIN
    DELETE FROM public.iadmin_notifications WHERE administration_id = ANY(v_admin_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_notifications: %', v_deleted;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE '[wipe] iadmin_notifications: SKIP';
  END;

  BEGIN
    DELETE FROM public.iadmin_item_share_tokens
     WHERE liquidation_run_id IN (
       SELECT id FROM public.iadmin_liquidation_runs WHERE administration_id = ANY(v_admin_ids)
     );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_item_share_tokens: %', v_deleted;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE '[wipe] iadmin_item_share_tokens: SKIP';
  END;

  DELETE FROM public.iadmin_reminders WHERE administration_id = ANY(v_admin_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE '[wipe] iadmin_reminders: %', v_deleted;

  DELETE FROM public.iadmin_payments WHERE administration_id = ANY(v_admin_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE '[wipe] iadmin_payments: %', v_deleted;

  DELETE FROM public.iadmin_bank_movements WHERE administration_id = ANY(v_admin_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE '[wipe] iadmin_bank_movements: %', v_deleted;

  DELETE FROM public.iadmin_liquidation_items
   WHERE liquidation_run_id IN (
     SELECT id FROM public.iadmin_liquidation_runs WHERE administration_id = ANY(v_admin_ids)
   );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE '[wipe] iadmin_liquidation_items: %', v_deleted;

  DELETE FROM public.iadmin_liquidation_runs WHERE administration_id = ANY(v_admin_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE '[wipe] iadmin_liquidation_runs: %', v_deleted;

  BEGIN
    DELETE FROM public.iadmin_ai_document_extractions
     WHERE expense_id IN (
       SELECT id FROM public.iadmin_expenses WHERE administration_id = ANY(v_admin_ids)
     );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_ai_document_extractions: %', v_deleted;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE '[wipe] iadmin_ai_document_extractions: SKIP';
  END;

  BEGIN
    DELETE FROM public.iadmin_expense_documents
     WHERE expense_id IN (
       SELECT id FROM public.iadmin_expenses WHERE administration_id = ANY(v_admin_ids)
     );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_expense_documents: %', v_deleted;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE '[wipe] iadmin_expense_documents: SKIP';
  END;

  DELETE FROM public.iadmin_expenses WHERE administration_id = ANY(v_admin_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE '[wipe] iadmin_expenses: %', v_deleted;

  DELETE FROM public.iadmin_accounting_periods WHERE managed_property_id = ANY(v_property_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE '[wipe] iadmin_accounting_periods: %', v_deleted;

  DELETE FROM public.iadmin_providers WHERE administration_id = ANY(v_admin_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE '[wipe] iadmin_providers: %', v_deleted;

  DELETE FROM public.iadmin_cash_accounts WHERE managed_property_id = ANY(v_property_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE '[wipe] iadmin_cash_accounts: %', v_deleted;

  BEGIN
    DELETE FROM public.unit_profile_memberships
     WHERE unit_id IN (SELECT id FROM public.iadmin_units WHERE managed_property_id = ANY(v_property_ids));
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] unit_profile_memberships: %', v_deleted;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE '[wipe] unit_profile_memberships: SKIP';
  END;

  DELETE FROM public.iadmin_unit_holders
   WHERE unit_id IN (SELECT id FROM public.iadmin_units WHERE managed_property_id = ANY(v_property_ids));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE '[wipe] iadmin_unit_holders: %', v_deleted;

  DELETE FROM public.iadmin_units WHERE managed_property_id = ANY(v_property_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE '[wipe] iadmin_units: %', v_deleted;

  DELETE FROM public.iadmin_managed_properties WHERE id = ANY(v_property_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE '[wipe] iadmin_managed_properties: %', v_deleted;

  -- ─── 5. Capa building ───────────────────────────────────────────────────

  IF COALESCE(array_length(v_building_ids, 1), 0) > 0 THEN

    BEGIN
      DELETE FROM public.announcement_reads
       WHERE announcement_id IN (
         SELECT id FROM public.announcements WHERE building_id = ANY(v_building_ids)
       );
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] announcement_reads: %', v_deleted;
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE '[wipe] announcement_reads: SKIP';
    END;

    BEGIN
      DELETE FROM public.announcements WHERE building_id = ANY(v_building_ids);
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] announcements: %', v_deleted;
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE '[wipe] announcements: SKIP';
    END;

    BEGIN
      DELETE FROM public.complaint_case_events
       WHERE case_id IN (SELECT id FROM public.complaint_cases WHERE building_id = ANY(v_building_ids));
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] complaint_case_events: %', v_deleted;
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE '[wipe] complaint_case_events: SKIP';
    END;

    BEGIN
      DELETE FROM public.complaint_case_messages
       WHERE case_id IN (SELECT id FROM public.complaint_cases WHERE building_id = ANY(v_building_ids));
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] complaint_case_messages: %', v_deleted;
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE '[wipe] complaint_case_messages: SKIP';
    END;

    BEGIN
      DELETE FROM public.complaint_cases WHERE building_id = ANY(v_building_ids);
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] complaint_cases: %', v_deleted;
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE '[wipe] complaint_cases: SKIP';
    END;

    BEGIN
      DELETE FROM public.complaints WHERE building_id = ANY(v_building_ids);
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] complaints (legacy): %', v_deleted;
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE '[wipe] complaints (legacy): SKIP';
    END;

    BEGIN
      DELETE FROM public.building_information WHERE building_id = ANY(v_building_ids);
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] building_information: %', v_deleted;
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE '[wipe] building_information: SKIP';
    END;

    BEGIN
      DELETE FROM public.consorcio_assignments WHERE building_id = ANY(v_building_ids);
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] consorcio_assignments: %', v_deleted;
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE '[wipe] consorcio_assignments: SKIP';
    END;

    -- Profiles vecinos (NO el admin target)
    DELETE FROM public.profiles
     WHERE building_id = ANY(v_building_ids)
       AND id <> v_profile_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] profiles vecinos borrados: %', v_deleted;

    -- Buildings
    DELETE FROM public.buildings WHERE id = ANY(v_building_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] buildings: %', v_deleted;
  ELSE
    RAISE NOTICE '[wipe] Sin buildings vinculados, skip capa building.';
  END IF;

  -- ─── 6. Limpiar building_id colgante en el admin ────────────────────────
  UPDATE public.profiles SET building_id = NULL WHERE id = v_profile_id AND building_id IS NOT NULL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted > 0 THEN
    RAISE NOTICE '[wipe] profile.building_id reseteado a NULL';
  END IF;

  -- ─── 7. Verificación ────────────────────────────────────────────────────
  SELECT count(*) INTO v_count FROM public.iadmin_managed_properties WHERE administration_id = ANY(v_admin_ids);
  RAISE NOTICE '[wipe] VERIFY: managed_properties restantes = % (esperado 0)', v_count;

  SELECT count(*) INTO v_count FROM public.iadmin_role_grants WHERE profile_id = v_profile_id;
  RAISE NOTICE '[wipe] VERIFY: role_grants conservados = %', v_count;

  RAISE NOTICE '[wipe] OK ✓';
END
$wipe$;

COMMIT;
