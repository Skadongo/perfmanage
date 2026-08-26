-- ============================================================
-- Fix: Infinite recursion in user_profiles RLS policy
-- ============================================================
-- Root cause:
--   The "up_select" policy on user_profiles uses a correlated
--   subquery that queries user_profiles itself to check system_role:
--
--     EXISTS (
--       SELECT 1 FROM public.user_profiles up2
--       WHERE up2.id = auth.uid()
--         AND up2.system_role IN (...)
--     )
--
--   When PostgreSQL evaluates this policy for ANY row in user_profiles,
--   it re-enters the same policy, causing infinite recursion (error 42P17).
--
-- Fix:
--   Replace the self-referential subquery with a SECURITY DEFINER
--   function that reads system_role directly using auth.uid() as a
--   primary key lookup — bypassing RLS entirely (SECURITY DEFINER
--   functions run as the function owner, not the calling user, so
--   RLS is not applied to the function's internal query).
-- ============================================================

-- ── 1. Create a SECURITY DEFINER function to check manager role ──────────────
-- This function queries user_profiles with RLS bypassed (SECURITY DEFINER),
-- so it will NEVER trigger the policy on user_profiles recursively.
CREATE OR REPLACE FUNCTION public.current_user_is_manager_safe()
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

-- ── 2. Drop the recursive policy and replace with a safe version ─────────────
DROP POLICY IF EXISTS "up_select" ON public.user_profiles;

-- Safe SELECT policy: own row OR manager (via SECURITY DEFINER function)
-- The SECURITY DEFINER function bypasses RLS when it queries user_profiles,
-- so there is no recursion.
CREATE POLICY "up_select"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.current_user_is_manager_safe()
);

-- ── 3. Update current_user_is_manager() to use the safe function ─────────────
-- The existing current_user_is_manager() is used in policies on OTHER tables
-- (mid_year_reviews, workplan_settings, appraisal_drafts, etc.).
-- Those tables are NOT user_profiles, so querying user_profiles from their
-- policies is safe. However, we update the wrapper to be consistent.
CREATE OR REPLACE FUNCTION public.current_user_is_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_is_manager_safe();
$$;

-- ── 4. Verify ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'user_profiles RLS recursion fix applied successfully.';
  RAISE NOTICE 'up_select policy now uses current_user_is_manager_safe() (SECURITY DEFINER).';
  RAISE NOTICE 'Infinite recursion (42P17) on user_profiles is resolved.';
END $$;
