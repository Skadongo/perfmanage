-- Bulk Workplan Import Tracking
-- Tracks each bulk import batch and individual file results

CREATE TABLE IF NOT EXISTS public.workplan_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    imported_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    total_files INTEGER NOT NULL DEFAULT 0,
    successful INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    skipped INTEGER NOT NULL DEFAULT 0,
    fiscal_year TEXT NOT NULL DEFAULT 'FY 2026-2027',
    status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | completed | partial
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.workplan_import_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES public.workplan_import_batches(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    workplan_id UUID REFERENCES public.workplan_settings(id) ON DELETE SET NULL,
    staff_name_parsed TEXT,
    job_title_parsed TEXT,
    fiscal_year TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | matched | saved | failed | skipped
    error_message TEXT,
    parse_warnings JSONB DEFAULT '[]'::JSONB,
    parsed_data JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wib_imported_by ON public.workplan_import_batches(imported_by);
CREATE INDEX IF NOT EXISTS idx_wib_fiscal_year ON public.workplan_import_batches(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_wib_status ON public.workplan_import_batches(status);
CREATE INDEX IF NOT EXISTS idx_wir_batch_id ON public.workplan_import_results(batch_id);
CREATE INDEX IF NOT EXISTS idx_wir_staff_id ON public.workplan_import_results(staff_id);
CREATE INDEX IF NOT EXISTS idx_wir_workplan_id ON public.workplan_import_results(workplan_id);

-- Enable RLS
ALTER TABLE public.workplan_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workplan_import_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "authenticated_manage_workplan_import_batches" ON public.workplan_import_batches;
CREATE POLICY "authenticated_manage_workplan_import_batches"
ON public.workplan_import_batches
FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_manage_workplan_import_results" ON public.workplan_import_results;
CREATE POLICY "authenticated_manage_workplan_import_results"
ON public.workplan_import_results
FOR ALL TO authenticated USING (true) WITH CHECK (true);
