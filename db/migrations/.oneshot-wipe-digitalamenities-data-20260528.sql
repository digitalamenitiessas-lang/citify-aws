-- ============================================================================
-- ONE-SHOT WIPE OPERATIVO — NO ES UNA MIGRACIÓN ESTRUCTURAL
-- ============================================================================
-- Resetea los DATOS INTERNOS que cargó el admin digitalamenitiessas@gmail.com
-- pero conserva:
--   • profile + role grants (iadmin_role_grants)
--   • iadmin_managed_properties (vínculo administración ↔ edificio)
--   • buildings y consorcio_assignments
--
-- Borra (si existen las tablas): unidades, holders, vecinos (profiles),
-- building_information, gastos, providers, liquidaciones, payments,
-- bank_movements, cash_accounts, accounting_periods, reminders,
-- notifications, audit_logs, anuncios y reclamos.
--
-- Cada DELETE va envuelto en BEGIN/EXCEPTION para no abortar la transacción
-- si una tabla o columna no existe en este entorno.
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
  SELECT array_agg(DISTINCT administration_id) INTO v_admin_ids
    FROM public.iadmin_role_grants
   WHERE profile_id = v_profile_id;

  IF v_admin_ids IS NULL THEN
    RAISE NOTICE '[wipe] El profile no tiene role_grants. Nada que limpiar.';
    RETURN;
  END IF;
  RAISE NOTICE '[wipe] Administraciones: %', array_length(v_admin_ids, 1);

  -- ─── 3. Properties y buildings vinculados (NO se borran) ────────────────
  SELECT array_agg(id), array_agg(DISTINCT building_id) FILTER (WHERE building_id IS NOT NULL)
    INTO v_property_ids, v_building_ids
    FROM public.iadmin_managed_properties
   WHERE administration_id = ANY(v_admin_ids);

  v_property_ids := COALESCE(v_property_ids, ARRAY[]::uuid[]);
  v_building_ids := COALESCE(v_building_ids, ARRAY[]::uuid[]);
  RAISE NOTICE '[wipe] managed_properties (conservadas): %, buildings (conservados): %',
    array_length(v_property_ids, 1), array_length(v_building_ids, 1);

  -- ─── 4. Capa iadmin ─────────────────────────────────────────────────────

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
    DELETE FROM public.iadmin_item_share_tokens
     WHERE liquidation_item_id IN (
       SELECT li.id
         FROM public.iadmin_liquidation_items li
         JOIN public.iadmin_liquidation_runs lr ON lr.id = li.liquidation_run_id
        WHERE lr.administration_id = ANY(v_admin_ids)
     );
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
    DELETE FROM public.iadmin_liquidation_items
     WHERE liquidation_run_id IN (
       SELECT id FROM public.iadmin_liquidation_runs WHERE administration_id = ANY(v_admin_ids)
     );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_liquidation_items: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] iadmin_liquidation_items: SKIP (%)', SQLERRM;
  END;

  BEGIN
    DELETE FROM public.iadmin_liquidation_runs WHERE administration_id = ANY(v_admin_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_liquidation_runs: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] iadmin_liquidation_runs: SKIP (%)', SQLERRM;
  END;

  BEGIN
    DELETE FROM public.iadmin_ai_document_extractions
     WHERE document_id IN (
       SELECT d.id
         FROM public.iadmin_expense_documents d
         JOIN public.iadmin_expenses e ON e.id = d.expense_id
        WHERE e.administration_id = ANY(v_admin_ids)
     );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_ai_document_extractions: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] iadmin_ai_document_extractions: SKIP (%)', SQLERRM;
  END;

  BEGIN
    DELETE FROM public.iadmin_expense_documents
     WHERE expense_id IN (
       SELECT id FROM public.iadmin_expenses WHERE administration_id = ANY(v_admin_ids)
     );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_expense_documents: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] iadmin_expense_documents: SKIP (%)', SQLERRM;
  END;

  BEGIN
    DELETE FROM public.iadmin_expenses WHERE administration_id = ANY(v_admin_ids);
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
    DELETE FROM public.unit_profile_memberships
     WHERE unit_id IN (SELECT id FROM public.iadmin_units WHERE managed_property_id = ANY(v_property_ids));
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] unit_profile_memberships: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] unit_profile_memberships: SKIP (%)', SQLERRM;
  END;

  BEGIN
    DELETE FROM public.iadmin_unit_holders
     WHERE unit_id IN (SELECT id FROM public.iadmin_units WHERE managed_property_id = ANY(v_property_ids));
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_unit_holders: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] iadmin_unit_holders: SKIP (%)', SQLERRM;
  END;

  BEGIN
    DELETE FROM public.iadmin_units WHERE managed_property_id = ANY(v_property_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_units: %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] iadmin_units: SKIP (%)', SQLERRM;
  END;

  -- Reset suave: NO borramos managed_properties (vínculo admin ↔ edificio).
  BEGIN
    UPDATE public.iadmin_managed_properties
       SET legal_info = '{}'::jsonb,
           operational_settings = '{}'::jsonb,
           notes = NULL
     WHERE id = ANY(v_property_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[wipe] iadmin_managed_properties (reset campos editables): %', v_deleted;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    RAISE NOTICE '[wipe] iadmin_managed_properties UPDATE: SKIP (%)', SQLERRM;
  END;

  -- ─── 5. Capa building (info, anuncios, reclamos, vecinos) ───────────────
  IF array_length(v_building_ids, 1) > 0 THEN

    BEGIN
      DELETE FROM public.building_announcement_reads
       WHERE announcement_id IN (
         SELECT id FROM public.building_announcements WHERE building_id = ANY(v_building_ids)
       );
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] building_announcement_reads: %', v_deleted;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      RAISE NOTICE '[wipe] building_announcement_reads: SKIP (%)', SQLERRM;
    END;

    BEGIN
      DELETE FROM public.building_announcements WHERE building_id = ANY(v_building_ids);
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] building_announcements: %', v_deleted;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      RAISE NOTICE '[wipe] building_announcements: SKIP (%)', SQLERRM;
    END;

    BEGIN
      DELETE FROM public.complaint_case_message_mentions
       WHERE message_id IN (
         SELECT m.id FROM public.complaint_case_messages m
           JOIN public.complaint_cases c ON c.id = m.case_id
          WHERE c.building_id = ANY(v_building_ids)
       );
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] complaint_case_message_mentions: %', v_deleted;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      RAISE NOTICE '[wipe] complaint_case_message_mentions: SKIP (%)', SQLERRM;
    END;

    BEGIN
      DELETE FROM public.complaint_case_events
       WHERE case_id IN (SELECT id FROM public.complaint_cases WHERE building_id = ANY(v_building_ids));
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] complaint_case_events: %', v_deleted;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      RAISE NOTICE '[wipe] complaint_case_events: SKIP (%)', SQLERRM;
    END;

    BEGIN
      DELETE FROM public.complaint_case_messages
       WHERE case_id IN (SELECT id FROM public.complaint_cases WHERE building_id = ANY(v_building_ids));
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] complaint_case_messages: %', v_deleted;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      RAISE NOTICE '[wipe] complaint_case_messages: SKIP (%)', SQLERRM;
    END;

    BEGIN
      DELETE FROM public.complaint_case_reasons
       WHERE case_id IN (SELECT id FROM public.complaint_cases WHERE building_id = ANY(v_building_ids));
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] complaint_case_reasons: %', v_deleted;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      RAISE NOTICE '[wipe] complaint_case_reasons: SKIP (%)', SQLERRM;
    END;

    BEGIN
      DELETE FROM public.complaint_cases WHERE building_id = ANY(v_building_ids);
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] complaint_cases: %', v_deleted;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      RAISE NOTICE '[wipe] complaint_cases: SKIP (%)', SQLERRM;
    END;

    BEGIN
      DELETE FROM public.building_complaints WHERE building_id = ANY(v_building_ids);
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] building_complaints (legacy): %', v_deleted;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      RAISE NOTICE '[wipe] building_complaints (legacy): SKIP (%)', SQLERRM;
    END;

    BEGIN
      DELETE FROM public.building_information WHERE building_id = ANY(v_building_ids);
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] building_information: %', v_deleted;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      RAISE NOTICE '[wipe] building_information: SKIP (%)', SQLERRM;
    END;

    -- Vecinos (todo profile vinculado al building, excepto el admin target)
    BEGIN
      DELETE FROM public.profiles
       WHERE building_id = ANY(v_building_ids)
         AND id <> v_profile_id;
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      RAISE NOTICE '[wipe] profiles vecinos borrados: %', v_deleted;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      RAISE NOTICE '[wipe] profiles vecinos: SKIP (%)', SQLERRM;
    END;

    -- NOTA: NO borramos buildings ni consorcio_assignments.
  ELSE
    RAISE NOTICE '[wipe] Sin buildings vinculados, skipping capa building.';
  END IF;

  -- ─── 6. Verificación final ──────────────────────────────────────────────
  SELECT count(*) INTO v_count FROM public.iadmin_managed_properties WHERE administration_id = ANY(v_admin_ids);
  RAISE NOTICE '[wipe] VERIFY: managed_properties conservadas = % (esperado > 0)', v_count;

  SELECT count(*) INTO v_count FROM public.buildings WHERE id = ANY(v_building_ids);
  RAISE NOTICE '[wipe] VERIFY: buildings conservados = % (esperado > 0)', v_count;

  SELECT count(*) INTO v_count FROM public.iadmin_role_grants WHERE profile_id = v_profile_id;
  RAISE NOTICE '[wipe] VERIFY: role_grants del admin = % (esperado > 0)', v_count;

  SELECT count(*) INTO v_count FROM public.iadmin_units WHERE managed_property_id = ANY(v_property_ids);
  RAISE NOTICE '[wipe] VERIFY: iadmin_units restantes = % (esperado 0)', v_count;

  RAISE NOTICE '[wipe] OK ✓';
END
$wipe$;

COMMIT;
