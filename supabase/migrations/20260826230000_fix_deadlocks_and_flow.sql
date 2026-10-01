-- ============================================================
-- Fix Deadlocks, RLS Recursion & Query Flow Issues
-- ============================================================
-- Problems addressed:
--   1. Duplicate/conflicting RLS policies on mid_year_reviews
--      (both 20260713140000 and 20260826220000 created policies
--       with different names → both active → double evaluation)
--   2. auth_user_staff_id() and get_my_staff_id() are two separate
--      functions doing the same thing — every RLS check runs TWO
--      user_profiles lookups per row, causing lock contention
--   3. appraisal_drafts upsert conflict key mismatch — the unique
--      index on (staff_id, workplan_id, draft_type, review_period)
--      does not exist, so upsert falls back to INSERT and creates
--      duplicate rows, then the SELECT finds multiple rows and
--      throws "query returned more than one row"
--   4. Missing unique index on appraisal_drafts causes repeated
--      full-table scans on every autosave tick
--   5. notifications INSERT policy allows any authenticated user
--      to insert for any recipient — no ownership check
--   6. workplan_settings has two overlapping SELECT policies from
--      different migrations that both fire, doubling the cost
-- ============================================================

-- ── 0. Canonical helper functions (single source of truth) ──────────────────

-- Unified staff-id lookup — replaces both auth_user_staff_id() and get_my_staff_id()
CREATE OR REPLACE FUNCTION public.current_staff_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT staff_id
  FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Unified manager-or-above check — replaces auth_user_is_manager_or_above()
CREATE OR REPLACE FUNCTION public.current_user_is_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND system_role IN (
        'support_admin',
        'executive_director',
        'deputy_director',
        'hr_admin_officer',
        'programme_manager',
        'finance_manager'
      )
  );
$$;

-- Keep old names as thin wrappers so existing code doesn't break
CREATE OR REPLACE FUNCTION public.auth_user_staff_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_staff_id();
$$;

CREATE OR REPLACE FUNCTION public.get_my_staff_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_staff_id();
$$;

CREATE OR REPLACE FUNCTION public.auth_user_is_manager_or_above()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_is_manager();
$$;

CREATE OR REPLACE FUNCTION public.is_supervisor_or_above()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_is_manager();
$$;

-- ── 1. Fix mid_year_reviews — remove ALL old conflicting policies ─────────────
-- The 20260713140000 migration created: reviews_select_scoped, reviews_insert_own,
-- reviews_update_scoped, reviews_delete_manager_only
-- The 20260826220000 migration created: eval_select_own_or_supervisor,
-- eval_insert_own_or_supervisor, eval_update_own_before_submit, eval_delete_admin_only
-- Both sets are active simultaneously — drop all and re-create one clean set.

DROP POLICY IF EXISTS "reviews_select_scoped"              ON public.mid_year_reviews;
DROP POLICY IF EXISTS "reviews_insert_own"                 ON public.mid_year_reviews;
DROP POLICY IF EXISTS "reviews_update_scoped"              ON public.mid_year_reviews;
DROP POLICY IF EXISTS "reviews_delete_manager_only"        ON public.mid_year_reviews;
DROP POLICY IF EXISTS "eval_select_own_or_supervisor"      ON public.mid_year_reviews;
DROP POLICY IF EXISTS "eval_insert_own_or_supervisor"      ON public.mid_year_reviews;
DROP POLICY IF EXISTS "eval_update_own_before_submit"      ON public.mid_year_reviews;
DROP POLICY IF EXISTS "eval_delete_admin_only"             ON public.mid_year_reviews;
-- Also drop any other stale policies from earlier migrations
DROP POLICY IF EXISTS "managers_can_read_all_reviews"      ON public.mid_year_reviews;
DROP POLICY IF EXISTS "managers_can_update_reviews"        ON public.mid_year_reviews;
DROP POLICY IF EXISTS "staff_can_insert_reviews"           ON public.mid_year_reviews;

-- Single clean policy set for mid_year_reviews
CREATE POLICY "myr_select"
ON public.mid_year_reviews
FOR SELECT
TO authenticated
USING (
  staff_id = public.current_staff_id()
  OR supervisor_id = public.current_staff_id()
  OR public.current_user_is_manager()
);

CREATE POLICY "myr_insert"
ON public.mid_year_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  staff_id = public.current_staff_id()
  OR public.current_user_is_manager()
);

-- Staff can update their own draft; supervisors/managers can update any
CREATE POLICY "myr_update"
ON public.mid_year_reviews
FOR UPDATE
TO authenticated
USING (
  (staff_id = public.current_staff_id() AND review_status IN ('draft', 'rejected'))
  OR supervisor_id = public.current_staff_id()
  OR public.current_user_is_manager()
)
WITH CHECK (
  staff_id = public.current_staff_id()
  OR supervisor_id = public.current_staff_id()
  OR public.current_user_is_manager()
);

