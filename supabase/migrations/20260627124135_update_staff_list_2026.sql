-- Migration: Update Staff List 2026 (Revised CHRIS)
-- Adds email column to staff table and upserts all 54 staff records
-- with correct designations, emails, and supervisor relationships

-- 1. Add email column to staff table if it does not exist
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Upsert all 54 staff records
-- Strategy: Delete all existing staff and re-insert with correct data
-- (safe because no mid_year_reviews or workplan_settings exist yet)
DO $$
DECLARE
    -- Department UUIDs
    dept_exec       UUID;
    dept_programmes UUID;
    dept_finance    UUID;
    dept_operations UUID;
    dept_cosecsa    UUID;
    dept_ecsaconm   UUID;
    dept_canecsa    UUID;
    dept_ecsacog    UUID;
    dept_thanzi     UUID;
    dept_mpa        UUID;

    -- ── Leadership ──────────────────────────────────────────────────────────
    s_kapologwe   UUID := gen_random_uuid();  -- 44 Director General
    s_mungati     UUID := gen_random_uuid();  -- 41 Director of Programmes
    s_njuba       UUID := gen_random_uuid();  -- 33 Director of Finance
    s_mwandumbya  UUID := gen_random_uuid();  -- 45 Communication Specialist
    s_sibandze    UUID := gen_random_uuid();  -- 47 Director of Operations

    -- ── COSECSA ─────────────────────────────────────────────────────────────
    s_itungu      UUID := gen_random_uuid();  -- 9  CEO COSECSA
    s_uiso        UUID := gen_random_uuid();  -- 1  Examination Officer
    s_kaiza       UUID := gen_random_uuid();  -- 2  Administrative Officer
    s_kondamwali  UUID := gen_random_uuid();  -- 3  Admission Assistant
    s_foya        UUID := gen_random_uuid();  -- 4  Records & Admissions Asst
    s_sama        UUID := gen_random_uuid();  -- 5  Research & OPD Coordinator
    s_omongole    UUID := gen_random_uuid();  -- 6  Finance Officer COSECSA
    s_kisanga     UUID := gen_random_uuid();  -- 7  Assistant IT COSECSA
    s_bachheta    UUID := gen_random_uuid();  -- 8  Education Officer COSECSA

    -- ── ECSACOG ─────────────────────────────────────────────────────────────
    s_mroso       UUID := gen_random_uuid();  -- 26 Senior Programme Officer ECSACOG
    s_mrina       UUID := gen_random_uuid();  -- 22 Finance & Admin Officer ECSACOG
    s_kanyonyi    UUID := gen_random_uuid();  -- 10 Asst IT Officer ECSACOG

    -- ── ECSACONM ────────────────────────────────────────────────────────────
    s_mabuga      UUID := gen_random_uuid();  -- 31 Senior Programme Officer ECSACONM
    s_tingai      UUID := gen_random_uuid();  -- 29 IT Officer ECSACONM

    -- ── CANECSA ─────────────────────────────────────────────────────────────
    s_masuka      UUID := gen_random_uuid();  -- 50 Senior Admin Officer CANECSA
    s_martin      UUID := gen_random_uuid();  -- 28 Asst IT & Finance Officer

    -- ── Finance Directorate ─────────────────────────────────────────────────
    s_mapunda     UUID := gen_random_uuid();  -- 16 Senior Accountant
    s_njenga      UUID := gen_random_uuid();  -- 17 Finance Officer
    s_chibuna     UUID := gen_random_uuid();  -- 34 Financial Management Specialist
    s_golugwa     UUID := gen_random_uuid();  -- 35 Finance Officer GF Project
    s_matemba     UUID := gen_random_uuid();  -- 46 Assistant Finance Officer

    -- ── Operations & Institutional Development ──────────────────────────────
    s_minja       UUID := gen_random_uuid();  -- 15 Senior IT Officer
    s_bani        UUID := gen_random_uuid();  -- 23 Procurement Officer
    s_mhomi       UUID := gen_random_uuid();  -- 39 Senior Admin & HR Officer

    -- ── Admin & Support (under Mhomi) ───────────────────────────────────────
    s_kilawe      UUID := gen_random_uuid();  -- 24 Records & Archive Clerk
    s_zarifu      UUID := gen_random_uuid();  -- 25 Driver
    s_mhanusi     UUID := gen_random_uuid();  -- 36 Administrative Assistant
    s_wisiko      UUID := gen_random_uuid();  -- 37 Receptionist / Store Keeper
    s_mmari       UUID := gen_random_uuid();  -- 38 Driver
    s_lema        UUID := gen_random_uuid();  -- 43 Administrative Assistant

    -- ── Programmes Directorate ──────────────────────────────────────────────
    s_silumesii   UUID := gen_random_uuid();  -- 12 Manager Family Health & ID
    s_kataika     UUID := gen_random_uuid();  -- 18 Principal Investigator Thanzi
    s_masiye      UUID := gen_random_uuid();  -- 27 Manager NCD Food Security
    s_mmohamed    UUID := gen_random_uuid();  -- 40 Project Coordinator MPA
    s_myeni       UUID := gen_random_uuid();  -- 51 Manager KM M&E
    s_chisenga    UUID := gen_random_uuid();  -- 52 Manager Health Systems
    s_nalomba     UUID := gen_random_uuid();  -- 32 Project Officer COVID-19
    s_letawo      UUID := gen_random_uuid();  -- 53 Programme Officer KM M&E
    s_marandu     UUID := gen_random_uuid();  -- 11 Senior Programme Officer NCD
    s_urasa       UUID := gen_random_uuid();  -- 42 Senior Programme Officer FHID

    -- ── MPA Project Team ────────────────────────────────────────────────────
    s_azam        UUID := gen_random_uuid();  -- 30 Senior Lab Specialist MPA
    s_atimothy    UUID := gen_random_uuid();  -- 13 System Developer MPA
    s_bmushi      UUID := gen_random_uuid();  -- 14 Senior M&E Specialist
    s_meleke      UUID := gen_random_uuid();  -- 19 Gender Equity & HR Specialist
    s_wesangula   UUID := gen_random_uuid();  -- 21 AMR Control Specialist MPA
    s_biduda      UUID := gen_random_uuid();  -- 48 Procurement Specialist MPA
    s_buguzi      UUID := gen_random_uuid();  -- 49 Project Administrator
    s_feyisa      UUID := gen_random_uuid();  -- 54 Emergency Preparedness Specialist

    -- ── Thanzi La Onse Project ───────────────────────────────────────────────
    s_mnjowe      UUID := gen_random_uuid();  -- 20 Software Developer Thanzi

