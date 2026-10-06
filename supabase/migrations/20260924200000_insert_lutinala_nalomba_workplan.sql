-- Migration: Insert Lutinala N. Nalomba's Individual Performance Contract Workplan
-- Source: ECSA-HC Individual Performance Contract (July 2026 – June 2027)
-- Employee: Lutinala N. Nalomba, Project Officer, FHID Cluster
-- Supervisor: Dr Andrew Silumesii, Manager, FHID
-- Review Period: FY 2026-2027 | Biannual Appraisal

DO $$
DECLARE
    v_staff_id       UUID;
    v_supervisor_id  UUID;
    v_workplan_id    UUID;
    v_perspectives   JSONB;
    v_competencies   JSONB;
BEGIN

    -- -------------------------------------------------------
    -- 1. Resolve staff record for Lutinala N. Nalomba
    -- -------------------------------------------------------
    SELECT id INTO v_staff_id
    FROM public.staff
    WHERE full_name ILIKE '%Nalomba%'
       OR full_name ILIKE '%Lutinala%'
    LIMIT 1;

    IF v_staff_id IS NULL THEN
        -- Create the staff record if not found
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
            'Lutinala N. Nalomba',
            'Project Officer',
            'active',
            'programme_officer',
            NOW(),
            NOW()
        )
        RETURNING id INTO v_staff_id;

        RAISE NOTICE 'Created new staff record for Lutinala N. Nalomba: %', v_staff_id;
    ELSE
        RAISE NOTICE 'Found existing staff record for Lutinala N. Nalomba: %', v_staff_id;
    END IF;

    -- -------------------------------------------------------
    -- 2. Resolve supervisor record for Dr Andrew Silumesii
    -- -------------------------------------------------------
    SELECT id INTO v_supervisor_id
    FROM public.staff
    WHERE full_name ILIKE '%Silumesii%'
       OR full_name ILIKE '%Andrew%Silumesii%'
    LIMIT 1;

    IF v_supervisor_id IS NULL THEN
        -- Create supervisor record if not found
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
            'Dr Andrew Silumesii',
            'Manager, FHID',
            'active',
            'programme_manager',
            NOW(),
            NOW()
        )
        RETURNING id INTO v_supervisor_id;

        RAISE NOTICE 'Created new staff record for Dr Andrew Silumesii: %', v_supervisor_id;
    ELSE
        RAISE NOTICE 'Found existing staff record for Dr Andrew Silumesii: %', v_supervisor_id;
    END IF;

    -- Update supervisor link on Nalomba's staff record
    UPDATE public.staff
    SET supervisor_id   = v_supervisor_id,
        supervisor_name = 'Dr Andrew Silumesii',
        updated_at      = NOW()
    WHERE id = v_staff_id;

    -- -------------------------------------------------------
    -- 3. Build perspectives_objectives JSONB
    --    Mirrors the BSC scorecard from the PDF (80% weight)
    --    Structure: array of perspective objects, each with
    --    an objectives array, each objective with a kpis array
    -- -------------------------------------------------------
    v_perspectives := jsonb_build_array(

        -- PERSPECTIVE 1: Finance – Sustainability & Grants
        jsonb_build_object(
            'id',          'perspective-finance',
            'perspective', 'Finance',
            'weight',      10,
            'objectives',  jsonb_build_array(
                jsonb_build_object(
                    'id',          'obj-sustainability-grants',
                    'objective',   'Sustainability & Grants',
                    'description', 'Contribute to grant cycle management and financial performance monitoring for the FHID cluster',
                    'kpis',        jsonb_build_array(
                        jsonb_build_object(
                            'id',          'kpi-gc8-proposal',
                            'kpi',         'Number of grant proposals submitted (GC8)',
                            'description', 'Contribute to development of the Grant Cycle 8 (GC8) proposal writing',
                            'target',      '1 GF Proposal',
                            'weight',      5,
                            'unit',        'proposals'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-cluster-proposals',
                            'kpi',         'Number of grant proposals submitted (cluster)',
                            'description', 'Contribute to all grant proposals being written under the cluster',
                            'target',      '2 proposals',
                            'weight',      3,
                            'unit',        'proposals'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-grant-absorption',
                            'kpi',         'Grant absorption rate',
                            'description', 'Monitor the grant financial performance',
                            'target',      '85%',
                            'weight',      2,
                            'unit',        '%'
                        )
                    )
                )
            )
        ),

        -- PERSPECTIVE 2: Customer / Operations – Training & Capacity
        jsonb_build_object(
            'id',          'perspective-customer-ops',
            'perspective', 'Customer / Operations',
            'weight',      10,
            'objectives',  jsonb_build_array(
                jsonb_build_object(
                    'id',          'obj-training-capacity',
                    'objective',   'Training & Capacity',
                    'description', 'Facilitate technical assistance and training activities under the ILSS and DAC projects',
                    'kpis',        jsonb_build_array(
                        jsonb_build_object(
                            'id',          'kpi-technical-assistance',
                            'kpi',         'Number of countries provided with technical assistance based on needs',
                            'description', 'Facilitate technical assistance visits under the ILSS and DAC projects',
                            'target',      '21',
                            'weight',      5,
                            'unit',        'countries'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-training-sessions',
                            'kpi',         'Number of training sessions conducted in project countries',
                            'description', 'Facilitate training activities under the ILSS and DAC projects',
                            'target',      '5',
                            'weight',      5,
                            'unit',        'sessions'
                        )
                    )
                )
            )
        ),

        -- PERSPECTIVE 3: Customer / Business Process – Health Systems Support
        jsonb_build_object(
            'id',          'perspective-business-process',
            'perspective', 'Customer / Business Process',
            'weight',      3,
            'objectives',  jsonb_build_array(
                jsonb_build_object(
                    'id',          'obj-health-systems-support',
                    'objective',   'Health Systems Support',
                    'description', 'Contribute to FHID cluster work as assigned by the Manager',
                    'kpis',        jsonb_build_array(
                        jsonb_build_object(
                            'id',          'kpi-non-project-tasks',
                            'kpi',         'Number of non-project-related tasks completed',
                            'description', 'Contribute to FHID cluster work as assigned by the Manager',
                            'target',      'As assigned',
                            'weight',      3,
                            'unit',        'tasks'
                        )
                    )
                )
            )
        ),

        -- PERSPECTIVE 4: Learning & Growth – Knowledge & Data
        jsonb_build_object(
            'id',          'perspective-learning-growth',
            'perspective', 'Learning & Growth',
            'weight',      29,
            'objectives',  jsonb_build_array(
                jsonb_build_object(
                    'id',          'obj-knowledge-data',
                    'objective',   'Knowledge & Data',
                    'description', 'Facilitate knowledge sharing, policy development, project monitoring, reporting and governance',
                    'kpis',        jsonb_build_array(
                        jsonb_build_object(
                            'id',          'kpi-ilss-knowledge-meetings',
                            'kpi',         'Number of meetings attended where data from the ILSS is shared',
                            'description', 'Facilitate knowledge sharing through ILSS data dissemination meetings',
                            'target',      '3',
                            'weight',      5,
                            'unit',        'meetings'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-policy-briefs',
                            'kpi',         'Number of policy briefs developed',
                            'description', 'Develop policy briefs based on project data and findings',
                            'target',      '1',
                            'weight',      2,
                            'unit',        'briefs'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-monthly-workplan-updates',
                            'kpi',         'Monthly progress updates of the work plan',
                            'description', 'Monitor project implementation through monthly work-plan updates',
                            'target',      '12',
                            'weight',      5,
                            'unit',        'updates'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-global-fund-pu',
                            'kpi',         'Final Performance Update (PU) submitted to the Global Fund',
                            'description', 'Annual reporting – submit final PU to the Global Fund',
                            'target',      '1',
                            'weight',      5,
                            'unit',        'reports'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-final-narrative-report',
                            'kpi',         'Final narrative report documented',
                            'description', 'Document the final project narrative report',
                            'target',      '1',
                            'weight',      5,
                            'unit',        'reports'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-governance-meetings',
                            'kpi',         'Number of ECSA CHS governance meetings held',
                            'description', 'Facilitate ECSA CHS Governance Meetings',
                            'target',      '13',
                            'weight',      5,
                            'unit',        'meetings'
                        )
                    )
                )
            )
        )

    );

    -- -------------------------------------------------------
    -- 4. Build general_competencies JSONB (20% weight)
    --    Seven competencies from Part 2 of the contract
    -- -------------------------------------------------------
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
            'description', 'Is reliable, meets all deadlines, and takes credit only for own work',
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
            'weight',      5
        ),
        jsonb_build_object(
            'id',          'comp-leadership',
            'name',        'Leadership (GS3+)',
            'description', 'Acts as a role model and provides timely specific feedback to staff',
            'weight',      5
        )
    );

    -- -------------------------------------------------------
    -- 5. Check for existing workplan for this staff / FY
    -- -------------------------------------------------------
    SELECT id INTO v_workplan_id
    FROM public.workplan_settings
    WHERE staff_id   = v_staff_id
      AND fiscal_year = 'FY 2026-2027'
    LIMIT 1;

    IF v_workplan_id IS NOT NULL THEN
        -- Update existing workplan
        UPDATE public.workplan_settings
        SET
            supervisor_id            = v_supervisor_id,
            fiscal_year              = 'FY 2026-2027',
            review_year              = 2026,
            review_type              = 'biannual',
            perspectives_objectives  = v_perspectives,
            general_competencies     = v_competencies,
            status                   = 'draft',
            workflow_stage           = 'workplan_pending',
            updated_at               = NOW()
        WHERE id = v_workplan_id;

        RAISE NOTICE 'Updated existing workplan % for Lutinala N. Nalomba', v_workplan_id;
    ELSE
        -- Insert new workplan
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
            version,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            v_staff_id,
            v_supervisor_id,
            'FY 2026-2027',
            2026,
            'biannual',
            v_perspectives,
            v_competencies,
            'draft',
            'workplan_pending',
            1,
            NOW(),
            NOW()
        )
        RETURNING id INTO v_workplan_id;

        RAISE NOTICE 'Inserted new workplan % for Lutinala N. Nalomba', v_workplan_id;
    END IF;

    RAISE NOTICE 'Workplan insertion complete. staff_id=%, supervisor_id=%, workplan_id=%',
        v_staff_id, v_supervisor_id, v_workplan_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Workplan insertion failed: %', SQLERRM;
        RAISE;
END $$;
