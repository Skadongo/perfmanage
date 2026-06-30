-- Migration: Set Prof Abebe Bekele (Secretary General) as supervisor of Stella Itungu
-- Date: 2026-06-24

DO $$
DECLARE
    v_abebe_id UUID;
    v_stella_id UUID;
    v_dept_exec UUID;
BEGIN
    -- Get Executive Office department id
    SELECT id INTO v_dept_exec FROM public.departments WHERE name = 'Executive Office' LIMIT 1;

    -- Insert Prof Abebe Bekele if not already present
    SELECT id INTO v_abebe_id FROM public.staff WHERE full_name ILIKE '%Abebe Bekele%' LIMIT 1;

    IF v_abebe_id IS NULL THEN
        v_abebe_id := gen_random_uuid();
        INSERT INTO public.staff (id, full_name, job_title, department_id, supervisor_name, supervisor_id, employment_status)
        VALUES (
            v_abebe_id,
            'PROF ABEBE BEKELE',
            'Secretary General',
            v_dept_exec,
            NULL,
            NULL,
            'active'
        );
    END IF;

    -- Get Stella Itungu's id
    SELECT id INTO v_stella_id FROM public.staff WHERE full_name ILIKE '%Stella Itungu%' LIMIT 1;

    IF v_stella_id IS NOT NULL THEN
        UPDATE public.staff
        SET
            supervisor_id   = v_abebe_id,
            supervisor_name = 'Secretary General',
            updated_at      = CURRENT_TIMESTAMP
        WHERE id = v_stella_id;

        RAISE NOTICE 'Updated Stella Itungu supervisor to Prof Abebe Bekele (Secretary General)';
    ELSE
        RAISE NOTICE 'Stella Itungu not found in staff table';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Migration error: %', SQLERRM;
END $$;
