-- ============================================================
-- Fix login for pms_support@ecsa.org
-- Resets password hash and repairs auth.identities record
-- so Supabase can authenticate this account correctly.
-- ============================================================

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Resolve the user id
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'pms_support@ecsa.org'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    -- ── Account does not exist at all — create it from scratch ──────────
    v_user_id := gen_random_uuid();

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
      crypt('Support@Ecsa2026!', gen_salt('bf', 10)),
      now(),
      now(),
      now(),
      jsonb_build_object(
        'full_name',   'PMS Support',
        'role',        'admin',
        'system_role', 'support_admin'
      ),
      jsonb_build_object(
        'provider',   'email',
        'providers',  ARRAY['email']::TEXT[]
      ),
      false, false,
      '', null, '', null, '', '', null, '', 0, '', null,
      null, '', '', null
    );

    RAISE NOTICE 'Created new auth user pms_support@ecsa.org (id: %)', v_user_id;
  ELSE
    -- ── Account exists — reset password with a fresh hash ───────────────
    UPDATE auth.users
    SET
      encrypted_password = crypt('Support@Ecsa2026!', gen_salt('bf', 10)),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at         = now()
    WHERE id = v_user_id;

    RAISE NOTICE 'Reset password for pms_support@ecsa.org (id: %)', v_user_id;
  END IF;

  -- ── Ensure exactly one valid email identity exists ───────────────────
  -- Delete any stale / duplicate identity rows for this user
  DELETE FROM auth.identities
  WHERE user_id = v_user_id AND provider = 'email';

  -- Re-insert a clean identity record
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
    v_user_id::TEXT,          -- provider_id must equal user_id::TEXT for email provider
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

  RAISE NOTICE 'Rebuilt auth.identities for pms_support@ecsa.org';

  -- ── Ensure user_profiles row is correct ─────────────────────────────
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
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET
      email                = EXCLUDED.email,
      full_name            = EXCLUDED.full_name,
      role                 = EXCLUDED.role,
      system_role          = EXCLUDED.system_role,
      department           = EXCLUDED.department,
      job_title            = EXCLUDED.job_title,
      avatar_initials      = EXCLUDED.avatar_initials,
      is_active            = EXCLUDED.is_active,
      must_change_password = EXCLUDED.must_change_password,
      updated_at           = now();

  RAISE NOTICE 'pms_support@ecsa.org is ready. Email: pms_support@ecsa.org | Password: Support@Ecsa2026!';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error fixing pms_support@ecsa.org login: %', SQLERRM;
END $$;
