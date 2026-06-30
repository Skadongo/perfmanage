-- Activity Logs table for Performance Dashboard Recent Activity feed
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  action_description TEXT NOT NULL,
  subject_name TEXT,
  subject_detail TEXT,
  icon_name TEXT NOT NULL DEFAULT 'ClipboardDocumentCheckIcon',
  icon_bg TEXT NOT NULL DEFAULT 'bg-sky-50',
  icon_color TEXT NOT NULL DEFAULT 'text-sky-600',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_logs_public_read" ON public.activity_logs;
CREATE POLICY "activity_logs_public_read"
  ON public.activity_logs
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "activity_logs_authenticated_insert" ON public.activity_logs;
CREATE POLICY "activity_logs_authenticated_insert"
  ON public.activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Seed activity logs from existing data
DO $$
DECLARE
  v_staff_name TEXT;
  v_staff_title TEXT;
  v_supervisor_name TEXT;
  v_review_status TEXT;
  v_created_at TIMESTAMPTZ;
  v_workplan_status TEXT;
  v_workplan_staff TEXT;
  v_workplan_supervisor TEXT;
  v_workplan_created TIMESTAMPTZ;
BEGIN
  -- Only seed if table is empty
  IF (SELECT COUNT(*) FROM public.activity_logs) > 0 THEN
    RAISE NOTICE 'activity_logs already has data, skipping seed.';
    RETURN;
  END IF;

  -- Seed from mid_year_reviews (submitted reviews)
  FOR v_staff_name, v_staff_title, v_supervisor_name, v_review_status, v_created_at IN
    SELECT
      s.full_name,
      s.job_title,
      COALESCE(sup.full_name, 'Supervisor'),
      myr.review_status::TEXT,
      myr.created_at
    FROM public.mid_year_reviews myr
    JOIN public.staff s ON s.id = myr.staff_id
    LEFT JOIN public.staff sup ON sup.id = myr.supervisor_id
    ORDER BY myr.created_at DESC
    LIMIT 10
  LOOP
    IF v_review_status = 'submitted' THEN
      INSERT INTO public.activity_logs (activity_type, actor_name, action_description, subject_name, subject_detail, icon_name, icon_bg, icon_color, created_at)
      VALUES (
        'review_submitted',
        v_staff_name,
        'submitted mid-year self-evaluation',
        v_staff_title,
        NULL,
        'ClipboardDocumentCheckIcon',
        'bg-sky-50',
        'text-sky-600',
        v_created_at
      ) ON CONFLICT (id) DO NOTHING;
    ELSIF v_review_status = 'approved' THEN
      INSERT INTO public.activity_logs (activity_type, actor_name, action_description, subject_name, subject_detail, icon_name, icon_bg, icon_color, created_at)
      VALUES (
        'review_approved',
        v_supervisor_name,
        'approved mid-year review for',
        v_staff_name,
        v_staff_title,
        'CheckBadgeIcon',
        'bg-primary/10',
        'text-primary',
        v_created_at
      ) ON CONFLICT (id) DO NOTHING;
    ELSIF v_review_status = 'reviewed' THEN
      INSERT INTO public.activity_logs (activity_type, actor_name, action_description, subject_name, subject_detail, icon_name, icon_bg, icon_color, created_at)
      VALUES (
        'feedback_given',
        v_supervisor_name,
        'submitted supervisor feedback for',
        v_staff_name,
        v_staff_title,
        'ChatBubbleLeftRightIcon',
        'bg-emerald-50',
        'text-emerald-600',
        v_created_at
      ) ON CONFLICT (id) DO NOTHING;
    ELSE
      INSERT INTO public.activity_logs (activity_type, actor_name, action_description, subject_name, subject_detail, icon_name, icon_bg, icon_color, created_at)
      VALUES (
        'review_draft',
        v_staff_name,
        'started mid-year self-evaluation',
        v_staff_title,
        NULL,
        'ClipboardDocumentCheckIcon',
        'bg-sky-50',
        'text-sky-600',
        v_created_at
      ) ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;

  -- Seed from workplan_settings (signed workplans)
  FOR v_workplan_staff, v_workplan_supervisor, v_workplan_status, v_workplan_created IN
    SELECT
      s.full_name,
      COALESCE(sup.full_name, 'Supervisor'),
      ws.status,
      ws.created_at
    FROM public.workplan_settings ws
    JOIN public.staff s ON s.id = ws.staff_id
    LEFT JOIN public.staff sup ON sup.id = ws.supervisor_id
    ORDER BY ws.created_at DESC
    LIMIT 5
  LOOP
    IF v_workplan_status = 'signed' THEN
      INSERT INTO public.activity_logs (activity_type, actor_name, action_description, subject_name, subject_detail, icon_name, icon_bg, icon_color, created_at)
      VALUES (
        'workplan_approved',
        v_workplan_supervisor,
        'approved annual workplan for',
        v_workplan_staff,
        NULL,
        'CheckBadgeIcon',
        'bg-primary/10',
        'text-primary',
        v_workplan_created
      ) ON CONFLICT (id) DO NOTHING;
    ELSE
      INSERT INTO public.activity_logs (activity_type, actor_name, action_description, subject_name, subject_detail, icon_name, icon_bg, icon_color, created_at)
      VALUES (
        'workplan_draft',
        v_workplan_staff,
        'created workplan setting',
        NULL,
        NULL,
        'DocumentTextIcon',
        'bg-teal-50',
        'text-teal-600',
        v_workplan_created
      ) ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed failed: %', SQLERRM;
END $$;
