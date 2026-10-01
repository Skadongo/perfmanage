-- Fix: Add missing custom_kpis column to workplan_settings
-- Root cause: WorkplanSettingForm inserts custom_kpis in the payload but the column
-- did not exist, causing every workplan save to fail with a PostgreSQL column error.

ALTER TABLE public.workplan_settings
ADD COLUMN IF NOT EXISTS custom_kpis JSONB DEFAULT '[]'::JSONB;
