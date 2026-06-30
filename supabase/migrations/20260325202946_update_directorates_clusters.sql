-- Migration: Update Departments to Directorates/Clusters
-- Replaces old department names with the 9 official directorates/clusters
-- and reassigns all staff to their correct directorate/cluster

DO $$
DECLARE
    -- New directorate/cluster UUIDs
    dir_dg        UUID;
    dir_ops       UUID;
    dir_prog      UUID;
    dir_finance   UUID;
    dir_mpa       UUID;
    dir_cosecsa   UUID;
    dir_ecsaconm  UUID;
    dir_canecsa   UUID;
    dir_ecsacog   UUID;

BEGIN
    -- ─── 1. Upsert the 9 directorates/clusters ────────────────────────────────

    -- Director General's Office
    INSERT INTO public.departments (name, description)
    VALUES ('Director General''s Office', 'Office of the Director General and Communications')
    ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO dir_dg;
    IF dir_dg IS NULL THEN
        SELECT id INTO dir_dg FROM public.departments WHERE name = 'Director General''s Office';
    END IF;

    -- Director of Operations and Institutional Development
    INSERT INTO public.departments (name, description)
    VALUES ('Operations & Institutional Development', 'Administration, HR, IT, Procurement and Logistics')
    ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO dir_ops;
    IF dir_ops IS NULL THEN
        SELECT id INTO dir_ops FROM public.departments WHERE name = 'Operations & Institutional Development';
    END IF;

    -- Director of Programmes
    INSERT INTO public.departments (name, description)
    VALUES ('Programmes', 'Family Health, NCD, Health Systems, Knowledge Management and Thanzi Project')
    ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO dir_prog;
    IF dir_prog IS NULL THEN
        SELECT id INTO dir_prog FROM public.departments WHERE name = 'Programmes';
    END IF;

    -- Director of Finance
    INSERT INTO public.departments (name, description)
    VALUES ('Finance', 'Financial Management, Accounting and Project Finance')
    ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO dir_finance;
    IF dir_finance IS NULL THEN
        SELECT id INTO dir_finance FROM public.departments WHERE name = 'Finance';
    END IF;

    -- MPA Project
    INSERT INTO public.departments (name, description)
    VALUES ('MPA Project', 'Multi-Partner AMR Control and Emergency Preparedness Project')
    ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO dir_mpa;
    IF dir_mpa IS NULL THEN
        SELECT id INTO dir_mpa FROM public.departments WHERE name = 'MPA Project';
    END IF;

    -- COSECSA
    INSERT INTO public.departments (name, description)
    VALUES ('COSECSA', 'College of Surgeons of East, Central and Southern Africa')
    ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO dir_cosecsa;
    IF dir_cosecsa IS NULL THEN
        SELECT id INTO dir_cosecsa FROM public.departments WHERE name = 'COSECSA';
    END IF;

    -- ECSACONM
    INSERT INTO public.departments (name, description)
    VALUES ('ECSACONM', 'East, Central and Southern Africa College of Nursing and Midwifery')
    ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO dir_ecsaconm;
    IF dir_ecsaconm IS NULL THEN
        SELECT id INTO dir_ecsaconm FROM public.departments WHERE name = 'ECSACONM';
    END IF;

    -- CANECSA
    INSERT INTO public.departments (name, description)
    VALUES ('CANECSA', 'College of Anesthesiologists of East, Central and Southern Africa')
    ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO dir_canecsa;
    IF dir_canecsa IS NULL THEN
        SELECT id INTO dir_canecsa FROM public.departments WHERE name = 'CANECSA';
    END IF;

    -- ECSACOG
    INSERT INTO public.departments (name, description)
    VALUES ('ECSACOG', 'East, Central and Southern Africa College of Obstetricians and Gynecologists')
    ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO dir_ecsacog;
    IF dir_ecsacog IS NULL THEN
        SELECT id INTO dir_ecsacog FROM public.departments WHERE name = 'ECSACOG';
    END IF;

    -- ─── 2. Remove old department names that are no longer used ──────────────
    -- Only delete departments that have no staff assigned (safe cleanup)
    DELETE FROM public.departments
    WHERE name IN ('Executive Office', 'Thanzi Project')
      AND NOT EXISTS (
          SELECT 1 FROM public.staff WHERE department_id = public.departments.id
      );

    -- ─── 3. Reassign all staff to correct directorates/clusters ──────────────

    -- DIRECTOR GENERAL'S OFFICE
    -- Ntuli A Kapologwe - Director General
    UPDATE public.staff SET department_id = dir_dg
    WHERE full_name ILIKE '%KAPOLOGWE%';

    -- Owen Mwandumbya - Communication Specialist
    UPDATE public.staff SET department_id = dir_dg
    WHERE full_name ILIKE '%MWANDUMBYA%';

    -- ─── OPERATIONS & INSTITUTIONAL DEVELOPMENT ──────────────────────────────
    -- Sibusiso Bafana Sibandze - Director of Operations
    UPDATE public.staff SET department_id = dir_ops
    WHERE full_name ILIKE '%SIBANDZE%';

    -- Mary Charles Mhomi - Senior Admin and HR Officer
    UPDATE public.staff SET department_id = dir_ops
    WHERE full_name ILIKE '%MHOMI%';

    -- Hamis Athumani Bani - Procurement Officer
    UPDATE public.staff SET department_id = dir_ops
    WHERE full_name ILIKE '%BANI%';

    -- Christopher August Minja - Senior IT Officer
    UPDATE public.staff SET department_id = dir_ops
    WHERE full_name ILIKE '%MINJA%';

    -- Christina Samwel Mhanusi - Administrative Assistant
    UPDATE public.staff SET department_id = dir_ops
    WHERE full_name ILIKE '%MHANUSI%';

    -- Neema Sia Lema - Administrative Assistant
    UPDATE public.staff SET department_id = dir_ops
    WHERE full_name ILIKE '%LEMA%';

    -- Mwamvua Herra - Receptionist/Store Keeper
    UPDATE public.staff SET department_id = dir_ops
    WHERE full_name ILIKE '%HERRA%';

    -- Helena Kilawe - Records and Archive Clerk
    UPDATE public.staff SET department_id = dir_ops
    WHERE full_name ILIKE '%KILAWE%';

    -- Valentino Mmari - Driver
    UPDATE public.staff SET department_id = dir_ops
    WHERE full_name ILIKE '%MMARI%';

    -- Jackson Salehe Zarifu - Driver
    UPDATE public.staff SET department_id = dir_ops
    WHERE full_name ILIKE '%ZARIFU%';

    -- ─── PROGRAMMES ──────────────────────────────────────────────────────────
    -- More Mungati - Director of Programmes
    UPDATE public.staff SET department_id = dir_prog
    WHERE full_name ILIKE '%MUNGATI%';

    -- Andrew Nkhulo Silumesii - Manager Family Health and Infectious Diseases
    UPDATE public.staff SET department_id = dir_prog
    WHERE full_name ILIKE '%SILUMESII%';

    -- Jones Kaponda Masiye - Manager NCD Food Security and Nutrition
    UPDATE public.staff SET department_id = dir_prog
    WHERE full_name ILIKE '%MASIYE%';

    -- Tina Chisenga - Manager Health System and Capacity Development
    UPDATE public.staff SET department_id = dir_prog
    WHERE full_name ILIKE '%CHISENGA%';

    -- Sebentile Myeni - Manager Knowledge Management M&E
    UPDATE public.staff SET department_id = dir_prog
    WHERE full_name ILIKE '%MYENI%';

    -- Edward Thomas Kataika - Principal Investigator Thanzi Project
    UPDATE public.staff SET department_id = dir_prog
    WHERE full_name ILIKE '%KATAIKA%';

    -- Miriam Japhet Urasa - Senior Programme Officer Family Health
    UPDATE public.staff SET department_id = dir_prog
    WHERE full_name ILIKE '%URASA%';

    -- Lutinala Nachiembo Nalomba - Project Officer COVID 19
    UPDATE public.staff SET department_id = dir_prog
    WHERE full_name ILIKE '%NALOMBA%';

    -- Doreen Marandu - Senior Programme Officer NCD
    UPDATE public.staff SET department_id = dir_prog
    WHERE full_name ILIKE '%MARANDU%';

    -- Upendo Barnabas Letawo - Programme Officer KM M&E
    UPDATE public.staff SET department_id = dir_prog
    WHERE full_name ILIKE '%LETAWO%';

    -- Emmanuel Mnjowe - Software Developer Thanzi La Onse
    UPDATE public.staff SET department_id = dir_prog
    WHERE full_name ILIKE '%MNJOWE%';

    -- ─── FINANCE ─────────────────────────────────────────────────────────────
    -- Lilliane Brenda Namutebi Njuba - Director of Finance
    UPDATE public.staff SET department_id = dir_finance
    WHERE full_name ILIKE '%NJUBA%';

    -- Chibuna Muteto - Financial Management Specialist
    UPDATE public.staff SET department_id = dir_finance
    WHERE full_name ILIKE '%MUTETO%';

    -- Darcy Ellison Njenga - Finance Officer
    UPDATE public.staff SET department_id = dir_finance
    WHERE full_name ILIKE '%NJENGA%';

    -- Cavin Charles Mapunda - Senior Accountant
    UPDATE public.staff SET department_id = dir_finance
    WHERE full_name ILIKE '%MAPUNDA%';

    -- Mariam Sam Golugwa - Finance Officer Global Fund
    UPDATE public.staff SET department_id = dir_finance
    WHERE full_name ILIKE '%GOLUGWA%';

    -- Faith Ngoi - Finance Officer TIMS Project
    UPDATE public.staff SET department_id = dir_finance
    WHERE full_name ILIKE '%NGOI%';

    -- Prisca Paul Matemba - Assistant Finance Officer
    UPDATE public.staff SET department_id = dir_finance
    WHERE full_name ILIKE '%MATEMBA%';

    -- James Aloyce Martin - Assistant IT and Finance Officer
    UPDATE public.staff SET department_id = dir_finance
    WHERE full_name ILIKE '%MARTIN%';

    -- Jonathan Omongole - Finance Officer COSECSA
    UPDATE public.staff SET department_id = dir_finance
    WHERE full_name ILIKE '%OMONGOLE%';

    -- Gasper Goodhance Mrina - Finance and Admin Officer ECSACOG
    UPDATE public.staff SET department_id = dir_finance
    WHERE full_name ILIKE '%MRINA%';

    -- ─── MPA PROJECT ─────────────────────────────────────────────────────────
    -- Mohamed Aly Mohamed - Project Coordinator MPA
    UPDATE public.staff SET department_id = dir_mpa
    WHERE full_name ILIKE '%MOHAMED%';

    -- Khalide Esmail Issufo Azam - Senior Laboratory Specialist
    UPDATE public.staff SET department_id = dir_mpa
    WHERE full_name ILIKE '%AZAM%';

    -- Benedict Mushi - Senior M&E Specialist
    UPDATE public.staff SET department_id = dir_mpa
    WHERE full_name ILIKE '%MUSHI%';

    -- Evelyne Wesangula - AMR Control Specialist
    UPDATE public.staff SET department_id = dir_mpa
    WHERE full_name ILIKE '%WESANGULA%';

    -- Yohannes Dugasa Feyisa - Emergency Preparedness Specialist
    UPDATE public.staff SET department_id = dir_mpa
    WHERE full_name ILIKE '%FEYISA%';

    -- Syriacus Buguzi - Project Administrator
    UPDATE public.staff SET department_id = dir_mpa
    WHERE full_name ILIKE '%BUGUZI%';

    -- Zuze Lydia Maleke - Gender Equity and Human Rights Specialist
    UPDATE public.staff SET department_id = dir_mpa
    WHERE full_name ILIKE '%MALEKE%';

    -- Stephen Fadson Biduda - Procurement Specialist MPA
    UPDATE public.staff SET department_id = dir_mpa
    WHERE full_name ILIKE '%BIDUDA%';

    -- Timothy Ayebare - System Developer MPA
    UPDATE public.staff SET department_id = dir_mpa
    WHERE full_name ILIKE '%AYEBARE%';

    -- ─── COSECSA ─────────────────────────────────────────────────────────────
    -- Stella Itungu - Chief Executive Officer COSECSA
    UPDATE public.staff SET department_id = dir_cosecsa
    WHERE full_name ILIKE '%ITUNGU%';

    -- Niraj Suresh Bachheta - Education Officer COSECSA
    UPDATE public.staff SET department_id = dir_cosecsa
    WHERE full_name ILIKE '%BACHHETA%';

    -- Amani Pascal Uiso - Examination Officer COSECSA
    UPDATE public.staff SET department_id = dir_cosecsa
    WHERE full_name ILIKE '%UISO%';

    -- Godfrey Philipo Sama - Research and Out Patient Coordinator
    UPDATE public.staff SET department_id = dir_cosecsa
    WHERE full_name ILIKE '%SAMA%';

    -- Diana Geras Kaiza - Administrative Officer COSECSA
    UPDATE public.staff SET department_id = dir_cosecsa
    WHERE full_name ILIKE '%KAIZA%';

    -- Davis Kondamwali - Admission Assistant COSECSA
    UPDATE public.staff SET department_id = dir_cosecsa
    WHERE full_name ILIKE '%KONDAMWALI%';

    -- Edna Herman Foya - Records and Admissions Assistant COSECSA
    UPDATE public.staff SET department_id = dir_cosecsa
    WHERE full_name ILIKE '%FOYA%';

    -- Laurence Paul Kisanga - Assistant IT COSECSA
    UPDATE public.staff SET department_id = dir_cosecsa
    WHERE full_name ILIKE '%KISANGA%';

    -- ─── ECSACONM ────────────────────────────────────────────────────────────
    -- Lemmy Medard Mabuga - Senior Programme Officer ECSACONM
    UPDATE public.staff SET department_id = dir_ecsaconm
    WHERE full_name ILIKE '%MABUGA%';

    -- Julius Tingai - IT Officer ECSACONM
    UPDATE public.staff SET department_id = dir_ecsaconm
    WHERE full_name ILIKE '%TINGAI%';

    -- ─── CANECSA ─────────────────────────────────────────────────────────────
    -- Sophia Masuka - Senior Administration Officer CANECSA
    UPDATE public.staff SET department_id = dir_canecsa
    WHERE full_name ILIKE '%MASUKA%';

    -- ─── ECSACOG ─────────────────────────────────────────────────────────────
    -- Judith Andrew - Senior Programme Officer ECSACOG
    UPDATE public.staff SET department_id = dir_ecsacog
    WHERE full_name ILIKE '%JUDITH%';

    -- Adam Simon Kanyonyi - Assistant IT Officer ECSACOG
    UPDATE public.staff SET department_id = dir_ecsacog
    WHERE full_name ILIKE '%KANYONYI%';

    RAISE NOTICE 'Directorates/clusters updated and staff reassigned successfully.';

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Migration error: %', SQLERRM;
END $$;

-- ─── 4. Clean up any remaining old-named departments with no staff ────────────
DELETE FROM public.departments
WHERE name IN (
    'Executive Office',
    'Thanzi Project'
)
AND NOT EXISTS (
    SELECT 1 FROM public.staff s WHERE s.department_id = public.departments.id
);
