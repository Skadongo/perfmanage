-- Fix appraisal_drafts unique index to handle NULL workplan_id
-- The original index on (staff_id, workplan_id, draft_type, review_period) does NOT
-- enforce uniqueness when workplan_id IS NULL (NULL != NULL in SQL), causing duplicate
-- draft rows and autosave failures. Replace with a functional index using COALESCE.

-- Drop the old non-functional index
DROP INDEX IF EXISTS idx_appraisal_drafts_unique;

-- Create a functional unique index that treats NULL workplan_id as a sentinel UUID
-- so uniqueness is enforced even when workplan_id is NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_appraisal_drafts_unique
ON public.appraisal_drafts(
  staff_id,
  COALESCE(workplan_id, '00000000-0000-0000-0000-000000000000'::uuid),
  draft_type,
  review_period
);
