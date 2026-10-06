-- ============================================================
-- Polish RLS Policies, Indexes & Query Performance
-- ============================================================
-- Goals:
--   1. Fix mid_year_reviews RLS — scope to owner/supervisor/manager
--   2. Fix notifications RLS — scope to recipient
--   3. Fix appraisal_drafts RLS — scope to owner
--   4. Fix staff_kpi_review_drafts RLS — scope to owner
--   5. Fix user_profiles RLS — users can read/update their own row
--   6. Fix workplan_settings — remove conflicting open policies
--   7. Add missing performance indexes
--   8. Ensure helper functions have correct search_path
-- ============================================================

-- ── 0. Ensure helper functions exist with correct search_path ────────────────

-- Returns the staff.id for the currently authenticated user
CREATE OR REPLACE FUNCTION public.auth_user_staff_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT staff_id
  FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Returns TRUE if the current user is a manager-level or above
CREATE OR REPLACE FUNCTION public.auth_user_is_manager_or_above()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND system_role IN (
        'executive_director',
        'deputy_director',
        'hr_admin_officer',
        'programme_manager',
        'finance_manager',
        'support_admin'
      )
  );
$$;

-- Returns TRUE if the current user is HR or Director level
CREATE OR REPLACE FUNCTION public.is_hr_or_director()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND system_role IN ('executive_director', 'deputy_director', 'hr_admin_officer', 'support_admin')
  );
$$;

-- Returns TRUE if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND system_role IN ('executive_director', 'deputy_director', 'hr_admin_officer', 'support_admin')
      AND is_active = true
  );
$$;

-- ── 1. user_profiles — users can read/update their own row; admins can read all ──

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profiles_select_own_or_admin" ON public.user_profiles;
CREATE POLICY "user_profiles_select_own_or_admin"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.is_admin_user()
);

DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;
CREATE POLICY "user_profiles_update_own"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.user_profiles;
CREATE POLICY "user_profiles_insert_own"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- ── 2. workplan_settings — remove conflicting open policies ──────────────────
-- The 20260622140000 migration added open policies that override the strict ones
-- from 20260713120000. Remove them here so only the strict policies remain.

DROP POLICY IF EXISTS "managers_can_read_workplan_settings" ON public.workplan_settings;
DROP POLICY IF EXISTS "managers_can_update_workplan_stage" ON public.workplan_settings;
-- Also remove any old permissive policies that may still be active
DROP POLICY IF EXISTS "public_read_workplan_settings" ON public.workplan_settings;
DROP POLICY IF EXISTS "authenticated_manage_workplan_settings" ON public.workplan_settings;

-- Re-assert the strict ownership policies (idempotent)
DROP POLICY IF EXISTS "workplan_select_own_or_manager" ON public.workplan_settings;
CREATE POLICY "workplan_select_own_or_manager"
ON public.workplan_settings
FOR SELECT
TO authenticated
USING (
  staff_id = public.auth_user_staff_id()
  OR supervisor_id = public.auth_user_staff_id()
  OR public.auth_user_is_manager_or_above()
);

DROP POLICY IF EXISTS "workplan_insert_own_only" ON public.workplan_settings;
CREATE POLICY "workplan_insert_own_only"
ON public.workplan_settings
FOR INSERT
TO authenticated
WITH CHECK (
  staff_id = public.auth_user_staff_id()
  OR public.auth_user_is_manager_or_above()
);

DROP POLICY IF EXISTS "workplan_update_own_only" ON public.workplan_settings;
CREATE POLICY "workplan_update_own_only"
ON public.workplan_settings
FOR UPDATE
TO authenticated
USING (
  staff_id = public.auth_user_staff_id()
  OR supervisor_id = public.auth_user_staff_id()
  OR public.auth_user_is_manager_or_above()
)
WITH CHECK (
  staff_id = public.auth_user_staff_id()
  OR supervisor_id = public.auth_user_staff_id()
  OR public.auth_user_is_manager_or_above()
);

