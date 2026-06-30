-- ============================================================
-- Director General Admin Access Migration
-- Ensures ntuli.kapologwe@ecsahc.org (Director General) has
-- system_role = 'executive_director' and role = 'admin' in
-- user_profiles so they can access the Admin Dashboard
-- (which requires minLevel >= 80 / hr_admin_officer+)
-- ============================================================

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the auth user id for the Director General
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'ntuli.kapologwe@ecsahc.org'
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Upsert user_profiles with correct executive_director role
    INSERT INTO public.user_profiles (
      id,
      email,
      full_name,
      role,
      system_role,
      is_active,
      must_change_password
    ) VALUES (
      v_user_id,
      'ntuli.kapologwe@ecsahc.org',
      'Ntuli A. Kapologwe',
      'admin'::public.user_role,
      'executive_director',
      true,
      false
    )
    ON CONFLICT (id) DO UPDATE
      SET system_role          = 'executive_director',
          role                 = 'admin'::public.user_role,
          full_name            = COALESCE(public.user_profiles.full_name, 'Ntuli A. Kapologwe'),
          is_active            = true,
          must_change_password = false,
          updated_at           = CURRENT_TIMESTAMP;

    RAISE NOTICE 'Director General ntuli.kapologwe@ecsahc.org role set to executive_director (level 100) — Admin Dashboard access granted.';
  ELSE
    RAISE NOTICE 'ntuli.kapologwe@ecsahc.org not found in auth.users — skipping. Run staff auth logins migration first.';
  END IF;
END $$;

-- Also ensure the handle_new_user trigger correctly maps executive_director
-- from raw_user_meta_data so future re-auth events preserve the role
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
    COALESCE(NEW.raw_user_meta_data->>'system_role', 'staff_member'),
    true,
    COALESCE((NEW.raw_user_meta_data->>'must_change_password')::boolean, true)
  )
  ON CONFLICT (id) DO UPDATE
    SET email                = EXCLUDED.email,
        full_name            = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
        role                 = COALESCE(EXCLUDED.role, public.user_profiles.role),
        system_role          = COALESCE(EXCLUDED.system_role, public.user_profiles.system_role),
        must_change_password = COALESCE(EXCLUDED.must_change_password, public.user_profiles.must_change_password),
        updated_at           = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;
