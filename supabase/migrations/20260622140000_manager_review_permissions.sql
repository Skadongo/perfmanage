-- Migration: Manager Review Permissions
-- Adds open-access RLS policies for mid_year_reviews to support manager review workflow
-- Timestamp: 20260622140000

-- Allow all authenticated users to read mid_year_reviews (managers need to see submitted assessments)
DROP POLICY IF EXISTS "managers_can_read_all_reviews" ON public.mid_year_reviews;
CREATE POLICY "managers_can_read_all_reviews"
ON public.mid_year_reviews
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to update reviews (for manager rating, approval, rejection)
DROP POLICY IF EXISTS "managers_can_update_reviews" ON public.mid_year_reviews;
CREATE POLICY "managers_can_update_reviews"
ON public.mid_year_reviews
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to insert reviews (for staff self-assessment submission)
DROP POLICY IF EXISTS "staff_can_insert_reviews" ON public.mid_year_reviews;
CREATE POLICY "staff_can_insert_reviews"
ON public.mid_year_reviews
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow managers to read workplan_settings for workflow stage advancement
DROP POLICY IF EXISTS "managers_can_read_workplan_settings" ON public.workplan_settings;
CREATE POLICY "managers_can_read_workplan_settings"
ON public.workplan_settings
FOR SELECT
TO authenticated
USING (true);

-- Allow managers to update workplan_settings workflow_stage on approval
DROP POLICY IF EXISTS "managers_can_update_workplan_stage" ON public.workplan_settings;
CREATE POLICY "managers_can_update_workplan_stage"
ON public.workplan_settings
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow all authenticated users to insert activity logs
DROP POLICY IF EXISTS "authenticated_can_insert_activity_logs" ON public.activity_logs;
CREATE POLICY "authenticated_can_insert_activity_logs"
ON public.activity_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow all authenticated users to read activity logs
DROP POLICY IF EXISTS "authenticated_can_read_activity_logs" ON public.activity_logs;
CREATE POLICY "authenticated_can_read_activity_logs"
ON public.activity_logs
FOR SELECT
TO authenticated
USING (true);
