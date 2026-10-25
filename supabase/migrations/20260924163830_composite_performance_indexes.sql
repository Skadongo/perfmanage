-- ============================================================
-- Migration: Composite indexes for performance optimization
-- Targets: most-filtered columns across key tables
-- ============================================================

-- mid_year_reviews: most common filter combinations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mid_year_reviews_staff_status
  ON public.mid_year_reviews (staff_id, review_status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mid_year_reviews_supervisor_status
  ON public.mid_year_reviews (supervisor_id, review_status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mid_year_reviews_status_year
  ON public.mid_year_reviews (review_status, review_year);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mid_year_reviews_staff_year
  ON public.mid_year_reviews (staff_id, review_year);

-- workplan_settings: workflow stage + staff lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workplan_settings_staff_stage
  ON public.workplan_settings (staff_id, workflow_stage);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workplan_settings_status_stage
  ON public.workplan_settings (status, workflow_stage);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workplan_settings_fiscal_year
  ON public.workplan_settings (staff_id, fiscal_year);

-- staff: supervisor + employment status (used in every dashboard query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_staff_supervisor_status
  ON public.staff (supervisor_id, employment_status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_staff_dept_status
  ON public.staff (department_id, employment_status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_staff_system_role
  ON public.staff (system_role);

-- user_profiles: role lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_system_role
  ON public.user_profiles (system_role);

-- activity_logs: time-based queries (dashboard feed)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_created_at
  ON public.activity_logs (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_staff_created
  ON public.activity_logs (staff_id, created_at DESC);

-- appraisal_drafts: staff + type lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appraisal_drafts_staff_type
  ON public.appraisal_drafts (staff_id, draft_type);
