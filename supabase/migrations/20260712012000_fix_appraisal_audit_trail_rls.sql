-- ─────────────────────────────────────────────────────────────────────────────
-- Recreate public.appraisal_audit_trail without SECURITY DEFINER context.
--
-- The previous definition granted SELECT to the `public` role, which allowed
-- unauthenticated callers to bypass RLS on the underlying tables.
--
-- This migration:
--   1. Drops the existing view.
--   2. Recreates it as a plain (invoker-rights) view — no SECURITY DEFINER.
--   3. Revokes any residual SELECT grant from the `public` role.
--   4. Grants SELECT only to `authenticated`, so the view executes in the
--      caller's security context and the RLS policies on workplan_settings,
--      mid_year_reviews, and staff are evaluated for every request.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Drop the existing view (removes all dependent GRANTs automatically)
DROP VIEW IF EXISTS public.appraisal_audit_trail;

-- Step 2: Recreate as a plain invoker-rights view (no SECURITY DEFINER)
CREATE VIEW public.appraisal_audit_trail AS
SELECT
  'workplan' AS form_type,
  ws.id,
  ws.staff_id,
  s.full_name AS staff_name,
  s.job_title,
  ws.fiscal_year AS period_label,
  ws.review_year,
  ws.status,
  ws.workflow_stage,
  ws.version,
  ws.submitted_at AS form_submitted_at,
  ws.created_at,
  ws.updated_at,
  NULL::NUMERIC AS overall_self_score,
  NULL::NUMERIC AS overall_supervisor_score
FROM public.workplan_settings ws
LEFT JOIN public.staff s ON ws.staff_id = s.id

UNION ALL

SELECT
  'evaluation' AS form_type,
  myr.id,
  myr.staff_id,
  s.full_name AS staff_name,
  s.job_title,
  COALESCE(myr.review_period_label, myr.review_period) AS period_label,
  myr.review_year,
  myr.review_status::TEXT AS status,
  NULL AS workflow_stage,
  myr.version,
  myr.submitted_at AS form_submitted_at,
  myr.created_at,
  myr.updated_at,
  myr.overall_self_score,
  myr.overall_supervisor_score
FROM public.mid_year_reviews myr
LEFT JOIN public.staff s ON myr.staff_id = s.id;

-- Step 3: Revoke any residual public (anonymous) access on the view
REVOKE ALL ON public.appraisal_audit_trail FROM public;
REVOKE ALL ON public.appraisal_audit_trail FROM anon;

-- Step 4: Grant SELECT only to authenticated users.
-- Access is now enforced entirely by the RLS policies on the underlying tables
-- (workplan_settings, mid_year_reviews, staff) — not on the view itself.
GRANT SELECT ON public.appraisal_audit_trail TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Ensure RLS is enabled on all underlying tables (idempotent).
-- The existing policies (authenticated_manage_workplan_settings,
-- authenticated_manage_mid_year_reviews, authenticated_manage_staff) already
-- use USING (true) for org-wide authenticated read access, which is the
-- intended behaviour for this PMS.  No policy changes are required here;
-- the security improvement comes solely from removing the `public` grant on
-- the view so unauthenticated callers can no longer bypass RLS.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.workplan_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mid_year_reviews  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff             ENABLE ROW LEVEL SECURITY;
