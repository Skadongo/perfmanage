-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Performance robustness — auto-refresh triggers, query tuning,
--            connection pooling guidance, and EXPLAIN ANALYZE annotations
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Auto-refresh materialised views on mid_year_reviews changes ────────────
-- Trigger fires AFTER INSERT/UPDATE/DELETE on mid_year_reviews and refreshes
-- both dashboard summary views concurrently (non-blocking).

CREATE OR REPLACE FUNCTION public.trg_refresh_dashboard_on_review_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- REFRESH CONCURRENTLY requires a unique index (already created in 20260713160000)
  -- and does NOT lock readers — safe for production traffic.
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_dashboard_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_staff_dashboard_summary;
  RETURN NULL;
END;
$$;

-- Drop before recreate to make migration idempotent
DROP TRIGGER IF EXISTS trg_refresh_dashboard_reviews
  ON public.mid_year_reviews;

CREATE TRIGGER trg_refresh_dashboard_reviews
  AFTER INSERT OR UPDATE OR DELETE
  ON public.mid_year_reviews
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_refresh_dashboard_on_review_change();

-- ── 2. Auto-refresh on workplan_settings changes ──────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_refresh_dashboard_on_workplan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_dashboard_summary;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_dashboard_workplans
  ON public.workplan_settings;

CREATE TRIGGER trg_refresh_dashboard_workplans
  AFTER INSERT OR UPDATE OR DELETE
  ON public.workplan_settings
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_refresh_dashboard_on_workplan_change();

-- ── 3. Composite index for the slowest dashboard query pattern ────────────────
-- EXPLAIN ANALYZE on the live-stats query showed a sequential scan on
-- mid_year_reviews when filtering by supervisor_id + review_status + selecting
-- supervisor_rating. This covering index eliminates the heap fetch entirely.

CREATE INDEX IF NOT EXISTS idx_myr_supervisor_status_rating
  ON public.mid_year_reviews (supervisor_id, review_status)
  INCLUDE (supervisor_rating, staff_id)
  WHERE supervisor_id IS NOT NULL;

-- ── 4. Covering index for staff-scoped dashboard (staff member view) ──────────
-- Eliminates heap fetch for the staff_id + review_status + supervisor_rating
-- combination used in useRealtimeDashboard fetchLiveStats.

CREATE INDEX IF NOT EXISTS idx_myr_staff_status_rating
  ON public.mid_year_reviews (staff_id, review_status)
  INCLUDE (supervisor_rating)
  WHERE staff_id IS NOT NULL;

-- ── 5. Partial index for active staff count query ─────────────────────────────
-- The staff count query (SELECT count(*) WHERE employment_status = 'active')
-- is run on every dashboard load. A partial index makes it an index-only scan.

CREATE INDEX IF NOT EXISTS idx_staff_active_only
  ON public.staff (id)
  WHERE employment_status = 'active';

-- ── 6. Index for activity_logs supervisor scope ───────────────────────────────
-- ActivityFeed queries activity_logs filtered by supervisor_id + ordered by
-- created_at. This composite index covers both predicates.

CREATE INDEX IF NOT EXISTS idx_activity_logs_supervisor_created
  ON public.activity_logs (supervisor_id, created_at DESC)
  WHERE supervisor_id IS NOT NULL;

-- ── 7. Connection pooling note (PgBouncer / Supabase Pooler) ─────────────────
-- Enable Transaction-mode pooling in the Supabase dashboard:
--   Project Settings → Database → Connection Pooling → Mode: Transaction
--   Pool size: 15 (recommended for this workload)
--   Max client connections: 100
--
-- Use the pooler connection string (port 6543) in production .env:
--   DATABASE_URL=postgresql://...@<project>.pooler.supabase.com:6543/postgres
--
-- The @supabase/ssr client already uses the anon key over HTTPS (port 443)
-- which goes through the Supabase API gateway — no changes needed there.
-- PgBouncer only applies to direct Postgres connections (e.g. migrations,
-- server-side admin queries).

-- ── 8. Grant execute on new trigger functions ─────────────────────────────────
GRANT EXECUTE ON FUNCTION public.trg_refresh_dashboard_on_review_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trg_refresh_dashboard_on_workplan_change() TO authenticated;
