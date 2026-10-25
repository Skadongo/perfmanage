-- ============================================================
-- Wipe ALL workplan data (saved workplans + autosaved drafts)
-- so every workplan dashboard counter reads 0 and data capture
-- can start anew.
--
-- PRESERVED: staff, user_profiles, role_permissions, fiscal_years,
--            kpi_templates, workflow_stages, review_timelines
-- CLEARED  : workplan_settings, appraisal_drafts,
--            staff_kpi_review_drafts, mid_year_reviews (child of workplans),
--            workplan-related notifications and activity logs
-- ============================================================

DO $$
DECLARE
  n INTEGER;
BEGIN
  -- 1. Child tables first (they reference workplan_settings)
  DELETE FROM public.staff_kpi_review_drafts;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Deleted % staff_kpi_review_drafts rows', n;

  DELETE FROM public.appraisal_drafts;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Deleted % appraisal_drafts rows (autosaves)', n;

  DELETE FROM public.mid_year_reviews;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Deleted % mid_year_reviews rows', n;

  -- 2. Parent table: all saved workplans (any status / workflow stage)
  DELETE FROM public.workplan_settings;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Deleted % workplan_settings rows', n;

  -- 3. Notifications that point at workplans / reviews
  DELETE FROM public.notifications
  WHERE related_type IS NOT NULL
     OR type ILIKE '%workplan%'
     OR type ILIKE '%review%'
     OR type ILIKE '%approval%';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Deleted % notifications rows', n;

  -- 4. Activity feed entries about workplans / reviews
  DELETE FROM public.activity_logs
  WHERE activity_type IN (
    'workplan', 'evaluation', 'appraisal', 'mid_year_review', 'self_evaluation'
  )
  OR action_description ILIKE '%workplan%';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Deleted % activity_logs rows', n;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Workplan wipe failed: %', SQLERRM;
    RAISE;
END $$;

-- 5. Refresh dashboard materialized views so cached counts become 0
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_matviews
    WHERE schemaname = 'public' AND matviewname = 'mv_dashboard_summary'
  ) THEN
    REFRESH MATERIALIZED VIEW public.mv_dashboard_summary;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_matviews
    WHERE schemaname = 'public' AND matviewname = 'mv_staff_dashboard_summary'
  ) THEN
    REFRESH MATERIALIZED VIEW public.mv_staff_dashboard_summary;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Materialized view refresh skipped: %', SQLERRM;
END $$;

-- 6. Confirm everything is zero
DO $$
DECLARE
  wp INT;
  dr INT;
  kp INT;
  rv INT;
BEGIN
  SELECT COUNT(*) INTO wp FROM public.workplan_settings;
  SELECT COUNT(*) INTO dr FROM public.appraisal_drafts;
  SELECT COUNT(*) INTO kp FROM public.staff_kpi_review_drafts;
  SELECT COUNT(*) INTO rv FROM public.mid_year_reviews;
  RAISE NOTICE 'Remaining -> workplan_settings: %, appraisal_drafts: %, staff_kpi_review_drafts: %, mid_year_reviews: %',
    wp, dr, kp, rv;
END $$;
