-- ============================================================
-- Staff Auth Logins: Create auth accounts for all 54 staff
-- Default password: Ecsahc@2026 (must change on first login)
-- ============================================================

DO $$
DECLARE
  -- Leadership / Executive Level
  v_ntuli       UUID := gen_random_uuid();
  v_more        UUID := gen_random_uuid();
  v_lilliane    UUID := gen_random_uuid();
  v_owen        UUID := gen_random_uuid();
  v_sibusiso    UUID := gen_random_uuid();

  -- COSECSA
  v_stella      UUID := gen_random_uuid();
  v_amani       UUID := gen_random_uuid();
  v_diana       UUID := gen_random_uuid();
  v_davis       UUID := gen_random_uuid();
  v_edna        UUID := gen_random_uuid();
  v_godfrey     UUID := gen_random_uuid();
  v_laurence    UUID := gen_random_uuid();
  v_niraj       UUID := gen_random_uuid();
  v_jonathan    UUID := gen_random_uuid();

  -- Finance Directorate
  v_cavin       UUID := gen_random_uuid();
  v_darcy       UUID := gen_random_uuid();
  v_chibuna     UUID := gen_random_uuid();
  v_mariam      UUID := gen_random_uuid();
  v_prisca      UUID := gen_random_uuid();

  -- Operations and Institutional Development
  v_christopher UUID := gen_random_uuid();
  v_hamis       UUID := gen_random_uuid();
  v_mary        UUID := gen_random_uuid();

  -- Programmes Directorate
  v_andrew      UUID := gen_random_uuid();
  v_edward      UUID := gen_random_uuid();
  v_jones       UUID := gen_random_uuid();
  v_mohamed     UUID := gen_random_uuid();
  v_sebentile   UUID := gen_random_uuid();
  v_tina        UUID := gen_random_uuid();
  v_lutinala    UUID := gen_random_uuid();
  v_miriam      UUID := gen_random_uuid();
  v_doreen      UUID := gen_random_uuid();
  v_upendo      UUID := gen_random_uuid();
  v_emmanuel    UUID := gen_random_uuid();
  v_khalid      UUID := gen_random_uuid();
  v_timothy     UUID := gen_random_uuid();
  v_benedict    UUID := gen_random_uuid();
  v_eveness     UUID := gen_random_uuid();
  v_evelyn      UUID := gen_random_uuid();
  v_stephen     UUID := gen_random_uuid();
  v_syriacus    UUID := gen_random_uuid();
  v_yohannes    UUID := gen_random_uuid();

  -- Administration and Support
  v_helena      UUID := gen_random_uuid();
  v_jackson     UUID := gen_random_uuid();
  v_christina   UUID := gen_random_uuid();
  v_mwamvua     UUID := gen_random_uuid();
  v_valentino   UUID := gen_random_uuid();
  v_neema       UUID := gen_random_uuid();

  -- College-Affiliated Units
  v_judith      UUID := gen_random_uuid();
  v_lemmy       UUID := gen_random_uuid();
  v_sophia      UUID := gen_random_uuid();
  v_james       UUID := gen_random_uuid();
  v_gasper      UUID := gen_random_uuid();
  v_adam        UUID := gen_random_uuid();
  v_julius      UUID := gen_random_uuid();

  v_default_pw  TEXT := crypt('Ecsahc@2026', gen_salt('bf', 10));

