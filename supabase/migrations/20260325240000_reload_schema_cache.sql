-- Reload PostgREST schema cache to ensure activity_logs table is recognized
-- This resolves "Could not find the table 'public.activity_logs' in the schema cache" error

-- Ensure activity_logs table exists (idempotent)
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

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
