-- ============================================================
-- Clear dashboard review data logs (Total Reviews, Submitted, Approved)
-- for all staff — mirrors the workplan settings data clear
-- ============================================================

-- Step 1: Nullify workplan_id references in mid_year_reviews (already done by prior migration,
--         but guard again in case new rows were added)
UPDATE public.mid_year_reviews
SET workplan_id = NULL
WHERE workplan_id IS NOT NULL;

-- Step 2: Delete all staff_kpi_review_drafts (depend on mid_year_reviews)
DELETE FROM public.staff_kpi_review_drafts;

-- Step 3: Delete all appraisal_drafts (depend on mid_year_reviews)
DELETE FROM public.appraisal_drafts;

-- Step 4: Delete all mid_year_reviews — this zeroes out the dashboard counters
--         (Total Reviews, Submitted, Approved, Pending, Avg Rating)
DELETE FROM public.mid_year_reviews;

-- Confirm
DO $$
DECLARE
  review_count  INT;
  draft_count   INT;
  kpi_count     INT;
BEGIN
  SELECT COUNT(*) INTO review_count  FROM public.mid_year_reviews;
  SELECT COUNT(*) INTO draft_count   FROM public.appraisal_drafts;
  SELECT COUNT(*) INTO kpi_count     FROM public.staff_kpi_review_drafts;

  RAISE NOTICE 'mid_year_reviews remaining: %',      review_count;
  RAISE NOTICE 'appraisal_drafts remaining: %',      draft_count;
  RAISE NOTICE 'staff_kpi_review_drafts remaining: %', kpi_count;
END $$;