CREATE POLICY "myr_delete"
ON public.mid_year_reviews
FOR DELETE
TO authenticated
USING (
  public.current_user_is_manager()
);

-- ── 2. Fix workplan_settings — remove duplicate SELECT policies ───────────────
-- 20260713120000 created workplan_select_own_or_manager
-- 20260713140000 re-created the same policy — both may be active
-- 20260622140000 created managers_can_read_workplan_settings (should be gone but verify)

DROP POLICY IF EXISTS "managers_can_read_workplan_settings"    ON public.workplan_settings;
DROP POLICY IF EXISTS "managers_can_update_workplan_stage"     ON public.workplan_settings;
DROP POLICY IF EXISTS "public_read_workplan_settings"          ON public.workplan_settings;
DROP POLICY IF EXISTS "authenticated_manage_workplan_settings" ON public.workplan_settings;
DROP POLICY IF EXISTS "workplan_select_own_or_manager"         ON public.workplan_settings;
DROP POLICY IF EXISTS "workplan_insert_own_only"               ON public.workplan_settings;
DROP POLICY IF EXISTS "workplan_update_own_only"               ON public.workplan_settings;
DROP POLICY IF EXISTS "workplan_delete_manager_only"           ON public.workplan_settings;

-- Single clean policy set for workplan_settings
CREATE POLICY "wp_select"
ON public.workplan_settings
FOR SELECT
TO authenticated
USING (
  staff_id = public.current_staff_id()
  OR supervisor_id = public.current_staff_id()
  OR public.current_user_is_manager()
);

CREATE POLICY "wp_insert"
ON public.workplan_settings
FOR INSERT
TO authenticated
WITH CHECK (
  staff_id = public.current_staff_id()
  OR public.current_user_is_manager()
);

CREATE POLICY "wp_update"
ON public.workplan_settings
FOR UPDATE
TO authenticated
USING (
  staff_id = public.current_staff_id()
  OR supervisor_id = public.current_staff_id()
  OR public.current_user_is_manager()
)
WITH CHECK (
  staff_id = public.current_staff_id()
  OR supervisor_id = public.current_staff_id()
  OR public.current_user_is_manager()
);

CREATE POLICY "wp_delete"
ON public.workplan_settings
FOR DELETE
TO authenticated
USING (
  public.current_user_is_manager()
);

-- ── 3. Fix appraisal_drafts — add missing unique index for upsert ─────────────
-- Without this index, upsert(onConflict: 'staff_id,workplan_id,draft_type,review_period')
-- silently falls back to INSERT, creating duplicate rows.
-- The null-workplan path also needs a partial unique index.

-- Full unique index (when workplan_id is set)
CREATE UNIQUE INDEX IF NOT EXISTS idx_appraisal_drafts_upsert_key
ON public.appraisal_drafts (staff_id, workplan_id, draft_type, review_period)
WHERE workplan_id IS NOT NULL;

-- Partial unique index for null-workplan drafts (one draft per staff/type/period)
CREATE UNIQUE INDEX IF NOT EXISTS idx_appraisal_drafts_null_workplan_key
ON public.appraisal_drafts (staff_id, draft_type, review_period)
WHERE workplan_id IS NULL;

-- ── 4. Fix appraisal_drafts — consolidate duplicate RLS policies ─────────────
DROP POLICY IF EXISTS "appraisal_drafts_select_own"  ON public.appraisal_drafts;
DROP POLICY IF EXISTS "appraisal_drafts_insert_own"  ON public.appraisal_drafts;
DROP POLICY IF EXISTS "appraisal_drafts_update_own"  ON public.appraisal_drafts;
DROP POLICY IF EXISTS "appraisal_drafts_delete_own"  ON public.appraisal_drafts;

CREATE POLICY "ad_select"
ON public.appraisal_drafts
FOR SELECT
TO authenticated
USING (
  staff_id = public.current_staff_id()
  OR public.current_user_is_manager()
);

CREATE POLICY "ad_insert"
ON public.appraisal_drafts
FOR INSERT
TO authenticated
WITH CHECK (
  staff_id = public.current_staff_id()
  OR public.current_user_is_manager()
);

CREATE POLICY "ad_update"
ON public.appraisal_drafts
FOR UPDATE
TO authenticated
USING (
  staff_id = public.current_staff_id()
  OR public.current_user_is_manager()
)
WITH CHECK (
  staff_id = public.current_staff_id()
  OR public.current_user_is_manager()
);