BEGIN

  -- ── Leadership / Executive Level ──────────────────────────────────────────

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES
    (v_ntuli, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'ntuli.kapologwe@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Ntuli A. Kapologwe', 'role', 'admin', 'system_role', 'executive_director', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_more, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'mmungati@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'More Mungati', 'role', 'manager', 'system_role', 'programme_manager', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_lilliane, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'lnjuba@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Lilliane Brenda Namutebi Njuba', 'role', 'manager', 'system_role', 'finance_manager', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_owen, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'omwandumbya@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Owen David Mwandumbya', 'role', 'staff', 'system_role', 'programme_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_sibusiso, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     's_sibandze@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Sibusiso Bafana Sibandze', 'role', 'manager', 'system_role', 'programme_manager', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)

  ON CONFLICT (email) DO NOTHING;

  -- ── COSECSA ───────────────────────────────────────────────────────────────

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES
    (v_stella, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'situngu@cosecsa.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Stella Itungu', 'role', 'manager', 'system_role', 'programme_manager', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_amani, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'apascal@cosecsa.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Amani Paskal Uiso', 'role', 'staff', 'system_role', 'programme_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_diana, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'dianaK@cosecsa.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Diana Geras Kaiza', 'role', 'staff', 'system_role', 'admin_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_davis, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'Davish@cosecsa.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Davis Hyacinth Kondamwali', 'role', 'staff', 'system_role', 'admin_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_edna, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'efoya@cosecsa.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Edna Herman Foya', 'role', 'staff', 'system_role', 'admin_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_godfrey, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'gsama@cosecsa.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Godfrey Philipo Sama', 'role', 'staff', 'system_role', 'programme_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_laurence, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'lkisanga@cosecsa.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Laurence Paul Kisanga', 'role', 'staff', 'system_role', 'admin_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_niraj, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'nbachheta@cosecsa.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Niraj Suresh Bachheta', 'role', 'staff', 'system_role', 'programme_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_jonathan, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'jomongole@cosecsa.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Jonathan Omongole', 'role', 'staff', 'system_role', 'finance_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)

  ON CONFLICT (email) DO NOTHING;

  -- ── Finance Directorate ───────────────────────────────────────────────────

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES
    (v_cavin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'cmapunda@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Cavin Charles Mapunda', 'role', 'staff', 'system_role', 'finance_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_darcy, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'dnjenga@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Darcy Ellison Njenga', 'role', 'staff', 'system_role', 'finance_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_chibuna, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'mchibuna@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Chibuna Muteto', 'role', 'staff', 'system_role', 'finance_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_mariam, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'mgolugwa@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Mariam Sam Golugwa', 'role', 'staff', 'system_role', 'finance_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_prisca, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'pmatemba@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Prisca Paul Matemba', 'role', 'staff', 'system_role', 'finance_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)

  ON CONFLICT (email) DO NOTHING;

  -- ── Operations and Institutional Development ──────────────────────────────

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES
    (v_christopher, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'chris@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Christopher August Minja', 'role', 'staff', 'system_role', 'admin_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_hamis, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'hbani@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Hamis Athuman Bani', 'role', 'staff', 'system_role', 'admin_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_mary, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'mmhomi@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Mary Charles Mhomi', 'role', 'admin', 'system_role', 'hr_admin_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)

  ON CONFLICT (email) DO NOTHING;

  -- ── Programmes Directorate ────────────────────────────────────────────────

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES
    (v_andrew, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'asilumesii@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Andrew Nkhulo Silumesii', 'role', 'manager', 'system_role', 'programme_manager', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_edward, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'ekataika@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Edward Thomas Kataika', 'role', 'manager', 'system_role', 'programme_manager', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_jones, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'jkmasiye@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Jones Kaponda Masiye', 'role', 'manager', 'system_role', 'programme_manager', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_mohamed, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'mmohamed@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Mohamed Ally Mohamed', 'role', 'staff', 'system_role', 'project_coordinator', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_sebentile, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'smyeni@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Sebentile Myeni', 'role', 'manager', 'system_role', 'programme_manager', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_tina, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'tchisenga@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Tina Chisenga', 'role', 'manager', 'system_role', 'programme_manager', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_lutinala, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'lnalomba@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Lutinala Nachiembo Nalomba', 'role', 'staff', 'system_role', 'programme_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_miriam, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'murasa@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Miriam Japhet Urasa', 'role', 'staff', 'system_role', 'programme_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_doreen, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'dmarandu@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Doreen Marandu', 'role', 'staff', 'system_role', 'programme_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_upendo, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'uletawo@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Upendo Barnabas Letawo', 'role', 'staff', 'system_role', 'programme_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_emmanuel, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'emnjowe@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Emmanuel Mnjowe', 'role', 'staff', 'system_role', 'programme_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_khalid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'kie.azam@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Khalid Esmail Issufo Azam', 'role', 'staff', 'system_role', 'programme_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_timothy, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'atimothy@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Timothy Ayebare', 'role', 'staff', 'system_role', 'programme_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_benedict, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'bmushi@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Benedict Pius Mushi', 'role', 'staff', 'system_role', 'programme_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_eveness, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'emeleke@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Eveness Lydia Zuze Meleke', 'role', 'staff', 'system_role', 'programme_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_evelyn, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'ewesangula@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Evelyn Nelima Wesangula', 'role', 'staff', 'system_role', 'programme_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_stephen, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'sbiduda@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Stephen Fadson Biduda', 'role', 'staff', 'system_role', 'programme_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_syriacus, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'sbuguzi@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Syriacus Buguzi', 'role', 'staff', 'system_role', 'project_coordinator', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_yohannes, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'yohannesd@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Yohannes Dugasa Feyisa', 'role', 'staff', 'system_role', 'programme_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)

  ON CONFLICT (email) DO NOTHING;

  -- ── Administration and Support ────────────────────────────────────────────

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES
    (v_helena, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'helenak@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Helena Nicetas Kilawe', 'role', 'staff', 'system_role', 'admin_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_jackson, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'jackson@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Jackson Salehe Zarifu', 'role', 'staff', 'system_role', 'admin_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_christina, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'mhanusi@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Christina Samwel Mhanusi', 'role', 'staff', 'system_role', 'admin_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_mwamvua, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'mherra@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Mwamvua Herra Wisiko', 'role', 'staff', 'system_role', 'admin_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_valentino, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'mmari@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Valentino Joachim Mmari', 'role', 'staff', 'system_role', 'admin_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_neema, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'nlema@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Neema Sia Lema', 'role', 'staff', 'system_role', 'admin_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)

  ON CONFLICT (email) DO NOTHING;

  -- ── College-Affiliated Units ───────────────────────────────────────────────

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES
    (v_judith, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'judith@ecsacog.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Judith Andrew Mroso', 'role', 'staff', 'system_role', 'programme_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_lemmy, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'lemmym@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Lemmy Medard Mabuga', 'role', 'staff', 'system_role', 'programme_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_sophia, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'smasuka@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Sophia Costantine Masuka', 'role', 'staff', 'system_role', 'admin_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_james, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'jmartin@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'James Aloyce Martin', 'role', 'staff', 'system_role', 'admin_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_gasper, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'gmrina@ecsacog.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Gasper Goodchance Mrina', 'role', 'staff', 'system_role', 'finance_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_adam, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'adam@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Adam Simon Kanyonyi', 'role', 'staff', 'system_role', 'admin_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),

    (v_julius, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'jtingai@ecsahc.org', v_default_pw, now(), now(), now(),
     jsonb_build_object('full_name', 'Julius Tingai', 'role', 'staff', 'system_role', 'admin_officer', 'must_change_password', true),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)

  ON CONFLICT (email) DO NOTHING;

  -- ── Ensure must_change_password = true in user_profiles for all staff ─────
  -- (trigger may have set it to false; override for all newly created staff)
  UPDATE public.user_profiles
  SET must_change_password = true
  WHERE email IN (
    'ntuli.kapologwe@ecsahc.org', 'mmungati@ecsahc.org', 'lnjuba@ecsahc.org',
    'omwandumbya@ecsahc.org', 's_sibandze@ecsahc.org',
    'situngu@cosecsa.org', 'apascal@cosecsa.org', 'dianaK@cosecsa.org',
    'Davish@cosecsa.org', 'efoya@cosecsa.org', 'gsama@cosecsa.org',
    'lkisanga@cosecsa.org', 'nbachheta@cosecsa.org', 'jomongole@cosecsa.org',
    'cmapunda@ecsahc.org', 'dnjenga@ecsahc.org', 'mchibuna@ecsahc.org',
    'mgolugwa@ecsahc.org', 'pmatemba@ecsahc.org',
    'chris@ecsahc.org', 'hbani@ecsahc.org', 'mmhomi@ecsahc.org',
    'asilumesii@ecsahc.org', 'ekataika@ecsahc.org', 'jkmasiye@ecsahc.org',
    'mmohamed@ecsahc.org', 'smyeni@ecsahc.org', 'tchisenga@ecsahc.org',
    'lnalomba@ecsahc.org', 'murasa@ecsahc.org', 'dmarandu@ecsahc.org',
    'uletawo@ecsahc.org', 'emnjowe@ecsahc.org', 'kie.azam@ecsahc.org',
    'atimothy@ecsahc.org', 'bmushi@ecsahc.org', 'emeleke@ecsahc.org',
    'ewesangula@ecsahc.org', 'sbiduda@ecsahc.org', 'sbuguzi@ecsahc.org',
    'yohannesd@ecsahc.org',
    'helenak@ecsahc.org', 'jackson@ecsahc.org', 'mhanusi@ecsahc.org',
    'mherra@ecsahc.org', 'mmari@ecsahc.org', 'nlema@ecsahc.org',
    'judith@ecsacog.org', 'lemmym@ecsahc.org', 'smasuka@ecsahc.org',
    'jmartin@ecsahc.org', 'gmrina@ecsacog.org', 'adam@ecsahc.org',
    'jtingai@ecsahc.org'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Staff auth creation error: %', SQLERRM;
END $$;
