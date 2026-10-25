-- HR Configuration Tables Migration
-- Creates fiscal_years, kpi_templates, workflow_stages tables
-- Seeds role_permissions for 9 staff roles across protected screens

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. FISCAL YEARS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fiscal_years (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT false,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_years_label
  ON public.fiscal_years (label);

CREATE INDEX IF NOT EXISTS idx_fiscal_years_is_active
  ON public.fiscal_years (is_active);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. KPI TEMPLATES TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kpi_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL DEFAULT 'general',
  weight          NUMERIC(5,2) NOT NULL DEFAULT 0,
  target_value    TEXT,
  unit            TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  applicable_roles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kpi_templates_category
  ON public.kpi_templates (category);

CREATE INDEX IF NOT EXISTS idx_kpi_templates_is_active
  ON public.kpi_templates (is_active);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. WORKFLOW STAGES TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workflow_stages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  stage_order     INTEGER NOT NULL DEFAULT 0,
  stage_type      TEXT NOT NULL DEFAULT 'review',
  required_role   TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  deadline_days   INTEGER,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_stages_order
  ON public.workflow_stages (stage_order);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ENABLE RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.fiscal_years    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_stages ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. HELPER FUNCTION: check if current user is HR/Admin/Director
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_hr_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.system_role IN (
        'superuser', 'support_admin',
        'executive_director', 'deputy_director',
        'hr_admin_officer'
      )
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RLS POLICIES — fiscal_years
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fiscal_years_select_authenticated" ON public.fiscal_years;
CREATE POLICY "fiscal_years_select_authenticated"
  ON public.fiscal_years FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "fiscal_years_insert_hr_admin" ON public.fiscal_years;
CREATE POLICY "fiscal_years_insert_hr_admin"
  ON public.fiscal_years FOR INSERT
  TO authenticated
  WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "fiscal_years_update_hr_admin" ON public.fiscal_years;
CREATE POLICY "fiscal_years_update_hr_admin"
  ON public.fiscal_years FOR UPDATE
  TO authenticated
  USING (public.is_hr_or_admin())
  WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "fiscal_years_delete_hr_admin" ON public.fiscal_years;
CREATE POLICY "fiscal_years_delete_hr_admin"
  ON public.fiscal_years FOR DELETE
  TO authenticated
  USING (public.is_hr_or_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RLS POLICIES — kpi_templates
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "kpi_templates_select_authenticated" ON public.kpi_templates;
CREATE POLICY "kpi_templates_select_authenticated"
  ON public.kpi_templates FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "kpi_templates_insert_hr_admin" ON public.kpi_templates;
CREATE POLICY "kpi_templates_insert_hr_admin"
  ON public.kpi_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "kpi_templates_update_hr_admin" ON public.kpi_templates;
CREATE POLICY "kpi_templates_update_hr_admin"
  ON public.kpi_templates FOR UPDATE
  TO authenticated
  USING (public.is_hr_or_admin())
  WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "kpi_templates_delete_hr_admin" ON public.kpi_templates;
CREATE POLICY "kpi_templates_delete_hr_admin"
  ON public.kpi_templates FOR DELETE
  TO authenticated
  USING (public.is_hr_or_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RLS POLICIES — workflow_stages
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "workflow_stages_select_authenticated" ON public.workflow_stages;
CREATE POLICY "workflow_stages_select_authenticated"
  ON public.workflow_stages FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "workflow_stages_insert_hr_admin" ON public.workflow_stages;
CREATE POLICY "workflow_stages_insert_hr_admin"
  ON public.workflow_stages FOR INSERT
  TO authenticated
  WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "workflow_stages_update_hr_admin" ON public.workflow_stages;
CREATE POLICY "workflow_stages_update_hr_admin"
  ON public.workflow_stages FOR UPDATE
  TO authenticated
  USING (public.is_hr_or_admin())
  WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "workflow_stages_delete_hr_admin" ON public.workflow_stages;
CREATE POLICY "workflow_stages_delete_hr_admin"
  ON public.workflow_stages FOR DELETE
  TO authenticated
  USING (public.is_hr_or_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. RLS POLICIES — role_permissions (already exists, add if missing)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "role_permissions_select_authenticated" ON public.role_permissions;
CREATE POLICY "role_permissions_select_authenticated"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "role_permissions_manage_hr_admin" ON public.role_permissions;
CREATE POLICY "role_permissions_manage_hr_admin"
  ON public.role_permissions FOR ALL
  TO authenticated
  USING (public.is_hr_or_admin())
  WITH CHECK (public.is_hr_or_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. SEED DATA — fiscal_years
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.fiscal_years (label, start_date, end_date, is_active)
VALUES
  ('FY 2025-2026', '2025-07-01', '2026-06-30', true),
  ('FY 2024-2025', '2024-07-01', '2025-06-30', false),
  ('FY 2023-2024', '2023-07-01', '2024-06-30', false)
ON CONFLICT (label) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. SEED DATA — kpi_templates
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.kpi_templates (name, description, category, weight, target_value, unit, applicable_roles)
VALUES
  ('Programme Delivery Rate',    'Percentage of planned programme activities delivered on time', 'programme',  25, '90',  '%',   ARRAY['programme_manager','programme_officer']),
  ('Financial Compliance',       'Adherence to financial policies and procedures',               'finance',    20, '100', '%',   ARRAY['finance_manager','finance_officer']),
  ('Staff Development Plans',    'Percentage of staff with active development plans',            'hr',         15, '80',  '%',   ARRAY['hr_admin_officer']),
  ('Report Submission Timeliness','Percentage of reports submitted on or before deadline',       'general',    20, '95',  '%',   ARRAY[]::TEXT[]),
  ('Stakeholder Engagement',     'Number of stakeholder meetings facilitated per quarter',       'programme',  10, '4',   'meetings', ARRAY['programme_manager','project_coordinator']),
  ('Budget Utilisation',         'Percentage of approved budget utilised within fiscal year',    'finance',    20, '85',  '%',   ARRAY['finance_manager','finance_officer']),
  ('Administrative Efficiency',  'Turnaround time for administrative requests (days)',           'admin',      15, '3',   'days',ARRAY['admin_officer'])
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. SEED DATA — workflow_stages
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.workflow_stages (name, description, stage_order, stage_type, required_role, deadline_days)
VALUES
  ('Workplan Submission',      'Staff submits annual workplan for supervisor review',         1, 'submission',  'staff_member',       14),
  ('Supervisor Approval',      'Supervisor reviews and approves the submitted workplan',      2, 'approval',    'programme_manager',  7),
  ('Self-Assessment',          'Staff completes mid-year or annual self-assessment form',     3, 'assessment',  'staff_member',       14),
  ('Supervisor Review',        'Supervisor reviews and rates the self-assessment',            4, 'review',      'programme_manager',  7),
  ('HR Verification',          'HR officer verifies completed appraisal for compliance',     5, 'verification','hr_admin_officer',   5),
  ('Director Approval',        'Director or Deputy Director gives final approval',           6, 'approval',    'executive_director', 5),
  ('Appraisal Archiving',      'Completed appraisal archived in the system',                 7, 'archive',     'hr_admin_officer',   3)
ON CONFLICT (stage_order) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. SEED DATA — role_permissions for 9 roles × 3 protected screens
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  roles TEXT[] := ARRAY[
    'executive_director', 'deputy_director', 'programme_manager',
    'finance_manager', 'hr_admin_officer', 'programme_officer',
    'finance_officer', 'admin_officer', 'project_coordinator'
  ];
  r TEXT;
BEGIN
  FOREACH r IN ARRAY roles LOOP
    -- performance-dashboard: all 9 roles can view; only directors/HR can create/edit
    INSERT INTO public.role_permissions
      (role_name, screen_name, can_view, can_create, can_edit, can_delete, can_approve)
    VALUES (
      r::public.staff_role,
      'performance-dashboard',
      true,
      r IN ('executive_director','deputy_director','hr_admin_officer'),
      r IN ('executive_director','deputy_director','hr_admin_officer'),
      r IN ('executive_director','deputy_director'),
      r IN ('executive_director','deputy_director')
    )
    ON CONFLICT DO NOTHING;

    -- hr-configuration: only HR admin and directors
    INSERT INTO public.role_permissions
      (role_name, screen_name, can_view, can_create, can_edit, can_delete, can_approve)
    VALUES (
      r::public.staff_role,
      'hr-configuration',
      r IN ('executive_director','deputy_director','hr_admin_officer'),
      r IN ('executive_director','deputy_director','hr_admin_officer'),
      r IN ('executive_director','deputy_director','hr_admin_officer'),
      r IN ('executive_director','deputy_director'),
      r IN ('executive_director','deputy_director')
    )
    ON CONFLICT DO NOTHING;

    -- evaluation-reviews: managers and above can view; staff can only view own
    INSERT INTO public.role_permissions
      (role_name, screen_name, can_view, can_create, can_edit, can_delete, can_approve)
    VALUES (
      r::public.staff_role,
      'evaluation-reviews',
      true,
      r IN ('executive_director','deputy_director','hr_admin_officer','programme_manager','finance_manager'),
      r IN ('executive_director','deputy_director','hr_admin_officer','programme_manager','finance_manager'),
      r IN ('executive_director','deputy_director','hr_admin_officer'),
      r IN ('executive_director','deputy_director','hr_admin_officer','programme_manager','finance_manager')
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
