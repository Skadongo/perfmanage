-- ============================================================
-- CONCLUSIVE ROLE FIX — Different approach: use auth.users metadata directly
-- Root cause: user_profiles.system_role stuck at 'staff_member' because:
--   1. handle_new_user trigger ON CONFLICT only updates email/full_name, never system_role
--   2. Previous fix relied on staff_id JOIN but staff_id was never populated
-- This fix: JOIN user_profiles directly to auth.users on id, pull system_role
--   from raw_user_meta_data — bypasses staff table entirely.
-- ============================================================

-- Step 1: Direct UPDATE using auth.users.raw_user_meta_data as authoritative source
-- This works for ALL 54 staff because raw_user_meta_data was set correctly when
-- auth.users rows were created in the staff_auth_logins migration.
UPDATE public.user_profiles up
SET
  system_role    = COALESCE(
                     NULLIF(au.raw_user_meta_data->>'system_role', ''),
                     up.system_role,
                     'staff_member'
                   ),
  role           = CASE
                     WHEN au.raw_user_meta_data->>'role' = 'admin'   THEN 'admin'::public.user_role
                     WHEN au.raw_user_meta_data->>'role' = 'manager' THEN 'manager'::public.user_role
                     ELSE 'staff'::public.user_role
                   END,
  full_name      = COALESCE(
                     NULLIF(up.full_name, ''),
                     au.raw_user_meta_data->>'full_name',
                     split_part(au.email, '@', 1)
                   ),
  updated_at     = NOW()
FROM auth.users au
WHERE up.id = au.id
  AND au.raw_user_meta_data->>'system_role' IS NOT NULL
  AND au.raw_user_meta_data->>'system_role' <> '';

-- Step 2: Fix the handle_new_user trigger so future logins/re-inserts
-- always sync system_role from raw_user_meta_data (prevents regression)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id, email, full_name, role, system_role, is_active, must_change_password
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')::public.user_role,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'system_role', ''), 'staff_member'),
    true,
    false
  )
  ON CONFLICT (id) DO UPDATE
    SET email         = EXCLUDED.email,
        full_name     = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.user_profiles.full_name),
        role          = EXCLUDED.role,
        system_role   = EXCLUDED.system_role,
        updated_at    = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- Step 3: Also update get_current_user_system_role to be safe
CREATE OR REPLACE FUNCTION public.get_current_user_system_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    NULLIF(system_role, ''),
    'staff_member'
  )
  FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Step 4: Verify — raise notice with count of non-staff_member roles after fix
DO $$
DECLARE
  v_total   INTEGER;
  v_fixed   INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.user_profiles;
  SELECT COUNT(*) INTO v_fixed
  FROM public.user_profiles
  WHERE system_role <> 'staff_member';

  RAISE NOTICE 'Role fix complete: % of % user_profiles now have non-staff_member roles',
    v_fixed, v_total;
END;
$$;