DROP POLICY IF EXISTS "workplan_delete_manager_only" ON public.workplan_settings;
CREATE POLICY "workplan_delete_manager_only"
ON public.workplan_settings
FOR DELETE
TO authenticated
USING (
  public.auth_user_is_manager_or_above()
);

-- ── 3. mid_year_reviews — replace open policies with scoped ones ─────────────

ALTER TABLE public.mid_year_reviews ENABLE ROW LEVEL SECURITY;

-- Remove the old open policies
DROP POLICY IF EXISTS "managers_can_read_all_reviews" ON public.mid_year_reviews;
DROP POLICY IF EXISTS "managers_can_update_reviews" ON public.mid_year_reviews;
DROP POLICY IF EXISTS "staff_can_insert_reviews" ON public.mid_year_reviews;

-- SELECT: staff see their own; supervisors see their direct reports; managers see all
DROP POLICY IF EXISTS "reviews_select_scoped" ON public.mid_year_reviews;
CREATE POLICY "reviews_select_scoped"
ON public.mid_year_reviews
FOR SELECT
TO authenticated
USING (
  staff_id = public.auth_user_staff_id()
  OR supervisor_id = public.auth_user_staff_id()
  OR public.auth_user_is_manager_or_above()
);

-- INSERT: staff can only insert a review for themselves
DROP POLICY IF EXISTS "reviews_insert_own" ON public.mid_year_reviews;
CREATE POLICY "reviews_insert_own"
ON public.mid_year_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  staff_id = public.auth_user_staff_id()
  OR public.auth_user_is_manager_or_above()
);

-- UPDATE: staff can update their own draft; supervisors can update their reports; managers can update all
DROP POLICY IF EXISTS "reviews_update_scoped" ON public.mid_year_reviews;
CREATE POLICY "reviews_update_scoped"
ON public.mid_year_reviews
FOR UPDATE
TO authenticated
USING (
  staff_id = public.auth_user_staff_id()
  OR supervisor_id = public.auth_user_staff_id()
  OR public.auth_user_is_manager_or_above()
)
WITH CHECK (
  staff_id = public.auth_user_staff_id()
  OR supervisor_id = public.auth_user_staff_id()
  OR public.auth_user_is_manager_or_above()
);

-- DELETE: only managers/HR
DROP POLICY IF EXISTS "reviews_delete_manager_only" ON public.mid_year_reviews;
CREATE POLICY "reviews_delete_manager_only"
ON public.mid_year_reviews
FOR DELETE
TO authenticated
USING (
  public.auth_user_is_manager_or_above()
);

-- ── 4. notifications — scope to recipient ────────────────────────────────────

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  recipient_staff_id = public.auth_user_staff_id()
  OR public.is_hr_or_director()
);

DROP POLICY IF EXISTS "notifications_insert_authenticated" ON public.notifications;
CREATE POLICY "notifications_insert_authenticated"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
ON public.notifications
FOR UPDATE
TO authenticated
USING (
  recipient_staff_id = public.auth_user_staff_id()
  OR public.is_hr_or_director()
)
WITH CHECK (
  recipient_staff_id = public.auth_user_staff_id()
  OR public.is_hr_or_director()
);

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own"
ON public.notifications
FOR DELETE
TO authenticated
USING (
  recipient_staff_id = public.auth_user_staff_id()
  OR public.is_hr_or_director()
);

-- ── 5. appraisal_drafts — scope to owner ─────────────────────────────────────

ALTER TABLE public.appraisal_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appraisal_drafts_select_own" ON public.appraisal_drafts;
CREATE POLICY "appraisal_drafts_select_own"
ON public.appraisal_drafts
FOR SELECT
TO authenticated
USING (
  staff_id = public.auth_user_staff_id()
  OR public.auth_user_is_manager_or_above()
);

DROP POLICY IF EXISTS "appraisal_drafts_insert_own" ON public.appraisal_drafts;
CREATE POLICY "appraisal_drafts_insert_own"
ON public.appraisal_drafts
FOR INSERT
TO authenticated
WITH CHECK (
  staff_id = public.auth_user_staff_id()
  OR public.auth_user_is_manager_or_above()
);

