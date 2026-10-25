-- ============================================================
-- Fix SECURITY DEFINER search_path for all staff-role functions
-- ============================================================
-- PostgreSQL security best practice: SECURITY DEFINER functions
-- must pin their search_path to prevent a malicious user from
-- creating objects in a schema that shadows public/auth and
-- hijacking the function's execution context.
--
-- All functions below are re-declared with:
--   SET search_path = public, auth
-- No logic changes — only the security attribute is added.
-- ============================================================

-- ── 1. handle_new_user (auth trigger) ────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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
    SET email       = EXCLUDED.email,
        full_name   = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.user_profiles.full_name),
        role        = EXCLUDED.role,
        system_role = EXCLUDED.system_role,
        updated_at  = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- ── 2. get_current_user_system_role ──────────────────────────
CREATE OR REPLACE FUNCTION public.get_current_user_system_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    NULLIF(system_role, ''),
    'staff_member'
  )
  FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- ── 3. is_hr_or_director ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_hr_or_director()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND system_role IN ('executive_director', 'deputy_director', 'hr_admin_officer')
  );
$$;

-- ── 4. is_admin_user ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.system_role IN (
        'executive_director', 'deputy_director', 'hr_admin_officer', 'support_admin'
      )
      AND up.is_active = true
  );
$$;

-- ── 5. get_auth_user_id_by_email ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE email = p_email LIMIT 1;
$$;

