-- ============================================================
-- Fix Staff Auth: Add missing auth.identities records
-- and ensure user_profiles exist for all staff.
-- Root cause: Previous migration inserted auth.users rows
-- but omitted auth.identities, which Supabase requires for
-- email/password sign-in to work.
-- ============================================================

DO $$
DECLARE
  v_user RECORD;
  v_default_pw TEXT := crypt('Ecsahc@2026', gen_salt('bf', 10));
BEGIN

  -- ── Step 1: Fix encrypted_password for all staff ──────────────────────────
  -- Reset to default password so all staff can sign in fresh.
  UPDATE auth.users
  SET
    encrypted_password = v_default_pw,
    updated_at = now()
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

  -- ── Step 2: Insert missing auth.identities for each staff user ────────────
  -- Supabase requires an identity record for email/password login.
  -- Without it, signInWithPassword always fails even if auth.users exists.
  FOR v_user IN
    SELECT id, email
    FROM auth.users
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
    )
  LOOP
    INSERT INTO auth.identities (
      id,
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user.id::TEXT,
      v_user.id,
      jsonb_build_object(
        'sub',   v_user.id::TEXT,
        'email', v_user.email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      now(),
      now(),
      now()
    )
    ON CONFLICT (provider_id, provider) DO NOTHING;
  END LOOP;

  -- ── Step 3: Ensure user_profiles exist for all staff ─────────────────────
  -- The handle_new_user trigger only fires on INSERT; existing rows need manual upsert.
  INSERT INTO public.user_profiles (id, email, full_name, role, system_role, must_change_password, is_active)
  SELECT
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
    CASE
      WHEN (au.raw_user_meta_data->>'role') = 'admin'    THEN 'admin'::public.user_role
      WHEN (au.raw_user_meta_data->>'role') = 'manager'  THEN 'manager'::public.user_role
      ELSE 'staff'::public.user_role
    END,
    COALESCE(au.raw_user_meta_data->>'system_role', 'staff_member'),
    true,
    true
  FROM auth.users au
  WHERE au.email IN (
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
  )
  ON CONFLICT (id) DO UPDATE SET
    email              = EXCLUDED.email,
    full_name          = EXCLUDED.full_name,
    role               = EXCLUDED.role,
    system_role        = EXCLUDED.system_role,
    must_change_password = true,
    is_active          = true,
    updated_at         = now();

  -- ── Step 4: Also handle staff whose auth.users rows were skipped ──────────
  -- The original migration used ON CONFLICT (email) DO NOTHING, so some staff
  -- may not have auth.users rows at all. Insert them now.
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  )
  SELECT
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    s.email,
    v_default_pw,
    now(), now(), now(),
    jsonb_build_object(
      'full_name',           s.full_name,
      'role',                s.role_val,
      'system_role',         s.system_role_val,
      'must_change_password', true
    ),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
    false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
  FROM (VALUES
    ('ntuli.kapologwe@ecsahc.org',  'Ntuli A. Kapologwe',             'admin',   'executive_director'),
    ('mmungati@ecsahc.org',         'More Mungati',                   'manager', 'programme_manager'),
    ('lnjuba@ecsahc.org',           'Lilliane Brenda Namutebi Njuba', 'manager', 'finance_manager'),
    ('omwandumbya@ecsahc.org',      'Owen David Mwandumbya',          'staff',   'programme_officer'),
    ('s_sibandze@ecsahc.org',       'Sibusiso Bafana Sibandze',       'manager', 'programme_manager'),
    ('situngu@cosecsa.org',         'Stella Itungu',                  'manager', 'programme_manager'),
    ('apascal@cosecsa.org',         'Amani Paskal Uiso',              'staff',   'programme_officer'),
    ('dianaK@cosecsa.org',          'Diana Geras Kaiza',              'staff',   'admin_officer'),
    ('Davish@cosecsa.org',          'Davis Hyacinth Kondamwali',      'staff',   'admin_officer'),
    ('efoya@cosecsa.org',           'Edna Herman Foya',               'staff',   'admin_officer'),
    ('gsama@cosecsa.org',           'Godfrey Philipo Sama',           'staff',   'programme_officer'),
    ('lkisanga@cosecsa.org',        'Laurence Paul Kisanga',          'staff',   'admin_officer'),
    ('nbachheta@cosecsa.org',       'Niraj Suresh Bachheta',          'staff',   'programme_officer'),
    ('jomongole@cosecsa.org',       'Jonathan Omongole',              'staff',   'finance_officer'),
    ('cmapunda@ecsahc.org',         'Cavin Charles Mapunda',          'staff',   'finance_officer'),
    ('dnjenga@ecsahc.org',          'Darcy Ellison Njenga',           'staff',   'finance_officer'),
    ('mchibuna@ecsahc.org',         'Chibuna Muteto',                 'staff',   'finance_officer'),
    ('mgolugwa@ecsahc.org',         'Mariam Sam Golugwa',             'staff',   'finance_officer'),
    ('pmatemba@ecsahc.org',         'Prisca Paul Matemba',            'staff',   'finance_officer'),
    ('chris@ecsahc.org',            'Christopher August Minja',       'staff',   'admin_officer'),
    ('hbani@ecsahc.org',            'Hamis Athuman Bani',             'staff',   'admin_officer'),
    ('mmhomi@ecsahc.org',           'Mary Charles Mhomi',             'admin',   'hr_admin_officer'),
    ('asilumesii@ecsahc.org',       'Andrew Nkhulo Silumesii',        'manager', 'programme_manager'),
    ('ekataika@ecsahc.org',         'Edward Thomas Kataika',          'manager', 'programme_manager'),
    ('jkmasiye@ecsahc.org',         'Jones Kaponda Masiye',           'manager', 'programme_manager'),
    ('mmohamed@ecsahc.org',         'Mohamed Ally Mohamed',           'staff',   'project_coordinator'),
    ('smyeni@ecsahc.org',           'Sebentile Myeni',                'manager', 'programme_manager'),
    ('tchisenga@ecsahc.org',        'Tina Chisenga',                  'manager', 'programme_manager'),
    ('lnalomba@ecsahc.org',         'Lutinala Nachiembo Nalomba',     'staff',   'programme_officer'),
    ('murasa@ecsahc.org',           'Miriam Japhet Urasa',            'staff',   'programme_officer'),
    ('dmarandu@ecsahc.org',         'Doreen Marandu',                 'staff',   'programme_officer'),
    ('uletawo@ecsahc.org',          'Upendo Barnabas Letawo',         'staff',   'programme_officer'),
    ('emnjowe@ecsahc.org',          'Emmanuel Mnjowe',                'staff',   'programme_officer'),
    ('kie.azam@ecsahc.org',         'Khalid Esmail Issufo Azam',      'staff',   'programme_officer'),
    ('atimothy@ecsahc.org',         'Timothy Ayebare',                'staff',   'programme_officer'),
    ('bmushi@ecsahc.org',           'Benedict Pius Mushi',            'staff',   'programme_officer'),
    ('emeleke@ecsahc.org',          'Eveness Lydia Zuze Meleke',      'staff',   'programme_officer'),
    ('ewesangula@ecsahc.org',       'Evelyn Nelima Wesangula',        'staff',   'programme_officer'),
    ('sbiduda@ecsahc.org',          'Stephen Fadson Biduda',          'staff',   'programme_officer'),
    ('sbuguzi@ecsahc.org',          'Syriacus Buguzi',                'staff',   'project_coordinator'),
    ('yohannesd@ecsahc.org',        'Yohannes Dugasa Feyisa',         'staff',   'programme_officer'),
    ('helenak@ecsahc.org',          'Helena Nicetas Kilawe',          'staff',   'admin_officer'),
    ('jackson@ecsahc.org',          'Jackson Salehe Zarifu',          'staff',   'admin_officer'),
    ('mhanusi@ecsahc.org',          'Christina Samwel Mhanusi',       'staff',   'admin_officer'),
    ('mherra@ecsahc.org',           'Mwamvua Herra Wisiko',           'staff',   'admin_officer'),
    ('mmari@ecsahc.org',            'Valentino Joachim Mmari',        'staff',   'admin_officer'),
    ('nlema@ecsahc.org',            'Neema Sia Lema',                 'staff',   'admin_officer'),
    ('judith@ecsacog.org',          'Judith Andrew Mroso',            'staff',   'programme_officer'),
    ('lemmym@ecsahc.org',           'Lemmy Medard Mabuga',            'staff',   'programme_officer'),
    ('smasuka@ecsahc.org',          'Sophia Costantine Masuka',       'staff',   'admin_officer'),
    ('jmartin@ecsahc.org',          'James Aloyce Martin',            'staff',   'admin_officer'),
    ('gmrina@ecsacog.org',          'Gasper Goodchance Mrina',        'staff',   'finance_officer'),
    ('adam@ecsahc.org',             'Adam Simon Kanyonyi',            'staff',   'admin_officer'),
    ('jtingai@ecsahc.org',          'Julius Tingai',                  'staff',   'admin_officer')
  ) AS s(email, full_name, role_val, system_role_val)
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.email = s.email
  );

  -- ── Step 5: Insert identities for any newly inserted users (Step 4) ───────
  FOR v_user IN
    SELECT id, email
    FROM auth.users
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
    )
    AND NOT EXISTS (
      SELECT 1 FROM auth.identities ai
      WHERE ai.user_id = auth.users.id AND ai.provider = 'email'
    )
  LOOP
    INSERT INTO auth.identities (
      id,
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user.id::TEXT,
      v_user.id,
      jsonb_build_object(
        'sub',   v_user.id::TEXT,
        'email', v_user.email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      now(),
      now(),
      now()
    )
    ON CONFLICT (provider_id, provider) DO NOTHING;
  END LOOP;

  -- ── Step 6: Ensure user_profiles for any newly inserted users ────────────
  INSERT INTO public.user_profiles (id, email, full_name, role, system_role, must_change_password, is_active)
  SELECT
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
    CASE
      WHEN (au.raw_user_meta_data->>'role') = 'admin'    THEN 'admin'::public.user_role
      WHEN (au.raw_user_meta_data->>'role') = 'manager'  THEN 'manager'::public.user_role
      ELSE 'staff'::public.user_role
    END,
    COALESCE(au.raw_user_meta_data->>'system_role', 'staff_member'),
    true,
    true
  FROM auth.users au
  WHERE au.email IN (
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
  )
  ON CONFLICT (id) DO UPDATE SET
    email                = EXCLUDED.email,
    full_name            = EXCLUDED.full_name,
    role                 = EXCLUDED.role,
    system_role          = EXCLUDED.system_role,
    must_change_password = true,
    is_active            = true,
    updated_at           = now();

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Fix staff auth error: %', SQLERRM;
END $$;
