-- ============================================================
-- Fix Admin Roles Migration
-- Ensures director@ecsahc.org and hr@ecsahc.org have correct
-- system_role and role values in user_profiles so they can
-- access the Admin Dashboard (requires hr_admin_officer level+)
-- ============================================================

-- 1. Ensure director@ecsahc.org has executive_director role
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the auth user id for director@ecsahc.org
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'director@ecsahc.org'
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Upsert user_profiles with correct role
    INSERT INTO public.user_profiles (
      id, email, full_name, role, system_role, is_active, must_change_password
    ) VALUES (
      v_user_id,
      'director@ecsahc.org',
      'Dr. James Kamau',
      'admin'::public.user_role,
      'executive_director',
      true,
      false
    )
    ON CONFLICT (id) DO UPDATE
      SET system_role        = 'executive_director',
          role               = 'admin'::public.user_role,
          is_active          = true,
          must_change_password = false,
          updated_at         = CURRENT_TIMESTAMP;

    RAISE NOTICE 'director@ecsahc.org role set to executive_director';
  ELSE
    RAISE NOTICE 'director@ecsahc.org not found in auth.users — skipping';
  END IF;
END $$;

-- 2. Ensure hr@ecsahc.org has hr_admin_officer role
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the auth user id for hr@ecsahc.org
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'hr@ecsahc.org'
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Upsert user_profiles with correct role
    INSERT INTO public.user_profiles (
      id, email, full_name, role, system_role, is_active, must_change_password
    ) VALUES (
      v_user_id,
      'hr@ecsahc.org',
      'Grace Mwangi',
      'admin'::public.user_role,
      'hr_admin_officer',
      true,
      false
    )
    ON CONFLICT (id) DO UPDATE
      SET system_role        = 'hr_admin_officer',
          role               = 'admin'::public.user_role,
          is_active          = true,
          must_change_password = false,
          updated_at         = CURRENT_TIMESTAMP;

    RAISE NOTICE 'hr@ecsahc.org role set to hr_admin_officer';
  ELSE
    RAISE NOTICE 'hr@ecsahc.org not found in auth.users — skipping';
  END IF;
END $$;

-- 3. Fix handle_new_user trigger to properly upsert system_role and role
--    so future user creation/re-seeding preserves correct roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role, system_role, is_active, must_change_password)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')::public.user_role,
    COALESCE(NEW.raw_user_meta_data->>'system_role', 'staff_member'),
    true,
    false
  )
  ON CONFLICT (id) DO UPDATE
    SET email                = EXCLUDED.email,
        full_name            = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
        role                 = COALESCE(EXCLUDED.role, public.user_profiles.role),
        system_role          = COALESCE(EXCLUDED.system_role, public.user_profiles.system_role),
        updated_at           = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;
