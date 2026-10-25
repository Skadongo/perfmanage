-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: workplan_settings — enforce own-record RLS for staff
-- Staff (level < 70) may only INSERT/UPDATE rows where staff_id matches their
-- own staff record (looked up via user_profiles.staff_id).
-- Managers and Directors (level ≥ 70) retain unrestricted write access.
-- SELECT remains open to all authenticated users (unchanged).
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper: return the role level for the current auth user
-- Uses the existing get_current_user_system_role() function already in the DB.
CREATE OR REPLACE FUNCTION public.get_current_user_role_level()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT CASE COALESCE(public.get_current_user_system_role(), 'staff_member')
    WHEN 'support_admin'       THEN 110
    WHEN 'executive_director'  THEN 100
    WHEN 'deputy_director'     THEN 90
    WHEN 'hr_admin_officer'    THEN 80
    WHEN 'programme_manager'   THEN 70
    WHEN 'finance_manager'     THEN 70
    WHEN 'programme_officer'   THEN 50
    WHEN 'finance_officer'     THEN 50
    WHEN 'admin_officer'       THEN 50
    WHEN 'project_coordinator' THEN 40
    WHEN 'staff_member'        THEN 30
    ELSE                            30
  END;
$$;

-- Helper: return the staff_id linked to the current auth user
CREATE OR REPLACE FUNCTION public.get_current_user_staff_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT staff_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ── Drop the old permissive write policy ─────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_manage_workplan_settings" ON public.workplan_settings;

-- ── New INSERT policy ─────────────────────────────────────────────────────────
-- Managers/Directors (level ≥ 70): can insert any row.
-- Staff (level < 70): can only insert a row for their own staff_id.
DROP POLICY IF EXISTS "workplan_insert_own_or_manager" ON public.workplan_settings;
CREATE POLICY "workplan_insert_own_or_manager" ON public.workplan_settings
FOR INSERT TO authenticated
WITH CHECK (
  public.get_current_user_role_level() >= 70
  OR staff_id = public.get_current_user_staff_id()
);

-- ── New UPDATE policy ─────────────────────────────────────────────────────────
-- Managers/Directors (level ≥ 70): can update any row.
-- Staff (level < 70): can only update rows that belong to their own staff_id.
DROP POLICY IF EXISTS "workplan_update_own_or_manager" ON public.workplan_settings;
CREATE POLICY "workplan_update_own_or_manager" ON public.workplan_settings
FOR UPDATE TO authenticated
USING (
  public.get_current_user_role_level() >= 70
  OR staff_id = public.get_current_user_staff_id()
)
WITH CHECK (
  public.get_current_user_role_level() >= 70
  OR staff_id = public.get_current_user_staff_id()
);

-- ── New DELETE policy ─────────────────────────────────────────────────────────
-- Only managers/directors (level ≥ 70) may delete workplan rows.
DROP POLICY IF EXISTS "workplan_delete_manager_only" ON public.workplan_settings;
CREATE POLICY "workplan_delete_manager_only" ON public.workplan_settings
FOR DELETE TO authenticated
USING (
  public.get_current_user_role_level() >= 70
);
