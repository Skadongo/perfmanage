-- ============================================================
-- Enhanced Admin Migration
-- Adds: bsc_perspectives_config, admin_email_log tables
--       + RPC helpers for email notifications on role/password changes
-- ============================================================

-- 1. BSC Perspectives Configuration Table
CREATE TABLE IF NOT EXISTS public.bsc_perspectives_config (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  weight        NUMERIC(5,2) NOT NULL DEFAULT 25.00,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  color         TEXT NOT NULL DEFAULT '#3B82F6',
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bsc_perspectives_config_active
  ON public.bsc_perspectives_config(is_active, sort_order);

-- 2. Admin Email Notification Log (tracks emails sent by admin actions)
CREATE TABLE IF NOT EXISTS public.admin_email_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email   TEXT NOT NULL,
  email_type    TEXT NOT NULL, -- 'password_reset' | 'role_change'
  subject       TEXT NOT NULL,
  body_preview  TEXT,
  sent_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'sent', -- 'sent' | 'failed'
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_email_log_recipient
  ON public.admin_email_log(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_email_log_type
  ON public.admin_email_log(email_type, created_at DESC);

-- 3. Enable RLS
ALTER TABLE public.bsc_perspectives_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_email_log ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "admin_manage_bsc_perspectives_config" ON public.bsc_perspectives_config;
CREATE POLICY "admin_manage_bsc_perspectives_config"
ON public.bsc_perspectives_config
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "authenticated_read_bsc_perspectives_config" ON public.bsc_perspectives_config;
CREATE POLICY "authenticated_read_bsc_perspectives_config"
ON public.bsc_perspectives_config
FOR SELECT
TO authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "admin_manage_admin_email_log" ON public.admin_email_log;
CREATE POLICY "admin_manage_admin_email_log"
ON public.admin_email_log
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- 5. Seed default BSC perspectives if table is empty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.bsc_perspectives_config LIMIT 1) THEN
    INSERT INTO public.bsc_perspectives_config (name, description, weight, sort_order, color) VALUES
      ('Financial',           'Financial stewardship, budget management, and resource utilisation', 25.00, 1, '#10B981'),
      ('Stakeholder',         'Stakeholder engagement, partnerships, and service delivery quality',  25.00, 2, '#3B82F6'),
      ('Internal Processes',  'Operational efficiency, process improvement, and compliance',         25.00, 3, '#F59E0B'),
      ('Learning & Growth',   'Staff development, innovation, capacity building, and knowledge',     25.00, 4, '#8B5CF6')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 6. RPC: Get BSC perspectives config (admin)
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

-- 7. RPC: Upsert BSC perspective
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
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  IF p_id IS NOT NULL THEN
    UPDATE public.bsc_perspectives_config
    SET
      name        = p_name,
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

-- 8. RPC: Delete BSC perspective
CREATE OR REPLACE FUNCTION public.admin_delete_bsc_perspective(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  DELETE FROM public.bsc_perspectives_config WHERE id = p_id;
  RETURN true;
END;
$$;

-- 9. RPC: Log email notification (called after Supabase Auth email is triggered)
CREATE OR REPLACE FUNCTION public.admin_log_email_notification(
  p_recipient_user_id UUID,
  p_recipient_email   TEXT,
  p_email_type        TEXT,
  p_subject           TEXT,
  p_body_preview      TEXT DEFAULT NULL,
  p_status            TEXT DEFAULT 'sent',
  p_error_message     TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  INSERT INTO public.admin_email_log
    (recipient_user_id, recipient_email, email_type, subject, body_preview, sent_by, status, error_message)
  VALUES
    (p_recipient_user_id, p_recipient_email, p_email_type, p_subject, p_body_preview, auth.uid(), p_status, p_error_message)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 10. RPC: Get email notification log (admin)
CREATE OR REPLACE FUNCTION public.admin_get_email_log(
  p_limit  INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id                UUID,
  recipient_email   TEXT,
  email_type        TEXT,
  subject           TEXT,
  body_preview      TEXT,
  status            TEXT,
  error_message     TEXT,
  created_at        TIMESTAMPTZ
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
    l.id, l.recipient_email, l.email_type, l.subject,
    l.body_preview, l.status, l.error_message, l.created_at
  FROM public.admin_email_log l
  ORDER BY l.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 11. Enhanced admin_update_user_role: also logs email notification intent
CREATE OR REPLACE FUNCTION public.admin_update_user_role(
  target_user_id UUID,
  new_system_role TEXT,
  new_role TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- Get target user info
  SELECT up.email, up.full_name
  INTO v_target_email, v_target_name
  FROM public.user_profiles up
  WHERE up.id = target_user_id;

  -- Get actor name
  SELECT up.full_name INTO v_actor_name
  FROM public.user_profiles up
  WHERE up.id = auth.uid();

  -- Map role to label
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
    ELSE new_system_role
  END;

  UPDATE public.user_profiles
  SET
    system_role = new_system_role,
    role        = new_role::public.user_role,
    updated_at  = CURRENT_TIMESTAMP
  WHERE id = target_user_id;

  -- Activity log
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

  -- Email notification log (email is sent client-side via Supabase Auth)
  INSERT INTO public.admin_email_log
    (recipient_user_id, recipient_email, email_type, subject, body_preview, sent_by, status)
  VALUES (
    target_user_id,
    COALESCE(v_target_email, ''),
    'role_change',
    'Your ECSA-HC PMS role has been updated',
    'Your system role has been updated to ' || v_role_label || ' by ' || COALESCE(v_actor_name, 'an administrator') || '.',
    auth.uid(),
    'pending'
  );

  RETURN true;
END;
$$;

-- 12. Enhanced admin_force_password_reset: also logs email notification intent
CREATE OR REPLACE FUNCTION public.admin_force_password_reset(
  target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
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
  SET must_change_password = true, updated_at = CURRENT_TIMESTAMP
  WHERE id = target_user_id;

  -- Activity log
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

  -- Email notification log
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
