-- =============================================================================
-- Script: Promote mdsohag7749@gmail.com to Admin (Failsafe & Self-Contained)
-- Description: Run this directly in Supabase Dashboard -> SQL Editor
-- =============================================================================

-- 1. Ensure user_role enum exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('user', 'admin');
  END IF;
END $$;

-- 2. Ensure role column exists in public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'user';

-- 3. Update protect_profile_role trigger function so SQL Editor / superuser can modify roles
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Database superuser (SQL Editor) and service_role can always assign/modify roles
  IF current_user IN ('postgres', 'supabase_admin') OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS NOT NULL AND NEW.role != 'user'::public.user_role THEN
      IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only administrators can assign elevated roles';
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only administrators can change user roles';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Temporarily disable trigger just in case
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_protect_profile_role') THEN
    ALTER TABLE public.profiles DISABLE TRIGGER trg_protect_profile_role;
  END IF;
END $$;

-- 5. Insert into profiles from auth.users (if signed up but profile missing) OR update existing profile
INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', 'Admin'), 'admin'::public.user_role
FROM auth.users
WHERE email = 'mdsohag7749@gmail.com'
ON CONFLICT (id) DO UPDATE 
SET role = 'admin'::public.user_role;

-- Also update existing profile row directly if email matches
UPDATE public.profiles
SET role = 'admin'::public.user_role
WHERE email = 'mdsohag7749@gmail.com';

-- 6. Re-enable trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_protect_profile_role') THEN
    ALTER TABLE public.profiles ENABLE TRIGGER trg_protect_profile_role;
  END IF;
END $$;

-- 7. Verification output: Show result
SELECT 
  p.id, 
  p.email, 
  p.full_name, 
  p.role, 
  p.created_at,
  CASE 
    WHEN p.role = 'admin' THEN 'SUCCESS: Admin role granted!'
    ELSE 'PENDING: User not found yet. Please sign up in the app first.'
  END AS status
FROM public.profiles p
WHERE p.email = 'mdsohag7749@gmail.com';
