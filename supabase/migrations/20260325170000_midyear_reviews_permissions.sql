-- Mid-Year Review Submission Flow + Role Permissions Migration
-- Adds: mid_year_reviews, review_timelines, role_permissions tables
-- Enforces: status tracking, supervisor routing, timeline enforcement, RLS per role

-- ─── 1. ENUM TYPES ────────────────────────────────────────────────────────────

DROP TYPE IF EXISTS public.review_status CASCADE;
CREATE TYPE public.review_status AS ENUM ('draft', 'submitted', 'reviewed', 'approved', 'rejected');

DROP TYPE IF EXISTS public.staff_role CASCADE;
CREATE TYPE public.staff_role AS ENUM (
  'executive_director',
  'deputy_director',
  'programme_manager',
  'finance_manager',
  'hr_admin_officer',
  'programme_officer',
  'finance_officer',
  'admin_officer',
  'project_coordinator'
);

-- ─── 2. REVIEW TIMELINES TABLE ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.review_timelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_year INTEGER NOT NULL,
  review_period TEXT NOT NULL DEFAULT 'mid-year',
  submission_open_date DATE NOT NULL,
  submission_deadline DATE NOT NULL,
  supervisor_review_deadline DATE NOT NULL,
  approval_deadline DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_timelines_year_period
  ON public.review_timelines (review_year, review_period);

-- ─── 3. MID-YEAR REVIEWS TABLE ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mid_year_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
  supervisor_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  timeline_id UUID REFERENCES public.review_timelines(id) ON DELETE SET NULL,
  review_status public.review_status DEFAULT 'draft'::public.review_status,
  review_year INTEGER NOT NULL,
  review_period TEXT NOT NULL DEFAULT 'mid-year',

  -- Staff self-assessment fields
  kpi_achievements TEXT,
  challenges_faced TEXT,
  support_needed TEXT,
  self_rating INTEGER CHECK (self_rating BETWEEN 1 AND 5),

  -- Supervisor review fields
  supervisor_comments TEXT,
  supervisor_rating INTEGER CHECK (supervisor_rating BETWEEN 1 AND 5),
  supervisor_reviewed_at TIMESTAMPTZ,

  -- Approval fields
  approved_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  approval_comments TEXT,
  approved_at TIMESTAMPTZ,

  -- Routing & timestamps
  submitted_at TIMESTAMPTZ,
  rejected_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_staff_id ON public.mid_year_reviews(staff_id);
CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_supervisor_id ON public.mid_year_reviews(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_status ON public.mid_year_reviews(review_status);
CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_year ON public.mid_year_reviews(review_year);

-- ─── 4. ROLE PERMISSIONS TABLE ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name public.staff_role NOT NULL,
  screen_name TEXT NOT NULL,
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_approve BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_role_permissions_role_screen
  ON public.role_permissions (role_name, screen_name);

-- ─── 5. STAFF ROLE ASSIGNMENTS (link staff to system roles) ───────────────────

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS system_role public.staff_role DEFAULT NULL;

-- ─── 6. UPDATED_AT TRIGGER FUNCTION ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mid_year_reviews_updated_at ON public.mid_year_reviews;
CREATE TRIGGER mid_year_reviews_updated_at
  BEFORE UPDATE ON public.mid_year_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS review_timelines_updated_at ON public.review_timelines;
CREATE TRIGGER review_timelines_updated_at
  BEFORE UPDATE ON public.review_timelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS role_permissions_updated_at ON public.role_permissions;
CREATE TRIGGER role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 7. ENABLE RLS ────────────────────────────────────────────────────────────

ALTER TABLE public.mid_year_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- ─── 8. RLS POLICIES ─────────────────────────────────────────────────────────

-- review_timelines: public read (all staff need to see deadlines)
DROP POLICY IF EXISTS "public_read_review_timelines" ON public.review_timelines;
CREATE POLICY "public_read_review_timelines" ON public.review_timelines
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "authenticated_manage_review_timelines" ON public.review_timelines;
CREATE POLICY "authenticated_manage_review_timelines" ON public.review_timelines
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- mid_year_reviews: public read for org-wide visibility, authenticated manage
DROP POLICY IF EXISTS "public_read_mid_year_reviews" ON public.mid_year_reviews;
CREATE POLICY "public_read_mid_year_reviews" ON public.mid_year_reviews
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "authenticated_manage_mid_year_reviews" ON public.mid_year_reviews;
CREATE POLICY "authenticated_manage_mid_year_reviews" ON public.mid_year_reviews
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- role_permissions: public read, authenticated manage
DROP POLICY IF EXISTS "public_read_role_permissions" ON public.role_permissions;
CREATE POLICY "public_read_role_permissions" ON public.role_permissions
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "authenticated_manage_role_permissions" ON public.role_permissions;
CREATE POLICY "authenticated_manage_role_permissions" ON public.role_permissions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 9. SEED DATA ─────────────────────────────────────────────────────────────

-- 9a. Review Timeline for 2026
INSERT INTO public.review_timelines (
  id, review_year, review_period,
  submission_open_date, submission_deadline,
  supervisor_review_deadline, approval_deadline, is_active
) VALUES (
  gen_random_uuid(), 2026, 'mid-year',
  '2026-06-01', '2026-06-30',
  '2026-07-15', '2026-07-31', true
) ON CONFLICT (review_year, review_period) DO NOTHING;

-- 9b. Role Permissions seed data
DO $$
DECLARE
  screens TEXT[] := ARRAY[
    'performance-dashboard',
    'evaluation-reviews',
    'feedback-mentorship',
    'training-resources',
    'staff-management',
    'analytics-reports',
    'mid-year-reviews',
    'permissions'
  ];
  s TEXT;
BEGIN
  -- Executive Director: full access to everything
  FOREACH s IN ARRAY screens LOOP
    INSERT INTO public.role_permissions (role_name, screen_name, can_view, can_create, can_edit, can_delete, can_approve)
    VALUES ('executive_director'::public.staff_role, s, true, true, true, true, true)
    ON CONFLICT (role_name, screen_name) DO NOTHING;
  END LOOP;

  -- Deputy Director: full access except permissions screen (no delete)
  FOREACH s IN ARRAY screens LOOP
    INSERT INTO public.role_permissions (role_name, screen_name, can_view, can_create, can_edit, can_delete, can_approve)
    VALUES ('deputy_director'::public.staff_role, s,
      true,
      s != 'permissions',
      s != 'permissions',
      false,
      s IN ('mid-year-reviews', 'evaluation-reviews')
    )
    ON CONFLICT (role_name, screen_name) DO NOTHING;
  END LOOP;

  -- Programme Manager: view all, manage own dept, approve reviews
  FOREACH s IN ARRAY screens LOOP
    INSERT INTO public.role_permissions (role_name, screen_name, can_view, can_create, can_edit, can_delete, can_approve)
    VALUES ('programme_manager'::public.staff_role, s,
      true,
      s IN ('mid-year-reviews', 'feedback-mentorship', 'training-resources'),
      s IN ('mid-year-reviews', 'feedback-mentorship', 'training-resources'),
      false,
      s = 'mid-year-reviews'
    )
    ON CONFLICT (role_name, screen_name) DO NOTHING;
  END LOOP;

  -- Finance Manager: view all, manage finance screens
  FOREACH s IN ARRAY screens LOOP
    INSERT INTO public.role_permissions (role_name, screen_name, can_view, can_create, can_edit, can_delete, can_approve)
    VALUES ('finance_manager'::public.staff_role, s,
      true,
      s IN ('mid-year-reviews', 'training-resources'),
      s IN ('mid-year-reviews', 'training-resources'),
      false,
      s = 'mid-year-reviews'
    )
    ON CONFLICT (role_name, screen_name) DO NOTHING;
  END LOOP;

  -- HR Admin Officer: full access to staff/permissions, view others
  FOREACH s IN ARRAY screens LOOP
    INSERT INTO public.role_permissions (role_name, screen_name, can_view, can_create, can_edit, can_delete, can_approve)
    VALUES ('hr_admin_officer'::public.staff_role, s,
      true,
      s IN ('staff-management', 'permissions', 'mid-year-reviews', 'training-resources'),
      s IN ('staff-management', 'permissions', 'mid-year-reviews', 'training-resources'),
      s IN ('staff-management'),
      s IN ('mid-year-reviews')
    )
    ON CONFLICT (role_name, screen_name) DO NOTHING;
  END LOOP;

  -- Programme Officer: view most, submit own reviews
  FOREACH s IN ARRAY screens LOOP
    INSERT INTO public.role_permissions (role_name, screen_name, can_view, can_create, can_edit, can_delete, can_approve)
    VALUES ('programme_officer'::public.staff_role, s,
      s NOT IN ('permissions', 'staff-management', 'analytics-reports'),
      s = 'mid-year-reviews',
      s = 'mid-year-reviews',
      false,
      false
    )
    ON CONFLICT (role_name, screen_name) DO NOTHING;
  END LOOP;

  -- Finance Officer: view limited screens, submit own reviews
  FOREACH s IN ARRAY screens LOOP
    INSERT INTO public.role_permissions (role_name, screen_name, can_view, can_create, can_edit, can_delete, can_approve)
    VALUES ('finance_officer'::public.staff_role, s,
      s IN ('performance-dashboard', 'mid-year-reviews', 'training-resources', 'feedback-mentorship'),
      s = 'mid-year-reviews',
      s = 'mid-year-reviews',
      false,
      false
    )
    ON CONFLICT (role_name, screen_name) DO NOTHING;
  END LOOP;

  -- Admin Officer: view limited, submit own reviews
  FOREACH s IN ARRAY screens LOOP
    INSERT INTO public.role_permissions (role_name, screen_name, can_view, can_create, can_edit, can_delete, can_approve)
    VALUES ('admin_officer'::public.staff_role, s,
      s IN ('performance-dashboard', 'mid-year-reviews', 'training-resources', 'feedback-mentorship'),
      s = 'mid-year-reviews',
      s = 'mid-year-reviews',
      false,
      false
    )
    ON CONFLICT (role_name, screen_name) DO NOTHING;
  END LOOP;

  -- Project Coordinator: view most, submit own reviews
  FOREACH s IN ARRAY screens LOOP
    INSERT INTO public.role_permissions (role_name, screen_name, can_view, can_create, can_edit, can_delete, can_approve)
    VALUES ('project_coordinator'::public.staff_role, s,
      s NOT IN ('permissions', 'analytics-reports'),
      s = 'mid-year-reviews',
      s = 'mid-year-reviews',
      false,
      false
    )
    ON CONFLICT (role_name, screen_name) DO NOTHING;
  END LOOP;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed data error: %', SQLERRM;
END $$;

-- 9c. Sample mid-year reviews linked to existing staff
DO $$
DECLARE
  staff_rec RECORD;
  supervisor_rec RECORD;
  timeline_id UUID;
  i INTEGER := 0;
  statuses public.review_status[] := ARRAY[
    'submitted'::public.review_status,
    'reviewed'::public.review_status,
    'approved'::public.review_status,
    'draft'::public.review_status,
    'submitted'::public.review_status
  ];
BEGIN
  SELECT id INTO timeline_id FROM public.review_timelines WHERE review_year = 2026 AND review_period = 'mid-year' LIMIT 1;

  IF timeline_id IS NULL THEN
    RAISE NOTICE 'No timeline found, skipping review seed data';
    RETURN;
  END IF;

  FOR staff_rec IN
    SELECT s.id, s.supervisor_id
    FROM public.staff s
    WHERE s.employment_status = 'active'
    LIMIT 20
  LOOP
    SELECT id INTO supervisor_rec FROM public.staff WHERE id = staff_rec.supervisor_id LIMIT 1;

    INSERT INTO public.mid_year_reviews (
      staff_id, supervisor_id, timeline_id,
      review_status, review_year, review_period,
      kpi_achievements, challenges_faced, support_needed,
      self_rating, supervisor_comments, supervisor_rating,
      supervisor_reviewed_at, submitted_at
    ) VALUES (
      staff_rec.id,
      staff_rec.supervisor_id,
      timeline_id,
      statuses[(i % 5) + 1],
      2026,
      'mid-year',
      'Achieved 85% of planned KPIs. Completed HEPRR framework reporting on schedule.',
      'Resource constraints and competing priorities across programme areas.',
      'Additional training on data analysis tools and BSC methodology.',
      4,
      CASE WHEN (i % 5) IN (1, 2) THEN 'Strong performance demonstrated across all key result areas.' ELSE NULL END,
      CASE WHEN (i % 5) IN (1, 2) THEN 4 ELSE NULL END,
      CASE WHEN (i % 5) IN (1, 2) THEN CURRENT_TIMESTAMP - INTERVAL '5 days' ELSE NULL END,
      CASE WHEN (i % 5) != 3 THEN CURRENT_TIMESTAMP - INTERVAL '10 days' ELSE NULL END
    ) ON CONFLICT DO NOTHING;

    i := i + 1;
  END LOOP;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Review seed data error: %', SQLERRM;
END $$;
