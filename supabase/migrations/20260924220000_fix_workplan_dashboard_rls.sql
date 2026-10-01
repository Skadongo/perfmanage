-- Fix: Allow admins, HR, directors, and superusers to SELECT all workplan_settings rows
-- so dashboards can correctly count and display submitted workplans.

-- Update the SELECT policy to include all privileged roles
DROP POLICY IF EXISTS "workplan_select_own_or_manager" ON public.workplan_settings;
CREATE POLICY "workplan_select_own_or_manager"
ON public.workplan_settings
FOR SELECT
TO authenticated
USING (
  staff_id = public.auth_user_staff_id()
  OR public.auth_user_is_manager_or_above()
  OR EXISTS (
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
  )
);
