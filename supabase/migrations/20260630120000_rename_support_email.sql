-- ============================================================
-- Rename support admin email: steve@support_ecsa.org → pms_support@ecsa.org
-- ============================================================

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the existing user id
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'steve@support_ecsa.org'
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Update auth.users
    UPDATE auth.users
    SET
      email   = 'pms_support@ecsa.org',
      updated_at = now()
    WHERE id = v_user_id;

    -- Update auth.identities
    UPDATE auth.identities
    SET
      identity_data = identity_data || jsonb_build_object('email', 'pms_support@ecsa.org'),
      updated_at    = now()
    WHERE user_id = v_user_id
      AND provider = 'email';

    -- Update public.staff
    UPDATE public.staff
    SET
      email      = 'pms_support@ecsa.org',
      updated_at = now()
    WHERE email = 'steve@support_ecsa.org';

    -- Update public.user_profiles
    UPDATE public.user_profiles
    SET
      email      = 'pms_support@ecsa.org',
      updated_at = now()
    WHERE id = v_user_id;

    RAISE NOTICE 'Support admin email updated to pms_support@ecsa.org (user id: %)', v_user_id;
  ELSE
    -- User may already have been renamed or doesn't exist — check new email
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'pms_support@ecsa.org') THEN
      RAISE NOTICE 'Email pms_support@ecsa.org already exists — no changes needed.';
    ELSE
      RAISE NOTICE 'User steve@support_ecsa.org not found — no changes made.';
    END IF;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error renaming support admin email: %', SQLERRM;
END $$;
