-- Migration: Set Prof Bellington Vwalika (Secretary General) as supervisor of Judith Andrew
-- Date: 2026-06-24

DO $$
DECLARE
    v_bellington_id UUID;
    v_judith_id UUID;
    v_dept_exec UUID;
BEGIN
    -- Get Executive Office department id
    SELECT id INTO v_dept_exec FROM public.departments WHERE name = 'Executive Office' LIMIT 1;

    -- Insert Prof Bellington Vwalika if not already present
    SELECT id INTO v_bellington_id FROM public.staff WHERE full_name ILIKE '%Bellington Vwalika%' LIMIT 1;

    IF v_bellington_id IS NULL THEN
        v_bellington_id := gen_random_uuid();
        INSERT INTO public.staff (id, full_name, job_title, department_id, supervisor_name, supervisor_id, employment_status)
        VALUES (
            v_bellington_id,
            'PROFESSOR BELLINGTON VWALIKA',
            'Secretary General',
            v_dept_exec,
            NULL,
            NULL,
            'active'
        );
    END IF;

    -- Get Judith Andrew's id
    SELECT id INTO v_judith_id FROM public.staff WHERE full_name ILIKE '%Judith Andrew%' LIMIT 1;

    IF v_judith_id IS NOT NULL THEN
        UPDATE public.staff
        SET
            supervisor_id   = v_bellington_id,
            supervisor_name = 'Secretary General',
            updated_at      = CURRENT_TIMESTAMP
        WHERE id = v_judith_id;

        RAISE NOTICE 'Updated Judith Andrew supervisor to Professor Bellington Vwalika (Secretary General)';
    ELSE
        RAISE NOTICE 'Judith Andrew not found in staff table';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Migration error: %', SQLERRM;
END $$;