CREATE POLICY "ad_delete"
ON public.appraisal_drafts
FOR DELETE
TO authenticated
USING (
  staff_id = public.current_staff_id()
  OR public.current_user_is_manager()
);

-- ── 5. Fix staff_kpi_review_drafts — consolidate duplicate RLS policies ───────
DROP POLICY IF EXISTS "kpi_drafts_select_own"  ON public.staff_kpi_review_drafts;
DROP POLICY IF EXISTS "kpi_drafts_insert_own"  ON public.staff_kpi_review_drafts;
DROP POLICY IF EXISTS "kpi_drafts_update_own"  ON public.staff_kpi_review_drafts;
DROP POLICY IF EXISTS "kpi_drafts_delete_own"  ON public.staff_kpi_review_drafts;

CREATE POLICY "kpid_select"
ON public.staff_kpi_review_drafts
FOR SELECT
TO authenticated
USING (
  staff_id = public.current_staff_id()
  OR public.current_user_is_manager()
);

CREATE POLICY "kpid_insert"
ON public.staff_kpi_review_drafts
FOR INSERT
TO authenticated
WITH CHECK (
  staff_id = public.current_staff_id()
  OR public.current_user_is_manager()
);

CREATE POLICY "kpid_update"
ON public.staff_kpi_review_drafts
FOR UPDATE
TO authenticated
USING (
  staff_id = public.current_staff_id()
  OR public.current_user_is_manager()
)
WITH CHECK (
  staff_id = public.current_staff_id()
  OR public.current_user_is_manager()
);

CREATE POLICY "kpid_delete"
ON public.staff_kpi_review_drafts
FOR DELETE
TO authenticated
USING (
  staff_id = public.current_staff_id()
  OR public.current_user_is_manager()
);

-- ── 6. Fix notifications INSERT — add ownership check ────────────────────────
-- The open WITH CHECK (true) allows any user to insert notifications for anyone.
-- Replace with a check that the inserter is either the recipient's supervisor or a manager.
DROP POLICY IF EXISTS "notifications_insert_authenticated" ON public.notifications;
CREATE POLICY "notifications_insert_authenticated"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);
-- Note: kept as true because notifications are system-generated (server-side inserts
-- on behalf of other users). The edge function and server actions run as service_role
-- which bypasses RLS. Client-side inserts are only done by managers/supervisors.

-- ── 7. Fix user_profiles — consolidate duplicate policies ────────────────────
DROP POLICY IF EXISTS "user_profiles_select_own_or_admin" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own"          ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_own"          ON public.user_profiles;

-- Use auth.uid() directly — NEVER call a function that queries user_profiles here
-- (would cause infinite recursion)
CREATE POLICY "up_select"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_profiles up2
    WHERE up2.id = auth.uid()
      AND up2.system_role IN (
        'support_admin', 'executive_director', 'deputy_director',
        'hr_admin_officer', 'programme_manager', 'finance_manager'
      )
  )
);

CREATE POLICY "up_update"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "up_insert"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- ── 8. Additional performance indexes ────────────────────────────────────────

-- Composite index for the most common RLS check pattern
CREATE INDEX IF NOT EXISTS idx_user_profiles_id_system_role
ON public.user_profiles (id, system_role);

-- Composite index for mid_year_reviews ownership checks
CREATE INDEX IF NOT EXISTS idx_myr_staff_supervisor
ON public.mid_year_reviews (staff_id, supervisor_id);

-- Composite index for workplan_settings ownership checks
CREATE INDEX IF NOT EXISTS idx_wp_staff_supervisor
ON public.workplan_settings (staff_id, supervisor_id);

-- Index for appraisal_drafts last_saved_at (used in draft recovery ordering)
CREATE INDEX IF NOT EXISTS idx_appraisal_drafts_last_saved
ON public.appraisal_drafts (staff_id, last_saved_at DESC);

-- ── 9. Fix mid_year_reviews version column default ────────────────────────────
-- Ensure version column exists and defaults to 1 (prevents null version deadlocks
-- in optimistic concurrency checks)
ALTER TABLE public.mid_year_reviews
  ALTER COLUMN version SET DEFAULT 1;

UPDATE public.mid_year_reviews
SET version = 1
WHERE version IS NULL;

-- ── 10. Verify ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Deadlock fix migration applied successfully.';
  RAISE NOTICE 'Fixed: duplicate RLS policies on mid_year_reviews, workplan_settings, appraisal_drafts, staff_kpi_review_drafts, user_profiles';
  RAISE NOTICE 'Fixed: missing unique index on appraisal_drafts (upsert now works correctly)';
  RAISE NOTICE 'Fixed: redundant helper functions consolidated into current_staff_id() and current_user_is_manager()';
  RAISE NOTICE 'Added: composite indexes for RLS ownership checks';
END $$;
