-- ============================================================================
-- ONE-SHOT WIPE v3 — NO ES UNA MIGRACIÓN ESTRUCTURAL
-- ============================================================================
-- v2 falló por columnas/nombres incorrectos. v3 usa nombres reales del schema:
--   iadmin_item_share_tokens.liquidation_item_id (no .liquidation_run_id)
--   building_announcements (no announcements)
--   building_announcement_reads (no announcement_reads)
--   building_admin_assignments (no consorcio_assignments)
--   building_complaints (no complaints)
-- Cada DELETE va en su propio EXCEPTION handler para tolerar diferencias de
-- schema entre prod y el repo.
-- ============================================================================

BEGIN;

DO $wipe$
DECLARE
  v_profile_id uuid;
  v_admin_ids uuid[];
  v_property_ids uuid[];
  v_building_ids uuid[];
  v_run_ids uuid[];
  v_item_ids uuid[];
  v_expense_ids uuid[];
  v_unit_ids uuid[];
  v_announcement_ids uuid[];
  v_complaint_case_ids uuid[];
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

  -- ─── 2. Administraciones del user (iadmin_role_grants) ──────────────────
  SELECT array_agg(administration_id) INTO v_admin_ids
    FROM public.iadmin_role_grants
   WHERE profile_id = v_profile_id;

  IF v_admin_ids IS NULL THEN
    RAISE NOTICE '[wipe] El profile no tiene role grants. Solo limpio building_id.';
    UPDATE public.profiles SET building_id = NULL WHERE id = v_profile_id;
    RETURN;
  END IF;
  RAISE NOTICE '[wipe] Administraciones: %', array_length(v_admin_ids, 1);

  -- ─── 3. Properties, buildings y conjuntos derivados ─────────────────────
  SELECT array_agg(id), array_agg(DISTINCT building_id) FILTER (WHERE building_id IS NOT NULL)
    INTO v_property_ids, v_building_ids
    FROM public.iadmin_managed_properties
   WHERE administration_id = ANY(v_admin_ids);

  v_property_ids := COALESCE(v_property_ids, ARRAY[]::uuid[]);
  v_building_ids := COALESCE(v_building_ids, ARRAY[]::uuid[]);
  RAISE NOTICE '[wipe] managed_properties: %, buildings: %',
    COALESCE(array_length(v_property_ids, 1), 0),
    COALESCE(array_length(v_building_ids, 1), 0);

  -- Pre-resolver IDs para evitar subqueries con joins que dependan de tablas opcionales
  SELECT array_agg(id) INTO v_run_ids
    FROM public.iadmin_liquidation_runs WHERE administration_id = ANY(v_admin_ids);
  v_run_ids := COALESCE(v_run_ids, ARRAY[]::uuid[]);

  SELECT array_agg(id) INTO v_item_ids
    FROM public.iadmin_liquidation_items WHERE liquidation_run_id = ANY(v_run_ids);
  v_item_ids := COALESCE(v_item_ids, ARRAY[]::uuid[]);

  SELECT array_agg(id) INTO v_expense_ids
    FROM public.iadmin_expenses WHERE administration_id = ANY(v_admin_ids);
  v_expense_ids := COALESCE(v_expense_ids, ARRAY[]::uuid[]);

  SELECT array_agg(id) INTO v_unit_ids
    FROM public.iadmin_units WHERE managed_property_id = ANY(v_property_ids);
  v_unit_ids := COALESCE(v_unit_ids, ARRAY[]::uuid[]);

  -- ─── 4. CAPA IADMIN (cada DELETE en su propio sub-block) ────────────────

  BEGIN
    DELETE FROM public.iadmin_audit_logs WHERE administration_id = ANY(v_admin_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_audit_logs: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] iadmin_audit_logs: SKIP (%)', SQLERRM;
  END;

  BEGIN
    DELETE FROM public.iadmin_notifications WHERE administration_id = ANY(v_admin_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_notifications: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] iadmin_notifications: SKIP (%)', SQLERRM;
  END;

  BEGIN
    DELETE FROM public.iadmin_item_share_tokens WHERE liquidation_item_id = ANY(v_item_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_item_share_tokens: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] iadmin_item_share_tokens: SKIP (%)', SQLERRM;
  END;

  BEGIN
    DELETE FROM public.iadmin_reminders WHERE administration_id = ANY(v_admin_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_reminders: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] iadmin_reminders: SKIP (%)', SQLERRM;
  END;

  BEGIN
    DELETE FROM public.iadmin_payments WHERE administration_id = ANY(v_admin_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_payments: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] iadmin_payments: SKIP (%)', SQLERRM;
  END;

  BEGIN
    DELETE FROM public.iadmin_bank_movements WHERE administration_id = ANY(v_admin_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_bank_movements: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] iadmin_bank_movements: SKIP (%)', SQLERRM;
  END;

  BEGIN
    DELETE FROM public.iadmin_liquidation_items WHERE id = ANY(v_item_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_liquidation_items: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] iadmin_liquidation_items: SKIP (%)', SQLERRM;
  END;

  BEGIN
    DELETE FROM public.iadmin_liquidation_runs WHERE id = ANY(v_run_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_liquidation_runs: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] iadmin_liquidation_runs: SKIP (%)', SQLERRM;
  END;

  BEGIN
    DELETE FROM public.iadmin_ai_document_extractions WHERE expense_id = ANY(v_expense_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_ai_document_extractions: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] iadmin_ai_document_extractions: SKIP (%)', SQLERRM;
  END;

  BEGIN
    DELETE FROM public.iadmin_expense_documents WHERE expense_id = ANY(v_expense_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_expense_documents: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] iadmin_expense_documents: SKIP (%)', SQLERRM;
  END;

  BEGIN
    DELETE FROM public.iadmin_expenses WHERE id = ANY(v_expense_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_expenses: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] iadmin_expenses: SKIP (%)', SQLERRM;
  END;

  BEGIN
    DELETE FROM public.iadmin_accounting_periods WHERE managed_property_id = ANY(v_property_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_accounting_periods: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] iadmin_accounting_periods: SKIP (%)', SQLERRM;
  END;

  BEGIN
    DELETE FROM public.iadmin_providers WHERE administration_id = ANY(v_admin_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_providers: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] iadmin_providers: SKIP (%)', SQLERRM;
  END;

  BEGIN
    DELETE FROM public.iadmin_cash_accounts WHERE managed_property_id = ANY(v_property_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_cash_accounts: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] iadmin_cash_accounts: SKIP (%)', SQLERRM;
  END;

  BEGIN
    DELETE FROM public.unit_profile_memberships WHERE unit_id = ANY(v_unit_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] unit_profile_memberships: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] unit_profile_memberships: SKIP (%)', SQLERRM;
  END;

  BEGIN
    DELETE FROM public.iadmin_unit_holders WHERE unit_id = ANY(v_unit_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_unit_holders: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] iadmin_unit_holders: SKIP (%)', SQLERRM;
  END;

  BEGIN
    DELETE FROM public.iadmin_units WHERE id = ANY(v_unit_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_units: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] iadmin_units: SKIP (%)', SQLERRM;
  END;

  BEGIN
    DELETE FROM public.iadmin_managed_properties WHERE id = ANY(v_property_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_managed_properties: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] iadmin_managed_properties: SKIP (%)', SQLERRM;
  END;

  -- ─── 5. CAPA BUILDING ───────────────────────────────────────────────────

  IF COALESCE(array_length(v_building_ids, 1), 0) > 0 THEN

    -- announcements (nuevo schema: building_announcements)
    BEGIN
      SELECT array_agg(id) INTO v_announcement_ids
        FROM public.building_announcements WHERE building_id = ANY(v_building_ids);
      v_announcement_ids := COALESCE(v_announcement_ids, ARRAY[]::uuid[]);
    EXCEPTION WHEN undefined_table THEN
      v_announcement_ids := ARRAY[]::uuid[];
    END;

    BEGIN
      DELETE FROM public.building_announcement_reads WHERE announcement_id = ANY(v_announcement_ids);
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] building_announcement_reads: %', v_deleted;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      RAISE NOTICE '[wipe] building_announcement_reads: SKIP (%)', SQLERRM;
    END;

    BEGIN
      DELETE FROM public.building_announcements WHERE id = ANY(v_announcement_ids);
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] building_announcements: %', v_deleted;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      RAISE NOTICE '[wipe] building_announcements: SKIP (%)', SQLERRM;
    END;

    -- complaint_cases (nuevo)
    BEGIN
      SELECT array_agg(id) INTO v_complaint_case_ids
        FROM public.complaint_cases WHERE building_id = ANY(v_building_ids);
      v_complaint_case_ids := COALESCE(v_complaint_case_ids, ARRAY[]::uuid[]);
    EXCEPTION WHEN undefined_table THEN
      v_complaint_case_ids := ARRAY[]::uuid[];
    END;

    BEGIN
      DELETE FROM public.complaint_case_events WHERE case_id = ANY(v_complaint_case_ids);
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] complaint_case_events: %', v_deleted;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      RAISE NOTICE '[wipe] complaint_case_events: SKIP (%)', SQLERRM;
    END;

    BEGIN
      DELETE FROM public.complaint_case_messages WHERE case_id = ANY(v_complaint_case_ids);
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] complaint_case_messages: %', v_deleted;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      RAISE NOTICE '[wipe] complaint_case_messages: SKIP (%)', SQLERRM;
    END;

    BEGIN
      DELETE FROM public.complaint_cases WHERE id = ANY(v_complaint_case_ids);
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] complaint_cases: %', v_deleted;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      RAISE NOTICE '[wipe] complaint_cases: SKIP (%)', SQLERRM;
    END;

    -- complaints legacy
    BEGIN
      DELETE FROM public.building_complaints WHERE building_id = ANY(v_building_ids);
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] building_complaints (legacy): %', v_deleted;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      RAISE NOTICE '[wipe] building_complaints: SKIP (%)', SQLERRM;
    END;

    BEGIN
      DELETE FROM public.building_information WHERE building_id = ANY(v_building_ids);
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] building_information: %', v_deleted;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      RAISE NOTICE '[wipe] building_information: SKIP (%)', SQLERRM;
    END;

    -- building_admin_assignments (NO consorcio_assignments)
    BEGIN
      DELETE FROM public.building_admin_assignments WHERE building_id = ANY(v_building_ids);
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] building_admin_assignments: %', v_deleted;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      RAISE NOTICE '[wipe] building_admin_assignments: SKIP (%)', SQLERRM;
    END;

    -- ─── 6. Profiles vecinos (NO el admin target) ────────────────────────
    BEGIN
      DELETE FROM public.profiles
       WHERE building_id = ANY(v_building_ids)
         AND id <> v_profile_id;
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] profiles vecinos borrados: %', v_deleted;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      RAISE NOTICE '[wipe] profiles vecinos: SKIP (%)', SQLERRM;
    END;

    -- ─── 7. Buildings ────────────────────────────────────────────────────
    BEGIN
      DELETE FROM public.buildings WHERE id = ANY(v_building_ids);
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] buildings: %', v_deleted;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      RAISE NOTICE '[wipe] buildings: SKIP (%)', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '[wipe] Sin buildings vinculados, skip capa building.';
  END IF;

  -- ─── 8. Limpiar building_id colgante en el admin ────────────────────────
  UPDATE public.profiles SET building_id = NULL WHERE id = v_profile_id AND building_id IS NOT NULL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted > 0 THEN
    RAISE NOTICE '[wipe] profile.building_id reseteado a NULL';
  END IF;

  -- ─── 9. Verificación final ──────────────────────────────────────────────
  SELECT count(*) INTO v_count FROM public.iadmin_managed_properties WHERE administration_id = ANY(v_admin_ids);
  RAISE NOTICE '[wipe] VERIFY: managed_properties restantes = % (esperado 0)', v_count;

  SELECT count(*) INTO v_count FROM public.iadmin_role_grants WHERE profile_id = v_profile_id;
  RAISE NOTICE '[wipe] VERIFY: role_grants conservados = %', v_count;

  RAISE NOTICE '[wipe] OK ✓';
END
$wipe$;

COMMIT;