BEGIN
    -- ── Resolve / create departments ────────────────────────────────────────
    INSERT INTO public.departments (name) VALUES
        ('Executive Office'),
        ('Programmes'),
        ('Finance'),
        ('Operations and Institutional Development'),
        ('COSECSA'),
        ('ECSACONM'),
        ('CANECSA'),
        ('ECSACOG'),
        ('Thanzi La Onse Project'),
        ('MPA Project')
    ON CONFLICT (name) DO NOTHING;

    SELECT id INTO dept_exec       FROM public.departments WHERE name = 'Executive Office'                          LIMIT 1;
    SELECT id INTO dept_programmes FROM public.departments WHERE name = 'Programmes'                                LIMIT 1;
    SELECT id INTO dept_finance    FROM public.departments WHERE name = 'Finance'                                   LIMIT 1;
    SELECT id INTO dept_operations FROM public.departments WHERE name = 'Operations and Institutional Development'  LIMIT 1;
    SELECT id INTO dept_cosecsa    FROM public.departments WHERE name = 'COSECSA'                                   LIMIT 1;
    SELECT id INTO dept_ecsaconm   FROM public.departments WHERE name = 'ECSACONM'                                  LIMIT 1;
    SELECT id INTO dept_canecsa    FROM public.departments WHERE name = 'CANECSA'                                   LIMIT 1;
    SELECT id INTO dept_ecsacog    FROM public.departments WHERE name = 'ECSACOG'                                   LIMIT 1;
    SELECT id INTO dept_thanzi     FROM public.departments WHERE name = 'Thanzi La Onse Project'                    LIMIT 1;
    SELECT id INTO dept_mpa        FROM public.departments WHERE name = 'MPA Project'                               LIMIT 1;

    -- ── Delete existing staff (cascade-safe: no reviews/workplans yet) ──────
    -- Remove supervisor_id FK references first to avoid self-ref constraint issues
    UPDATE public.staff SET supervisor_id = NULL;
    DELETE FROM public.staff;

    -- ── PASS 1: Insert all staff WITHOUT supervisor_id ───────────────────────
    -- Leadership
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, email, employment_status, system_role)
    VALUES
        (s_kapologwe,  44, 'NTULI A. KAPOLOGWE',           'DIRECTOR GENERAL',                                                    dept_exec,       'CHAIR OF HMC',                                                    'ntuli.kapologwe@ecsahc.org', 'active', 'executive_director'),
        (s_mungati,    41, 'MORE MUNGATI',                  'DIRECTOR OF PROGRAMMES',                                              dept_programmes, 'DIRECTOR GENERAL',                                                'mmungati@ecsahc.org',        'active', 'deputy_director'),
        (s_njuba,      33, 'LILLIANE BRENDA NAMUTEBI NJUBA','DIRECTOR OF FINANCE',                                                 dept_finance,    'DIRECTOR GENERAL',                                                'lnjuba@ecsahc.org',          'active', 'finance_manager'),
        (s_mwandumbya, 45, 'OWEN DAVID MWANDUMBYA',         'COMMUNICATION SPECIALIST',                                            dept_exec,       'DIRECTOR GENERAL',                                                'omwandumbya@ecsahc.org',     'active', 'programme_officer'),
        (s_sibandze,   47, 'SIBUSISO BAFANA SIBANDZE',      'DIRECTOR OF OPERATIONS AND INSTITUTIONAL DEVELOPMENT',                dept_operations, 'DIRECTOR GENERAL',                                                's_sibandze@ecsahc.org',      'active', 'deputy_director');

    -- COSECSA
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, email, employment_status, system_role)
    VALUES
        (s_itungu,     9,  'STELLA ITUNGU',                 'CHIEF EXECUTIVE OFFICER – COSECSA',                                   dept_cosecsa,    'PRESIDENT OF THE COLLEGE',                                        'situngu@cosecsa.org',        'active', 'programme_manager'),
        (s_uiso,       1,  'AMANI PASKAL UISO',             'EXAMINATION OFFICER – COSECSA',                                       dept_cosecsa,    'CHIEF EXECUTIVE OFFICER – COSECSA',                               'apascal@cosecsa.org',        'active', 'programme_officer'),
        (s_kaiza,      2,  'DIANA GERAS KAIZA',             'ADMINISTRATIVE OFFICER – COSECSA',                                    dept_cosecsa,    'CHIEF EXECUTIVE OFFICER – COSECSA',                               'dianaK@cosecsa.org',         'active', 'admin_officer'),
        (s_kondamwali, 3,  'DAVIS HYACINTH KONDAMWALI',     'ADMISSION ASSISTANT – COSECSA',                                       dept_cosecsa,    'CHIEF EXECUTIVE OFFICER – COSECSA',                               'Davish@cosecsa.org',         'active', 'admin_officer'),
        (s_foya,       4,  'EDNA HERMAN FOYA',              'RECORDS AND ADMISSIONS ASSISTANT – COSECSA',                          dept_cosecsa,    'CHIEF EXECUTIVE OFFICER – COSECSA',                               'efoya@cosecsa.org',          'active', 'admin_officer'),
        (s_sama,       5,  'GODFREY PHILIPO SAMA',          'RESEARCH AND OUT PATIENT COORDINATOR – COSECSA',                      dept_cosecsa,    'CHIEF EXECUTIVE OFFICER – COSECSA',                               'gsama@cosecsa.org',          'active', 'project_coordinator'),
        (s_kisanga,    7,  'LAURENCE PAUL KISANGA',         'ASSISTANT IT – COSECSA',                                              dept_cosecsa,    'CHIEF EXECUTIVE OFFICER – COSECSA',                               'lkisanga@cosecsa.org',       'active', 'admin_officer'),
        (s_bachheta,   8,  'NIRAJ SURESH BACHHETA',         'EDUCATION OFFICER – COSECSA',                                         dept_cosecsa,    'CHIEF EXECUTIVE OFFICER – COSECSA',                               'nbachheta@cosecsa.org',      'active', 'programme_officer');

    -- Finance Directorate
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, email, employment_status, system_role)
    VALUES
        (s_omongole,   6,  'JONATHAN OMONGOLE',             'FINANCE OFFICER – COSECSA',                                           dept_finance,    'DIRECTOR OF FINANCE',                                             'jomongole@cosecsa.org',      'active', 'finance_officer'),
        (s_mapunda,    16, 'CAVIN CHARLES MAPUNDA',         'SENIOR ACCOUNTANT',                                                   dept_finance,    'DIRECTOR OF FINANCE',                                             'cmapunda@ecsahc.org',        'active', 'finance_officer'),
        (s_njenga,     17, 'DARCY ELLISON NJENGA',          'FINANCE OFFICER',                                                     dept_finance,    'DIRECTOR OF FINANCE',                                             'dnjenga@ecsahc.org',         'active', 'finance_officer'),
        (s_chibuna,    34, 'CHIBUNA MUTETO',                'FINANCIAL MANAGEMENT SPECIALIST',                                     dept_finance,    'DIRECTOR OF FINANCE',                                             'mchibuna@ecsahc.org',        'active', 'finance_officer'),
        (s_golugwa,    35, 'MARIAM SAM GOLUGWA',            'FINANCE OFFICER – GLOBAL FUND PROJECT',                               dept_finance,    'DIRECTOR OF FINANCE',                                             'mgolugwa@ecsahc.org',        'active', 'finance_officer'),
        (s_matemba,    46, 'PRISCA PAUL MATEMBA',           'ASSISTANT FINANCE OFFICER',                                           dept_finance,    'DIRECTOR OF FINANCE',                                             'pmatemba@ecsahc.org',        'active', 'finance_officer');

    -- Operations & Institutional Development
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, email, employment_status, system_role)
    VALUES
        (s_minja,      15, 'CHRISTOPHER AUGUST MINJA',      'SENIOR INFORMATION TECHNOLOGY OFFICER',                               dept_operations, 'DIRECTOR OF OPERATIONS AND INSTITUTIONAL DEVELOPMENT',            'chris@ecsahc.org',           'active', 'admin_officer'),
        (s_bani,       23, 'HAMIS ATHUMAN BANI',            'PROCUREMENT OFFICER',                                                 dept_operations, 'DIRECTOR OF OPERATIONS AND INSTITUTIONAL DEVELOPMENT',            'hbani@ecsahc.org',           'active', 'admin_officer'),
        (s_mhomi,      39, 'MARY CHARLES MHOMI',            'SENIOR ADMINISTRATION AND HUMAN RESOURCE OFFICER',                    dept_operations, 'DIRECTOR OF OPERATIONS AND INSTITUTIONAL DEVELOPMENT',            'mmhomi@ecsahc.org',          'active', 'hr_admin_officer');

    -- Admin & Support (under Mhomi)
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, email, employment_status, system_role)
    VALUES
        (s_kilawe,     24, 'HELENA NICETAS KILAWE',         'RECORDS AND ARCHIVE CLERK',                                           dept_operations, 'SENIOR ADMINISTRATION AND HUMAN RESOURCE OFFICER',                'helenak@ecsahc.org',         'active', 'admin_officer'),
        (s_zarifu,     25, 'JACKSON SALEHE ZARIFU',         'DRIVER',                                                              dept_operations, 'SENIOR ADMINISTRATION AND HUMAN RESOURCE OFFICER',                'jackson@ecsahc.org',         'active', 'admin_officer'),
        (s_mhanusi,    36, 'CHRISTINA SAMWEL MHANUSI',      'ADMINISTRATIVE ASSISTANT',                                            dept_operations, 'SENIOR ADMINISTRATION AND HUMAN RESOURCE OFFICER',                'mhanusi@ecsahc.org',         'active', 'admin_officer'),
        (s_wisiko,     37, 'MWAMVUA HERRA WISIKO',          'RECEPTIONIST / STORE KEEPER',                                         dept_operations, 'SENIOR ADMINISTRATION AND HUMAN RESOURCE OFFICER',                'mherra@ecsahc.org',          'active', 'admin_officer'),
        (s_mmari,      38, 'VALENTINO JOACHIM MMARI',       'DRIVER',                                                              dept_operations, 'SENIOR ADMINISTRATION AND HUMAN RESOURCE OFFICER',                'mmari@ecsahc.org',           'active', 'admin_officer'),
        (s_lema,       43, 'NEEMA SIA LEMA',                'ADMINISTRATIVE ASSISTANT',                                            dept_operations, 'SENIOR ADMINISTRATION AND HUMAN RESOURCE OFFICER',                'nlema@ecsahc.org',           'active', 'admin_officer');

    -- Programmes Directorate – Managers
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, email, employment_status, system_role)
    VALUES
        (s_silumesii,  12, 'ANDREW NKHULO SILUMESII',       'MANAGER – FAMILY HEALTH AND INFECTIOUS DISEASES',                     dept_programmes, 'DIRECTOR OF PROGRAMMES',                                          'asilumesii@ecsahc.org',      'active', 'programme_manager'),
        (s_kataika,    18, 'EDWARD THOMAS KATAIKA',         'PRINCIPAL INVESTIGATOR – THANZI PROJECT',                             dept_thanzi,     'DIRECTOR OF PROGRAMMES',                                          'ekataika@ecsahc.org',        'active', 'programme_manager'),
        (s_masiye,     27, 'JONES KAPONDA MASIYE',          'MANAGER – NON COMMUNICABLE FOOD SECURITY AND NUTRITION',              dept_programmes, 'DIRECTOR OF PROGRAMMES',                                          'jkmasiye@ecsahc.org',        'active', 'programme_manager'),
        (s_mmohamed,   40, 'MOHAMED ALLY MOHAMED',          'PROJECT COORDINATOR – MPA PROJECT',                                   dept_mpa,        'DIRECTOR OF PROGRAMMES',                                          'mmohamed@ecsahc.org',        'active', 'project_coordinator'),
        (s_myeni,      51, 'SEBENTILE MYENI',               'MANAGER – KNOWLEDGE MANAGEMENT MONITORING AND EVALUATION',            dept_programmes, 'DIRECTOR OF PROGRAMMES',                                          'smyeni@ecsahc.org',          'active', 'programme_manager'),
        (s_chisenga,   52, 'TINA CHISENGA',                 'MANAGER – HEALTH SYSTEM AND CAPACITY DEVELOPMENT',                    dept_programmes, 'DIRECTOR OF PROGRAMMES',                                          'tchisenga@ecsahc.org',       'active', 'programme_manager');

    -- Programmes Directorate – Officers
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, email, employment_status, system_role)
    VALUES
        (s_nalomba,    32, 'LUTINALA NACHIEMBO NALOMBA',    'PROJECT OFFICER – COVID-19 PROJECT',                                  dept_programmes, 'MANAGER, FAMILY HEALTH AND INFECTIOUS DISEASES',                  'lnalomba@ecsahc.org',        'active', 'programme_officer'),
        (s_letawo,     53, 'UPENDO BARNABAS LETAWO',        'PROGRAMME OFFICER – KNOWLEDGE MANAGEMENT MONITORING AND EVALUATION',  dept_programmes, 'MANAGER, KNOWLEDGE MANAGEMENT MONITORING AND EVALUATION',         'uletawo@ecsahc.org',         'active', 'programme_officer'),
        (s_marandu,    11, 'DOREEN MARANDU',                'SENIOR PROGRAMME OFFICER – NON COMMUNICABLE FOOD SECURITY AND NUTRITION', dept_programmes, 'MANAGER, NON COMMUNICABLE FOOD SECURITY AND NUTRITION',      'dmarandu@ecsahc.org',        'active', 'programme_officer'),
        (s_urasa,      42, 'MIRIAM JAPHET URASA',           'SENIOR PROGRAMME OFFICER – FAMILY HEALTH AND INFECTIOUS DISEASES',    dept_programmes, 'MANAGER, FAMILY HEALTH AND INFECTIOUS DISEASES',                  'murasa@ecsahc.org',          'active', 'programme_officer');

    -- MPA Project Team
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, email, employment_status, system_role)
    VALUES
        (s_azam,       30, 'KHALID ESMAIL ISSUFO AZAM',     'SENIOR LABORATORY SPECIALIST – MPA PROJECT',                          dept_mpa,        'PROJECT COORDINATOR – MPA PROJECT',                               'kie.azam@ecsahc.org',        'active', 'programme_officer'),
        (s_atimothy,   13, 'TIMOTHY AYEBARE',               'SYSTEM DEVELOPER – MPA PROJECT',                                      dept_mpa,        'PROJECT COORDINATOR – MPA PROJECT',                               'atimothy@ecsahc.org',        'active', 'programme_officer'),
        (s_bmushi,     14, 'BENEDICT PIUS MUSHI',           'SENIOR MONITORING AND EVALUATION SPECIALIST',                         dept_mpa,        'PROJECT COORDINATOR – MPA PROJECT',                               'bmushi@ecsahc.org',          'active', 'programme_officer'),
        (s_meleke,     19, 'EVENESS LYDIA ZUZE MELEKE',     'GENDER, EQUITY AND HUMAN RIGHTS SPECIALIST',                          dept_mpa,        'PROJECT COORDINATOR – MPA PROJECT',                               'emeleke@ecsahc.org',         'active', 'programme_officer'),
        (s_wesangula,  21, 'EVELYN NELIMA WESANGULA',       'AMR CONTROL SPECIALIST – MPA PROJECT',                               dept_mpa,        'PROJECT COORDINATOR – MPA PROJECT',                               'ewesangula@ecsahc.org',      'active', 'programme_officer'),
        (s_biduda,     48, 'STEPHEN FADSON BIDUDA',         'PROCUREMENT SPECIALIST – MPA PROJECT',                                dept_mpa,        'PROJECT COORDINATOR – MPA PROJECT',                               'sbiduda@ecsahc.org',         'active', 'programme_officer'),
        (s_buguzi,     49, 'SYRIACUS BUGUZI',               'PROJECT ADMINISTRATOR',                                               dept_mpa,        'PROJECT COORDINATOR – MPA PROJECT',                               'sbuguzi@ecsahc.org',         'active', 'admin_officer'),
        (s_feyisa,     54, 'YOHANNES DUGASA FEYISA',        'EMERGENCY PREPAREDNESS AND RESPONSE SPECIALIST',                      dept_mpa,        'PROJECT COORDINATOR – MPA PROJECT',                               'yohannesd@ecsahc.org',       'active', 'programme_officer');

    -- Thanzi La Onse Project
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, email, employment_status, system_role)
    VALUES
        (s_mnjowe,     20, 'EMMANUEL MNJOWE',               'SOFTWARE DEVELOPER – THANZI LA ONSE PROJECT',                         dept_thanzi,     'PRINCIPAL INVESTIGATOR – THANZI PROJECT',                         'emnjowe@ecsahc.org',         'active', 'programme_officer');

    -- ECSACOG
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, email, employment_status, system_role)
    VALUES
        (s_mroso,      26, 'JUDITH ANDREW MROSO',           'SENIOR PROGRAMME OFFICER – ECSACOG',                                  dept_ecsacog,    'PRESIDENT OF THE COLLEGE',                                        'judith@ecsacog.org',         'active', 'programme_officer'),
        (s_mrina,      22, 'GASPER GOODCHANCE MRINA',       'FINANCE AND ADMINISTRATION OFFICER – ECSACOG',                        dept_ecsacog,    'SENIOR PROGRAMME OFFICER – ECSACOG',                              'gmrina@ecsacog.org',         'active', 'finance_officer'),
        (s_kanyonyi,   10, 'ADAM SIMON KANYONYI',           'ASSISTANT INFORMATION TECHNOLOGY OFFICER – ECSACOG',                  dept_ecsacog,    'SENIOR PROGRAMME OFFICER – ECSACOG',                              'adam@ecsahc.org',            'active', 'admin_officer');

    -- ECSACONM
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, email, employment_status, system_role)
    VALUES
        (s_mabuga,     31, 'LEMMY MEDARD MABUGA',           'SENIOR PROGRAMME OFFICER – ECSACONM',                                 dept_ecsaconm,   'PRESIDENT OF THE COLLEGE',                                        'lemmym@ecsahc.org',          'active', 'programme_officer'),
        (s_tingai,     29, 'JULIUS TINGAI',                 'INFORMATION TECHNOLOGY OFFICER – ECSACONM',                           dept_ecsaconm,   'SENIOR PROGRAMME OFFICER – ECSACONM',                             'jtingai@ecsahc.org',         'active', 'admin_officer');

    -- CANECSA
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, email, employment_status, system_role)
    VALUES
        (s_masuka,     50, 'SOPHIA COSTANTINE MASUKA',      'SENIOR ADMINISTRATION OFFICER – CANECSA',                             dept_canecsa,    'PRESIDENT OF THE COLLEGE',                                        'smasuka@ecsahc.org',         'active', 'admin_officer'),
        (s_martin,     28, 'JAMES ALOYCE MARTIN',           'ASSISTANT IT AND FINANCE OFFICER',                                    dept_canecsa,    'SENIOR ADMINISTRATION OFFICER – CANECSA',                         'jmartin@ecsahc.org',         'active', 'admin_officer');

    -- ── PASS 2: Set supervisor_id FK references ──────────────────────────────

    -- Leadership: report to Director General
    UPDATE public.staff SET supervisor_id = s_kapologwe
    WHERE id IN (s_mungati, s_njuba, s_mwandumbya, s_sibandze);

    -- COSECSA: all report to CEO COSECSA (Stella Itungu)
    UPDATE public.staff SET supervisor_id = s_itungu
    WHERE id IN (s_uiso, s_kaiza, s_kondamwali, s_foya, s_sama, s_kisanga, s_bachheta);

    -- Finance Officer COSECSA reports to Director of Finance
    UPDATE public.staff SET supervisor_id = s_njuba
    WHERE id IN (s_omongole, s_mapunda, s_njenga, s_chibuna, s_golugwa, s_matemba);

    -- Operations: Minja, Bani, Mhomi report to Sibandze
    UPDATE public.staff SET supervisor_id = s_sibandze
    WHERE id IN (s_minja, s_bani, s_mhomi);

    -- Admin & Support: report to Mhomi
    UPDATE public.staff SET supervisor_id = s_mhomi
    WHERE id IN (s_kilawe, s_zarifu, s_mhanusi, s_wisiko, s_mmari, s_lema);

    -- Programmes Managers: report to Director of Programmes
    UPDATE public.staff SET supervisor_id = s_mungati
    WHERE id IN (s_silumesii, s_kataika, s_masiye, s_mmohamed, s_myeni, s_chisenga);

    -- Programmes Officers
    UPDATE public.staff SET supervisor_id = s_silumesii WHERE id IN (s_nalomba, s_urasa);
    UPDATE public.staff SET supervisor_id = s_myeni     WHERE id = s_letawo;
    UPDATE public.staff SET supervisor_id = s_masiye    WHERE id = s_marandu;

    -- MPA Project Team: report to Mohamed (Project Coordinator MPA)
    UPDATE public.staff SET supervisor_id = s_mmohamed
    WHERE id IN (s_azam, s_atimothy, s_bmushi, s_meleke, s_wesangula, s_biduda, s_buguzi, s_feyisa);

    -- Thanzi La Onse: Mnjowe reports to Kataika
    UPDATE public.staff SET supervisor_id = s_kataika WHERE id = s_mnjowe;

    -- ECSACOG: Mrina and Kanyonyi report to Mroso
    UPDATE public.staff SET supervisor_id = s_mroso WHERE id IN (s_mrina, s_kanyonyi);

    -- ECSACONM: Tingai reports to Mabuga
    UPDATE public.staff SET supervisor_id = s_mabuga WHERE id = s_tingai;

    -- CANECSA: Martin reports to Masuka
    UPDATE public.staff SET supervisor_id = s_masuka WHERE id = s_martin;

    RAISE NOTICE 'Staff list 2026 updated successfully. Total staff: %', (SELECT COUNT(*) FROM public.staff);

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Staff update failed: %', SQLERRM;
        RAISE;
END $$;
