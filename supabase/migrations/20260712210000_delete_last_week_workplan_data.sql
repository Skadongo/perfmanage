-- Migration: Delete all workplan data captured last week (2026-07-05 to 2026-07-11)
-- Current date: 2026-07-12
-- Deletes dependent records first (FK order), then workplan_settings rows

DO $$
DECLARE
    deleted_workplan_ids UUID[];
    workplan_count INT;
    appraisal_drafts_count INT;
    mid_year_reviews_count INT;
    kpi_drafts_count INT;
BEGIN
    -- Collect IDs of workplan_settings created last week
    SELECT ARRAY_AGG(id)
    INTO deleted_workplan_ids
    FROM public.workplan_settings
    WHERE created_at >= '2026-07-05 00:00:00+00'
      AND created_at <  '2026-07-12 00:00:00+00';

    IF deleted_workplan_ids IS NULL OR array_length(deleted_workplan_ids, 1) = 0 THEN
        RAISE NOTICE 'No workplan_settings records found for last week (2026-07-05 to 2026-07-11). Nothing to delete.';
        RETURN;
    END IF;

    workplan_count := array_length(deleted_workplan_ids, 1);
    RAISE NOTICE 'Found % workplan_settings record(s) created last week. Proceeding with deletion...', workplan_count;

    -- Step 1: Delete staff_kpi_review_drafts referencing these workplans
    DELETE FROM public.staff_kpi_review_drafts
    WHERE workplan_id = ANY(deleted_workplan_ids);
    GET DIAGNOSTICS kpi_drafts_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % staff_kpi_review_drafts record(s).', kpi_drafts_count;

    -- Step 2: Delete appraisal_drafts referencing these workplans
    DELETE FROM public.appraisal_drafts
    WHERE workplan_id = ANY(deleted_workplan_ids);
    GET DIAGNOSTICS appraisal_drafts_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % appraisal_drafts record(s).', appraisal_drafts_count;

    -- Step 3: Delete mid_year_reviews referencing these workplans
    DELETE FROM public.mid_year_reviews
    WHERE workplan_id = ANY(deleted_workplan_ids);
    GET DIAGNOSTICS mid_year_reviews_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % mid_year_reviews record(s).', mid_year_reviews_count;

    -- Step 4: Delete the workplan_settings records themselves
    DELETE FROM public.workplan_settings
    WHERE id = ANY(deleted_workplan_ids);
    RAISE NOTICE 'Deleted % workplan_settings record(s).', workplan_count;

    RAISE NOTICE 'Workplan data cleanup complete. Summary: % workplans, % appraisal drafts, % mid-year reviews, % KPI drafts removed.',
        workplan_count, appraisal_drafts_count, mid_year_reviews_count, kpi_drafts_count;

EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'Foreign key constraint prevented deletion: %', SQLERRM;
    WHEN OTHERS THEN
        RAISE NOTICE 'Deletion failed: %', SQLERRM;
        RAISE;
END $$;
