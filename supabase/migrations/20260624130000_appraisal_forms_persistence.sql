-- ============================================================
-- Appraisal Forms Persistence Migration
-- Adds structured JSONB columns for:
--   1. workplan_settings  → general_competencies, version, submitted_at
--   2. mid_year_reviews   → bsc_ratings, competency_ratings (structured),
--                           goals, kpis, scores, signatures, audit fields
-- ============================================================

-- ─── 1. workplan_settings: add general_competencies & audit columns ──────────

ALTER TABLE public.workplan_settings
  ADD COLUMN IF NOT EXISTS general_competencies JSONB DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_type TEXT DEFAULT 'annual';

COMMENT ON COLUMN public.workplan_settings.general_competencies IS
  'Array of {id, name, description, weight} objects for the 5–7 general competencies set at workplan stage';

COMMENT ON COLUMN public.workplan_settings.version IS
  'Incremented on each update for optimistic concurrency / audit trail';

COMMENT ON COLUMN public.workplan_settings.submitted_at IS
  'Timestamp when the workplan was first submitted (signed by both parties)';

-- ─── 2. mid_year_reviews: add structured appraisal columns ──────────────────

-- BSC Perspective Ratings (structured, replaces text concatenation)
ALTER TABLE public.mid_year_reviews
  ADD COLUMN IF NOT EXISTS bsc_perspective_ratings JSONB DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS competency_ratings_detail JSONB DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS goals_detail JSONB DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS kpis_detail JSONB DEFAULT '[]'::JSONB;

COMMENT ON COLUMN public.mid_year_reviews.bsc_perspective_ratings IS
  'Array of {perspective, selfRating, supervisorRating, weight, comments} — 4 BSC perspectives';

COMMENT ON COLUMN public.mid_year_reviews.competency_ratings_detail IS
  'Array of {id, label, description, selfRating, supervisorRating, behavioralEvidence, weight} — 7 competencies';

COMMENT ON COLUMN public.mid_year_reviews.goals_detail IS
  'Array of {id, goal, target, actual, selfRating, supervisorRating, weight, comments}';

COMMENT ON COLUMN public.mid_year_reviews.kpis_detail IS
  'Array of {id, kpiId, target, actual, status, selfRating, supervisorRating}';

-- Score columns (computed and stored for reports/audit)
ALTER TABLE public.mid_year_reviews
  ADD COLUMN IF NOT EXISTS bsc_self_score NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS bsc_supervisor_score NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS competency_self_score NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS competency_supervisor_score NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS overall_self_score NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS overall_supervisor_score NUMERIC(6,4);

COMMENT ON COLUMN public.mid_year_reviews.bsc_self_score IS
  'Weighted BSC self score (1–5 scale, 80% of overall)';
COMMENT ON COLUMN public.mid_year_reviews.overall_self_score IS
  'Final overall self score = (BSC × 80%) + (Competency × 20%)';

-- Narrative / assessment fields
ALTER TABLE public.mid_year_reviews
  ADD COLUMN IF NOT EXISTS self_strengths TEXT,
  ADD COLUMN IF NOT EXISTS self_development_needs TEXT,
  ADD COLUMN IF NOT EXISTS supervisor_areas_for_improvement TEXT,
  ADD COLUMN IF NOT EXISTS supervisor_development_plan TEXT,
  ADD COLUMN IF NOT EXISTS supervisor_recommendation TEXT,
  ADD COLUMN IF NOT EXISTS review_date DATE;

-- Signature fields
ALTER TABLE public.mid_year_reviews
  ADD COLUMN IF NOT EXISTS staff_signature TEXT,
  ADD COLUMN IF NOT EXISTS supervisor_signature_eval TEXT,
  ADD COLUMN IF NOT EXISTS hr_signature TEXT,
  ADD COLUMN IF NOT EXISTS staff_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS supervisor_signed_eval_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hr_signed_at TIMESTAMPTZ;

-- Versioning & audit trail
ALTER TABLE public.mid_year_reviews
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS review_type TEXT DEFAULT 'Mid-Year Review',
  ADD COLUMN IF NOT EXISTS review_period_label TEXT;

COMMENT ON COLUMN public.mid_year_reviews.version IS
  'Incremented on each update for audit trail';

-- ─── 3. Indexes for reporting queries ────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_workplan_settings_status
  ON public.workplan_settings(status);

CREATE INDEX IF NOT EXISTS idx_workplan_settings_review_year
  ON public.workplan_settings(review_year);

CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_review_year
  ON public.mid_year_reviews(review_year);

CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_review_status
  ON public.mid_year_reviews(review_status);

CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_submitted_at
  ON public.mid_year_reviews(submitted_at);

-- ─── 4. Version auto-increment trigger for workplan_settings ─────────────────

CREATE OR REPLACE FUNCTION public.increment_workplan_version()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.version := COALESCE(OLD.version, 0) + 1;
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workplan_version_increment ON public.workplan_settings;
CREATE TRIGGER workplan_version_increment
  BEFORE UPDATE ON public.workplan_settings
  FOR EACH ROW EXECUTE FUNCTION public.increment_workplan_version();

-- ─── 5. Version auto-increment trigger for mid_year_reviews ──────────────────

CREATE OR REPLACE FUNCTION public.increment_review_version()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.version := COALESCE(OLD.version, 0) + 1;
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS review_version_increment ON public.mid_year_reviews;
CREATE TRIGGER review_version_increment
  BEFORE UPDATE ON public.mid_year_reviews
  FOR EACH ROW EXECUTE FUNCTION public.increment_review_version();

-- ─── 6. Audit log view for reports ───────────────────────────────────────────

CREATE OR REPLACE VIEW public.appraisal_audit_trail AS
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

-- Grant access to the view
GRANT SELECT ON public.appraisal_audit_trail TO authenticated;
GRANT SELECT ON public.appraisal_audit_trail TO public;
