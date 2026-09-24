-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Partial indexes for high-frequency filtered queries
-- Partial indexes only index rows matching the WHERE clause, making them
-- smaller and faster than full-table indexes for status-filtered queries.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── mid_year_reviews: partial indexes on active subsets ─────────────────────

-- Only index submitted/pending reviews (the most queried subset for dashboards)
CREATE INDEX IF NOT EXISTS idx_myr_submitted_partial
  ON public.mid_year_reviews (staff_id, created_at DESC)
  WHERE review_status IN ('submitted', 'reviewed');

-- Only index approved reviews (used in completion rate calculations)
CREATE INDEX IF NOT EXISTS idx_myr_approved_partial
  ON public.mid_year_reviews (staff_id, supervisor_rating)
  WHERE review_status = 'approved' AND supervisor_rating IS NOT NULL;

-- Supervisor scope: only active/pending reviews (at-risk table query)
CREATE INDEX IF NOT EXISTS idx_myr_supervisor_pending_partial
  ON public.mid_year_reviews (supervisor_id, created_at DESC)
  WHERE review_status IN ('draft', 'submitted');

-- ─── workplan_settings: partial indexes on non-draft records ─────────────────

-- Only index signed/approved workplans (evaluation-reviews list query)
CREATE INDEX IF NOT EXISTS idx_ws_signed_approved_partial
  ON public.workplan_settings (staff_id, updated_at DESC)
  WHERE status IN ('signed', 'approved');

-- Only index submitted workplans awaiting action (manager review queue)
CREATE INDEX IF NOT EXISTS idx_ws_submitted_partial
  ON public.workplan_settings (supervisor_id, updated_at DESC)
  WHERE status = 'submitted';

-- Workplan list by fiscal year (most common filter in WorkplanListView)
CREATE INDEX IF NOT EXISTS idx_ws_fiscal_year_partial
  ON public.workplan_settings (fiscal_year, staff_id)
  WHERE status != 'draft';

-- ─── staff: partial index on active staff only ───────────────────────────────

-- Active staff by directorate (org chart / staff management view)
CREATE INDEX IF NOT EXISTS idx_staff_active_directorate
  ON public.staff (directorate_id, full_name)
  WHERE employment_status = 'active';

-- Active staff by supervisor (supervisor scope queries)
CREATE INDEX IF NOT EXISTS idx_staff_active_supervisor
  ON public.staff (supervisor_id)
  WHERE employment_status = 'active';

-- ─── notifications: partial index on unread only ─────────────────────────────
-- (supplements the existing idx_notifications_unread from 20260713160000)
CREATE INDEX IF NOT EXISTS idx_notifications_unread_staff_partial
  ON public.notifications (recipient_staff_id, created_at DESC)
  WHERE is_read = false;

-- ─────────────────────────────────────────────────────────────────────────────
-- Connection Pooling Note:
-- Enable PgBouncer in Supabase Dashboard → Settings → Database → Connection Pooling
-- Recommended settings:
--   Pool mode: Transaction (best for serverless/Next.js)
--   Pool size: 15 (default is fine for most workloads)
--   Max client connections: 100
-- This reuses DB connections across requests instead of opening a new one per
-- API call, reducing connection overhead by ~80% under concurrent load.
-- ─────────────────────────────────────────────────────────────────────────────
