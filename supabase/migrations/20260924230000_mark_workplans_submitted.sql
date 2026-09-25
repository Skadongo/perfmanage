-- Migration: Mark existing workplans with content as submitted
-- Workplans inserted via migration have status='draft' but are fully populated.
-- Update them to status='submitted' so dashboards correctly count them.

-- Mark all workplans that have perspectives_objectives populated (i.e. real workplans, not empty drafts)
-- as submitted so they appear on all dashboards.
UPDATE public.workplan_settings
SET
    status         = 'submitted',
    workflow_stage = 'supervisor_review',
    submitted_at   = COALESCE(submitted_at, created_at),
    updated_at     = NOW()
WHERE
    status = 'draft'
    AND workflow_stage = 'workplan_pending'
    AND perspectives_objectives IS NOT NULL
    AND perspectives_objectives != '[]'::jsonb
    AND jsonb_array_length(perspectives_objectives) > 0;

-- Log how many were updated
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.workplan_settings
    WHERE status = 'submitted';

    RAISE NOTICE 'Total submitted workplans after update: %', v_count;
END $$;
