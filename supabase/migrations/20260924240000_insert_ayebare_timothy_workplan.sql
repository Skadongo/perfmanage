-- Migration: Insert Ayebare Timothy's Individual Performance Contract Workplan
-- Source: ECSA-HC Individual Performance Contract (July 2026 – June 2027)
-- Employee: Ayebare Timothy, Snr Systems Engineer – HEPRR MPA, Health Systems Cluster
-- Supervisor: Dr Mohammed Mohammed Ali, HEPRR MPA Coordinator
-- Review Period: FY 2026-2027 | Biannual Appraisal
-- Signed: May 12, 2026

DO $$
DECLARE
    v_staff_id       UUID;
    v_supervisor_id  UUID;
    v_workplan_id    UUID;
    v_perspectives   JSONB;
    v_competencies   JSONB;
BEGIN

    -- -------------------------------------------------------
    -- 1. Resolve staff record for Ayebare Timothy
    -- -------------------------------------------------------
    SELECT id INTO v_staff_id
    FROM public.staff
    WHERE full_name ILIKE '%Ayebare%Timothy%'
       OR full_name ILIKE '%Ayebare%'
    LIMIT 1;

    IF v_staff_id IS NULL THEN
        INSERT INTO public.staff (
            id,
            full_name,
            job_title,
            employment_status,
            system_role,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            'Ayebare Timothy',
            'Snr Systems Engineer - HEPRR MPA',
            'active',
            'programme_officer',
            NOW(),
            NOW()
        )
        RETURNING id INTO v_staff_id;

        RAISE NOTICE 'Created new staff record for Ayebare Timothy: %', v_staff_id;
    ELSE
        RAISE NOTICE 'Found existing staff record for Ayebare Timothy: %', v_staff_id;
    END IF;

    -- -------------------------------------------------------
    -- 2. Resolve supervisor record for Dr Mohammed Mohammed Ali
    -- -------------------------------------------------------
    SELECT id INTO v_supervisor_id
    FROM public.staff
    WHERE full_name ILIKE '%Mohammed%Ali%'
       OR full_name ILIKE '%Mohammed Mohammed Ali%'
    LIMIT 1;

    IF v_supervisor_id IS NULL THEN
        INSERT INTO public.staff (
            id,
            full_name,
            job_title,
            employment_status,
            system_role,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            'Dr Mohammed Mohammed Ali',
            'HEPRR MPA Coordinator',
            'active',
            'programme_manager',
            NOW(),
            NOW()
        )
        RETURNING id INTO v_supervisor_id;

        RAISE NOTICE 'Created new staff record for Dr Mohammed Mohammed Ali: %', v_supervisor_id;
    ELSE
        RAISE NOTICE 'Found existing staff record for Dr Mohammed Mohammed Ali: %', v_supervisor_id;
    END IF;

    -- Update supervisor link on Ayebare Timothy's staff record
    UPDATE public.staff
    SET supervisor_id   = v_supervisor_id,
        supervisor_name = 'Dr Mohammed Mohammed Ali',
        updated_at      = NOW()
    WHERE id = v_staff_id;

    -- -------------------------------------------------------
    -- 3. Build perspectives_objectives JSONB
    --    Mirrors the BSC scorecard from the PDF (80% weight)
    --    Perspective: HEPRR-MPA Component Subcomponent 1.4
    --    Key Work Objective: Support regional information systems
    --    for health emergencies and digitalization of the health sector
    -- -------------------------------------------------------
    v_perspectives := jsonb_build_array(

        -- PERSPECTIVE: HEPRR-MPA Component Subcomponent 1.4
        jsonb_build_object(
            'id',          'perspective-heprr-mpa-1-4',
            'perspective', 'HEPRR-MPA Component Subcomponent 1.4',
            'weight',      16,
            'objectives',  jsonb_build_array(
                jsonb_build_object(
                    'id',          'obj-regional-info-systems',
                    'objective',   'Support regional information systems for health emergencies and digitalization of the health sector',
                    'description', 'Support countries to develop, adopt, and roll out digital health tools including POE screening, HIS interoperability, SLIPTA, and AMR digital tools',
                    'kpis',        jsonb_build_array(

                        -- KPI 1: Digital POE / Surveillance Tools
                        jsonb_build_object(
                            'id',          'kpi-digital-poe-surveillance',
                            'kpi',         'Number of countries supported to expand, adopt, pilot, or roll out digital POE/surveillance tools',
                            'description', 'Support 4 countries to develop, adopt, and roll out digital point-of-entry (PoE) screening/surveillance tools',
                            'target',      '4 countries',
                            'weight',      5,
                            'unit',        'countries'
                        ),

                        -- KPI 2: HIS Interoperability Layer
                        jsonb_build_object(
                            'id',          'kpi-his-interoperability',
                            'kpi',         'Number of countries supported to develop an HIS layer for interoperability of primary ECSA-HC deployed tools and other national digital tools',
                            'description', 'Develop and deploy a digital interoperability layer for HIS/surveillance tools in three project countries, enabling secure, standards-based exchange of priority health emergency and surveillance data across national systems',
                            'target',      '3 countries',
                            'weight',      5,
                            'unit',        'countries'
                        ),

                        -- KPI 3: SLIPTA / Digital Regional Tools
                        jsonb_build_object(
                            'id',          'kpi-slipta-digital-tools',
                            'kpi',         'Number of countries supported to roll out SLIPTA/digital regional tools across 3 project countries',
                            'description', 'Coordinate and deliver the regional rollout of SLIPTA/digital regional tools across 3 project countries',
                            'target',      '3 countries',
                            'weight',      4,
                            'unit',        'countries'
                        ),

                        -- KPI 4: Digital AMR / Regional Tools
                        jsonb_build_object(
                            'id',          'kpi-digital-amr-tools',
                            'kpi',         'Number of countries supported to deliver the deployment of digital AMR/regional tools across three project countries',
                            'description', 'Coordinate and deliver the deployment of digital AMR/regional tools across three project countries',
                            'target',      '3 countries',
                            'weight',      2,
                            'unit',        'countries'
                        )
                    )
                )
            )
        )
    );

    -- -------------------------------------------------------
    -- 4. Build general_competencies JSONB (20% weight)
    --    Rated 1–5 based on behavioural evidence
    -- -------------------------------------------------------
    v_competencies := jsonb_build_array(
        jsonb_build_object(
            'id',          'comp-teamwork',
            'competency',  'Teamwork',
            'description', 'Creating a culture of teamwork and responding rationally to feedback',
            'weight',      5
        ),
        jsonb_build_object(
            'id',          'comp-respect-diversity',
            'competency',  'Respect for Diversity',
            'description', 'Valuing individual differences and promoting a peaceful work environment',
            'weight',      5
        ),
        jsonb_build_object(
            'id',          'comp-integrity',
            'competency',  'Integrity',
            'description', 'Being reliable, meeting all deadlines, and taking credit only for own work',
            'weight',      5
        ),
        jsonb_build_object(
            'id',          'comp-communication',
            'competency',  'Communication',
            'description', 'Explaining complex issues clearly and using visual aids effectively',
            'weight',      5
        ),
        jsonb_build_object(
            'id',          'comp-results-oriented',
            'competency',  'Results Oriented',
            'description', 'Prioritizing activities and matching tasks with team capabilities',
            'weight',      5
        ),
        jsonb_build_object(
            'id',          'comp-innovation',
            'competency',  'Innovation',
            'description', 'Thinking outside the box to foster team creativity',
            'weight',      4
        ),
        jsonb_build_object(
            'id',          'comp-leadership',
            'competency',  'Leadership (GS3+)',
            'description', 'Acting as a role model and providing timely specific feedback to staff',
            'weight',      2
        )
    );

    -- -------------------------------------------------------
    -- 5. Upsert the workplan into workplan_settings
    --    Avoid duplicates by checking staff_id + fiscal_year
    -- -------------------------------------------------------
    SELECT id INTO v_workplan_id
    FROM public.workplan_settings
    WHERE staff_id   = v_staff_id
      AND fiscal_year = '2026-2027'
    LIMIT 1;

    IF v_workplan_id IS NULL THEN
        INSERT INTO public.workplan_settings (
            id,
            staff_id,
            fiscal_year,
            perspectives_objectives,
            general_competencies,
            status,
            workflow_stage,
            submitted_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            v_staff_id,
            '2026-2027',
            v_perspectives,
            v_competencies,
            'submitted',
            'supervisor_review',
            NOW(),
            NOW(),
            NOW()
        )
        RETURNING id INTO v_workplan_id;

        RAISE NOTICE 'Created workplan for Ayebare Timothy (FY 2026-2027): %', v_workplan_id;
    ELSE
        UPDATE public.workplan_settings
        SET perspectives_objectives = v_perspectives,
            general_competencies    = v_competencies,
            status                  = 'submitted',
            workflow_stage          = 'supervisor_review',
            submitted_at            = COALESCE(submitted_at, NOW()),
            updated_at              = NOW()
        WHERE id = v_workplan_id;

        RAISE NOTICE 'Updated existing workplan for Ayebare Timothy (FY 2026-2027): %', v_workplan_id;
    END IF;

    RAISE NOTICE 'Ayebare Timothy workplan migration completed successfully.';
    RAISE NOTICE '  Staff ID:    %', v_staff_id;
    RAISE NOTICE '  Supervisor:  %', v_supervisor_id;
    RAISE NOTICE '  Workplan ID: %', v_workplan_id;

END $$;
