-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Superuser Account
-- Adds a 'superuser' role with level 120 (above all existing roles),
-- creates the superuser auth account, and protects it from deletion.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Add 'superuser' value to the staff_role enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'superuser'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'staff_role')
  ) THEN
    ALTER TYPE public.staff_role ADD VALUE 'superuser';
  END IF;
END $$;

-- Step 2: Create the superuser auth account (idempotent via ON CONFLICT)
DO $$
DECLARE
  v_superuser_id UUID := gen_random_uuid();
  v_existing_id  UUID;
BEGIN
  -- Check if superuser already exists
  SELECT id INTO v_existing_id
  FROM auth.users
  WHERE email = 'superadmin@ecsahc.int'
  LIMIT 1;

  IF v_existing_id IS NULL THEN
    -- Create auth.users entry
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_user_meta_data, raw_app_meta_data,
      is_sso_user, is_anonymous,
      confirmation_token, confirmation_sent_at,
      recovery_token, recovery_sent_at,
      email_change_token_new, email_change, email_change_sent_at,
      email_change_token_current, email_change_confirm_status,
      reauthentication_token, reauthentication_sent_at,
      phone, phone_change, phone_change_token, phone_change_sent_at
    ) VALUES (
      v_superuser_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'superadmin@ecsahc.int',
      crypt('Ecsahc@SuperAdmin2026!', gen_salt('bf', 10)),
      now(), now(), now(),
      jsonb_build_object(
        'full_name', 'System Super Administrator',
        'role', 'admin',
        'system_role', 'superuser'
      ),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
      false, false,
      '', null, '', null, '', '', null, '', 0, '', null,
      null, '', '', null
    )
    ON CONFLICT (id) DO NOTHING;

    -- Create user_profiles entry
    INSERT INTO public.user_profiles (
      id, email, full_name, role, system_role,
      department, job_title, avatar_initials,
      is_active, must_change_password
    ) VALUES (
      v_superuser_id,
      'superadmin@ecsahc.int',
      'System Super Administrator',
      'admin'::public.user_role,
      'superuser',
      'System',
      'Super Administrator',
      'SA',
      true,
      false
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Superuser account created with id: %', v_superuser_id;
  ELSE
    -- Ensure existing superuser profile has correct role
    UPDATE public.user_profiles
    SET system_role = 'superuser',
        role = 'admin'::public.user_role,
        must_change_password = false
    WHERE id = v_existing_id;

    RAISE NOTICE 'Superuser account already exists, role confirmed: %', v_existing_id;
  END IF;
END $$;

-- Step 3: Protect superuser from deletion via trigger on user_profiles
CREATE OR REPLACE FUNCTION public.protect_superuser_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.system_role = 'superuser' THEN
    RAISE EXCEPTION 'The superuser account cannot be deleted.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_superuser_profile ON public.user_profiles;
CREATE TRIGGER trg_protect_superuser_profile
  BEFORE DELETE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_superuser_profile();

-- Step 4: Protect superuser from deletion via trigger on staff table
-- (in case a superuser entry is ever linked to the staff table)
CREATE OR REPLACE FUNCTION public.protect_superuser_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.system_role::TEXT = 'superuser' THEN
    RAISE EXCEPTION 'The superuser account cannot be deleted from the staff table.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_superuser_staff ON public.staff;
CREATE TRIGGER trg_protect_superuser_staff
  BEFORE DELETE ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_superuser_staff();
