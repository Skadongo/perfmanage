-- Performance: Composite indexes for common query patterns
-- These indexes cover the most frequent filter combinations used in the app

-- mid_year_reviews: filter by staff + status + year (dashboard, evaluation-reviews)
CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_staff_status
  ON public.mid_year_reviews (staff_id, review_status);

CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_status_year
  ON public.mid_year_reviews (review_status, review_year);

CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_staff_year_status
  ON public.mid_year_reviews (staff_id, review_year, review_status);

-- workplan_settings: filter by staff + workflow_stage + status
CREATE INDEX IF NOT EXISTS idx_workplan_settings_staff_stage
  ON public.workplan_settings (staff_id, workflow_stage);

CREATE INDEX IF NOT EXISTS idx_workplan_settings_stage_status
  ON public.workplan_settings (workflow_stage, status);

-- staff: filter by employment_status + department (staff management, dashboard)
CREATE INDEX IF NOT EXISTS idx_staff_employment_dept
  ON public.staff (employment_status, department_id);

CREATE INDEX IF NOT EXISTS idx_staff_supervisor
  ON public.staff (supervisor_id);

-- user_profiles: filter by system_role (permissions, role checks)
CREATE INDEX IF NOT EXISTS idx_user_profiles_system_role
  ON public.user_profiles (system_role);

-- activity_logs: filter by user + created_at (audit trail)
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created
  ON public.activity_logs (user_id, created_at DESC);

-- Refresh materialized view if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'dashboard_stats'
  ) THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.dashboard_stats;
  END IF;
END $$;
