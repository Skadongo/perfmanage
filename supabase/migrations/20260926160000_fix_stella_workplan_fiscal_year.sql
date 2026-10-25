-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Fix workplan fiscal_year format mismatch + Stella Itungu visibility
--            + Fix mv_dashboard_summary CONCURRENT refresh (unique index)
--
-- ROOT CAUSE 1: workplan_settings.fiscal_year default is 'FY 2025-2026' but the
-- dashboard query was filtering with plain '2026' — causing Stella Itungu's
-- workplan (and others) to be invisible on the dashboard.
--
-- ROOT CAUSE 2: REFRESH MATERIALIZED VIEW CONCURRENTLY requires a unique index
-- on real columns (not a constant expression). mv_dashboard_summary is a
-- single-row aggregate with no natural key, so we add an explicit `id` column
-- (integer literal 1) and index that real column.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Normalize plain integer fiscal_year values to 'FY YYYY-YYYY' format
--    e.g. '2026' → 'FY 2025-2026'  (fiscal year ending in that calendar year)
UPDATE public.workplan_settings
SET fiscal_year = 'FY ' || (fiscal_year::integer - 1)::text || '-' || fiscal_year
WHERE fiscal_year ~ '^\d{4}$';

-- 2. Ensure the column default matches canonical format
ALTER TABLE public.workplan_settings
  ALTER COLUMN fiscal_year SET DEFAULT 'FY 2025-2026';

-- 3. Add index on fiscal_year for fast dashboard filtering
CREATE INDEX IF NOT EXISTS idx_workplan_settings_fiscal_year
  ON public.workplan_settings (fiscal_year, staff_id);

-- 4. Diagnostic view: HR officers can query this to inspect workplan status per staff
CREATE OR REPLACE VIEW public.v_workplan_status_summary AS
SELECT
  s.full_name,
  s.job_title,
  ws.fiscal_year,
  ws.status,
  ws.workflow_stage,
  ws.submitted_at,
  ws.created_at,
  ws.updated_at,
  ws.id AS workplan_id,
  ws.staff_id
FROM public.workplan_settings ws
JOIN public.staff s ON s.id = ws.staff_id
ORDER BY s.full_name, ws.fiscal_year DESC;

-- Grant read access to authenticated users (HR officers)
GRANT SELECT ON public.v_workplan_status_summary TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Fix mv_dashboard_summary for CONCURRENT refresh
--    PostgreSQL requires a unique index on real columns (not constant expressions).
--    We drop the existing view and recreate it with an explicit integer `id` column.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop dependent objects first
DROP INDEX IF EXISTS public.mv_dashboard_summary_idx;
DROP MATERIALIZED VIEW IF EXISTS public.mv_dashboard_summary;

-- Recreate with explicit `id` column so we can build a real unique index
CREATE MATERIALIZED VIEW public.mv_dashboard_summary AS
SELECT
  1                                                               AS id,
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
FROM public.mid_year_reviews;

-- Unique index on the real `id` column — required for CONCURRENT refresh
CREATE UNIQUE INDEX mv_dashboard_summary_idx
  ON public.mv_dashboard_summary (id);

-- Restore read access
GRANT SELECT ON public.mv_dashboard_summary TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Ensure mv_staff_dashboard_summary unique index exists (staff_id is already
--    a real column — no change needed, just ensure the index is present)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS mv_staff_dashboard_summary_idx
  ON public.mv_staff_dashboard_summary (staff_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Refresh both materialized views (CONCURRENTLY now works with real unique indexes)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT public.refresh_dashboard_views();
