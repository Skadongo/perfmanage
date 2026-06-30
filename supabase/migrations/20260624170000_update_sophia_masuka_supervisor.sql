-- Migration: Set Dr Abel Mwale (Secretary General) as supervisor of Sophia Masuka
-- Timestamp: 20260624170000

DO $$
DECLARE
    abel_mwale_id UUID;
    sophia_masuka_id UUID;
BEGIN
    -- Insert Dr Abel Mwale if not already present
    INSERT INTO public.staff (
        id,
        full_name,
        job_title,
        department,
        email,
        created_at,
        updated_at
    )
    VALUES (
        gen_random_uuid(),
        'Dr Abel Mwale',
        'Secretary General',
        'Executive',
        'abel.mwale@ecsahc.org',
        now(),
        now()
    )
    ON CONFLICT (email) DO NOTHING;

    -- Get Dr Abel Mwale's ID
    SELECT id INTO abel_mwale_id
    FROM public.staff
    WHERE full_name ILIKE '%Abel Mwale%'
    LIMIT 1;

    -- Get Sophia Masuka's ID
    SELECT id INTO sophia_masuka_id
    FROM public.staff
    WHERE full_name ILIKE '%Sophia Masuka%'
    LIMIT 1;

    IF abel_mwale_id IS NULL THEN
        RAISE NOTICE 'Dr Abel Mwale not found in staff table after insert attempt.';
    END IF;

    IF sophia_masuka_id IS NULL THEN
        RAISE NOTICE 'Sophia Masuka not found in staff table.';
    ELSE
        -- Update Sophia Masuka's supervisor
        UPDATE public.staff
        SET
            supervisor_id   = abel_mwale_id,
            supervisor_name = 'Dr Abel Mwale',
            updated_at      = now()
        WHERE id = sophia_masuka_id;

        RAISE NOTICE 'Successfully set Dr Abel Mwale as supervisor of Sophia Masuka.';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Migration failed: %', SQLERRM;
END $$;
