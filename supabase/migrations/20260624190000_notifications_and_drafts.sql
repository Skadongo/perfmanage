-- ============================================================
-- Notifications & Appraisal Drafts
-- ============================================================

-- 1. Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id UUID,
  related_type TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_staff_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_open_access" ON public.notifications;
CREATE POLICY "notifications_open_access"
  ON public.notifications FOR ALL TO public USING (true) WITH CHECK (true);

-- 2. Appraisal drafts table for auto-save
CREATE TABLE IF NOT EXISTS public.appraisal_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
  workplan_id UUID REFERENCES public.workplan_settings(id) ON DELETE CASCADE,
  draft_type TEXT NOT NULL DEFAULT 'self_assessment',
  review_period TEXT NOT NULL DEFAULT 'mid-year',
  form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  active_step INTEGER NOT NULL DEFAULT 0,
  last_saved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_appraisal_drafts_unique
  ON public.appraisal_drafts(staff_id, workplan_id, draft_type, review_period);

CREATE INDEX IF NOT EXISTS idx_appraisal_drafts_staff ON public.appraisal_drafts(staff_id);

ALTER TABLE public.appraisal_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appraisal_drafts_open_access" ON public.appraisal_drafts;
CREATE POLICY "appraisal_drafts_open_access"
  ON public.appraisal_drafts FOR ALL TO public USING (true) WITH CHECK (true);
