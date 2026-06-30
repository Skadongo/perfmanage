-- ============================================================
-- Staff Email, Role Assignment & Password Reset Support
-- Adds email column to staff table
-- Adds HR/Director policy to update any user_profiles row
-- Adds helper function to get staff auth user id by email
-- ============================================================

-- 1. Add email column to staff table (idempotent)
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS idx_staff_email ON public.staff(email);

-- 2. Add system_role column to staff table for display purposes (idempotent)
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS system_role TEXT DEFAULT 'staff_member';

-- 3. Allow HR/Directors to update ANY user_profiles row (for role assignment)
--    The existing policy only allows users to update their own profile.
--    We add a separate elevated-access policy for HR/Director roles.
DROP POLICY IF EXISTS "hr_directors_manage_all_profiles" ON public.user_profiles;
CREATE POLICY "hr_directors_manage_all_profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (public.is_hr_or_director())
WITH CHECK (public.is_hr_or_director());

-- 4. Helper function: get auth user id by email (used for password reset)
CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM auth.users WHERE email = p_email LIMIT 1;
$$;

-- 5. Helper function: update staff system_role in user_profiles by email
CREATE OR REPLACE FUNCTION public.assign_staff_role(
  p_email TEXT,
  p_system_role TEXT,
  p_role TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.user_profiles
  SET system_role = p_system_role,
      role = p_role::public.user_role,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = v_user_id;

  RETURN TRUE;
END;
$$;

-- 6. Helper function: reset staff password (admin-level, SECURITY DEFINER)
--    Uses Supabase admin API pattern via auth schema
CREATE OR REPLACE FUNCTION public.admin_reset_staff_password(
  p_email TEXT,
  p_new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf', 8)),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = v_user_id;

  -- Force password change on next login
  UPDATE public.user_profiles
  SET must_change_password = TRUE,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = v_user_id;

  RETURN TRUE;
END;
$$;

DO $$ BEGIN RAISE NOTICE 'Staff email, role assignment, and password reset support added successfully.'; END $$;
