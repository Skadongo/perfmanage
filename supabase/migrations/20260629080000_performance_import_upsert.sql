-- Performance Import Upsert Support
-- Adds unique index on mid_year_reviews(staff_id, review_year, review_period)
-- to enable ON CONFLICT upsert from Excel import

-- Unique index for upsert conflict target
CREATE UNIQUE INDEX IF NOT EXISTS idx_mid_year_reviews_staff_year_period
  ON public.mid_year_reviews (staff_id, review_year, review_period)
  WHERE staff_id IS NOT NULL;

-- RPC function: admin_upsert_performance_data
-- Called once per Excel row; upserts staff record then upserts mid_year_reviews
CREATE OR REPLACE FUNCTION public.admin_upsert_performance_data(
  p_full_name          TEXT,
  p_job_title          TEXT,
  p_department_name    TEXT,
  p_supervisor_name    TEXT,
  p_employment_status  TEXT,
  p_serial_number      INTEGER,
  p_bsc_perspective    TEXT,
  p_self_rating        INTEGER,
  p_supervisor_rating  INTEGER,
  p_review_year        INTEGER DEFAULT 2026,
  p_review_period      TEXT    DEFAULT 'mid-year'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_staff_id        UUID;
  v_supervisor_id   UUID;
  v_department_id   UUID;
  v_review_id       UUID;
  v_bsc_ratings     JSONB;
  v_self_score      NUMERIC;
  v_sup_score       NUMERIC;
BEGIN
  -- 1. Resolve department
  SELECT id INTO v_department_id
  FROM public.departments
  WHERE lower(name) = lower(p_department_name)
  LIMIT 1;

  -- 2. Resolve supervisor
  SELECT id INTO v_supervisor_id
  FROM public.staff
  WHERE lower(full_name) = lower(p_supervisor_name)
  LIMIT 1;

  -- 3. Upsert staff record (conflict on full_name)
  INSERT INTO public.staff (
    full_name,
    job_title,
    department_id,
    supervisor_id,
    supervisor_name,
    employment_status,
    serial_number
  )
  VALUES (
    upper(p_full_name),
    p_job_title,
    v_department_id,
    v_supervisor_id,
    NULLIF(p_supervisor_name, ''),
    COALESCE(NULLIF(lower(p_employment_status), ''), 'active'),
    p_serial_number
  )
  ON CONFLICT (full_name)
  DO UPDATE SET
    job_title         = EXCLUDED.job_title,
    department_id     = COALESCE(EXCLUDED.department_id, public.staff.department_id),
    supervisor_id     = COALESCE(EXCLUDED.supervisor_id, public.staff.supervisor_id),
    supervisor_name   = COALESCE(EXCLUDED.supervisor_name, public.staff.supervisor_name),
    employment_status = EXCLUDED.employment_status,
    serial_number     = COALESCE(EXCLUDED.serial_number, public.staff.serial_number),
    updated_at        = CURRENT_TIMESTAMP;

  -- 4. Fetch the resolved staff id
  SELECT id INTO v_staff_id
  FROM public.staff
  WHERE full_name = upper(p_full_name)
  LIMIT 1;

  IF v_staff_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Staff record not found after upsert');
  END IF;

  -- 5. Build bsc_perspective_ratings JSONB (only when perspective provided)
  IF p_bsc_perspective IS NOT NULL AND p_bsc_perspective <> '' THEN
    v_bsc_ratings := jsonb_build_array(
      jsonb_build_object(
        'perspective',       p_bsc_perspective,
        'selfRating',        p_self_rating,
        'supervisorRating',  p_supervisor_rating,
        'weight',            25,
        'comments',          ''
      )
    );
  ELSE
    v_bsc_ratings := '[]'::jsonb;
  END IF;

  -- 6. Compute simple scores (same value as rating when single perspective)
  v_self_score := p_self_rating;
  v_sup_score  := p_supervisor_rating;

  -- 7. Upsert mid_year_reviews
  INSERT INTO public.mid_year_reviews (
    staff_id,
    supervisor_id,
    review_year,
    review_period,
    review_status,
    self_rating,
    supervisor_rating,
    bsc_perspective_ratings,
    bsc_self_score,
    bsc_supervisor_score,
    overall_self_score,
    overall_supervisor_score
  )
  VALUES (
    v_staff_id,
    v_supervisor_id,
    p_review_year,
    p_review_period,
    'reviewed'::public.review_status,
    NULLIF(p_self_rating, 0),
    NULLIF(p_supervisor_rating, 0),
    v_bsc_ratings,
    NULLIF(v_self_score, 0),
    NULLIF(v_sup_score, 0),
    NULLIF(v_self_score, 0),
    NULLIF(v_sup_score, 0)
  )
  ON CONFLICT (staff_id, review_year, review_period)
  WHERE staff_id IS NOT NULL
  DO UPDATE SET
    supervisor_id            = COALESCE(EXCLUDED.supervisor_id, public.mid_year_reviews.supervisor_id),
    self_rating              = COALESCE(EXCLUDED.self_rating, public.mid_year_reviews.self_rating),
    supervisor_rating        = COALESCE(EXCLUDED.supervisor_rating, public.mid_year_reviews.supervisor_rating),
    bsc_perspective_ratings  = CASE
                                 WHEN jsonb_array_length(EXCLUDED.bsc_perspective_ratings) > 0
                                 THEN EXCLUDED.bsc_perspective_ratings
                                 ELSE public.mid_year_reviews.bsc_perspective_ratings
                               END,
    bsc_self_score           = COALESCE(EXCLUDED.bsc_self_score, public.mid_year_reviews.bsc_self_score),
    bsc_supervisor_score     = COALESCE(EXCLUDED.bsc_supervisor_score, public.mid_year_reviews.bsc_supervisor_score),
    overall_self_score       = COALESCE(EXCLUDED.overall_self_score, public.mid_year_reviews.overall_self_score),
    overall_supervisor_score = COALESCE(EXCLUDED.overall_supervisor_score, public.mid_year_reviews.overall_supervisor_score),
    review_status            = 'reviewed'::public.review_status,
    updated_at               = CURRENT_TIMESTAMP
  RETURNING id INTO v_review_id;

  RETURN jsonb_build_object(
    'success',    true,
    'staff_id',   v_staff_id,
    'review_id',  v_review_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
