-- ============================================================
-- Clear Assessment Data Migration
-- Removes all workplan data, mid-year self-evaluation data,
-- and any dummy data associated with assessments.
-- Tables preserved: staff, departments (real org data kept)
-- ============================================================

-- Delete mid_year_reviews first (child table — references workplan_settings)
DELETE FROM public.mid_year_reviews;

-- Delete workplan_settings (parent table)
DELETE FROM public.workplan_settings;

-- Reset any activity logs related to appraisals/assessments (if any exist)
DELETE FROM public.activity_logs
WHERE activity_type IN ('workplan', 'evaluation', 'appraisal', 'mid_year_review', 'self_evaluation');
