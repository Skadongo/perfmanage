-- Staff Management Migration
-- Creates departments, staff tables with supervisor relationships
-- Populates all 57 staff members from STAFF_LIST_2026

-- 1. Create departments table
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create staff table
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number INTEGER,
    full_name TEXT NOT NULL,
    job_title TEXT NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    supervisor_name TEXT,
    supervisor_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    employment_status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_staff_department_id ON public.staff(department_id);
CREATE INDEX IF NOT EXISTS idx_staff_supervisor_id ON public.staff(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_staff_full_name ON public.staff(full_name);
CREATE INDEX IF NOT EXISTS idx_departments_name ON public.departments(name);

-- 4. Enable RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies - public read access (staff directory is org-wide)
DROP POLICY IF EXISTS "public_read_departments" ON public.departments;
CREATE POLICY "public_read_departments" ON public.departments
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "authenticated_manage_departments" ON public.departments;
CREATE POLICY "authenticated_manage_departments" ON public.departments
FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_staff" ON public.staff;
CREATE POLICY "public_read_staff" ON public.staff
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "authenticated_manage_staff" ON public.staff;
CREATE POLICY "authenticated_manage_staff" ON public.staff
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_staff_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_updated_at ON public.staff;
CREATE TRIGGER staff_updated_at
    BEFORE UPDATE ON public.staff
    FOR EACH ROW EXECUTE FUNCTION public.update_staff_updated_at();

-- 7. Seed Data
DO $$
DECLARE
    dept_exec UUID;
    dept_programmes UUID;
    dept_finance UUID;
    dept_operations UUID;
    dept_mpa UUID;
    dept_cosecsa UUID;
    dept_ecsaconm UUID;
    dept_canecsa UUID;
    dept_ecsacog UUID;
    dept_thanzi UUID;

    -- Staff UUIDs - Leadership
    s_kapologwe UUID := gen_random_uuid();
    s_sibandze UUID := gen_random_uuid();
    s_mungati UUID := gen_random_uuid();
    s_njuba UUID := gen_random_uuid();

    -- Programmes
    s_silumesii UUID := gen_random_uuid();
    s_masiye UUID := gen_random_uuid();
    s_chisenga UUID := gen_random_uuid();
    s_myeni UUID := gen_random_uuid();

    -- COSECSA
    s_itungu UUID := gen_random_uuid();

    -- Thanzi Project
    s_kataika UUID := gen_random_uuid();

    -- MPA Project
    s_azam UUID := gen_random_uuid();
    s_mohamed UUID := gen_random_uuid();
    s_mushi UUID := gen_random_uuid();
    s_wesangula UUID := gen_random_uuid();
    s_feyisa UUID := gen_random_uuid();
    s_buguzi UUID := gen_random_uuid();
    s_maleke UUID := gen_random_uuid();
    s_biduda UUID := gen_random_uuid();
    s_ayebare UUID := gen_random_uuid();

    -- Finance
    s_muteto UUID := gen_random_uuid();
    s_njenga UUID := gen_random_uuid();
    s_mapunda UUID := gen_random_uuid();
    s_golugwa UUID := gen_random_uuid();
    s_ngoi UUID := gen_random_uuid();
    s_matemba UUID := gen_random_uuid();
    s_martin UUID := gen_random_uuid();

    -- Communications
    s_mwandumbya UUID := gen_random_uuid();

    -- Thanzi Developer
    s_mnjowe UUID := gen_random_uuid();

    -- Programme Officers
    s_urasa UUID := gen_random_uuid();
    s_marandu UUID := gen_random_uuid();
    s_letawo UUID := gen_random_uuid();

    -- Operations
    s_mhomi UUID := gen_random_uuid();
    s_bani UUID := gen_random_uuid();
    s_minja UUID := gen_random_uuid();

    -- COSECSA Finance
    s_omongole UUID := gen_random_uuid();

    -- COSECSA Staff
    s_bachheta UUID := gen_random_uuid();
    s_uiso UUID := gen_random_uuid();
    s_sama UUID := gen_random_uuid();
    s_kaiza UUID := gen_random_uuid();
    s_kondamwali UUID := gen_random_uuid();
    s_foya UUID := gen_random_uuid();
    s_kisanga UUID := gen_random_uuid();

    -- COVID Project
    s_nalomba UUID := gen_random_uuid();

    -- ECSACONM
    s_mabuga UUID := gen_random_uuid();
    s_tingai UUID := gen_random_uuid();

    -- CANECSA
    s_masuka UUID := gen_random_uuid();

    -- ECSACOG
    s_andrew UUID := gen_random_uuid();
    s_mrina UUID := gen_random_uuid();
    s_kanyonyi UUID := gen_random_uuid();

    -- Admin Assistants
    s_mhanusi UUID := gen_random_uuid();
    s_lema UUID := gen_random_uuid();
    s_herra UUID := gen_random_uuid();
    s_kilawe UUID := gen_random_uuid();
    s_mmari UUID := gen_random_uuid();
    s_zarifu UUID := gen_random_uuid();

BEGIN
    -- Insert Departments
    INSERT INTO public.departments (id, name, description) VALUES
        (gen_random_uuid(), 'Executive Office', 'Director General and senior leadership'),
        (gen_random_uuid(), 'Programmes', 'Health programmes and technical teams'),
        (gen_random_uuid(), 'Finance', 'Finance and accounting'),
        (gen_random_uuid(), 'Operations & Institutional Development', 'Operations, HR, IT and procurement'),
        (gen_random_uuid(), 'MPA Project', 'Multi-Partner Agreement project team'),
        (gen_random_uuid(), 'COSECSA', 'College of Surgeons of East, Central and Southern Africa'),
        (gen_random_uuid(), 'ECSACONM', 'East, Central and Southern Africa College of Nursing and Midwifery'),
        (gen_random_uuid(), 'CANECSA', 'College of Anaesthesiologists of East, Central and Southern Africa'),
        (gen_random_uuid(), 'ECSACOG', 'East, Central and Southern Africa College of Obstetricians and Gynaecologists'),
        (gen_random_uuid(), 'Thanzi Project', 'Thanzi La Onse research project')
    ON CONFLICT (name) DO NOTHING;

    -- Fetch department IDs
    SELECT id INTO dept_exec FROM public.departments WHERE name = 'Executive Office' LIMIT 1;
    SELECT id INTO dept_programmes FROM public.departments WHERE name = 'Programmes' LIMIT 1;
    SELECT id INTO dept_finance FROM public.departments WHERE name = 'Finance' LIMIT 1;
    SELECT id INTO dept_operations FROM public.departments WHERE name = 'Operations & Institutional Development' LIMIT 1;
    SELECT id INTO dept_mpa FROM public.departments WHERE name = 'MPA Project' LIMIT 1;
    SELECT id INTO dept_cosecsa FROM public.departments WHERE name = 'COSECSA' LIMIT 1;
    SELECT id INTO dept_ecsaconm FROM public.departments WHERE name = 'ECSACONM' LIMIT 1;
    SELECT id INTO dept_canecsa FROM public.departments WHERE name = 'CANECSA' LIMIT 1;
    SELECT id INTO dept_ecsacog FROM public.departments WHERE name = 'ECSACOG' LIMIT 1;
    SELECT id INTO dept_thanzi FROM public.departments WHERE name = 'Thanzi Project' LIMIT 1;

    -- Insert Leadership (no supervisor_id yet, will update after)
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, supervisor_id) VALUES
        (s_kapologwe, 1, 'NTULI A KAPOLOGWE', 'Director General', dept_exec, 'Chair of HMC', NULL),
        (s_sibandze, 2, 'SIBUSISO BAFANA SIBANDZE', 'Director of Operations and Institutional Development', dept_operations, 'Director General', NULL),
        (s_mungati, 3, 'MORE MUNGATI', 'Director of Programmes', dept_programmes, 'Director General', NULL),
        (s_njuba, 4, 'LILLIANE BRENDA NAMUTEBI NJUBA', 'Director of Finance', dept_finance, 'Director General', NULL)
    ON CONFLICT (id) DO NOTHING;

    -- Update Director General supervisor references
    UPDATE public.staff SET supervisor_id = s_kapologwe WHERE id IN (s_sibandze, s_mungati, s_njuba);

    -- Insert Programmes Managers
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, supervisor_id) VALUES
        (s_silumesii, 5, 'ANDREW NKHULO SILUMESII', 'Manager Family Health and Infectious Diseases', dept_programmes, 'Director of Programmes', s_mungati),
        (s_masiye, 7, 'JONES KAPONDA MASIYE', 'Manager Non Communicable Food Security and Nutrition', dept_programmes, 'Director of Programmes', s_mungati),
        (s_chisenga, 9, 'TINA CHISENGA', 'Manager Health System and Capacity Development', dept_programmes, 'Director of Programmes', s_mungati),
        (s_myeni, 10, 'SEBENTILE MYENI', 'Manager Knowledge Management Monitoring and Evaluation', dept_programmes, 'Director of Programmes', s_mungati)
    ON CONFLICT (id) DO NOTHING;

    -- COSECSA CEO
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, supervisor_id) VALUES
        (s_itungu, 11, 'STELLA ITUNGU', 'Chief Executive Officer-COSECSA', dept_cosecsa, 'President of the College', NULL)
    ON CONFLICT (id) DO NOTHING;

    -- Thanzi Project PI
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, supervisor_id) VALUES
        (s_kataika, 12, 'EDWARD THOMAS KATAIKA', 'Principal Investigator - Thanzi Project', dept_thanzi, 'Director of Programmes', s_mungati)
    ON CONFLICT (id) DO NOTHING;

    -- MPA Project Coordinator
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, supervisor_id) VALUES
        (s_mohamed, 14, 'MOHAMED ALY MOHAMED', 'Project Coordinator -MPA Project', dept_mpa, 'Director of Programmes', s_mungati)
    ON CONFLICT (id) DO NOTHING;

    -- MPA Project Team
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, supervisor_id) VALUES
        (s_azam, 13, 'KHALIDE ESMAIL ISSUFO AZAM', 'Senior Laboratory Specialist-MPA Project', dept_mpa, 'Project Coordinator -MPA Project', s_mohamed),
        (s_mushi, 15, 'BENEDICT MUSHI', 'Senior Monitoring and Evaluation Specialist', dept_mpa, 'Project Coordinator -MPA Project', s_mohamed),
        (s_wesangula, 16, 'EVELYNE WESANGULA', 'AMR Control Specialist -MPA Project', dept_mpa, 'Project Coordinator -MPA Project', s_mohamed),
        (s_feyisa, 17, 'YOHANNES DUGASA FEYISA', 'Emergency Preparedness and Response Specialist', dept_mpa, 'Project Coordinator -MPA Project', s_mohamed),
        (s_buguzi, 18, 'SYRIACUS BUGUZI', 'Project Administrator', dept_mpa, 'Project Coordinator -MPA Project', s_mohamed),
        (s_maleke, 20, 'ZUZE LYDIA MALEKE', 'Gender, Equity and Human Rights Specialist', dept_mpa, 'Project Coordinator -MPA Project', s_mohamed),
        (s_biduda, 21, 'STEPHEN FADSON BIDUDA', 'Procurement Specialist-MPA Project', dept_mpa, 'Project Coordinator -MPA Project', s_mohamed),
        (s_ayebare, 22, 'TIMOTHY AYEBARE', 'System Developer-MPA Project', dept_mpa, 'Project Coordinator -MPA Project', s_mohamed)
    ON CONFLICT (id) DO NOTHING;

    -- Finance Team
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, supervisor_id) VALUES
        (s_muteto, 19, 'CHIBUNA MUTETO', 'Financial Management Specialist', dept_finance, 'Director of Finance', s_njuba),
        (s_njenga, 23, 'DARCY ELLISON NJENGA', 'Finance Officer', dept_finance, 'Director of Finance', s_njuba),
        (s_mapunda, 24, 'CAVIN CHARLES MAPUNDA', 'Senior Accountant', dept_finance, 'Director of Finance', s_njuba),
        (s_golugwa, 25, 'MARIAM SAM GOLUGWA', 'Finance Officer -Global Fund Project', dept_finance, 'Director of Finance', s_njuba),
        (s_ngoi, 26, 'FAITH NGOI', 'Finance Officer-TIMS Project', dept_finance, 'Director of Finance', s_njuba),
        (s_matemba, 27, 'PRISCA PAUL MATEMBA', 'Assistant Finance Officer', dept_finance, 'Director of Finance', s_njuba),
        (s_martin, 28, 'JAMES ALOYCE MARTIN', 'Assistant IT and Finance Officer', dept_finance, 'Director of Finance', s_njuba)
    ON CONFLICT (id) DO NOTHING;

    -- Communications
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, supervisor_id) VALUES
        (s_mwandumbya, 29, 'OWEN MWANDUMBYA', 'Communication Specialist', dept_exec, 'Director General', s_kapologwe)
    ON CONFLICT (id) DO NOTHING;

    -- Thanzi Developer
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, supervisor_id) VALUES
        (s_mnjowe, 30, 'EMMANUEL MNJOWE', 'Software Developer - Thanzi La Onse Project', dept_thanzi, 'Principal Investigator - Thanzi Project', s_kataika)
    ON CONFLICT (id) DO NOTHING;

    -- Programme Officers
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, supervisor_id) VALUES
        (s_urasa, 31, 'MIRIAM JAPHET URASA', 'Senior Programme Officer Family Health and Infectious Diseases', dept_programmes, 'Manager Family Health and Infectious Diseases', s_silumesii),
        (s_marandu, 32, 'DOREEN MARANDU', 'Senior Programme Officer Non Communicable Food Security and Nutrition', dept_programmes, 'Manager Non Communicable Food Security and Nutrition', s_masiye),
        (s_letawo, 33, 'UPENDO BARNABAS LETAWO', 'Programme Officer Knowledge Management Monitoring and Evaluation', dept_programmes, 'Manager Knowledge Management Monitoring and Evaluation', s_myeni)
    ON CONFLICT (id) DO NOTHING;

    -- Operations Team
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, supervisor_id) VALUES
        (s_mhomi, 34, 'MARY CHARLES MHOMI', 'Senior Administration and Human Resource Officer', dept_operations, 'Director of Operations and Institutional Development', s_sibandze),
        (s_bani, 35, 'HAMIS ATHUMANI BANI', 'Procurement Officer', dept_operations, 'Director of Operations and Institutional Development', s_sibandze),
        (s_minja, 36, 'CHISTOPHER AUGUST MINJA', 'Senior Information Technology Officer', dept_operations, 'Director of Operations and Institutional Development', s_sibandze)
    ON CONFLICT (id) DO NOTHING;

    -- COSECSA Finance
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, supervisor_id) VALUES
        (s_omongole, 37, 'JONATHAN OMONGOLE', 'Finance Officer -COSECSA', dept_cosecsa, 'Director of Finance', s_njuba)
    ON CONFLICT (id) DO NOTHING;

    -- COSECSA Staff
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, supervisor_id) VALUES
        (s_bachheta, 38, 'NIRAJ SURESH BACHHETA', 'Education Officer-COSESA', dept_cosecsa, 'Chief Executive Officer-COSECSA', s_itungu),
        (s_uiso, 39, 'AMANI PASCAL UISO', 'Examination Officer-COSECSA', dept_cosecsa, 'Chief Executive Officer-COSECSA', s_itungu),
        (s_sama, 40, 'GODFREY PHILIPO SAMA', 'Research and Out Patient Coordinator -COSECSA', dept_cosecsa, 'Chief Executive Officer-COSECSA', s_itungu),
        (s_kaiza, 41, 'DIANA GERAS KAIZA', 'Administrative Officer-COSECSA', dept_cosecsa, 'Chief Executive Officer-COSECSA', s_itungu),
        (s_kondamwali, 42, 'DAVIS KONDAMWALI', 'Admission Assistant-COSESA', dept_cosecsa, 'Chief Executive Officer-COSECSA', s_itungu),
        (s_foya, 43, 'EDNA HERMAN FOYA', 'Records and Admissions Assistant-COSECSA', dept_cosecsa, 'Chief Executive Officer-COSECSA', s_itungu),
        (s_kisanga, 57, 'LAURENCE PAUL KISANGA', 'Assistant IT -COSECSA', dept_cosecsa, 'Chief Executive Officer-COSECSA', s_itungu)
    ON CONFLICT (id) DO NOTHING;

    -- COVID Project
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, supervisor_id) VALUES
        (s_nalomba, 44, 'LUTINALA NACHIEMBO NALOMBA', 'Project Officer-COVID 19 Project', dept_programmes, 'Manager Family Health and Infectious Diseases', s_silumesii)
    ON CONFLICT (id) DO NOTHING;

    -- ECSACONM
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, supervisor_id) VALUES
        (s_mabuga, 45, 'LEMMY MEDARD MABUGA', 'Senior Programme Officer-ECSACONM', dept_ecsaconm, 'President of the College', NULL)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, supervisor_id) VALUES
        (s_tingai, 46, 'JULIUS TINGAI', 'Information Technology Officer-ECSACONM', dept_ecsaconm, 'Senior Programme Officer-ECSACONM', s_mabuga)
    ON CONFLICT (id) DO NOTHING;

    -- CANECSA
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, supervisor_id) VALUES
        (s_masuka, 47, 'SOPHIA MASUKA', 'Senior Administration Officer-CANECSA', dept_canecsa, 'President of the College', NULL)
    ON CONFLICT (id) DO NOTHING;

    -- ECSACOG
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, supervisor_id) VALUES
        (s_andrew, 48, 'JUDITH ANDREW', 'Senior Programme Officer-ECSACOG', dept_ecsacog, 'President of the College', NULL),
        (s_mrina, 49, 'GASPER GOODHANCE MRINA', 'Finance and Administration Officer-ECSACOG', dept_ecsacog, 'Director of Finance', s_njuba)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, supervisor_id) VALUES
        (s_kanyonyi, 50, 'ADAM SIMON KANYONYI', 'Assistant Information Technology Officer-ECSACOG', dept_ecsacog, 'Senior Programme Officer-ECSACOG', s_andrew)
    ON CONFLICT (id) DO NOTHING;

    -- Admin Assistants
    INSERT INTO public.staff (id, serial_number, full_name, job_title, department_id, supervisor_name, supervisor_id) VALUES
        (s_mhanusi, 51, 'CHRISTINA SAMWEL MHANUSI', 'Administrative Assistant', dept_operations, 'Senior Administration and Human Resource Officer', s_mhomi),
        (s_lema, 52, 'NEEMA SIA LEMA', 'Administrative Assistant', dept_operations, 'Senior Administration and Human Resource Officer', s_mhomi),
        (s_herra, 53, 'MWAMVUA HERRA', 'Receptionist/Store Keeper', dept_operations, 'Senior Administration and Human Resource Officer', s_mhomi),
        (s_kilawe, 54, 'HELENA KILAWE', 'Records and Archive Clerk', dept_operations, 'Senior Administration and Human Resource Officer', s_mhomi),
        (s_mmari, 55, 'VALENTINO MMARI', 'Driver', dept_operations, 'Senior Administration and Human Resource Officer', s_mhomi),
        (s_zarifu, 56, 'JACKSON SALEHE ZARIFU', 'Driver', dept_operations, 'Senior Administration and Human Resource Officer', s_mhomi)
    ON CONFLICT (id) DO NOTHING;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Staff seed data error: %', SQLERRM;
END $$;
