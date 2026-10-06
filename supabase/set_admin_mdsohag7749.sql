-- =============================================================================
-- Script: Promote mdsohag7749@gmail.com to Admin
-- Description: Run this script in Supabase Dashboard -> SQL Editor
-- =============================================================================

-- 1. Update existing profile to admin role
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'mdsohag7749@gmail.com';

-- 2. Verify the update
SELECT id, email, full_name, role, created_at
FROM public.profiles
WHERE email = 'mdsohag7749@gmail.com';
