-- Workplan Ownership Security Migration
-- Enforces that a staff member can only INSERT/UPDATE their own workplan.
-- Uses user_profiles.staff_id to link auth.uid() → staff.id.

-- ── 1. Helper function: resolve the staff.id for the current auth user ────────
CREATE OR REPLACE FUNCTION public.auth_user_staff_id()
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

-- ── 2. Helper function: is the current user a manager or above? ───────────────
--    Managers/HR/Directors can create workplans on behalf of staff.
CREATE OR REPLACE FUNCTION public.auth_user_is_manager_or_above()
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
        'executive_director',
        'deputy_director',
        'hr_admin_officer',
        'programme_manager',
        'finance_manager',
        'support_admin'
      )
  );
$$;

-- ── 3. Drop the old permissive policies ──────────────────────────────────────
DROP POLICY IF EXISTS "public_read_workplan_settings" ON public.workplan_settings;
DROP POLICY IF EXISTS "authenticated_manage_workplan_settings" ON public.workplan_settings;

-- ── 4. Re-enable RLS (idempotent) ────────────────────────────────────────────
ALTER TABLE public.workplan_settings ENABLE ROW LEVEL SECURITY;

-- ── 5. SELECT: staff can read their own workplan; managers can read all ───────
DROP POLICY IF EXISTS "workplan_select_own_or_manager" ON public.workplan_settings;
CREATE POLICY "workplan_select_own_or_manager"
ON public.workplan_settings
FOR SELECT
TO authenticated
USING (
  staff_id = public.auth_user_staff_id()
  OR public.auth_user_is_manager_or_above()
);

-- ── 6. INSERT: staff can only insert a workplan where staff_id = their own ────
DROP POLICY IF EXISTS "workplan_insert_own_only" ON public.workplan_settings;
CREATE POLICY "workplan_insert_own_only"
ON public.workplan_settings
FOR INSERT
TO authenticated
WITH CHECK (
  staff_id = public.auth_user_staff_id()
  OR public.auth_user_is_manager_or_above()
);

-- ── 7. UPDATE: staff can only update their own workplan ───────────────────────
DROP POLICY IF EXISTS "workplan_update_own_only" ON public.workplan_settings;
CREATE POLICY "workplan_update_own_only"
ON public.workplan_settings
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

-- ── 8. DELETE: only managers/HR can delete workplans ─────────────────────────
DROP POLICY IF EXISTS "workplan_delete_manager_only" ON public.workplan_settings;
CREATE POLICY "workplan_delete_manager_only"
ON public.workplan_settings
FOR DELETE
TO authenticated
USING (
  public.auth_user_is_manager_or_above()
);
