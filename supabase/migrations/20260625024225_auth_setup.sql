-- ============================================================
-- Auth Setup: trigger, RLS policies, and demo users
-- ============================================================

-- 1. Function: auto-create user_profiles row on new auth user
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
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
        updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- 2. Trigger: fires after new auth user created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Helper function: get current user system_role (avoids recursion in RLS)
CREATE OR REPLACE FUNCTION public.get_current_user_system_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT system_role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 4. Helper function: check if current user is HR/Director level
CREATE OR REPLACE FUNCTION public.is_hr_or_director()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND system_role IN ('executive_director', 'deputy_director', 'hr_admin_officer')
  );
$$;

-- 5. RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_view_own_profile" ON public.user_profiles;
CREATE POLICY "users_view_own_profile"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_hr_or_director());

DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
CREATE POLICY "users_update_own_profile"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "users_insert_own_profile" ON public.user_profiles;
CREATE POLICY "users_insert_own_profile"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- 6. Demo users for testing
DO $$
DECLARE
  dir_uuid    UUID := gen_random_uuid();
  hr_uuid     UUID := gen_random_uuid();
  mgr_uuid    UUID := gen_random_uuid();
  staff_uuid  UUID := gen_random_uuid();
BEGIN
  -- Executive Director
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES (
    dir_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'director@ecsahc.org', crypt('Director@2026', gen_salt('bf', 10)), now(), now(), now(),
    jsonb_build_object('full_name', 'Dr. James Kamau', 'role', 'admin', 'system_role', 'executive_director'),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
    false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
  ) ON CONFLICT (id) DO NOTHING;

  -- HR Admin Officer
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES (
    hr_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'hr@ecsahc.org', crypt('HRAdmin@2026', gen_salt('bf', 10)), now(), now(), now(),
    jsonb_build_object('full_name', 'Grace Mwangi', 'role', 'admin', 'system_role', 'hr_admin_officer'),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
    false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
  ) ON CONFLICT (id) DO NOTHING;

  -- Programme Manager
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES (
    mgr_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'manager@ecsahc.org', crypt('Manager@2026', gen_salt('bf', 10)), now(), now(), now(),
    jsonb_build_object('full_name', 'Samuel Odhiambo', 'role', 'manager', 'system_role', 'programme_manager'),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
    false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
  ) ON CONFLICT (id) DO NOTHING;

  -- Staff Member
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES (
    staff_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'staff@ecsahc.org', crypt('Staff@2026', gen_salt('bf', 10)), now(), now(), now(),
    jsonb_build_object('full_name', 'Amina Hassan', 'role', 'staff', 'system_role', 'programme_officer'),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
    false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
  ) ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Demo user creation skipped: %', SQLERRM;
END $$;
