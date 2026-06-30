-- Workplan Settings Migration
-- Creates workplan_settings table to store Stage 1 (Beginning of Year) data:
-- perspectives, objectives, KPIs agreed between staff and supervisor, with dual sign-off.
-- Stage 2 (Mid-Year Self-Eval) and Stage 3 (End-Year Self-Eval) reference this workplan.

-- 1. Create workplan_settings table
CREATE TABLE IF NOT EXISTS public.workplan_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
    supervisor_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    fiscal_year TEXT NOT NULL DEFAULT 'FY 2025-2026',
    review_year INTEGER NOT NULL DEFAULT 2026,

    -- Perspectives & Objectives (stored as JSONB array)
    -- Each item: { perspective, objective, kpi_ids[], weight, target }
    perspectives_objectives JSONB DEFAULT '[]'::JSONB,

    -- Sign-off
    staff_signed_at TIMESTAMPTZ,
    staff_signature TEXT,
    supervisor_signed_at TIMESTAMPTZ,
    supervisor_signature TEXT,

    -- Status: draft | signed | active
    status TEXT NOT NULL DEFAULT 'draft',

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add workplan_id foreign key to mid_year_reviews for Stage 2 & 3 linkage
ALTER TABLE public.mid_year_reviews
ADD COLUMN IF NOT EXISTS workplan_id UUID REFERENCES public.workplan_settings(id) ON DELETE SET NULL;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_workplan_settings_staff_id ON public.workplan_settings(staff_id);
CREATE INDEX IF NOT EXISTS idx_workplan_settings_supervisor_id ON public.workplan_settings(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_workplan_settings_fiscal_year ON public.workplan_settings(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_mid_year_reviews_workplan_id ON public.mid_year_reviews(workplan_id);

-- 4. Enable RLS
ALTER TABLE public.workplan_settings ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "public_read_workplan_settings" ON public.workplan_settings;
CREATE POLICY "public_read_workplan_settings" ON public.workplan_settings
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "authenticated_manage_workplan_settings" ON public.workplan_settings;
CREATE POLICY "authenticated_manage_workplan_settings" ON public.workplan_settings
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_workplan_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workplan_settings_updated_at ON public.workplan_settings;
CREATE TRIGGER workplan_settings_updated_at
    BEFORE UPDATE ON public.workplan_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_workplan_updated_at();
