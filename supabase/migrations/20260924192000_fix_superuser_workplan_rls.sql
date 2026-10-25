-- Fix: Add 'superuser' to auth_user_is_manager_or_above() so superuser accounts
-- can INSERT/UPDATE workplan_settings records via the bulk upload and manual form.

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
      'support_admin',
      'superuser'
    )
);
$$;
