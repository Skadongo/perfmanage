-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Dashboard materialised view + supporting indexes
-- Pre-aggregates dashboard metrics so the dashboard page reads one row
-- instead of scanning mid_year_reviews + staff on every load.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Materialised view: org-wide dashboard summary
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_dashboard_summary AS
SELECT
  COUNT(*)                                                        AS total_reviews,
  COUNT(*) FILTER (WHERE review_status IN ('submitted','reviewed','approved'))
                                                                  AS submitted_reviews,
  COUNT(*) FILTER (WHERE review_status = 'approved')             AS approved_reviews,
  COUNT(*) FILTER (WHERE review_status IN ('draft','submitted'))  AS pending_reviews,
  ROUND(
    AVG(supervisor_rating) FILTER (WHERE supervisor_rating IS NOT NULL)::numeric,
    1
  )                                                               AS avg_supervisor_rating,
  NOW()                                                           AS last_refreshed
FROM public.mid_year_reviews;

-- 2. Unique index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS mv_dashboard_summary_idx
  ON public.mv_dashboard_summary ((1));

-- 3. Materialised view: per-staff summary (used by staff-scoped dashboard)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_staff_dashboard_summary AS
SELECT
  staff_id,
  COUNT(*)                                                        AS total_reviews,
  COUNT(*) FILTER (WHERE review_status IN ('submitted','reviewed','approved'))
                                                                  AS submitted_reviews,
  COUNT(*) FILTER (WHERE review_status = 'approved')             AS approved_reviews,
  COUNT(*) FILTER (WHERE review_status IN ('draft','submitted'))  AS pending_reviews,
  ROUND(
    AVG(supervisor_rating) FILTER (WHERE supervisor_rating IS NOT NULL)::numeric,
    1
  )                                                               AS avg_supervisor_rating,
  NOW()                                                           AS last_refreshed
FROM public.mid_year_reviews
GROUP BY staff_id;

CREATE UNIQUE INDEX IF NOT EXISTS mv_staff_dashboard_summary_idx
  ON public.mv_staff_dashboard_summary (staff_id);

-- 4. Function to refresh both views (call from a cron job or trigger)
CREATE OR REPLACE FUNCTION public.refresh_dashboard_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_dashboard_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_staff_dashboard_summary;
END;
$$;

-- 5. Grant read access to authenticated users
GRANT SELECT ON public.mv_dashboard_summary TO authenticated;
GRANT SELECT ON public.mv_staff_dashboard_summary TO authenticated;

-- 6. Additional performance indexes (supplement 20260713140000)
-- workplan_settings: common filter columns
CREATE INDEX IF NOT EXISTS idx_workplan_settings_staff_status
  ON public.workplan_settings (staff_id, status);

CREATE INDEX IF NOT EXISTS idx_workplan_settings_workflow_stage
  ON public.workplan_settings (workflow_stage);

-- mid_year_reviews: composite index for dashboard aggregation
CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_status_rating
  ON public.mid_year_reviews (review_status, supervisor_rating)
  WHERE supervisor_rating IS NOT NULL;

-- appraisal_drafts: lookup by staff + workplan + type
CREATE INDEX IF NOT EXISTS idx_appraisal_drafts_lookup
  ON public.appraisal_drafts (staff_id, workplan_id, draft_type, review_period);

-- notifications: unread count query
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications (recipient_staff_id, is_read, created_at DESC)
  WHERE is_read = false;
