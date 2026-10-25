-- Migration: Insert Timothy Ayebare's workplan data
-- Source: Ayebare Timothy ECSA-HC Individual Performance Contract (July 2026 – June 2027)
-- Staff: Timothy Ayebare, Snr Systems Engineer – HEPRR MPA
-- Supervisor: Dr Mohammed Mohammed Ali, HEPRR MPA Coordinator

DO $$
DECLARE
    v_staff_id       UUID;
    v_supervisor_id  UUID;
    v_workplan_id    UUID;
    v_perspectives   JSONB;
    v_competencies   JSONB;
BEGIN
    -- Resolve Timothy Ayebare's staff record
    SELECT id INTO v_staff_id
    FROM public.staff
    WHERE email ILIKE 'atimothy@ecsahc.org'
       OR full_name ILIKE '%TIMOTHY AYEBARE%'
       OR full_name ILIKE '%AYEBARE%TIMOTHY%'
    LIMIT 1;

    IF v_staff_id IS NULL THEN
        RAISE NOTICE 'Staff record for Timothy Ayebare not found – workplan not inserted.';
        RETURN;
    END IF;

    -- Resolve supervisor (Dr Mohammed Mohammed Ali / mmohamed)
    SELECT id INTO v_supervisor_id
    FROM public.staff
    WHERE email ILIKE 'mmohamed@ecsahc.org'
       OR full_name ILIKE '%MOHAMMED%ALI%'
       OR full_name ILIKE '%MMOHAMED%'
    LIMIT 1;

    -- Build perspectives_objectives JSONB
    -- Part 1 – Scorecard Performance (80% weight)
    -- Component: HEPRR-MPA Subcomponent 1.4
    -- Objective: Support regional information systems for health emergencies and digitalisation
    v_perspectives := jsonb_build_array(
        jsonb_build_object(
            'id',          'heprr-1',
            'perspective', 'HEPRR-MPA Component Subcomponent 1.4',
            'objective',   'Support regional information systems for health emergencies and digitalization of the health sector',
            'activities',  'Support 4 countries to develop, adopt, and roll out digital point-of-entry (PoE) screening/surveillance tools',
            'kpi',         'Number of countries supported to expand, adopt, pilot, or roll out digital POE/surveillance tools',
            'target',      '4 countries',
            'weight',      5
        ),
        jsonb_build_object(
            'id',          'heprr-2',
            'perspective', 'HEPRR-MPA Component Subcomponent 1.4',
            'objective',   'Support regional information systems for health emergencies and digitalization of the health sector',
            'activities',  'Develop and deploy a secure, standards-based digital interoperability layer for HIS/surveillance tools in 3 project countries, enabling national teams to operate and sustain the interoperability functions',
            'kpi',         'Number of countries supported to develop an HIS layer for interoperability of primary ECSA-HC deployed tools and other national digital tools',
            'target',      '3 countries',
            'weight',      5
        ),
        jsonb_build_object(
            'id',          'heprr-3',
            'perspective', 'HEPRR-MPA Component Subcomponent 1.4',
            'objective',   'Support regional information systems for health emergencies and digitalization of the health sector',
            'activities',  'Regional activity: Coordinate and deliver rollout of SLIPTA/digital regional tools across 3 project countries',
            'kpi',         'Number of countries supported to roll out SLIPTA/digital regional tools across 3 project countries',
            'target',      '3 countries',
            'weight',      4
        ),
        jsonb_build_object(
            'id',          'heprr-4',
            'perspective', 'HEPRR-MPA Component Subcomponent 1.4',
            'objective',   'Support regional information systems for health emergencies and digitalization of the health sector',
            'activities',  'Regional activity: Coordinate and deliver deployment of digital AMR/regional tools across 3 project countries',
            'kpi',         'Number of countries supported to deliver deployment of digital AMR/regional tools across 3 project countries',
            'target',      '3 countries',
            'weight',      2
        )
    );

    -- Build general_competencies JSONB
    -- Part 2 – General Competencies (20% weight)
    v_competencies := jsonb_build_array(
        jsonb_build_object(
            'id',          'comp-teamwork',
            'name',        'Teamwork',
            'description', 'Creates a culture of teamwork and responds rationally to feedback',
            'weight',      5
        ),
        jsonb_build_object(
            'id',          'comp-diversity',
            'name',        'Respect for Diversity',
            'description', 'Values individual differences and promotes a peaceful work environment',
            'weight',      5
        ),
        jsonb_build_object(
            'id',          'comp-integrity',
            'name',        'Integrity',
            'description', 'Reliable, meets all deadlines, and takes credit only for own work',
            'weight',      5
        ),
        jsonb_build_object(
            'id',          'comp-communication',
            'name',        'Communication',
            'description', 'Explains complex issues clearly and uses visual aids effectively',
            'weight',      5
        ),
        jsonb_build_object(
            'id',          'comp-results',
            'name',        'Results Oriented',
            'description', 'Prioritizes activities and matches tasks with team capabilities',
            'weight',      5
        ),
        jsonb_build_object(
            'id',          'comp-innovation',
            'name',        'Innovation',
            'description', 'Thinks outside the box to foster team creativity',
            'weight',      4
        ),
        jsonb_build_object(
            'id',          'comp-leadership',
            'name',        'Leadership (GS3+)',
            'description', 'Acts as a role model and provides timely specific feedback to staff',
            'weight',      2
        )
    );

    -- Check whether a workplan already exists for this staff + fiscal year to avoid duplicates
    SELECT id INTO v_workplan_id
    FROM public.workplan_settings
    WHERE staff_id   = v_staff_id
      AND fiscal_year = 'FY 2026-2027'
    LIMIT 1;

    IF v_workplan_id IS NOT NULL THEN
        -- Update existing record with the PDF data
        UPDATE public.workplan_settings
        SET
            supervisor_id          = COALESCE(v_supervisor_id, supervisor_id),
            perspectives_objectives = v_perspectives,
            general_competencies   = v_competencies,
            review_type            = 'annual',
            review_year            = 2027,
            status                 = 'draft',
            staff_signature        = 'Ayebare Timothy',
            staff_signed_at        = '2026-05-12 00:00:00+00',
            updated_at             = CURRENT_TIMESTAMP
        WHERE id = v_workplan_id;

        RAISE NOTICE 'Updated existing workplan (id=%) for Timothy Ayebare – FY 2026-2027.', v_workplan_id;
    ELSE
        -- Insert new workplan record
        INSERT INTO public.workplan_settings (
            id,
            staff_id,
            supervisor_id,
            fiscal_year,
            review_year,
            review_type,
            perspectives_objectives,
            general_competencies,
            status,
            workflow_stage,
            staff_signature,
            staff_signed_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            v_staff_id,
            v_supervisor_id,
            'FY 2026-2027',
            2027,
            'annual',
            v_perspectives,
            v_competencies,
            'draft',
            'workplan_pending',
            'Ayebare Timothy',
            '2026-05-12 00:00:00+00',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        );

        RAISE NOTICE 'Inserted new workplan for Timothy Ayebare – FY 2026-2027.';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Workplan insertion failed: %', SQLERRM;
END $$;
