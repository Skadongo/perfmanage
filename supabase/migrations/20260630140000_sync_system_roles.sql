-- Migration: Sync user_profiles.system_role from staff.system_role
-- This fixes all users whose user_profiles.system_role was stuck at the default 'staff_member'
-- even though their staff record has the correct role assigned.

DO $$
BEGIN
  -- Update user_profiles.system_role for every user that has a linked staff record
  -- with a non-null system_role. The staff table is the authoritative source.
  UPDATE public.user_profiles up
  SET
    system_role = s.system_role::text,
    updated_at  = NOW()
  FROM public.staff s
  WHERE up.staff_id = s.id
    AND s.system_role IS NOT NULL
    AND s.system_role::text <> ''
    AND (
      up.system_role IS NULL
      OR up.system_role = 'staff_member'
      OR up.system_role = ''
    );

  RAISE NOTICE 'Synced system_role from staff → user_profiles for % rows',
    (SELECT COUNT(*) FROM public.user_profiles up
     JOIN public.staff s ON up.staff_id = s.id
     WHERE s.system_role IS NOT NULL);
END;
$$;

-- Also ensure any user_profiles without a staff link but with a known email
-- that matches a staff email get linked and synced.
DO $$
BEGIN
  -- Link user_profiles to staff via email where staff_id is missing
  UPDATE public.user_profiles up
  SET
    staff_id    = s.id,
    system_role = s.system_role::text,
    job_title   = COALESCE(NULLIF(up.job_title, ''), s.job_title),
    updated_at  = NOW()
  FROM public.staff s
  WHERE up.staff_id IS NULL
    AND LOWER(up.email) = LOWER(s.email)
    AND s.system_role IS NOT NULL;

  RAISE NOTICE 'Linked and synced unlinked user_profiles via email match';
END;
$$;
