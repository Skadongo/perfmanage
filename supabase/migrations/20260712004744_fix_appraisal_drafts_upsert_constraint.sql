-- Fix appraisal_drafts upsert: replace functional COALESCE index with a proper
-- named unique constraint that PostgREST / Supabase client can resolve.
--
-- The previous migration used:
--   CREATE UNIQUE INDEX ... ON appraisal_drafts(staff_id, COALESCE(workplan_id, '00000000...'), draft_type, review_period)
-- PostgREST cannot map a column-name list to a functional/expression index, so
-- upsert with onConflict: 'staff_id,draft_type,review_period' raised:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- Solution: use a single named unique constraint on all four columns (workplan_id
-- included, nullable). NULL values in a UNIQUE constraint are treated as distinct
-- by default in PostgreSQL, so we also add a partial unique index for the
-- NULL-workplan_id case that PostgREST CAN use via the constraint name approach.
-- The application code will use a manual SELECT → INSERT/UPDATE pattern instead
-- of relying on onConflict column strings, which is the most reliable approach.

-- 1. Drop the old functional index
DROP INDEX IF EXISTS idx_appraisal_drafts_unique;

-- 2. Add a standard unique constraint for rows WHERE workplan_id IS NOT NULL
--    (PostgREST can resolve this by constraint name)
ALTER TABLE public.appraisal_drafts
  DROP CONSTRAINT IF EXISTS uq_appraisal_drafts_with_workplan;

ALTER TABLE public.appraisal_drafts
  ADD CONSTRAINT uq_appraisal_drafts_with_workplan
  UNIQUE (staff_id, workplan_id, draft_type, review_period);

-- 3. Add a partial unique index for the NULL workplan_id case
--    (used for lookups; the app code handles upsert manually for this path)
CREATE UNIQUE INDEX IF NOT EXISTS idx_appraisal_drafts_no_workplan
  ON public.appraisal_drafts (staff_id, draft_type, review_period)
  WHERE workplan_id IS NULL;
