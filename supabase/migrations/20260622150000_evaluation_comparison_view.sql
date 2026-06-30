-- Migration: Evaluation Comparison View Support
-- Adds per-item supervisor rating columns and comparison feedback fields

-- Add supervisor KPI ratings (JSONB array of { kpi_id, rating, comment })
ALTER TABLE public.mid_year_reviews
ADD COLUMN IF NOT EXISTS supervisor_kpi_ratings JSONB DEFAULT '[]'::jsonb;

-- Add supervisor competency ratings (JSONB array of { competency_id, rating, comment })
ALTER TABLE public.mid_year_reviews
ADD COLUMN IF NOT EXISTS supervisor_competency_ratings JSONB DEFAULT '[]'::jsonb;

-- Add overall comparison feedback fields
ALTER TABLE public.mid_year_reviews
ADD COLUMN IF NOT EXISTS comparison_feedback TEXT;

ALTER TABLE public.mid_year_reviews
ADD COLUMN IF NOT EXISTS rating_variance_notes TEXT;

-- Index for faster lookups on review_status for comparison queries
CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_status_year
ON public.mid_year_reviews(review_status, review_year);

-- RLS: Allow supervisors to update comparison fields
DROP POLICY IF EXISTS "supervisors_update_comparison_fields" ON public.mid_year_reviews;
CREATE POLICY "supervisors_update_comparison_fields"
ON public.mid_year_reviews
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_mid_year_reviews" ON public.mid_year_reviews;
CREATE POLICY "authenticated_read_mid_year_reviews"
ON public.mid_year_reviews
FOR SELECT
TO authenticated
USING (true);
