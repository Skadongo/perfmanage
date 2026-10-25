-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Schedule pg_cron job to refresh dashboard materialized views
-- every 5 minutes so mv_dashboard_summary and mv_staff_dashboard_summary
-- stay accurate within 5 minutes of any data change.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable pg_cron extension (safe to run if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage on cron schema to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- Remove existing job if it exists (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'refresh-dashboard-views'
  ) THEN
    PERFORM cron.unschedule('refresh-dashboard-views');
  END IF;
END;
$$;

-- Schedule refresh every 5 minutes
SELECT cron.schedule(
  'refresh-dashboard-views',
  '*/5 * * * *',
  $$SELECT public.refresh_dashboard_views()$$
);

-- Also add review_year index on mid_year_reviews for accuracy gap fixes
CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_year_status
  ON public.mid_year_reviews (review_year, review_status);

-- Add fiscal_year + review_year composite for scoped dashboard queries
CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_year_rating
  ON public.mid_year_reviews (review_year, supervisor_rating)
  WHERE supervisor_rating IS NOT NULL;
