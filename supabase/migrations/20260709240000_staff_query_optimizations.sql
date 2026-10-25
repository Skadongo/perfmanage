-- ─── Staff Query Optimizations ───────────────────────────────────────────────
-- Adds indexes on frequently-filtered columns and a staff_with_roles view
-- to reduce round-trips and full table scans across all screens.

-- ─── 1. Indexes on staff table ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_staff_email
  ON public.staff (email);

CREATE INDEX IF NOT EXISTS idx_staff_system_role
  ON public.staff (system_role);

CREATE INDEX IF NOT EXISTS idx_staff_department_id
  ON public.staff (department_id);

CREATE INDEX IF NOT EXISTS idx_staff_supervisor_id
  ON public.staff (supervisor_id);

CREATE INDEX IF NOT EXISTS idx_staff_employment_status
  ON public.staff (employment_status);

CREATE INDEX IF NOT EXISTS idx_staff_serial_number
  ON public.staff (serial_number);

-- ─── 2. Indexes on user_profiles table ───────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_user_profiles_staff_id
  ON public.user_profiles (staff_id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_system_role
  ON public.user_profiles (system_role);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email
  ON public.user_profiles (email);

-- ─── 3. Indexes on mid_year_reviews for common filters ───────────────────────

CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_staff_id
  ON public.mid_year_reviews (staff_id);

CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_supervisor_id
  ON public.mid_year_reviews (supervisor_id);

CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_review_status
  ON public.mid_year_reviews (review_status);

CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_review_year
  ON public.mid_year_reviews (review_year);

-- ─── 4. Indexes on workplan_settings ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_workplan_settings_staff_id
  ON public.workplan_settings (staff_id);

CREATE INDEX IF NOT EXISTS idx_workplan_settings_workflow_stage
  ON public.workplan_settings (workflow_stage);

-- ─── 5. staff_with_roles view ─────────────────────────────────────────────────
-- Joins staff + user_profiles in one query so screens don't need two round-trips.

CREATE OR REPLACE VIEW public.staff_with_roles AS
SELECT
  s.id,
  s.serial_number,
  s.full_name,
  s.job_title,
  s.department_id,
  s.supervisor_id,
  s.supervisor_name,
  s.employment_status,
  s.email                         AS staff_email,
  s.system_role                   AS staff_system_role,
  s.created_at,
  s.updated_at,
  up.id                           AS user_profile_id,
  up.email                        AS auth_email,
  up.role                         AS user_role,
  up.system_role                  AS profile_system_role,
  up.is_active,
  up.must_change_password,
  d.name                          AS department_name
FROM public.staff s
LEFT JOIN public.user_profiles up ON up.staff_id = s.id
LEFT JOIN public.departments d    ON d.id = s.department_id;

-- Grant read access to authenticated users (view inherits RLS from base tables)
GRANT SELECT ON public.staff_with_roles TO authenticated;
