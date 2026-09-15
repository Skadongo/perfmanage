-- Workplan data loading optimization: indexes for fiscal_year, supervisor_id,
-- and composite role-scoped query patterns.
-- All indexes use IF NOT EXISTS so this migration is safe to re-run.

-- ─── workplan_settings: fiscal_year ──────────────────────────────────────────
-- Used by: tabbed/accordion view filtering by fiscal year
CREATE INDEX IF NOT EXISTS idx_ws_fiscal_year
  ON public.workplan_settings (fiscal_year);

-- ─── workplan_settings: supervisor_id ────────────────────────────────────────
-- Used by: supervisor role-scoped queries (direct reports only)
CREATE INDEX IF NOT EXISTS idx_ws_supervisor_id
  ON public.workplan_settings (supervisor_id);

-- ─── workplan_settings: user_id ──────────────────────────────────────────────
-- Used by: staff member own-workplan queries
CREATE INDEX IF NOT EXISTS idx_ws_user_id
  ON public.workplan_settings (user_id);

-- ─── Composite: fiscal_year + status ─────────────────────────────────────────
-- Used by: list view filtered by year AND status (most common combined filter)
CREATE INDEX IF NOT EXISTS idx_ws_fiscal_year_status
  ON public.workplan_settings (fiscal_year, status);

-- ─── Composite: fiscal_year + workflow_stage ─────────────────────────────────
-- Used by: accordion panels filtered by year AND stage
CREATE INDEX IF NOT EXISTS idx_ws_fiscal_year_stage
  ON public.workplan_settings (fiscal_year, workflow_stage);

-- ─── Composite: staff_id + fiscal_year ───────────────────────────────────────
-- Used by: staff member lazy-load of own workplan for a specific year
CREATE INDEX IF NOT EXISTS idx_ws_staff_fiscal_year
  ON public.workplan_settings (staff_id, fiscal_year);

-- ─── Composite: supervisor_id + fiscal_year ──────────────────────────────────
-- Used by: supervisor role-scoped queries filtered by year
CREATE INDEX IF NOT EXISTS idx_ws_supervisor_fiscal_year
  ON public.workplan_settings (supervisor_id, fiscal_year);

-- ─── Composite: supervisor_id + fiscal_year + status ─────────────────────────
-- Used by: supervisor dashboard — direct reports by year and status
CREATE INDEX IF NOT EXISTS idx_ws_supervisor_fiscal_status
  ON public.workplan_settings (supervisor_id, fiscal_year, status);

-- ─── workplan_settings: updated_at ───────────────────────────────────────────
-- Used by: ORDER BY updated_at DESC in list views
CREATE INDEX IF NOT EXISTS idx_ws_updated_at
  ON public.workplan_settings (updated_at DESC);