DROP POLICY IF EXISTS "appraisal_drafts_update_own" ON public.appraisal_drafts;
CREATE POLICY "appraisal_drafts_update_own"
ON public.appraisal_drafts
FOR UPDATE
TO authenticated
USING (
  staff_id = public.auth_user_staff_id()
  OR public.auth_user_is_manager_or_above()
)
WITH CHECK (
  staff_id = public.auth_user_staff_id()
  OR public.auth_user_is_manager_or_above()
);

DROP POLICY IF EXISTS "appraisal_drafts_delete_own" ON public.appraisal_drafts;
CREATE POLICY "appraisal_drafts_delete_own"
ON public.appraisal_drafts
FOR DELETE
TO authenticated
USING (
  staff_id = public.auth_user_staff_id()
  OR public.auth_user_is_manager_or_above()
);

-- ── 6. staff_kpi_review_drafts — scope to owner ──────────────────────────────

ALTER TABLE public.staff_kpi_review_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kpi_drafts_select_own" ON public.staff_kpi_review_drafts;
CREATE POLICY "kpi_drafts_select_own"
ON public.staff_kpi_review_drafts
FOR SELECT
TO authenticated
USING (
  staff_id = public.auth_user_staff_id()
  OR public.auth_user_is_manager_or_above()
);

DROP POLICY IF EXISTS "kpi_drafts_insert_own" ON public.staff_kpi_review_drafts;
CREATE POLICY "kpi_drafts_insert_own"
ON public.staff_kpi_review_drafts
FOR INSERT
TO authenticated
WITH CHECK (
  staff_id = public.auth_user_staff_id()
  OR public.auth_user_is_manager_or_above()
);

DROP POLICY IF EXISTS "kpi_drafts_update_own" ON public.staff_kpi_review_drafts;
CREATE POLICY "kpi_drafts_update_own"
ON public.staff_kpi_review_drafts
FOR UPDATE
TO authenticated
USING (
  staff_id = public.auth_user_staff_id()
  OR public.auth_user_is_manager_or_above()
)
WITH CHECK (
  staff_id = public.auth_user_staff_id()
  OR public.auth_user_is_manager_or_above()
);

DROP POLICY IF EXISTS "kpi_drafts_delete_own" ON public.staff_kpi_review_drafts;
CREATE POLICY "kpi_drafts_delete_own"
ON public.staff_kpi_review_drafts
FOR DELETE
TO authenticated
USING (
  staff_id = public.auth_user_staff_id()
  OR public.auth_user_is_manager_or_above()
);

-- ── 7. activity_logs — keep open read, restrict insert to authenticated ───────

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_logs_public_read" ON public.activity_logs;
CREATE POLICY "activity_logs_public_read"
ON public.activity_logs
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "activity_logs_authenticated_insert" ON public.activity_logs;
DROP POLICY IF EXISTS "authenticated_can_insert_activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "authenticated_can_read_activity_logs" ON public.activity_logs;
CREATE POLICY "activity_logs_authenticated_insert"
ON public.activity_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- ── 8. security_audit_logs — admins only ─────────────────────────────────────

ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "security_audit_logs_admin_only" ON public.security_audit_logs;
CREATE POLICY "security_audit_logs_admin_only"
ON public.security_audit_logs
FOR SELECT
TO authenticated
USING (public.is_admin_user());

DROP POLICY IF EXISTS "security_audit_logs_insert_authenticated" ON public.security_audit_logs;
CREATE POLICY "security_audit_logs_insert_authenticated"
ON public.security_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- ── 9. login_audit_logs — admins only ────────────────────────────────────────

ALTER TABLE public.login_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "login_audit_logs_admin_only" ON public.login_audit_logs;
CREATE POLICY "login_audit_logs_admin_only"
ON public.login_audit_logs
FOR SELECT
TO authenticated
USING (public.is_admin_user());

DROP POLICY IF EXISTS "login_audit_logs_insert" ON public.login_audit_logs;
CREATE POLICY "login_audit_logs_insert"
ON public.login_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- ── 10. bsc_perspectives_config — read for all authenticated, write for admins ─

