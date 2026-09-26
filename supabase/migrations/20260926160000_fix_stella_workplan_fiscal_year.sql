-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Fix workplan fiscal_year format mismatch + Stella Itungu visibility
--
-- ROOT CAUSE: workplan_settings.fiscal_year default is 'FY 2025-2026' but the
-- dashboard query was filtering with plain '2026' — causing Stella Itungu's
-- workplan (and others) to be invisible on the dashboard.
--
-- FIX:
--   1. Normalize any plain-year values (e.g. '2026') to 'FY YYYY-YYYY' format
--   2. Update the column default to match the canonical format
--   3. Add a diagnostic function for HR to inspect workplan data
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

-- 5. Refresh dashboard materialized views so the corrected data is reflected
SELECT public.refresh_dashboard_views();
