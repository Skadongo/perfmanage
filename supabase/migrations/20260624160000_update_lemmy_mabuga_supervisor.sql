-- Migration: Set Dr. Glory Msibi (President of ECSACONM) as supervisor of Lemmy Medard Mabuga
-- Timestamp: 20260624160000

DO $$
DECLARE
    glory_msibi_id UUID;
    lemmy_mabuga_id UUID;
BEGIN
    -- Insert Dr. Glory Msibi if not already present
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
        'Dr. Glory Msibi',
        'President of ECSACONM',
        'Executive',
        'glory.msibi@ecsaconm.org',
        now(),
        now()
    )
    ON CONFLICT (email) DO NOTHING;

    -- Get Dr. Glory Msibi's ID
    SELECT id INTO glory_msibi_id
    FROM public.staff
    WHERE full_name ILIKE '%Glory Msibi%'
    LIMIT 1;

    -- Get Lemmy Medard Mabuga's ID
    SELECT id INTO lemmy_mabuga_id
    FROM public.staff
    WHERE full_name ILIKE '%Lemmy%Mabuga%'
       OR full_name ILIKE '%Lemmy Medard%'
    LIMIT 1;

    IF glory_msibi_id IS NULL THEN
        RAISE NOTICE 'Dr. Glory Msibi not found in staff table after insert attempt.';
    END IF;

    IF lemmy_mabuga_id IS NULL THEN
        RAISE NOTICE 'Lemmy Medard Mabuga not found in staff table.';
    ELSE
        -- Update Lemmy Medard Mabuga's supervisor
        UPDATE public.staff
        SET
            supervisor_id   = glory_msibi_id,
            supervisor_name = 'Dr. Glory Msibi',
            updated_at      = now()
        WHERE id = lemmy_mabuga_id;

        RAISE NOTICE 'Successfully set Dr. Glory Msibi as supervisor of Lemmy Medard Mabuga.';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Migration failed: %', SQLERRM;
END $$;
