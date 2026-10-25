-- Migration: Import STAFF LIST 2026 (revised CHRIS) and link every user profile to its staff record
--
-- ROOT CAUSE: public.staff only contained 2 rows while user_profiles had 66.
-- workplan_settings.staff_id is checked by RLS against user_profiles.staff_id
-- (public.auth_user_staff_id()), so a user with no linked staff record cannot save a workplan.
--
-- This migration is NON-DESTRUCTIVE and idempotent:
--   * never deletes staff rows (workplans / drafts / reviews reference staff.id)
--   * matches existing staff by lower(email) and updates them
--   * inserts only the missing staff
--   * links user_profiles.staff_id by email, then by exact name as a fallback

-- 1. Make sure supporting columns / indexes exist
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS idx_staff_email_lower ON public.staff (lower(email));
CREATE INDEX IF NOT EXISTS idx_user_profiles_email_lower ON public.user_profiles (lower(email));

-- 2. Departments
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

-- 3. Upsert staff list (by lower(email)), then supervisors, then profile links
DO $$
DECLARE
  r RECORD;
  v_dept_id UUID;
  v_staff_id UUID;
  v_inserted INT := 0;
  v_updated INT := 0;
  v_linked_email INT := 0;
  v_linked_name INT := 0;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      (44, 'NTULI A. KAPOLOGWE', 'DIRECTOR GENERAL', 'CHAIR OF HMC', 'ntuli.kapologwe@ecsahc.org', 'Executive Office', 'executive_director'),
      (41, 'MORE MUNGATI', 'DIRECTOR OF PROGRAMMES', 'DIRECTOR GENERAL', 'mmungati@ecsahc.org', 'Programmes', 'deputy_director'),
      (33, 'LILLIANE BRENDA NAMUTEBI NJUBA', 'DIRECTOR OF FINANCE', 'DIRECTOR GENERAL', 'lnjuba@ecsahc.org', 'Finance', 'finance_manager'),
      (45, 'OWEN DAVID MWANDUMBYA', 'COMMUNICATION SPECIALIST', 'DIRECTOR GENERAL', 'omwandumbya@ecsahc.org', 'Executive Office', 'programme_officer'),
      (47, 'SIBUSISO BAFANA SIBANDZE', 'DIRECTOR OF OPERATIONS AND INSTITUTIONAL DEVELOPMENT', 'DIRECTOR GENERAL', 's_sibandze@ecsahc.org', 'Operations and Institutional Development', 'deputy_director'),
      (9, 'STELLA ITUNGU', 'CHIEF EXECUTIVE OFFICER-COSECSA', 'PRESIDENT OF THE COLLEGE', 'situngu@cosecsa.org', 'COSECSA', 'programme_manager'),
      (1, 'AMANI PASKAL UISO', 'EXAMINATION OFFICER-COSECSA', 'CHIEF EXECUTIVE OFFICER-COSECSA', 'apascal@cosecsa.org', 'COSECSA', 'programme_officer'),
      (2, 'DIANA GERAS KAIZA', 'ADMINISTRATIVE OFFICER-COSECSA', 'CHIEF EXECUTIVE OFFICER-COSECSA', 'dianaK@cosecsa.org', 'COSECSA', 'admin_officer'),
      (3, 'DAVIS HYACINTH KONDAMWALI', 'ADMISSION ASSISTANT-COSECSA', 'CHIEF EXECUTIVE OFFICER-COSECSA', 'Davish@cosecsa.org', 'COSECSA', 'admin_officer'),
      (4, 'EDNA HERMAN FOYA', 'RECORDS AND ADMISSIONS ASSISTANT-COSECSA', 'CHIEF EXECUTIVE OFFICER-COSECSA', 'efoya@cosecsa.org', 'COSECSA', 'admin_officer'),
      (5, 'GODFREY PHILIPO SAMA', 'RESEARCH AND OUT PATIENT COORDINATOR-COSECSA', 'CHIEF EXECUTIVE OFFICER-COSECSA', 'gsama@cosecsa.org', 'COSECSA', 'project_coordinator'),
      (7, 'LAURENCE PAUL KISANGA', 'ASSISTANT IT-COSECSA', 'CHIEF EXECUTIVE OFFICER-COSECSA', 'lkisanga@cosecsa.org', 'COSECSA', 'admin_officer'),
      (8, 'NIRAJ SURESH BACHHETA', 'EDUCATION OFFICER-COSECSA', 'CHIEF EXECUTIVE OFFICER-COSECSA', 'nbachheta@cosecsa.org', 'COSECSA', 'programme_officer'),
      (6, 'JONATHAN OMONGOLE', 'FINANCE OFFICER-COSECSA', 'DIRECTOR OF FINANCE', 'jomongole@cosecsa.org', 'Finance', 'finance_officer'),
      (16, 'CAVIN CHARLES MAPUNDA', 'SENIOR ACCOUNTANT', 'DIRECTOR OF FINANCE', 'cmapunda@ecsahc.org', 'Finance', 'finance_officer'),
      (17, 'DARCY ELLISON NJENGA', 'FINANCE OFFICER', 'DIRECTOR OF FINANCE', 'dnjenga@ecsahc.org', 'Finance', 'finance_officer'),
      (34, 'CHIBUNA MUTETO', 'FINANCIAL MANAGEMENT SPECIALIST', 'DIRECTOR OF FINANCE', 'mchibuna@ecsahc.org', 'Finance', 'finance_officer'),
      (35, 'MARIAM SAM GOLUGWA', 'FINANCE OFFICER-GLOBAL FUND PROJECT', 'DIRECTOR OF FINANCE', 'mgolugwa@ecsahc.org', 'Finance', 'finance_officer'),
      (46, 'PRISCA PAUL MATEMBA', 'ASSISTANT FINANCE OFFICER', 'DIRECTOR OF FINANCE', 'pmatemba@ecsahc.org', 'Finance', 'finance_officer'),
      (15, 'CHRISTOPHER AUGUST MINJA', 'SENIOR INFORMATION TECHNOLOGY OFFICER', 'DIRECTOR OF OPERATIONS AND INSTITUTIONAL DEVELOPMENT', 'chris@ecsahc.org', 'Operations and Institutional Development', 'admin_officer'),
      (23, 'HAMIS ATHUMAN BANI', 'PROCUREMENT OFFICER', 'DIRECTOR OF OPERATIONS AND INSTITUTIONAL DEVELOPMENT', 'hbani@ecsahc.org', 'Operations and Institutional Development', 'admin_officer'),
      (39, 'MARY CHARLES MHOMI', 'SENIOR ADMINISTRATION AND HUMAN RESOURCE OFFICER', 'DIRECTOR OF OPERATIONS AND INSTITUTIONAL DEVELOPMENT', 'mmhomi@ecsahc.org', 'Operations and Institutional Development', 'hr_admin_officer'),
      (12, 'ANDREW NKHULO SILUMESII', 'MANAGER FAMILY HEALTH AND INFECTIOUS DISEASES', 'DIRECTOR OF PROGRAMMES', 'asilumesii@ecsahc.org', 'Programmes', 'programme_manager'),
      (18, 'EDWARD THOMAS KATAIKA', 'PRINCIPAL INVESTIGATOR-THANZI PROJECT', 'DIRECTOR OF PROGRAMMES', 'ekataika@ecsahc.org', 'Thanzi La Onse Project', 'programme_manager'),
      (27, 'JONES KAPONDA MASIYE', 'MANAGER NON COMMUNICABLE FOOD SECURITY AND NUTRITION', 'DIRECTOR OF PROGRAMMES', 'jkmasiye@ecsahc.org', 'Programmes', 'programme_manager'),
      (40, 'MOHAMED ALLY MOHAMED', 'PROJECT COORDINATOR-MPA PROJECT', 'DIRECTOR OF PROGRAMMES', 'mmohamed@ecsahc.org', 'MPA Project', 'project_coordinator'),
      (51, 'SEBENTILE MYENI', 'MANAGER KNOWLEDGE MANAGEMENT MONITORING AND EVALUATION', 'DIRECTOR OF PROGRAMMES', 'smyeni@ecsahc.org', 'Programmes', 'programme_manager'),
      (52, 'TINA CHISENGA', 'MANAGER HEALTH SYSTEM AND CAPACITY DEVELOPMENT', 'DIRECTOR OF PROGRAMMES', 'tchisenga@ecsahc.org', 'Programmes', 'programme_manager'),
      (32, 'LUTINALA NACHIEMBO NALOMBA', 'PROJECT OFFICER-COVID 19 PROJECT', 'MANAGER FAMILY HEALTH AND INFECTIOUS DISEASES', 'lnalomba@ecsahc.org', 'Programmes', 'programme_officer'),
      (53, 'UPENDO BARNABAS LETAWO', 'PROGRAMME OFFICER KNOWLEDGE MANAGEMENT MONITORING AND EVALUATION', 'MANAGER KNOWLEDGE MANAGEMENT MONITORING AND EVALUATION', 'uletawo@ecsahc.org', 'Programmes', 'programme_officer'),
      (11, 'DOREEN MARANDU', 'SENIOR PROGRAMME OFFICER NON COMMUNICABLE FOOD SECURITY AND NUTRITION', 'MANAGER NON COMMUNICABLE FOOD SECURITY AND NUTRITION', 'dmarandu@ecsahc.org', 'Programmes', 'programme_officer'),
      (42, 'MIRIAM JAPHET URASA', 'SENIOR PROGRAMME OFFICER FAMILY HEALTH AND INFECTIOUS DISEASES', 'MANAGER FAMILY HEALTH AND INFECTIOUS DISEASES', 'murasa@ecsahc.org', 'Programmes', 'programme_officer'),
      (26, 'JUDITH ANDREW MROSO', 'SENIOR PROGRAMME OFFICER-ECSACOG', 'PRESIDENT OF THE COLLEGE', 'judith@ecsacog.org', 'ECSACOG', 'programme_officer'),
      (31, 'LEMMY MEDARD MABUGA', 'SENIOR PROGRAMME OFFICER-ECSACONM', 'PRESIDENT OF THE COLLEGE', 'lemmym@ecsahc.org', 'ECSACONM', 'programme_officer'),
      (50, 'SOPHIA COSTANTINE MASUKA', 'SENIOR ADMINISTRATION OFFICER-CANECSA', 'PRESIDENT OF THE COLLEGE', 'smasuka@ecsahc.org', 'CANECSA', 'admin_officer'),
      (20, 'EMMANUEL MNJOWE', 'SOFTWARE DEVELOPER-THANZI LA ONSE PROJECT', 'PRINCIPAL INVESTIGATOR-THANZI PROJECT', 'emnjowe@ecsahc.org', 'Thanzi La Onse Project', 'programme_officer'),
      (30, 'KHALID ESMAIL ISSUFO AZAM', 'SENIOR LABORATORY SPECIALIST-MPA PROJECT', 'PROJECT COORDINATOR-MPA PROJECT', 'kie.azam@ecsahc.org', 'MPA Project', 'programme_officer'),
      (13, 'TIMOTHY AYEBARE', 'SYSTEM DEVELOPER-MPA PROJECT', 'PROJECT COORDINATOR-MPA PROJECT', 'atimothy@ecsahc.org', 'MPA Project', 'programme_officer'),
      (14, 'BENEDICT PIUS MUSHI', 'SENIOR MONITORING AND EVALUATION SPECIALIST', 'PROJECT COORDINATOR-MPA PROJECT', 'bmushi@ecsahc.org', 'MPA Project', 'programme_officer'),
      (19, 'EVENESS LYDIA ZUZE MELEKE', 'GENDER, EQUITY AND HUMAN RIGHTS SPECIALIST', 'PROJECT COORDINATOR-MPA PROJECT', 'emeleke@ecsahc.org', 'MPA Project', 'programme_officer'),
      (21, 'EVELYN NELIMA WESANGULA', 'AMR CONTROL SPECIALIST-MPA PROJECT', 'PROJECT COORDINATOR-MPA PROJECT', 'ewesangula@ecsahc.org', 'MPA Project', 'programme_officer'),
      (48, 'STEPHEN FADSON BIDUDA', 'PROCUREMENT SPECIALIST-MPA PROJECT', 'PROJECT COORDINATOR-MPA PROJECT', 'sbiduda@ecsahc.org', 'MPA Project', 'programme_officer'),
      (49, 'SYRIACUS BUGUZI', 'PROJECT ADMINISTRATOR', 'PROJECT COORDINATOR-MPA PROJECT', 'sbuguzi@ecsahc.org', 'MPA Project', 'admin_officer'),
      (54, 'YOHANNES DUGASA FEYISA', 'EMERGENCY PREPAREDNESS AND RESPONSE SPECIALIST', 'PROJECT COORDINATOR-MPA PROJECT', 'yohannesd@ecsahc.org', 'MPA Project', 'programme_officer'),
      (24, 'HELENA NICETAS KILAWE', 'RECORDS AND ARCHIVE CLERK', 'SENIOR ADMINISTRATION AND HUMAN RESOURCE OFFICER', 'helenak@ecsahc.org', 'Operations and Institutional Development', 'admin_officer'),
      (25, 'JACKSON SALEHE ZARIFU', 'DRIVER', 'SENIOR ADMINISTRATION AND HUMAN RESOURCE OFFICER', 'jackson@ecsahc.org', 'Operations and Institutional Development', 'admin_officer'),
      (36, 'CHRISTINA SAMWEL MHANUSI', 'ADMINISTRATIVE ASSISTANT', 'SENIOR ADMINISTRATION AND HUMAN RESOURCE OFFICER', 'mhanusi@ecsahc.org', 'Operations and Institutional Development', 'admin_officer'),
      (37, 'MWAMVUA HERRA WISIKO', 'RECEPTIONIST/STORE KEEPER', 'SENIOR ADMINISTRATION AND HUMAN RESOURCE OFFICER', 'mherra@ecsahc.org', 'Operations and Institutional Development', 'admin_officer'),
      (38, 'VALENTINO JOACHIM MMARI', 'DRIVER', 'SENIOR ADMINISTRATION AND HUMAN RESOURCE OFFICER', 'mmari@ecsahc.org', 'Operations and Institutional Development', 'admin_officer'),
      (43, 'NEEMA SIA LEMA', 'ADMINISTRATIVE ASSISTANT', 'SENIOR ADMINISTRATION AND HUMAN RESOURCE OFFICER', 'nlema@ecsahc.org', 'Operations and Institutional Development', 'admin_officer'),
      (28, 'JAMES ALOYCE MARTIN', 'ASSISTANT IT AND FINANCE OFFICER', 'SENIOR ADMINISTRATION OFFICER-CANECSA', 'jmartin@ecsahc.org', 'CANECSA', 'admin_officer'),
      (22, 'GASPER GOODCHANCE MRINA', 'FINANCE AND ADMINISTRATION OFFICER-ECSACOG', 'SENIOR PROGRAMME OFFICER-ECSACOG', 'gmrina@ecsacog.org', 'ECSACOG', 'finance_officer'),
      (10, 'ADAM SIMON KANYONYI', 'ASSISTANT INFORMATION TECHNOLOGY OFFICER-ECSACOG', 'SENIOR PROGRAMME OFFICER-ECSACOG', 'adam@ecsahc.org', 'ECSACOG', 'admin_officer'),
      (29, 'JULIUS TINGAI', 'INFORMATION TECHNOLOGY OFFICER-ECSACONM', 'SENIOR PROGRAMME OFFICER-ECSACONM', 'jtingai@ecsahc.org', 'ECSACONM', 'admin_officer')
    ) AS t(sn, full_name, job_title, supervisor_name, email, dept_name, sys_role)
  LOOP
    SELECT id INTO v_dept_id FROM public.departments WHERE name = r.dept_name LIMIT 1;

    -- Match an existing staff row by email, then by name
    SELECT id INTO v_staff_id
    FROM public.staff
    WHERE lower(email) = lower(r.email)
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_staff_id IS NULL THEN
      SELECT id INTO v_staff_id
      FROM public.staff
      WHERE upper(trim(full_name)) = upper(trim(r.full_name))
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;

    IF v_staff_id IS NULL THEN
      INSERT INTO public.staff (
        id, serial_number, full_name, job_title, department_id,
        supervisor_name, email, employment_status, system_role
      ) VALUES (
        gen_random_uuid(), r.sn, r.full_name, r.job_title, v_dept_id,
        r.supervisor_name, lower(r.email), 'active', r.sys_role::public.staff_role
      );
      v_inserted := v_inserted + 1;
    ELSE
      UPDATE public.staff
      SET serial_number     = r.sn,
          full_name         = r.full_name,
          job_title         = r.job_title,
          department_id     = COALESCE(v_dept_id, department_id),
          supervisor_name   = r.supervisor_name,
          email             = lower(r.email),
          employment_status = 'active',
          -- keep an already-elevated role (e.g. superuser) untouched
          system_role       = CASE
                                WHEN system_role = 'superuser'::public.staff_role THEN system_role
                                ELSE r.sys_role::public.staff_role
                              END,
          updated_at        = CURRENT_TIMESTAMP
      WHERE id = v_staff_id;
      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  -- 4. Explicit supervisor mapping by email (the spreadsheet lists supervisors by designation)
  UPDATE public.staff s
  SET supervisor_id = sup.id
  FROM (VALUES
    ('mmungati@ecsahc.org','ntuli.kapologwe@ecsahc.org'),
    ('lnjuba@ecsahc.org','ntuli.kapologwe@ecsahc.org'),
    ('omwandumbya@ecsahc.org','ntuli.kapologwe@ecsahc.org'),
    ('s_sibandze@ecsahc.org','ntuli.kapologwe@ecsahc.org'),
    ('apascal@cosecsa.org','situngu@cosecsa.org'),
    ('dianak@cosecsa.org','situngu@cosecsa.org'),
    ('davish@cosecsa.org','situngu@cosecsa.org'),
    ('efoya@cosecsa.org','situngu@cosecsa.org'),
    ('gsama@cosecsa.org','situngu@cosecsa.org'),
    ('lkisanga@cosecsa.org','situngu@cosecsa.org'),
    ('nbachheta@cosecsa.org','situngu@cosecsa.org'),
    ('jomongole@cosecsa.org','lnjuba@ecsahc.org'),
    ('cmapunda@ecsahc.org','lnjuba@ecsahc.org'),
    ('dnjenga@ecsahc.org','lnjuba@ecsahc.org'),
    ('mchibuna@ecsahc.org','lnjuba@ecsahc.org'),
    ('mgolugwa@ecsahc.org','lnjuba@ecsahc.org'),
    ('pmatemba@ecsahc.org','lnjuba@ecsahc.org'),
    ('chris@ecsahc.org','s_sibandze@ecsahc.org'),
    ('hbani@ecsahc.org','s_sibandze@ecsahc.org'),
    ('mmhomi@ecsahc.org','s_sibandze@ecsahc.org'),
    ('helenak@ecsahc.org','mmhomi@ecsahc.org'),
    ('jackson@ecsahc.org','mmhomi@ecsahc.org'),
    ('mhanusi@ecsahc.org','mmhomi@ecsahc.org'),
    ('mherra@ecsahc.org','mmhomi@ecsahc.org'),
    ('mmari@ecsahc.org','mmhomi@ecsahc.org'),
    ('nlema@ecsahc.org','mmhomi@ecsahc.org'),
    ('asilumesii@ecsahc.org','mmungati@ecsahc.org'),
    ('ekataika@ecsahc.org','mmungati@ecsahc.org'),
    ('jkmasiye@ecsahc.org','mmungati@ecsahc.org'),
    ('mmohamed@ecsahc.org','mmungati@ecsahc.org'),
    ('smyeni@ecsahc.org','mmungati@ecsahc.org'),
    ('tchisenga@ecsahc.org','mmungati@ecsahc.org'),
    ('lnalomba@ecsahc.org','asilumesii@ecsahc.org'),
    ('murasa@ecsahc.org','asilumesii@ecsahc.org'),
    ('uletawo@ecsahc.org','smyeni@ecsahc.org'),
    ('dmarandu@ecsahc.org','jkmasiye@ecsahc.org'),
    ('emnjowe@ecsahc.org','ekataika@ecsahc.org'),
    ('kie.azam@ecsahc.org','mmohamed@ecsahc.org'),
    ('atimothy@ecsahc.org','mmohamed@ecsahc.org'),
    ('bmushi@ecsahc.org','mmohamed@ecsahc.org'),
    ('emeleke@ecsahc.org','mmohamed@ecsahc.org'),
    ('ewesangula@ecsahc.org','mmohamed@ecsahc.org'),
    ('sbiduda@ecsahc.org','mmohamed@ecsahc.org'),
    ('sbuguzi@ecsahc.org','mmohamed@ecsahc.org'),
    ('yohannesd@ecsahc.org','mmohamed@ecsahc.org'),
    ('jmartin@ecsahc.org','smasuka@ecsahc.org'),
    ('gmrina@ecsacog.org','judith@ecsacog.org'),
    ('adam@ecsahc.org','judith@ecsacog.org'),
    ('jtingai@ecsahc.org','lemmym@ecsahc.org')
  ) AS m(staff_email, sup_email)
  JOIN public.staff sup ON lower(sup.email) = lower(m.sup_email)
  WHERE lower(s.email) = lower(m.staff_email)
    AND s.id <> sup.id;

  -- 5. Link user_profiles -> staff by email (case-insensitive)
  UPDATE public.user_profiles up
  SET staff_id   = s.id,
      job_title  = COALESCE(NULLIF(up.job_title, ''), s.job_title),
      updated_at = CURRENT_TIMESTAMP
  FROM public.staff s
  WHERE lower(trim(up.email)) = lower(trim(s.email))
    AND s.email IS NOT NULL
    AND (up.staff_id IS DISTINCT FROM s.id);
  GET DIAGNOSTICS v_linked_email = ROW_COUNT;

  -- 6. Fallback: link remaining profiles by exact (case-insensitive) full name
  UPDATE public.user_profiles up
  SET staff_id   = s.id,
      updated_at = CURRENT_TIMESTAMP
  FROM public.staff s
  WHERE up.staff_id IS NULL
    AND upper(trim(up.full_name)) = upper(trim(s.full_name))
    AND trim(up.full_name) <> '';
  GET DIAGNOSTICS v_linked_name = ROW_COUNT;

  -- 7. Sync system_role from staff for linked profiles that are still at the default
  UPDATE public.user_profiles up
  SET system_role = s.system_role::text,
      updated_at  = CURRENT_TIMESTAMP
  FROM public.staff s
  WHERE up.staff_id = s.id
    AND s.system_role IS NOT NULL
    AND (up.system_role IS NULL OR up.system_role = '' OR up.system_role = 'staff_member');

  RAISE NOTICE 'Staff import: % inserted, % updated. Profiles linked by email: %, by name: %. Total staff: %, profiles still unlinked: %',
    v_inserted, v_updated, v_linked_email, v_linked_name,
    (SELECT COUNT(*) FROM public.staff),
    (SELECT COUNT(*) FROM public.user_profiles WHERE staff_id IS NULL);
END $$;

-- 8. Auto-link future / unlinked profiles on login-time profile changes (insert or email update)
CREATE OR REPLACE FUNCTION public.link_profile_to_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_staff_id UUID;
BEGIN
  IF NEW.staff_id IS NULL AND NEW.email IS NOT NULL THEN
    SELECT id INTO v_staff_id
    FROM public.staff
    WHERE lower(trim(email)) = lower(trim(NEW.email))
    LIMIT 1;

    IF v_staff_id IS NOT NULL THEN
      NEW.staff_id := v_staff_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_link_profile_to_staff ON public.user_profiles;
CREATE TRIGGER trg_link_profile_to_staff
BEFORE INSERT OR UPDATE OF email, staff_id ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.link_profile_to_staff();

-- 9. Refresh dashboard views so counts reflect the re-linked staff (ignore if unavailable)
DO $$
BEGIN
  PERFORM public.refresh_dashboard_views();
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Dashboard view refresh skipped: %', SQLERRM;
END $$;
