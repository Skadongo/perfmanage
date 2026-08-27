-- Performance optimization: add indexes for the most frequent query patterns
-- These indexes target the columns used in WHERE, JOIN, and ORDER BY clauses
-- across the dashboard, evaluation-reviews, staff-management, and analytics pages.

-- ─── mid_year_reviews ────────────────────────────────────────────────────────

-- Dashboard live stats: filter by staff_id (staff member scope)
CREATE INDEX IF NOT EXISTS idx_myr_staff_id
  ON public.mid_year_reviews (staff_id);

-- Dashboard live stats: filter by supervisor_id (supervisor scope)
CREATE INDEX IF NOT EXISTS idx_myr_supervisor_id
  ON public.mid_year_reviews (supervisor_id);

-- At-risk table & trend chart: filter by review_status
CREATE INDEX IF NOT EXISTS idx_myr_review_status
  ON public.mid_year_reviews (review_status);

-- Trend chart: order by created_at
CREATE INDEX IF NOT EXISTS idx_myr_created_at
  ON public.mid_year_reviews (created_at);

-- Composite: supervisor scope + status (most common combined filter)
CREATE INDEX IF NOT EXISTS idx_myr_supervisor_status
  ON public.mid_year_reviews (supervisor_id, review_status);

-- Composite: staff scope + status
CREATE INDEX IF NOT EXISTS idx_myr_staff_status
  ON public.mid_year_reviews (staff_id, review_status);

-- ─── workplan_settings ───────────────────────────────────────────────────────

-- Evaluation reviews: filter by status = 'signed'
CREATE INDEX IF NOT EXISTS idx_ws_status
  ON public.workplan_settings (status);

-- Composite: status + workflow_stage (stage counts query)
CREATE INDEX IF NOT EXISTS idx_ws_status_stage
  ON public.workplan_settings (status, workflow_stage);

-- Metric cards: filter by staff_id
CREATE INDEX IF NOT EXISTS idx_ws_staff_id
  ON public.workplan_settings (staff_id);

-- ─── staff ───────────────────────────────────────────────────────────────────

-- All pages: filter by employment_status = 'active'
CREATE INDEX IF NOT EXISTS idx_staff_employment_status
  ON public.staff (employment_status);

-- Supervisor scope queries: filter by supervisor_id
CREATE INDEX IF NOT EXISTS idx_staff_supervisor_id
  ON public.staff (supervisor_id);

-- Staff management: order by serial_number
CREATE INDEX IF NOT EXISTS idx_staff_serial_number
  ON public.staff (serial_number);

-- Composite: active staff by department (department view)
CREATE INDEX IF NOT EXISTS idx_staff_dept_status
  ON public.staff (department_id, employment_status);

-- ─── user_profiles ───────────────────────────────────────────────────────────

-- Auth context: lookup by id (primary key already indexed, but ensure system_role is fast)
CREATE INDEX IF NOT EXISTS idx_user_profiles_system_role
  ON public.user_profiles (system_role);

-- ─── activity_logs ───────────────────────────────────────────────────────────
-- Note: activity_logs uses actor_name (TEXT) — there is no user_id column.
-- The created_at index is already created in 20260325230000_activity_logs.sql;
-- IF NOT EXISTS ensures this is a safe no-op if it already exists.
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
  ON public.activity_logs (created_at DESC);
