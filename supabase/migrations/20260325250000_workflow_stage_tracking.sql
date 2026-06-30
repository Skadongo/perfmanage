-- Workflow Stage Tracking Migration
-- Adds stage progression columns to workplan_settings and mid_year_reviews
-- so staff auto-advance through: Workplan → Mid-Year → End-Year
-- with supervisor approval required at each stage gate.

-- 1. Add workflow_stage to workplan_settings
-- Stages: workplan_pending → workplan_approved → mid_year_pending → mid_year_approved → end_year_pending → end_year_approved
ALTER TABLE public.workplan_settings
ADD COLUMN IF NOT EXISTS workflow_stage TEXT NOT NULL DEFAULT 'workplan_pending';

ALTER TABLE public.workplan_settings
ADD COLUMN IF NOT EXISTS supervisor_approved_at TIMESTAMPTZ;

ALTER TABLE public.workplan_settings
ADD COLUMN IF NOT EXISTS supervisor_approval_comments TEXT;

-- 2. Add supervisor approval fields to mid_year_reviews for stage gate
ALTER TABLE public.mid_year_reviews
ADD COLUMN IF NOT EXISTS stage_approved_at TIMESTAMPTZ;

ALTER TABLE public.mid_year_reviews
ADD COLUMN IF NOT EXISTS stage_approval_comments TEXT;

-- 3. Index for fast stage lookups
CREATE INDEX IF NOT EXISTS idx_workplan_settings_workflow_stage ON public.workplan_settings(workflow_stage);
CREATE INDEX IF NOT EXISTS idx_workplan_settings_staff_stage ON public.workplan_settings(staff_id, workflow_stage);

-- 4. Update existing signed workplans to have correct stage
-- Any workplan already signed but with no mid-year review → workplan_approved
-- Any workplan with an approved mid-year review → mid_year_approved
DO $$
BEGIN
  -- Set signed workplans to workplan_approved if they don't have a stage yet
  UPDATE public.workplan_settings
  SET workflow_stage = 'workplan_approved'
  WHERE status = 'signed'
    AND workflow_stage = 'workplan_pending';

  -- Advance to mid_year_approved if there's an approved mid-year review
  UPDATE public.workplan_settings ws
  SET workflow_stage = 'mid_year_approved'
  WHERE ws.status = 'signed'
    AND ws.workflow_stage IN ('workplan_approved', 'mid_year_pending')
    AND EXISTS (
      SELECT 1 FROM public.mid_year_reviews myr
      WHERE myr.workplan_id = ws.id
        AND myr.review_period = 'mid-year'
        AND myr.review_status = 'approved'
    );

  -- Advance to end_year_approved if there's an approved end-year review
  UPDATE public.workplan_settings ws
  SET workflow_stage = 'end_year_approved'
  WHERE ws.status = 'signed'
    AND ws.workflow_stage IN ('mid_year_approved', 'end_year_pending')
    AND EXISTS (
      SELECT 1 FROM public.mid_year_reviews myr
      WHERE myr.workplan_id = ws.id
        AND myr.review_period = 'annual'
        AND myr.review_status = 'approved'
    );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Stage backfill skipped: %', SQLERRM;
END $$;
