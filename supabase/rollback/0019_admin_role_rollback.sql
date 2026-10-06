-- =============================================================================
-- Rollback: 0019_admin_role_rollback.sql
-- Reverts: supabase/migrations/0019_admin_role.sql
-- Description: Safely removes all objects introduced by migration 0019.
--
-- SAFETY WARNING
-- --------------
-- * This script DOES NOT drop any user data rows.
-- * It removes the `role` column from profiles (the column value is lost
--   for all rows — see DATA-LOSS RISK below).
-- * It drops the `user_role` enum type.
-- * It drops the `is_admin()` function.
-- * It drops the `protect_profile_role` trigger and function.
-- * It drops the partial index idx_profiles_role_admin.
-- * It drops the two Admin Panel RLS policies.
-- * It does NOT touch any other table, column, policy, or function.
--
-- DATA-LOSS RISK
-- --------------
-- Dropping profiles.role destroys the role assignment for every user.
-- Before running this rollback:
--   1. Back up all admin user IDs:
--        SELECT id, email, role FROM public.profiles WHERE role = 'admin';
--   2. Save the output — you will need it to re-promote admins if you
--      re-apply the migration afterwards.
--
-- HOW TO USE
-- ----------
-- Paste into Supabase SQL Editor → New query and click Run, OR:
--   supabase db execute --file supabase/rollback/0019_admin_role_rollback.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- STEP R1: Drop Admin Panel RLS policies (must come before column/type drop)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all profiles"   ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- ---------------------------------------------------------------------------
-- STEP R2: Drop role protection trigger and function
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_profile_role();

-- ---------------------------------------------------------------------------
-- STEP R3: Revoke EXECUTE on is_admin() and drop the function
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM authenticated;
DROP FUNCTION IF EXISTS public.is_admin();

-- ---------------------------------------------------------------------------
-- STEP R4: Drop the partial index on admin role
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_profiles_role_admin;

-- ---------------------------------------------------------------------------
-- STEP R5: Drop the `role` column from profiles
-- ---------------------------------------------------------------------------
-- This is the only destructive step: the role value for every row is lost.
-- Ensure you have completed the backup in the DATA-LOSS RISK section above.
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS role;

-- ---------------------------------------------------------------------------
-- STEP R6: Drop the user_role enum type
-- ---------------------------------------------------------------------------
-- Must come after the column is dropped; Postgres refuses to drop a type
-- that is still referenced by a column.
DROP TYPE IF EXISTS public.user_role;

-- =============================================================================
-- Post-rollback verification checklist:
--   1. SELECT column_name FROM information_schema.columns
--      WHERE table_name = 'profiles' AND column_name = 'role';
--      → Must return 0 rows.
--   2. SELECT typname FROM pg_type WHERE typname = 'user_role';
--      → Must return 0 rows.
--   3. SELECT proname FROM pg_proc WHERE proname IN ('is_admin', 'protect_profile_role');
--      → Must return 0 rows.
--   4. SELECT indexname FROM pg_indexes
--      WHERE indexname = 'idx_profiles_role_admin';
--      → Must return 0 rows.
--   5. SELECT policyname FROM pg_policies
--      WHERE tablename = 'profiles'
--        AND policyname IN ('Admins can view all profiles',
--                           'Admins can update all profiles');
--      → Must return 0 rows.
--   6. Confirm normal user SELECT/INSERT/UPDATE still works via existing
--      0001 policies ("Profiles are viewable by their owner", etc.).
--
-- Re-apply procedure:
--   After rollback is verified, re-apply by running:
--     supabase/migrations/0019_admin_role.sql
--   Then re-promote any admin users using the IDs captured before rollback:
--     UPDATE public.profiles SET role = 'admin' WHERE id = '<uuid>';
-- =============================================================================
