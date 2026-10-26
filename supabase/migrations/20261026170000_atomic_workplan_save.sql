-- Migration: Atomic, self-healing workplan save
--
-- WHY: Saving a workplan from the browser required several fragile steps
-- (resolve staff link -> look up existing row -> INSERT or UPDATE) each of which
-- could fail independently (stale cached lookups, missing user_profiles.staff_id,
-- duplicate rows because there was no unique key, RLS refusing the write).
--
-- This migration:
--   1. Removes duplicate (staff_id, fiscal_year) rows (keeps the most recently updated)
--   2. Adds a UNIQUE index on (staff_id, fiscal_year)
--   3. Adds public.save_my_workplan(...) - ONE atomic call that:
--        * identifies the caller from auth.uid()
--        * self-heals user_profiles.staff_id (by email) when it is missing
--        * upserts the workplan for (staff, fiscal year)
--        * refuses to downgrade a signed/approved workplan back to draft
--        * returns the saved row id + status

-- 1. Remove duplicates (children first would be needed, so only dedupe rows with no dependants)
DO $$
DECLARE
  n INTEGER := 0;
BEGIN
  WITH ranked AS (
    SELECT
      ws.id,
      ROW_NUMBER() OVER (
        PARTITION BY ws.staff_id, ws.fiscal_year
        ORDER BY
          CASE WHEN ws.status IN ('signed', 'submitted', 'approved') THEN 0 ELSE 1 END,
          ws.updated_at DESC NULLS LAST,
          ws.created_at DESC NULLS LAST
      ) AS rn
    FROM public.workplan_settings ws
    WHERE ws.staff_id IS NOT NULL
  ),
  deletable AS (
    SELECT r.id
    FROM ranked r
    WHERE r.rn > 1
      AND NOT EXISTS (SELECT 1 FROM public.mid_year_reviews m WHERE m.workplan_id = r.id)
      AND NOT EXISTS (SELECT 1 FROM public.appraisal_drafts d WHERE d.workplan_id = r.id)
      AND NOT EXISTS (SELECT 1 FROM public.staff_kpi_review_drafts k WHERE k.workplan_id = r.id)
  )
  DELETE FROM public.workplan_settings w
  USING deletable x
  WHERE w.id = x.id;

  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Removed % duplicate workplan rows', n;
END $$;

-- 2. One workplan per staff member per fiscal year
CREATE UNIQUE INDEX IF NOT EXISTS uq_workplan_staff_fiscal_year
  ON public.workplan_settings (staff_id, fiscal_year)
  WHERE staff_id IS NOT NULL;

-- 3. Atomic save function
CREATE OR REPLACE FUNCTION public.save_my_workplan(
  p_fiscal_year TEXT,
  p_review_year INTEGER,
  p_perspectives_objectives JSONB,
  p_general_competencies JSONB,
  p_staff_signature TEXT,
  p_supervisor_id UUID,
  p_submit BOOLEAN
)
RETURNS TABLE (workplan_id UUID, workplan_status TEXT, resolved_staff_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_uid UUID := auth.uid();
  v_staff_id UUID;
  v_email TEXT;
  v_existing_id UUID;
  v_existing_status TEXT;
  v_now TIMESTAMPTZ := CURRENT_TIMESTAMP;
  v_status TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Resolve the staff record for the caller
  SELECT up.staff_id, up.email
    INTO v_staff_id, v_email
  FROM public.user_profiles up
  WHERE up.id = v_uid
  LIMIT 1;

  -- Self-heal: link by email when the profile has no staff link
  IF v_staff_id IS NULL THEN
    IF v_email IS NULL OR v_email = '' THEN
      SELECT au.email INTO v_email FROM auth.users au WHERE au.id = v_uid LIMIT 1;
    END IF;

    IF v_email IS NOT NULL AND v_email <> '' THEN
      SELECT s.id INTO v_staff_id
      FROM public.staff s
      WHERE lower(trim(s.email)) = lower(trim(v_email))
      ORDER BY s.created_at ASC
      LIMIT 1;

      IF v_staff_id IS NOT NULL THEN
        UPDATE public.user_profiles
           SET staff_id = v_staff_id
         WHERE id = v_uid AND staff_id IS NULL;
      END IF;
    END IF;
  END IF;

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Your login (%) is not linked to a staff record. Ask HR to add this email to the staff list.', COALESCE(v_email, 'unknown')
      USING ERRCODE = 'P0002';
  END IF;

  -- Existing workplan for this staff member + fiscal year
  SELECT w.id, w.status
    INTO v_existing_id, v_existing_status
  FROM public.workplan_settings w
  WHERE w.staff_id = v_staff_id AND w.fiscal_year = p_fiscal_year
  ORDER BY w.updated_at DESC NULLS LAST
  LIMIT 1;

  IF p_submit THEN
    v_status := 'signed';
  ELSE
    -- Autosave / draft must never downgrade a submitted workplan
    IF v_existing_status IN ('signed', 'submitted', 'approved') THEN
      workplan_id := v_existing_id;
      workplan_status := v_existing_status;
      resolved_staff_id := v_staff_id;
      RETURN NEXT;
      RETURN;
    END IF;
    v_status := 'draft';
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.workplan_settings w
       SET supervisor_id = COALESCE(p_supervisor_id, w.supervisor_id),
           review_year = p_review_year,
           perspectives_objectives = COALESCE(p_perspectives_objectives, '[]'::jsonb),
           general_competencies = COALESCE(p_general_competencies, '[]'::jsonb),
           staff_signature = COALESCE(p_staff_signature, ''),
           status = v_status,
           workflow_stage = CASE WHEN p_submit THEN 'workplan_pending' ELSE COALESCE(w.workflow_stage, 'workplan_pending') END,
           staff_signed_at = CASE WHEN p_submit THEN v_now ELSE w.staff_signed_at END,
           submitted_at = CASE WHEN p_submit THEN COALESCE(w.submitted_at, v_now) ELSE w.submitted_at END,
           review_type = CASE WHEN p_submit THEN 'annual' ELSE w.review_type END,
           updated_at = v_now
     WHERE w.id = v_existing_id;

    workplan_id := v_existing_id;
  ELSE
    INSERT INTO public.workplan_settings (
      staff_id, supervisor_id, fiscal_year, review_year,
      perspectives_objectives, general_competencies, staff_signature,
      status, workflow_stage, staff_signed_at, submitted_at, review_type,
      created_at, updated_at
    ) VALUES (
      v_staff_id, p_supervisor_id, p_fiscal_year, p_review_year,
      COALESCE(p_perspectives_objectives, '[]'::jsonb),
      COALESCE(p_general_competencies, '[]'::jsonb),
      COALESCE(p_staff_signature, ''),
      v_status, 'workplan_pending',
      CASE WHEN p_submit THEN v_now ELSE NULL END,
      CASE WHEN p_submit THEN v_now ELSE NULL END,
      'annual',
      v_now, v_now
    )
    RETURNING id INTO workplan_id;
  END IF;

  workplan_status := v_status;
  resolved_staff_id := v_staff_id;
  RETURN NEXT;
END;
$func$;

REVOKE ALL ON FUNCTION public.save_my_workplan(TEXT, INTEGER, JSONB, JSONB, TEXT, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_my_workplan(TEXT, INTEGER, JSONB, JSONB, TEXT, UUID, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';
