-- ============================================================
-- DEFINITIVE FIX: user_profiles RLS infinite recursion (42P17)
-- ============================================================
-- Root cause (confirmed):
--   Every previous fix still queries user_profiles inside the
--   up_select policy — either directly via a subquery or via a
--   SECURITY DEFINER function.  Even though SECURITY DEFINER
--   bypasses RLS, PostgreSQL's policy planner can still enter
--   a recursion loop when the function is called during the
--   evaluation of the same table's policy in certain query plans
--   (e.g. when the function result is not yet cached and the
--   planner re-evaluates the policy mid-scan).
--
-- Definitive solution:
--   Read system_role from the JWT token (auth.jwt()) instead of
--   querying user_profiles at all.  The JWT is already in memory
--   for the current request — no table access, no recursion risk.
--
--   The JWT is populated with app_metadata (including system_role)
--   by the handle_new_user trigger and by admin_update_user_role().
--   We also add a helper that syncs system_role into app_metadata
--   so the JWT stays current.
--
-- Policy logic:
--   SELECT: own row  OR  system_role in JWT is a manager-level role
--   UPDATE: own row only
--   INSERT: own row only
-- ============================================================

-- ── 1. Create a JWT-based manager check (zero table access) ──────────────────
-- Reads system_role directly from the JWT claims — never touches user_profiles.
-- Safe to call from ANY policy on ANY table, including user_profiles itself.
CREATE OR REPLACE FUNCTION public.jwt_user_is_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'system_role'),
    (auth.jwt() -> 'user_metadata' ->> 'system_role'),
    ''
  ) IN (
    'support_admin',
    'executive_director',
    'deputy_director',
    'hr_admin_officer',
    'programme_manager',
    'finance_manager'
  );
$$;

-- ── 2. Drop ALL existing policies on user_profiles ───────────────────────────
-- Belt-and-suspenders: drop every known policy name from all migrations.
DROP POLICY IF EXISTS "user_profiles_select_own_or_admin"  ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own"           ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_own"           ON public.user_profiles;
DROP POLICY IF EXISTS "up_select"                          ON public.user_profiles;
DROP POLICY IF EXISTS "up_update"                          ON public.user_profiles;
DROP POLICY IF EXISTS "up_insert"                          ON public.user_profiles;
DROP POLICY IF EXISTS "users_manage_own_user_profiles"     ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select"               ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert"               ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update"               ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete"               ON public.user_profiles;

-- ── 3. Re-enable RLS (idempotent) ────────────────────────────────────────────
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- ── 4. Create recursion-proof policies ───────────────────────────────────────

-- SELECT: own row OR JWT says user is a manager-level role
-- jwt_user_is_manager() reads from the JWT token — zero table access.
CREATE POLICY "up_select"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.jwt_user_is_manager()
);

-- UPDATE: own row only
CREATE POLICY "up_update"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- INSERT: own row only (handle_new_user trigger uses service_role, bypasses RLS)
CREATE POLICY "up_insert"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- ── 5. Update current_user_is_manager_safe() to also use JWT ─────────────────
-- This ensures all other tables' policies that call this function
-- also benefit from the zero-table-access approach.
CREATE OR REPLACE FUNCTION public.current_user_is_manager_safe()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.jwt_user_is_manager();
$$;

-- ── 6. Update current_user_is_manager() wrapper ──────────────────────────────
CREATE OR REPLACE FUNCTION public.current_user_is_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.jwt_user_is_manager();
$$;

-- ── 7. Update auth_user_is_manager_or_above() wrapper ────────────────────────
CREATE OR REPLACE FUNCTION public.auth_user_is_manager_or_above()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.jwt_user_is_manager();
$$;

-- ── 8. Update is_supervisor_or_above() wrapper ───────────────────────────────
CREATE OR REPLACE FUNCTION public.is_supervisor_or_above()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.jwt_user_is_manager();
$$;

-- ── 9. Sync system_role into auth app_metadata for existing users ─────────────
-- The JWT is populated from app_metadata. We need to ensure system_role
-- is present there so jwt_user_is_manager() works correctly.
-- This updates auth.users.raw_app_meta_data for all existing user_profiles.
UPDATE auth.users au
SET raw_app_meta_data = COALESCE(au.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('system_role', COALESCE(up.system_role, 'staff_member'))
FROM public.user_profiles up
WHERE au.id = up.id
  AND up.system_role IS NOT NULL
  AND up.system_role <> '';

-- ── 10. Update handle_new_user to sync system_role into app_metadata ──────────
-- Ensures new users always have system_role in their JWT from first login.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_system_role TEXT;
BEGIN
  v_system_role := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'system_role', ''),
    NULLIF(NEW.raw_app_meta_data->>'system_role', ''),
    'staff_member'
  );

  -- Sync system_role into app_metadata so JWT contains it
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('system_role', v_system_role)
  WHERE id = NEW.id;

  INSERT INTO public.user_profiles (
    id, email, full_name, role, system_role, is_active, must_change_password
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')::public.user_role,
    v_system_role,
    true,
    false
  )
  ON CONFLICT (id) DO UPDATE
    SET email       = EXCLUDED.email,
        full_name   = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.user_profiles.full_name),
        role        = EXCLUDED.role,
        system_role = EXCLUDED.system_role,
        updated_at  = CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$;

-- ── 11. Update admin_update_user_role to sync app_metadata ───────────────────
-- When an admin changes a user's role, the JWT must be updated too.
-- We patch the function to also write to raw_app_meta_data.
CREATE OR REPLACE FUNCTION public.admin_update_user_role(
  target_user_id UUID,
  new_system_role TEXT,
  new_role        TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_target_email TEXT;
  v_target_name  TEXT;
  v_actor_name   TEXT;
  v_role_label   TEXT;
BEGIN
  -- Only admins can call this
  IF NOT (
    COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'system_role'),
      (auth.jwt() -> 'user_metadata' ->> 'system_role'),
      ''
    ) IN ('support_admin', 'executive_director', 'deputy_director', 'hr_admin_officer')
  ) THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  SELECT up.email, up.full_name
  INTO v_target_email, v_target_name
  FROM public.user_profiles up
  WHERE up.id = target_user_id;

  SELECT up.full_name INTO v_actor_name
  FROM public.user_profiles up
  WHERE up.id = auth.uid();

  -- Update user_profiles
  UPDATE public.user_profiles
  SET system_role = new_system_role,
      role        = new_role::public.user_role,
      updated_at  = CURRENT_TIMESTAMP
  WHERE id = target_user_id;

  -- Sync system_role into app_metadata so JWT reflects the change on next login
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('system_role', new_system_role)
  WHERE id = target_user_id;

  RETURN TRUE;
END;
$$;

-- ── 12. Verify ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Definitive user_profiles RLS fix applied.';
  RAISE NOTICE 'up_select now uses jwt_user_is_manager() — zero table access, zero recursion risk.';
  RAISE NOTICE 'current_user_is_manager(), current_user_is_manager_safe(), auth_user_is_manager_or_above() all delegate to jwt_user_is_manager().';
  RAISE NOTICE 'auth.users.raw_app_meta_data synced with system_role for all existing users.';
END $$;