ALTER TABLE public.bsc_perspectives_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bsc_config_read_authenticated" ON public.bsc_perspectives_config;
CREATE POLICY "bsc_config_read_authenticated"
ON public.bsc_perspectives_config
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "bsc_config_write_admin" ON public.bsc_perspectives_config;
CREATE POLICY "bsc_config_write_admin"
ON public.bsc_perspectives_config
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- ── 11. admin_email_log — admins only ────────────────────────────────────────

ALTER TABLE public.admin_email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_email_log_admin_only" ON public.admin_email_log;
CREATE POLICY "admin_email_log_admin_only"
ON public.admin_email_log
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- ── 12. role_permissions — read for all authenticated, write for admins ───────

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_permissions_read_authenticated" ON public.role_permissions;
CREATE POLICY "role_permissions_read_authenticated"
ON public.role_permissions
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "role_permissions_write_admin" ON public.role_permissions;
CREATE POLICY "role_permissions_write_admin"
ON public.role_permissions
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- ── 13. review_timelines — read for all authenticated, write for admins ───────

ALTER TABLE public.review_timelines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "review_timelines_read_authenticated" ON public.review_timelines;
CREATE POLICY "review_timelines_read_authenticated"
ON public.review_timelines
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "review_timelines_write_admin" ON public.review_timelines;
CREATE POLICY "review_timelines_write_admin"
ON public.review_timelines
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- ── 14. Performance indexes ───────────────────────────────────────────────────

-- user_profiles: fast lookup by auth uid (most common query)
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON public.user_profiles(id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_staff_id ON public.user_profiles(staff_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_system_role ON public.user_profiles(system_role);

-- mid_year_reviews: most common filter columns
CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_staff_id ON public.mid_year_reviews(staff_id);
CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_supervisor_id ON public.mid_year_reviews(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_review_status ON public.mid_year_reviews(review_status);
CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_workplan_id ON public.mid_year_reviews(workplan_id);
CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_review_year ON public.mid_year_reviews(review_year);

-- workplan_settings: ownership lookups
CREATE INDEX IF NOT EXISTS idx_workplan_settings_staff_id ON public.workplan_settings(staff_id);
CREATE INDEX IF NOT EXISTS idx_workplan_settings_supervisor_id ON public.workplan_settings(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_workplan_settings_status ON public.workplan_settings(status);
CREATE INDEX IF NOT EXISTS idx_workplan_settings_workflow_stage ON public.workplan_settings(workflow_stage);

-- notifications: recipient lookup (most common query)
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_staff_id ON public.notifications(recipient_staff_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- appraisal_drafts: ownership lookups
CREATE INDEX IF NOT EXISTS idx_appraisal_drafts_staff_id ON public.appraisal_drafts(staff_id);
CREATE INDEX IF NOT EXISTS idx_appraisal_drafts_workplan_id ON public.appraisal_drafts(workplan_id);

-- staff_kpi_review_drafts: ownership lookups
CREATE INDEX IF NOT EXISTS idx_kpi_drafts_staff_id ON public.staff_kpi_review_drafts(staff_id);
CREATE INDEX IF NOT EXISTS idx_kpi_drafts_workplan_id ON public.staff_kpi_review_drafts(workplan_id);

-- staff: email lookup (used in WorkplanSettingForm fallback)
CREATE INDEX IF NOT EXISTS idx_staff_email ON public.staff(email);
CREATE INDEX IF NOT EXISTS idx_staff_employment_status ON public.staff(employment_status);

-- activity_logs: time-ordered feed
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- ── 15. Verify helper function linkage ───────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'RLS polish migration applied successfully.';
  RAISE NOTICE 'Policies updated: user_profiles, workplan_settings, mid_year_reviews, notifications, appraisal_drafts, staff_kpi_review_drafts, activity_logs, security_audit_logs, login_audit_logs, bsc_perspectives_config, admin_email_log, role_permissions, review_timelines';
  RAISE NOTICE 'Indexes added for: user_profiles, mid_year_reviews, workplan_settings, notifications, appraisal_drafts, staff_kpi_review_drafts, staff, activity_logs';
END $$;
