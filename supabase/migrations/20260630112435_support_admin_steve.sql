-- ============================================================
-- Support Admin Account: pms_support@ecsa.org
-- Super access privilege — highest level in the system (level 110)
-- Can access all dashboards, edit everything, reset all passwords
-- ============================================================

DO $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_staff_id UUID := gen_random_uuid();
  v_existing_user_id UUID;
  v_existing_staff_id UUID;
BEGIN
  -- Check if user already exists in auth.users
  SELECT id INTO v_existing_user_id
  FROM auth.users
  WHERE email = 'pms_support@ecsa.org'
  LIMIT 1;

  IF v_existing_user_id IS NOT NULL THEN
    -- User already exists — just ensure profile is correct
    v_user_id := v_existing_user_id;
    RAISE NOTICE 'Auth user pms_support@ecsa.org already exists (id: %), updating profile only.', v_user_id;
  ELSE
    -- Create the auth.users record
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_user_meta_data,
      raw_app_meta_data,
      is_sso_user,
      is_anonymous,
      confirmation_token,
      confirmation_sent_at,
      recovery_token,
      recovery_sent_at,
      email_change_token_new,
      email_change,
      email_change_sent_at,
      email_change_token_current,
      email_change_confirm_status,
      reauthentication_token,
      reauthentication_sent_at,
      phone,
      phone_change,
      phone_change_token,
      phone_change_sent_at
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'pms_support@ecsa.org',
      crypt('Support@Ecsa2026!', gen_salt('bf', 8)),
      now(),
      now(),
      now(),
      jsonb_build_object(
        'full_name', 'PMS Support',
        'role', 'support_admin',
        'system_role', 'support_admin'
      ),
      jsonb_build_object(
        'provider', 'email',
        'providers', ARRAY['email']::TEXT[]
      ),
      false,
      false,
      '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
    );

    -- Create auth identity for email provider
    INSERT INTO auth.identities (
      id,
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id::TEXT,
      v_user_id,
      jsonb_build_object(
        'sub',            v_user_id::TEXT,
        'email',          'pms_support@ecsa.org',
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      now(),
      now(),
      now()
    );

    RAISE NOTICE 'Created auth user pms_support@ecsa.org with id: %', v_user_id;
  END IF;

  -- Check if a staff record already exists for this user
  SELECT id INTO v_existing_staff_id
  FROM public.staff
  WHERE email = 'pms_support@ecsa.org'
  LIMIT 1;

  IF v_existing_staff_id IS NOT NULL THEN
    v_staff_id := v_existing_staff_id;
    -- Update existing staff record
    UPDATE public.staff
    SET
      full_name        = 'PMS Support',
      job_title        = 'Support Administrator',
      system_role      = 'executive_director',
      employment_status = 'active',
      updated_at       = now()
    WHERE id = v_staff_id;
    RAISE NOTICE 'Updated existing staff record for pms_support@ecsa.org (id: %)', v_staff_id;
  ELSE
    -- Create staff record
    INSERT INTO public.staff (
      id,
      full_name,
      job_title,
      employment_status,
      system_role,
      email,
      created_at,
      updated_at
    ) VALUES (
      v_staff_id,
      'PMS Support',
      'Support Administrator',
      'active',
      'executive_director',
      'pms_support@ecsa.org',
      now(),
      now()
    );
    RAISE NOTICE 'Created staff record for pms_support@ecsa.org (id: %)', v_staff_id;
  END IF;

  -- Upsert user_profiles with support_admin system_role (highest privilege)
  INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    role,
    system_role,
    department,
    job_title,
    avatar_initials,
    is_active,
    must_change_password,
    staff_id,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    'pms_support@ecsa.org',
    'PMS Support',
    'admin'::public.user_role,
    'support_admin',
    'Support',
    'Support Administrator',
    'PS',
    true,
    false,
    v_staff_id,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET
      email             = EXCLUDED.email,
      full_name         = EXCLUDED.full_name,
      role              = EXCLUDED.role,
      system_role       = EXCLUDED.system_role,
      department        = EXCLUDED.department,
      job_title         = EXCLUDED.job_title,
      avatar_initials   = EXCLUDED.avatar_initials,
      is_active         = EXCLUDED.is_active,
      must_change_password = EXCLUDED.must_change_password,
      staff_id          = EXCLUDED.staff_id,
      updated_at        = now();

  RAISE NOTICE 'Support admin account pms_support@ecsa.org is ready. Password: Support@Ecsa2026!';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating support admin: %', SQLERRM;
END $$;
