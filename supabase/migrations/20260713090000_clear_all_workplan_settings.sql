-- Clear all workplan_settings data entered last week (for all staff)
-- Current date: 2026-07-13. "Last week" = 2026-07-07 to 2026-07-13.
-- This migration removes all workplan_settings rows and their dependent data.

DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Step 1: Nullify workplan_id in mid_year_reviews for affected workplans
    UPDATE public.mid_year_reviews
    SET workplan_id = NULL
    WHERE workplan_id IN (
        SELECT id FROM public.workplan_settings
        WHERE created_at >= '2026-07-07 00:00:00+00'
    );

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Nullified workplan_id in % mid_year_reviews rows', deleted_count;

    -- Step 2: Delete appraisal_drafts linked to affected workplans
    DELETE FROM public.appraisal_drafts
    WHERE workplan_id IN (
        SELECT id FROM public.workplan_settings
        WHERE created_at >= '2026-07-07 00:00:00+00'
    );

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % appraisal_drafts rows', deleted_count;

    -- Step 3: Delete staff_kpi_review_drafts linked to affected workplans
    DELETE FROM public.staff_kpi_review_drafts
    WHERE workplan_id IN (
        SELECT id FROM public.workplan_settings
        WHERE created_at >= '2026-07-07 00:00:00+00'
    );

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % staff_kpi_review_drafts rows', deleted_count;

    -- Step 4: Delete all workplan_settings created last week (all staff)
    DELETE FROM public.workplan_settings
    WHERE created_at >= '2026-07-07 00:00:00+00';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % workplan_settings rows', deleted_count;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Cleanup failed: %', SQLERRM;
        RAISE;
END $$;
