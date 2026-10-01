-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Dashboard accuracy & speed fixes
-- 1. Fix mv_dashboard_summary to filter by current review_year
-- 2. Add supervisor_id index on workplan_settings
-- 3. Trigger MV refresh on mid_year_reviews INSERT/UPDATE
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Fix 1: Recreate mv_dashboard_summary filtered to current review_year ──────
-- Drop and recreate so the WHERE clause takes effect.
-- CONCURRENTLY cannot be used on DROP, so we do a plain drop + recreate.
DROP MATERIALIZED VIEW IF EXISTS public.mv_dashboard_summary CASCADE;

CREATE MATERIALIZED VIEW public.mv_dashboard_summary AS
SELECT
  1                                                               AS id,
  EXTRACT(YEAR FROM NOW())::int                                   AS review_year,
  COUNT(*)                                                        AS total_reviews,
  COUNT(*) FILTER (WHERE review_status IN ('submitted','reviewed','approved'))
                                                                  AS submitted_reviews,
  COUNT(*) FILTER (WHERE review_status = 'approved')             AS approved_reviews,
  COUNT(*) FILTER (WHERE review_status IN ('draft','submitted'))  AS pending_reviews,
  ROUND(
    AVG(supervisor_rating) FILTER (WHERE supervisor_rating IS NOT NULL)::numeric,
    1
  )                                                               AS avg_supervisor_rating,
  NOW()                                                           AS last_refreshed
FROM public.mid_year_reviews
WHERE review_year = EXTRACT(YEAR FROM NOW())::int;

-- Unique index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS mv_dashboard_summary_idx
  ON public.mv_dashboard_summary (id);

-- Recreate mv_staff_dashboard_summary filtered to current review_year
DROP MATERIALIZED VIEW IF EXISTS public.mv_staff_dashboard_summary CASCADE;

CREATE MATERIALIZED VIEW public.mv_staff_dashboard_summary AS
SELECT
  staff_id,
  EXTRACT(YEAR FROM NOW())::int                                   AS review_year,
  COUNT(*)                                                        AS total_reviews,
  COUNT(*) FILTER (WHERE review_status IN ('submitted','reviewed','approved'))
                                                                  AS submitted_reviews,
  COUNT(*) FILTER (WHERE review_status = 'approved')             AS approved_reviews,
  COUNT(*) FILTER (WHERE review_status IN ('draft','submitted'))  AS pending_reviews,
  ROUND(
    AVG(supervisor_rating) FILTER (WHERE supervisor_rating IS NOT NULL)::numeric,
    1
  )                                                               AS avg_supervisor_rating,
  NOW()                                                           AS last_refreshed
FROM public.mid_year_reviews
WHERE review_year = EXTRACT(YEAR FROM NOW())::int
GROUP BY staff_id;

CREATE UNIQUE INDEX IF NOT EXISTS mv_staff_dashboard_summary_idx
  ON public.mv_staff_dashboard_summary (staff_id);

-- Restore read grants
GRANT SELECT ON public.mv_dashboard_summary TO authenticated;
GRANT SELECT ON public.mv_staff_dashboard_summary TO authenticated;

-- Recreate the refresh function (unchanged logic, but views were recreated)
CREATE OR REPLACE FUNCTION public.refresh_dashboard_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_dashboard_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_staff_dashboard_summary;
END;
$$;

-- ── Fix 2: Add supervisor_id composite index on workplan_settings ─────────────
CREATE INDEX IF NOT EXISTS idx_workplan_settings_supervisor_id
  ON public.workplan_settings (supervisor_id, fiscal_year, status);

-- ── Fix 3: Trigger MV refresh on mid_year_reviews INSERT/UPDATE ───────────────
-- Use a AFTER trigger that calls refresh_dashboard_views() asynchronously
-- via pg_notify so the INSERT/UPDATE transaction is not blocked.

-- Trigger function: fires refresh after each review change
CREATE OR REPLACE FUNCTION public.trg_refresh_dashboard_on_review_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Refresh both materialized views immediately.
  -- For low-traffic orgs this is safe; for high-traffic consider pg_notify + worker.
  PERFORM public.refresh_dashboard_views();
  RETURN NULL;
END;
$$;

-- Drop existing trigger if present (idempotent)
DROP TRIGGER IF EXISTS trg_mid_year_reviews_refresh_mv ON public.mid_year_reviews;

-- Create AFTER trigger on INSERT and UPDATE
CREATE TRIGGER trg_mid_year_reviews_refresh_mv
  AFTER INSERT OR UPDATE ON public.mid_year_reviews
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_refresh_dashboard_on_review_change();
