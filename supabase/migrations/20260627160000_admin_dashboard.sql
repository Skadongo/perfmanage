-- ============================================================
-- Admin Dashboard Migration
-- Adds: login_audit_logs table, admin helper functions
-- ============================================================

-- 1. Login Audit Logs Table
CREATE TABLE IF NOT EXISTS public.login_audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email         TEXT NOT NULL,
  event_type    TEXT NOT NULL DEFAULT 'login', -- login | logout | failed_login | password_reset
  ip_address    TEXT,
  user_agent    TEXT,
  success       BOOLEAN NOT NULL DEFAULT true,
  failure_reason TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_login_audit_logs_user_id   ON public.login_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_audit_logs_email     ON public.login_audit_logs(email);
CREATE INDEX IF NOT EXISTS idx_login_audit_logs_created   ON public.login_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_audit_logs_event     ON public.login_audit_logs(event_type);

-- 2. Admin helper: check if current user is admin/hr
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.system_role IN ('executive_director','deputy_director','hr_admin_officer')
      AND up.is_active = true
  );
$$;

-- 3. Admin helper: get all user profiles with staff info (for admin dashboard)
CREATE OR REPLACE FUNCTION public.admin_get_all_users()
RETURNS TABLE (
  user_id       UUID,
  email         TEXT,
  full_name     TEXT,
  system_role   TEXT,
  role          TEXT,
  department    TEXT,
  job_title     TEXT,
  is_active     BOOLEAN,
  must_change_password BOOLEAN,
  staff_id      UUID,
  staff_email   TEXT,
  staff_job_title TEXT,
  created_at    TIMESTAMPTZ,
  last_sign_in  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    up.id                       AS user_id,
    up.email                    AS email,
    up.full_name                AS full_name,
    up.system_role              AS system_role,
    up.role::TEXT               AS role,
    COALESCE(up.department,'')  AS department,
    COALESCE(up.job_title,'')   AS job_title,
    up.is_active                AS is_active,
    up.must_change_password     AS must_change_password,
    up.staff_id                 AS staff_id,
    s.email                     AS staff_email,
    s.job_title                 AS staff_job_title,
    up.created_at               AS created_at,
    au.last_sign_in_at          AS last_sign_in
  FROM public.user_profiles up
  LEFT JOIN public.staff s ON s.id = up.staff_id
  LEFT JOIN auth.users au ON au.id = up.id
  ORDER BY up.full_name;
END;
$$;

-- 4. Admin helper: update user role
CREATE OR REPLACE FUNCTION public.admin_update_user_role(
  target_user_id UUID,
  new_system_role TEXT,
  new_role TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  UPDATE public.user_profiles
  SET
    system_role = new_system_role,
    role        = new_role::public.user_role,
    updated_at  = CURRENT_TIMESTAMP
  WHERE id = target_user_id;

  -- Log the action
  INSERT INTO public.activity_logs (
    activity_type, actor_name, action_description, subject_name,
    icon_name, icon_bg, icon_color
  )
  SELECT
    'role_change',
    up.full_name,
    'Updated role to ' || new_system_role,
    (SELECT full_name FROM public.user_profiles WHERE id = target_user_id),
    'ShieldCheckIcon',
    'bg-violet-50',
    'text-violet-600'
  FROM public.user_profiles up
  WHERE up.id = auth.uid();

  RETURN true;
END;
$$;

-- 5. Admin helper: toggle user active status
CREATE OR REPLACE FUNCTION public.admin_toggle_user_active(
  target_user_id UUID,
  new_is_active BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  UPDATE public.user_profiles
  SET is_active = new_is_active, updated_at = CURRENT_TIMESTAMP
  WHERE id = target_user_id;

  RETURN true;
END;
$$;

-- 6. Admin helper: force password reset flag
CREATE OR REPLACE FUNCTION public.admin_force_password_reset(
  target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  UPDATE public.user_profiles
  SET must_change_password = true, updated_at = CURRENT_TIMESTAMP
  WHERE id = target_user_id;

  -- Log the action
  INSERT INTO public.activity_logs (
    activity_type, actor_name, action_description, subject_name,
    icon_name, icon_bg, icon_color
  )
  SELECT
    'password_reset',
    up.full_name,
    'Forced password reset',
    (SELECT full_name FROM public.user_profiles WHERE id = target_user_id),
    'KeyIcon',
    'bg-amber-50',
    'text-amber-600'
  FROM public.user_profiles up
  WHERE up.id = auth.uid();

  RETURN true;
END;
$$;

-- 7. Admin helper: get login audit logs
CREATE OR REPLACE FUNCTION public.admin_get_login_audit(
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id            UUID,
  user_id       UUID,
  email         TEXT,
  event_type    TEXT,
  ip_address    TEXT,
  success       BOOLEAN,
  failure_reason TEXT,
  created_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    l.id, l.user_id, l.email, l.event_type,
    l.ip_address, l.success, l.failure_reason, l.created_at
  FROM public.login_audit_logs l
  ORDER BY l.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 8. Enable RLS on login_audit_logs
ALTER TABLE public.login_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_access_login_audit_logs" ON public.login_audit_logs;
CREATE POLICY "admin_full_access_login_audit_logs"
ON public.login_audit_logs
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- Allow users to insert their own login events (for client-side logging)
DROP POLICY IF EXISTS "users_insert_own_login_audit" ON public.login_audit_logs;
CREATE POLICY "users_insert_own_login_audit"
ON public.login_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
