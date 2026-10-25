-- ============================================================
-- Evaluation Form Security Migration
-- Implements all 6 security measures for evaluation forms
-- ============================================================

-- ── 1. Helper functions (created BEFORE RLS policies) ────────────────────────

-- Returns the staff.id linked to the currently authenticated user
CREATE OR REPLACE FUNCTION public.get_my_staff_id()
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

-- Returns true if the current user is a supervisor/manager/admin
CREATE OR REPLACE FUNCTION public.is_supervisor_or_above()
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

-- Returns true if the current user is a direct supervisor of the given staff_id
CREATE OR REPLACE FUNCTION public.is_direct_supervisor_of(target_staff_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.id = target_staff_id
      AND s.supervisor_id = public.get_my_staff_id()
  );
$$;

-- Returns true if the current user can write an evaluation for the given staff_id:
--   a) the staff_id IS the current user's own staff record, OR
--   b) the current user is a direct supervisor of that staff member
CREATE OR REPLACE FUNCTION public.can_write_evaluation_for(target_staff_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    target_staff_id = public.get_my_staff_id()
    OR public.is_direct_supervisor_of(target_staff_id)
    OR public.is_supervisor_or_above()
  );
$$;

-- ── 2. Add submitted_by column to mid_year_reviews (audit trail) ─────────────
ALTER TABLE public.mid_year_reviews
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.mid_year_reviews
  ADD COLUMN IF NOT EXISTS submitted_by_name TEXT;

ALTER TABLE public.mid_year_reviews
  ADD COLUMN IF NOT EXISTS submitted_by_role TEXT;

-- ── 3. Index for fast ownership lookups ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_staff_id ON public.mid_year_reviews(staff_id);
CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_submitted_by ON public.mid_year_reviews(submitted_by);
CREATE INDEX IF NOT EXISTS idx_user_profiles_staff_id ON public.user_profiles(staff_id);

-- ── 4. Enable RLS (idempotent) ───────────────────────────────────────────────
ALTER TABLE public.mid_year_reviews ENABLE ROW LEVEL SECURITY;

-- ── 5. RLS Policies for mid_year_reviews ─────────────────────────────────────

-- SELECT: staff can read their own reviews; supervisors/admins can read all
DROP POLICY IF EXISTS "eval_select_own_or_supervisor" ON public.mid_year_reviews;
CREATE POLICY "eval_select_own_or_supervisor"
ON public.mid_year_reviews
FOR SELECT
TO authenticated
USING (
  staff_id = public.get_my_staff_id()
  OR public.is_direct_supervisor_of(staff_id)
  OR public.is_supervisor_or_above()
);

-- INSERT: only allowed if the actor can write for the target staff_id
DROP POLICY IF EXISTS "eval_insert_own_or_supervisor" ON public.mid_year_reviews;
CREATE POLICY "eval_insert_own_or_supervisor"
ON public.mid_year_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_write_evaluation_for(staff_id)
);

-- UPDATE: only allowed while status is NOT 'submitted' (prevents post-submission edits)
-- Supervisors/admins can still update (for review/approval workflow)
DROP POLICY IF EXISTS "eval_update_own_before_submit" ON public.mid_year_reviews;
CREATE POLICY "eval_update_own_before_submit"
ON public.mid_year_reviews
FOR UPDATE
TO authenticated
USING (
  (staff_id = public.get_my_staff_id() AND review_status != 'submitted')
  OR public.is_direct_supervisor_of(staff_id)
  OR public.is_supervisor_or_above()
)
WITH CHECK (
  public.can_write_evaluation_for(staff_id)
);

-- DELETE: only admins/HR can delete
DROP POLICY IF EXISTS "eval_delete_admin_only" ON public.mid_year_reviews;
CREATE POLICY "eval_delete_admin_only"
ON public.mid_year_reviews
FOR DELETE
TO authenticated
USING (
  public.is_supervisor_or_above()
);

-- ── 6. Audit log trigger: stamp submitted_by on every insert ─────────────────
CREATE OR REPLACE FUNCTION public.stamp_evaluation_submitter()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_role TEXT;
BEGIN
  SELECT full_name, system_role
  INTO v_name, v_role
  FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1;

  NEW.submitted_by := auth.uid();
  NEW.submitted_by_name := COALESCE(v_name, '');
  NEW.submitted_by_role := COALESCE(v_role, '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_evaluation_submitter ON public.mid_year_reviews;
CREATE TRIGGER trg_stamp_evaluation_submitter
BEFORE INSERT ON public.mid_year_reviews
FOR EACH ROW
EXECUTE FUNCTION public.stamp_evaluation_submitter();
