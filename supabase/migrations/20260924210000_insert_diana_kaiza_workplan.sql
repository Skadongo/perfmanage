-- Migration: Insert Diana Kaiza's Individual Performance Contract Workplan
-- Source: ECSA-HC Individual Performance Contract (July 2026 – June 2027)
-- Employee: Diana Kaiza, Administrative Officer, COSECSA Cluster
-- Supervisor: Ms. Stella Itungu, Chief Executive Officer
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
    -- 1. Resolve staff record for Diana Kaiza
    -- -------------------------------------------------------
    SELECT id INTO v_staff_id
    FROM public.staff
    WHERE full_name ILIKE '%Diana%Kaiza%'
       OR full_name ILIKE '%Kaiza%'
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
            'Diana Kaiza',
            'Administrative Officer',
            'active',
            'programme_officer',
            NOW(),
            NOW()
        )
        RETURNING id INTO v_staff_id;

        RAISE NOTICE 'Created new staff record for Diana Kaiza: %', v_staff_id;
    ELSE
        RAISE NOTICE 'Found existing staff record for Diana Kaiza: %', v_staff_id;
    END IF;

    -- -------------------------------------------------------
    -- 2. Resolve supervisor record for Ms. Stella Itungu
    -- -------------------------------------------------------
    SELECT id INTO v_supervisor_id
    FROM public.staff
    WHERE full_name ILIKE '%Stella%Itungu%'
       OR full_name ILIKE '%Itungu%'
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
            'Stella Itungu',
            'Chief Executive Officer',
            'active',
            'programme_manager',
            NOW(),
            NOW()
        )
        RETURNING id INTO v_supervisor_id;

        RAISE NOTICE 'Created new staff record for Stella Itungu: %', v_supervisor_id;
    ELSE
        RAISE NOTICE 'Found existing staff record for Stella Itungu: %', v_supervisor_id;
    END IF;

    -- Update supervisor link on Diana Kaiza's staff record
    UPDATE public.staff
    SET supervisor_id   = v_supervisor_id,
        supervisor_name = 'Stella Itungu',
        updated_at      = NOW()
    WHERE id = v_staff_id;

    -- -------------------------------------------------------
    -- 3. Build perspectives_objectives JSONB
    --    Mirrors the BSC scorecard from the PDF (80% weight)
    -- -------------------------------------------------------
    v_perspectives := jsonb_build_array(

        -- PERSPECTIVE 1: Finance / Stewardship
        jsonb_build_object(
            'id',          'perspective-finance',
            'perspective', 'Finance / Stewardship',
            'weight',      18,
            'objectives',  jsonb_build_array(
                jsonb_build_object(
                    'id',          'obj-strategic-partnerships',
                    'objective',   'Strategic Partnerships Development and Financial Sustainability',
                    'description', 'Support strategic communication, partner engagement, payment processing, funds collection and budget compliance',
                    'kpis',        jsonb_build_array(
                        jsonb_build_object(
                            'id',          'kpi-official-communication',
                            'kpi',         'Number of fact sheets and official correspondence sent to the Ministry of Health within the required timeline',
                            'description', 'Timely dissemination of official communication to the Ministry of Health',
                            'target',      '15',
                            'weight',      3,
                            'unit',        'fact sheets / correspondence'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-partner-engagement',
                            'kpi',         'Percentage of partners/institutions successfully engaged and invited for the Annual Scientific Conference and Graduation Ceremony',
                            'description', 'Support partner and stakeholder engagement for annual events',
                            'target',      '80%',
                            'weight',      3,
                            'unit',        '%'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-payment-memos',
                            'kpi',         'Percentage of payment memos processed within the approved timeline',
                            'description', 'Timely processing of payment memos',
                            'target',      '80%',
                            'weight',      5,
                            'unit',        '%'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-merchandise-sales',
                            'kpi',         'Percentage of support provided in the collection of income during annual events',
                            'description', 'Support funds collection from the sale of merchandise during annual events',
                            'target',      '80%',
                            'weight',      3,
                            'unit',        '%'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-budget-compliance',
                            'kpi',         'Percentage adherence to approved activity budgets during implementation of events and administrative activities',
                            'description', 'Maintain budget compliance during events and administrative activities',
                            'target',      '80%',
                            'weight',      4,
                            'unit',        '%'
                        )
                    )
                )
            )
        ),

        -- PERSPECTIVE 2: Customer / Stakeholder
        jsonb_build_object(
            'id',          'perspective-customer-stakeholder',
            'perspective', 'Customer / Stakeholder',
            'weight',      9,
            'objectives',  jsonb_build_array(
                jsonb_build_object(
                    'id',          'obj-hrh-capacity-building',
                    'objective',   'Human Resources for Health Capacity Building',
                    'description', 'Deliver a high-quality training program for health care professionals through logistics coordination',
                    'kpis',        jsonb_build_array(
                        jsonb_build_object(
                            'id',          'kpi-travel-logistics',
                            'kpi',         'Percentage of travel arrangements (flights, accommodation, transport, visas, per diem) completed before the scheduled travel date',
                            'description', 'Coordinate travel logistics for health professionals undertaking short-term training',
                            'target',      '80%',
                            'weight',      5,
                            'unit',        '%'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-fcs-exit-exams',
                            'kpi',         'Percentage of logistics executed without delays for scholarship candidates attending final FCS exit exams',
                            'description', 'Implement logistics for scholarship candidates to attend the final FCS exit exams',
                            'target',      '80%',
                            'weight',      4,
                            'unit',        '%'
                        )
                    )
                )
            )
        ),

        -- PERSPECTIVE 3: Internal Business Processes
        jsonb_build_object(
            'id',          'perspective-internal-business',
            'perspective', 'Internal Business Processes',
            'weight',      25,
            'objectives',  jsonb_build_array(
                jsonb_build_object(
                    'id',          'obj-examiner-logistics',
                    'objective',   'Examination and Workshop Logistics Coordination',
                    'description', 'Coordinate logistics for examinations, workshops and learning site development',
                    'kpis',        jsonb_build_array(
                        jsonb_build_object(
                            'id',          'kpi-next-gen-examiners',
                            'kpi',         'Successful organisation and logistical support of the Next Generation of Examiners workshops according to approved schedules and budgets',
                            'description', 'Coordinate the logistics for the Next Generation of Examiners workshop',
                            'target',      '80%',
                            'weight',      4,
                            'unit',        '%'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-court-of-examiners',
                            'kpi',         'Successful organisation and logistical support of the COSECSA Court of Examiners and panel heads to attend Surgical Exit Examinations and Clinical/Viva',
                            'description', 'Facilitate the logistics for the COSECSA Court of Examiners and Panel Heads to attend Examinations',
                            'target',      '80%',
                            'weight',      4,
                            'unit',        '%'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-tot-workshops',
                            'kpi',         'Percentage of TOT workshops successfully coordinated and delivered as planned',
                            'description', 'Coordinate logistics for Training of Trainers (TOTs) for Educators to improve trainers teaching skills in Surgical Education',
                            'target',      '80%',
                            'weight',      5,
                            'unit',        '%'
                        )
                    )
                ),
                jsonb_build_object(
                    'id',          'obj-data-management',
                    'objective',   'COSECSA Data Management and Reporting',
                    'description', 'Develop and maintain COSECSA data management systems and create data visualization reports showcasing the College regional impact',
                    'kpis',        jsonb_build_array(
                        jsonb_build_object(
                            'id',          'kpi-monthly-staff-reports',
                            'kpi',         'Number of monthly reports consolidated and submitted to the CEO',
                            'description', 'Consolidate the monthly staff reports and submit to the CEO',
                            'target',      '10',
                            'weight',      5,
                            'unit',        'reports'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-country-coordinator-reports',
                            'kpi',         'Number of monthly progress reports evaluated and submitted to the CEO',
                            'description', 'Evaluation of Country Coordinators monthly progress reports',
                            'target',      '40',
                            'weight',      5,
                            'unit',        'reports'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-partner-contact-database',
                            'kpi',         'Maintenance of an organised and easily retrievable partner contact database',
                            'description', 'Maintain the COSECSA records including the contact list of partners',
                            'target',      'Yes',
                            'weight',      3,
                            'unit',        'Yes/No'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-country-coordinator-contracts',
                            'kpi',         'Number of Country Coordinators annual contracts prepared and shared with Country Coordinators',
                            'description', 'Support the CEO in the development of Country Coordinators annual contracts',
                            'target',      '10',
                            'weight',      3,
                            'unit',        'contracts'
                        )
                    )
                )
            )
        ),

        -- PERSPECTIVE 4: Innovation, Learning & Growth
        jsonb_build_object(
            'id',          'perspective-learning-growth',
            'perspective', 'Innovation, Learning & Growth',
            'weight',      28,
            'objectives',  jsonb_build_array(
                jsonb_build_object(
                    'id',          'obj-communication-management',
                    'objective',   'Knowledge & Data – Communication Management Support',
                    'description', 'Manage internal and external communications including newsletters, promotional materials, correspondence and office administration',
                    'kpis',        jsonb_build_array(
                        jsonb_build_object(
                            'id',          'kpi-promotional-materials',
                            'kpi',         'Number of promotional materials printed and distributed',
                            'description', 'Print and distribute promotional materials',
                            'target',      '4',
                            'weight',      3,
                            'unit',        'materials'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-newsletters',
                            'kpi',         'Number of newsletters published',
                            'description', 'Publish COSECSA newsletters',
                            'target',      '4',
                            'weight',      4,
                            'unit',        'newsletters'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-meeting-minutes',
                            'kpi',         'Number of staff meeting minutes disseminated',
                            'description', 'Dissemination of staff meeting minutes',
                            'target',      '5',
                            'weight',      2,
                            'unit',        'minutes'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-inquiry-response',
                            'kpi',         'Percentage of inquiries responded to',
                            'description', 'Respond to inquiries in a timely and professional manner',
                            'target',      '80%',
                            'weight',      3,
                            'unit',        '%'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-official-correspondence',
                            'kpi',         'Percentage of official correspondence prepared in a timely manner',
                            'description', 'Timely preparation of official correspondence',
                            'target',      '80%',
                            'weight',      3,
                            'unit',        '%'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-staff-meetings',
                            'kpi',         'Percentage of staff meetings successfully scheduled and coordinated in a timely manner',
                            'description', 'Successful scheduling and coordination of staff meetings',
                            'target',      '80%',
                            'weight',      3,
                            'unit',        '%'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-official-memos',
                            'kpi',         'Percentage of official memos filed in a timely manner',
                            'description', 'Timely filing of official memos',
                            'target',      '80%',
                            'weight',      2,
                            'unit',        '%'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-office-supplies',
                            'kpi',         'Percentage availability of essential office stock and supplies',
                            'description', 'Ensure availability of essential office stock and supplies',
                            'target',      '80%',
                            'weight',      3,
                            'unit',        '%'
                        )
                    )
                ),
                jsonb_build_object(
                    'id',          'obj-governance-skills',
                    'objective',   'Governance & Skills',
                    'description', 'Coordinate College governance events and advocate for global surgery policy at regional and international levels',
                    'kpis',        jsonb_build_array(
                        jsonb_build_object(
                            'id',          'kpi-college-events',
                            'kpi',         'Percentage of delegates supported with travel and logistical arrangements on time for Council Meetings, AGM, Examinations, and Graduation',
                            'description', 'Coordination of College events including Council Meetings, AGM, Examinations, and Graduation',
                            'target',      '85%',
                            'weight',      5,
                            'unit',        '%'
                        ),
                        jsonb_build_object(
                            'id',          'kpi-global-surgery-policy',
                            'kpi',         'Percentage of official meetings/events successfully coordinated for COSECSA leadership and staff to participate in global surgery policy advocacy',
                            'description', 'Coordinate logistics for COSECSA Leadership and staff to participate and advocate for global surgery policy at regional and international levels',
                            'target',      '80%',
                            'weight',      5,
                            'unit',        '%'
                        )
                    )
                )
            )
        )

    );

    -- -------------------------------------------------------
    -- 4. Build general_competencies JSONB (20% weight)
    --    Eight competencies from Part 2 of the contract
    -- -------------------------------------------------------
    v_competencies := jsonb_build_array(
        jsonb_build_object(
            'id',          'comp-teamwork',
            'name',        'Teamwork',
            'description', 'Works collaboratively with staff, Country Coordinators, and stakeholders to achieve institutional goals',
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
            'description', 'Demonstrates accountability, confidentiality, and ethical conduct in all assignments',
            'weight',      5
        ),
        jsonb_build_object(
            'id',          'comp-communication',
            'name',        'Communication',
            'description', 'Communicates effectively through reports and correspondence, and partner engagement',
            'weight',      5
        ),
        jsonb_build_object(
            'id',          'comp-results',
            'name',        'Results Oriented',
            'description', 'Prioritises assignments effectively and ensures the timely delivery of outputs',
            'weight',      5
        ),
        jsonb_build_object(
            'id',          'comp-innovation',
            'name',        'Innovation',
            'description', 'Suggests practical improvements to administrative systems and office operations',
            'weight',      5
        ),
        jsonb_build_object(
            'id',          'comp-customer-care',
            'name',        'Customer Care',
            'description', 'Responds professionally and promptly to inquiries from trainees, fellows, partners, and stakeholders',
            'weight',      5
        ),
        jsonb_build_object(
            'id',          'comp-leadership',
            'name',        'Leadership',
            'description', 'Demonstrates strong organisational and coordination skills for meetings, travel, and events',
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

        RAISE NOTICE 'Updated existing workplan % for Diana Kaiza', v_workplan_id;
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

        RAISE NOTICE 'Inserted new workplan % for Diana Kaiza', v_workplan_id;
    END IF;

    RAISE NOTICE 'Workplan insertion complete. staff_id=%, supervisor_id=%, workplan_id=%',
        v_staff_id, v_supervisor_id, v_workplan_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Workplan insertion failed: %', SQLERRM;
        RAISE;
END $$;