-- ── 6. assign_staff_role ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.assign_staff_role(
  p_email       TEXT,
  p_system_role TEXT,
  p_role        TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.user_profiles
  SET system_role = p_system_role,
      role        = p_role::public.user_role,
      updated_at  = CURRENT_TIMESTAMP
  WHERE id = v_user_id;

  RETURN TRUE;
END;
$$;

-- ── 7. admin_reset_staff_password ────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_reset_staff_password(
  p_email        TEXT,
  p_new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf', 8)),
      updated_at         = CURRENT_TIMESTAMP
  WHERE id = v_user_id;

  UPDATE public.user_profiles
  SET must_change_password = TRUE,
      updated_at           = CURRENT_TIMESTAMP
  WHERE id = v_user_id;

  RETURN TRUE;
END;
$$;

-- ── 8. admin_get_all_users ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_all_users()
RETURNS TABLE (
  user_id              UUID,
  email                TEXT,
  full_name            TEXT,
  system_role          TEXT,
  role                 TEXT,
  department           TEXT,
  job_title            TEXT,
  is_active            BOOLEAN,
  must_change_password BOOLEAN,
  staff_id             UUID,
  staff_email          TEXT,
  staff_job_title      TEXT,
  created_at           TIMESTAMPTZ,
  last_sign_in         TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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
    COALESCE(up.department, '') AS department,
    COALESCE(up.job_title, '')  AS job_title,
    up.is_active                AS is_active,
    up.must_change_password     AS must_change_password,
    up.staff_id                 AS staff_id,
    s.email                     AS staff_email,
    s.job_title                 AS staff_job_title,
    up.created_at               AS created_at,
    au.last_sign_in_at          AS last_sign_in
  FROM public.user_profiles up
  LEFT JOIN public.staff s ON s.id = up.staff_id
  LEFT JOIN auth.users au  ON au.id = up.id
  ORDER BY up.full_name;
END;
$$;

-- ── 9. admin_update_user_role ────────────────────────────────
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
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  SELECT up.email, up.full_name
  INTO v_target_email, v_target_name
  FROM public.user_profiles up
  WHERE up.id = target_user_id;

  SELECT up.full_name INTO v_actor_name
  FROM public.user_profiles up
  WHERE up.id = auth.uid();

  v_role_label := CASE new_system_role
    WHEN 'executive_director'  THEN 'Director General'
    WHEN 'deputy_director'     THEN 'Director of Operations'
    WHEN 'hr_admin_officer'    THEN 'HR & Admin Officer'
    WHEN 'programme_manager'   THEN 'Programme Manager'
    WHEN 'finance_manager'     THEN 'Finance Manager'
    WHEN 'programme_officer'   THEN 'Programme Officer'
    WHEN 'finance_officer'     THEN 'Finance Officer'
    WHEN 'admin_officer'       THEN 'Admin Officer'
    WHEN 'project_coordinator' THEN 'Project Coordinator'
    WHEN 'support_admin'       THEN 'Support Administrator'
    ELSE new_system_role
  END;

  UPDATE public.user_profiles
  SET system_role = new_system_role,
      role        = new_role::public.user_role,
      updated_at  = CURRENT_TIMESTAMP
  WHERE id = target_user_id;

  INSERT INTO public.activity_logs (
    activity_type, actor_name, action_description, subject_name,
    icon_name, icon_bg, icon_color
  ) VALUES (
    'role_change',
    COALESCE(v_actor_name, 'Admin'),
    'Updated role to ' || v_role_label,
    v_target_name,
    'ShieldCheckIcon',
    'bg-violet-50',
    'text-violet-600'
  );

  INSERT INTO public.admin_email_log
    (recipient_user_id, recipient_email, email_type, subject, body_preview, sent_by, status)
  VALUES (
    target_user_id,
    COALESCE(v_target_email, ''),
    'role_change',
    'Your ECSA-HC PMS role has been updated',
    'Your system role has been updated to ' || v_role_label ||
      ' by ' || COALESCE(v_actor_name, 'an administrator') || '.',
    auth.uid(),
    'pending'
  );

  RETURN true;
END;
$$;

-- ── 10. admin_force_password_reset ───────────────────────────
CREATE OR REPLACE FUNCTION public.admin_force_password_reset(
  target_user_id UUID
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
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  SELECT up.email, up.full_name
  INTO v_target_email, v_target_name
  FROM public.user_profiles up
  WHERE up.id = target_user_id;

  SELECT up.full_name INTO v_actor_name
  FROM public.user_profiles up
  WHERE up.id = auth.uid();

  UPDATE public.user_profiles
  SET must_change_password = true,
      updated_at           = CURRENT_TIMESTAMP
  WHERE id = target_user_id;

  INSERT INTO public.activity_logs (
    activity_type, actor_name, action_description, subject_name,
    icon_name, icon_bg, icon_color
  ) VALUES (
    'password_reset',
    COALESCE(v_actor_name, 'Admin'),
    'Forced password reset',
    v_target_name,
    'KeyIcon',
    'bg-amber-50',
    'text-amber-600'
  );

  INSERT INTO public.admin_email_log
    (recipient_user_id, recipient_email, email_type, subject, body_preview, sent_by, status)
  VALUES (
    target_user_id,
    COALESCE(v_target_email, ''),
    'password_reset',
    'Action required: Reset your ECSA-HC PMS password',
    'An administrator has requested that you reset your password. You will be prompted to set a new password on your next login.',
    auth.uid(),
    'pending'
  );

  RETURN true;
END;
$$;

-- ── 11. admin_get_bsc_perspectives ───────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_bsc_perspectives()
RETURNS TABLE (
  id          UUID,
  name        TEXT,
  description TEXT,
  weight      NUMERIC,
  sort_order  INTEGER,
  is_active   BOOLEAN,
  color       TEXT,
  created_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.name, p.description, p.weight,
    p.sort_order, p.is_active, p.color,
    p.created_at, p.updated_at
  FROM public.bsc_perspectives_config p
  ORDER BY p.sort_order;
END;
$$;

-- ── 12. admin_upsert_bsc_perspective ─────────────────────────
CREATE OR REPLACE FUNCTION public.admin_upsert_bsc_perspective(
  p_id          UUID,
  p_name        TEXT,
  p_description TEXT,
  p_weight      NUMERIC,
  p_sort_order  INTEGER,
  p_is_active   BOOLEAN,
  p_color       TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  IF p_id IS NOT NULL THEN
    UPDATE public.bsc_perspectives_config
    SET name        = p_name,
        description = p_description,
        weight      = p_weight,
        sort_order  = p_sort_order,
        is_active   = p_is_active,
        color       = p_color,
        updated_at  = CURRENT_TIMESTAMP
    WHERE id = p_id;
    v_id := p_id;
  ELSE
    INSERT INTO public.bsc_perspectives_config
      (name, description, weight, sort_order, is_active, color, created_by)
    VALUES
      (p_name, p_description, p_weight, p_sort_order, p_is_active, p_color, auth.uid())
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- ── 13. admin_delete_bsc_perspective ─────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_bsc_perspective(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  DELETE FROM public.bsc_perspectives_config WHERE id = p_id;
  RETURN true;
END;
$$;

-- ── 14. admin_log_email_notification ─────────────────────────
CREATE OR REPLACE FUNCTION public.admin_log_email_notification(
  p_recipient_user_id UUID,
  p_recipient_email   TEXT,
  p_email_type        TEXT,
  p_subject           TEXT,
  p_body_preview      TEXT    DEFAULT NULL,
  p_status            TEXT    DEFAULT 'sent',
  p_error_message     TEXT    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  INSERT INTO public.admin_email_log
    (recipient_user_id, recipient_email, email_type, subject,
     body_preview, sent_by, status, error_message)
  VALUES
    (p_recipient_user_id, p_recipient_email, p_email_type, p_subject,
     p_body_preview, auth.uid(), p_status, p_error_message)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── 15. admin_get_email_log ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_email_log(
  p_limit  INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id              UUID,
  recipient_email TEXT,
  email_type      TEXT,
  subject         TEXT,
  body_preview    TEXT,
  status          TEXT,
  error_message   TEXT,
  created_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    l.id, l.recipient_email, l.email_type, l.subject,
    l.body_preview, l.status, l.error_message, l.created_at
  FROM public.admin_email_log l
  ORDER BY l.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

DO $$ BEGIN
  RAISE NOTICE 'SECURITY DEFINER search_path fix applied to all 15 staff-role functions.';
END $$;
