# Admin Panel Architecture

> **Document scope:** Database schema, Row Level Security design, and migration rollback procedures for the EdgeJournal Admin Panel feature.
>
> Last updated: 2026-10-06 · Migration: `0019_admin_role`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Database Schema Changes](#2-database-schema-changes)
3. [Access Control Matrix](#3-access-control-matrix)
4. [Migration Reference](#4-migration-reference)
5. [Rollback Documentation](#5-rollback-documentation)
6. [Operational Runbook](#6-operational-runbook)
7. [Known Limitations and Future Work](#7-known-limitations-and-future-work)
8. [Phase 2: Admin Frontend Shell & Overview Dashboard](#8-phase-2-admin-frontend-shell--overview-dashboard)
9. [Phase 3: User Management](#9-phase-3-user-management)
10. [Phase 4: Trading Account & Trade Management](#10-phase-4--trading-account--trade-management)
11. [Phase 5: Advanced Trade Analytics & Performance Intelligence](#11-phase-5--advanced-trade-analytics--performance-intelligence)
12. [Phase 6: Platform Reports, Data Export & Audit Architecture](#12-phase-6--platform-reports-data-export--audit-architecture)
13. [Phase 7: Subscriptions, Plans & Entitlements](#13-phase-7--subscriptions-plans--entitlements)

---

## 1. Overview

The Admin Panel adds a first-class role system to EdgeJournal. A single `role` column on the `profiles` table controls all elevated access. Access is enforced at the database layer via Postgres Row Level Security and database triggers — the client application cannot bypass it.

**Design principles:**

- **Least privilege by default** — every new signup gets `role = 'user'`.
- **Server-enforced** — RLS, database triggers (`protect_profile_role`), and a `SECURITY DEFINER` helper function (`is_admin()`) ensure clients cannot self-elevate.
- **Additive, non-destructive** — migration 0019 only adds objects; it never modifies or drops anything that existed before.
- **Idempotent** — every DDL statement uses `IF NOT EXISTS` / `CREATE OR REPLACE` so the migration can be safely re-applied without errors.

---

## 2. Database Schema Changes

### 2.1 `user_role` enum

**File:** `supabase/migrations/0019_admin_role.sql`

```sql
CREATE TYPE public.user_role AS ENUM ('user', 'admin');
```

| Attribute | Value |
|-----------|-------|
| Schema | `public` |
| Name | `user_role` |
| Values | `'user'`, `'admin'` |
| Created by | Migration 0019 |
| Depends on | Nothing |
| Depended on by | `profiles.role` column, `is_admin()` function |

**Rollback:** `DROP TYPE public.user_role;` (must drop `profiles.role` column first).

---

### 2.2 `profiles.role` column

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'user';
```

| Attribute | Value |
|-----------|-------|
| Table | `public.profiles` |
| Column | `role` |
| Type | `public.user_role` |
| Nullable | `NOT NULL` |
| Default | `'user'` |
| Backfill | Automatic — Postgres evaluates `DEFAULT` for all existing rows on `ADD COLUMN` |

**Rollback:** `ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;`

> **Data-loss risk:** Dropping this column destroys all role assignments. See Section 5.5.

---

### 2.3 `is_admin()` helper function

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
```

| Attribute | Value |
|-----------|-------|
| Schema | `public` |
| Name | `is_admin` |
| Returns | `boolean` |
| Volatility | `STABLE` |
| Security | `SECURITY DEFINER` — runs as owner, not caller |
| `search_path` | `''` — injection-safe |
| Granted to | `authenticated` role only (revoked from `PUBLIC`) |

**Why SECURITY DEFINER:** The function reads `public.profiles`. It runs as its owner (postgres/service role) to avoid a circular RLS dependency where a policy calls a function that itself needs a policy to resolve.

**Rollback:**

```sql
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM authenticated;
DROP FUNCTION IF EXISTS public.is_admin();
```

---

### 2.4 Partial index

```sql
CREATE INDEX IF NOT EXISTS idx_profiles_role_admin
  ON public.profiles (id)
  WHERE role = 'admin';
```

| Attribute | Value |
|-----------|-------|
| Index name | `idx_profiles_role_admin` |
| Table | `public.profiles` |
| Column | `id` |
| Condition | `WHERE role = 'admin'` |
| Purpose | Keeps `is_admin()` lookups fast — only indexes the tiny admin subset |

**Rollback:** `DROP INDEX IF EXISTS public.idx_profiles_role_admin;`

---

### 2.5 Role protection trigger (`protect_profile_role`)

```sql
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
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

CREATE TRIGGER trg_protect_profile_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();
```

Enforces that unauthenticated and regular users cannot self-elevate by submitting `UPDATE profiles SET role = 'admin'` or inserting rows with elevated privileges.

**Rollback:**

```sql
DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_profile_role();
```

---

### 2.6 RLS policies

Two new policies are added to `public.profiles`. Existing 0001-era policies are **not modified**.

**Policy A — "Admins can view all profiles"**

```sql
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin());
```

Allows admins to `SELECT` any profile row (needed by the Admin Panel user list). Normal users are unaffected — they remain covered by the 0001 policy.

**Policy B — "Admins can update all profiles"**

```sql
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
```

Allows admins to `UPDATE` any profile row (e.g., promoting or demoting a user).

**Rollback:**

```sql
DROP POLICY IF EXISTS "Admins can view all profiles"   ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
```

---

## 3. Access Control Matrix

| Operation | Normal user (role = user) | Admin (role = admin) | Unauthenticated |
|-----------|--------------------------|----------------------|-----------------|
| SELECT own profile | Yes (0001 policy) | Yes (0001 policy) | No |
| SELECT any profile | No | Yes (0019 policy A) | No |
| INSERT own profile | Yes (0001 policy) | Yes (0001 policy) | No |
| UPDATE own profile (non-role fields) | Yes (0001 policy) | Yes (0001 policy) | No |
| UPDATE role = 'admin' | **Blocked** (0019 trigger) | Yes | **Blocked** |
| UPDATE any profile | No | Yes (0019 policy B) | No |
| DELETE own profile | Yes (0001 policy) | Yes (0001 policy) | No |
| Call is_admin() | Yes (returns false) | Yes (returns true) | No (revoked from PUBLIC) |

---

## 4. Migration Reference

| Field | Value |
|-------|-------|
| Migration name | `0019_admin_role` |
| File | `supabase/migrations/0019_admin_role.sql` |
| Rollback file | `supabase/rollback/0019_admin_role_rollback.sql` |
| Applies after | `0018_trade_psychology.sql` |
| Hard dependency | `0001_profiles_and_trades.sql` (profiles table must exist) |
| Is destructive? | No — additive only |
| Is idempotent? | Yes — all statements use `IF NOT EXISTS` / `CREATE OR REPLACE` |
| Estimated runtime | Less than 1 second (schema-only; backfill is instant in Postgres via ADD COLUMN DEFAULT) |

### Objects created by migration 0019

| Object type | Name | Notes |
|-------------|------|-------|
| Enum type | `public.user_role` | Values: 'user', 'admin' |
| Column | `public.profiles.role` | user_role NOT NULL DEFAULT 'user' |
| Function | `public.is_admin()` | SECURITY DEFINER, STABLE |
| Function | `public.protect_profile_role()` | SECURITY DEFINER, plpgsql |
| Trigger | `trg_protect_profile_role` | BEFORE INSERT OR UPDATE ON profiles |
| Index | `idx_profiles_role_admin` | Partial — admin rows only |
| RLS policy | "Admins can view all profiles" | FOR SELECT |
| RLS policy | "Admins can update all profiles" | FOR UPDATE |
| Grant | EXECUTE ON is_admin() TO authenticated | |

### Objects modified by migration 0019

_None._ Migration 0019 is purely additive.

---

## 5. Rollback Documentation

> **Important:** Do not claim a migration is rollback-safe unless the rollback procedure has been tested against a disposable or staging database that mirrors production. The procedure below is designed for correctness; verify it in your environment before trusting it in production.

### 5.1 Migration name / version

`0019_admin_role` — applies to the Supabase project schema after `0018_trade_psychology`.

### 5.2 What the migration changes

1. Creates `public.user_role` enum.
2. Adds `public.profiles.role` column (NOT NULL DEFAULT 'user').
3. Creates `public.is_admin()` SECURITY DEFINER function.
4. Grants EXECUTE on `is_admin()` strictly to `authenticated`.
5. Creates partial index `idx_profiles_role_admin`.
6. Creates `protect_profile_role` trigger on `public.profiles`.
7. Creates two RLS policies on `public.profiles`.

### 5.3 Dependencies

| Dependency | Direction | Notes |
|------------|-----------|-------|
| `public.profiles` table | Upstream (must exist) | Created by 0001 |
| `auth.uid()` function | Upstream (must exist) | Provided by Supabase Auth |
| Any future migration reading `profiles.role` | Downstream | Must be rolled back before 0019 |
| Admin Panel application code | Downstream | Must be feature-flagged off before rollback |

### 5.4 Rollback steps

**Pre-requisites before running the rollback:**

1. Feature-flag or disable the Admin Panel so no running instance calls `is_admin()` during rollback.
2. Back up all current admin user IDs (role values are destroyed on rollback):

```sql
SELECT id, email, role FROM public.profiles WHERE role = 'admin';
```

Save this output securely — you need it to re-promote admins after re-applying the migration.

3. Confirm no later migration (0020+) depends on `profiles.role` or `is_admin()`. Roll those back first if they exist.

**Execute the rollback:**

```bash
# Option A — Supabase CLI
supabase db execute --file supabase/rollback/0019_admin_role_rollback.sql

# Option B — Supabase Dashboard
# SQL Editor > New query > paste supabase/rollback/0019_admin_role_rollback.sql > Run
```

**What the rollback script does (in order):**

```sql
-- R1: Remove admin RLS policies
DROP POLICY IF EXISTS "Admins can view all profiles"   ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- R2: Drop role protection trigger and function
DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_profile_role();

-- R3: Revoke function grant and drop function
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM authenticated;
DROP FUNCTION IF EXISTS public.is_admin();

-- R4: Drop partial index
DROP INDEX IF EXISTS public.idx_profiles_role_admin;

-- R5: Drop role column  !! DATA LOSS — role values are destroyed !!
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- R6: Drop user_role enum
DROP TYPE IF EXISTS public.user_role;
```

Each step uses `IF EXISTS` so partial-run re-execution is safe.

### 5.5 Data-loss risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| `profiles.role` column dropped — all role assignments lost | Medium | Back up admin UUIDs before rollback (Section 5.4) |
| New signups after migration (have role = 'user') | None | No action needed |
| Existing user data (trades, goals, plans, reflections, study notes) | None | Migration 0019 only touches `profiles.role` |
| `user_role` enum dropped — no standalone stored data | None | Values only exist as column values, removed in R5 |

### 5.6 Potential production impact

| Impact | Description | Mitigation |
|--------|-------------|------------|
| Admin Panel becomes unavailable | `is_admin()` no longer exists — code calling it will error | Feature-flag Admin Panel off before rollback |
| Admins lose elevated access | "Admins can view all profiles" policy removed | Expected rollback state; re-apply migration to restore |
| Normal users unaffected | 0001-era policies untouched | No action needed |
| Supabase Auth unaffected | Auth is a separate service | No action needed |
| App 500 errors if Admin Panel not disabled | Postgres returns function-not-found on is_admin() calls | Disable Admin Panel before rollback |

### 5.7 Verification steps after rollback

Run these queries in the Supabase SQL Editor:

```sql
-- 1. role column must not exist
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role';
-- Expected: 0 rows

-- 2. user_role enum must not exist
SELECT typname FROM pg_type WHERE typname = 'user_role';
-- Expected: 0 rows

-- 3. is_admin() function must not exist
SELECT proname FROM pg_proc WHERE proname IN ('is_admin', 'protect_profile_role');
-- Expected: 0 rows

-- 4. Partial index must not exist
SELECT indexname FROM pg_indexes WHERE indexname = 'idx_profiles_role_admin';
-- Expected: 0 rows

-- 5. Admin Panel policies must not exist
SELECT policyname FROM pg_policies
WHERE tablename = 'profiles'
  AND policyname IN ('Admins can view all profiles','Admins can update all profiles');
-- Expected: 0 rows

-- 6. Pre-existing 0001 policies must still exist
SELECT policyname FROM pg_policies WHERE tablename = 'profiles';
-- Expected: original policies intact

-- 7. Normal user access smoke-test (as authenticated user, not service role)
SELECT id, email FROM public.profiles WHERE id = auth.uid();
-- Expected: current user's own profile row returned
```

### 5.8 Re-apply procedure

After rollback is verified, re-apply cleanly:

```bash
# Option A — Supabase CLI
supabase db execute --file supabase/migrations/0019_admin_role.sql

# Option B — Supabase Dashboard
# Paste supabase/migrations/0019_admin_role.sql > Run
```

Then re-promote any admins using the UUIDs saved in Section 5.4:

```sql
UPDATE public.profiles SET role = 'admin' WHERE id = '<admin-user-uuid>';
SELECT id, email, role FROM public.profiles WHERE role = 'admin';
```

Run the post-migration checklist at the bottom of `0019_admin_role.sql` to confirm success.

---

## 6. Operational Runbook

### 6.1 Promote a user to admin

```sql
-- Run as service role (Supabase SQL Editor, not via client)
UPDATE public.profiles SET role = 'admin' WHERE id = '<target-user-uuid>';
```

### 6.2 Demote an admin to regular user

```sql
UPDATE public.profiles SET role = 'user' WHERE id = '<target-user-uuid>';
```

### 6.3 List all admins

```sql
SELECT id, email, full_name, created_at
FROM public.profiles WHERE role = 'admin' ORDER BY created_at;
```

### 6.4 Test is_admin() for a specific user

Sign in as that user in a test Supabase client, then run:

```sql
SELECT public.is_admin();
-- true if the signed-in user has role = 'admin', false otherwise
```

### 6.5 Migration execution order

| Order | File | Notes |
|-------|------|-------|
| 1 | `0001_profiles_and_trades.sql` | Required — creates `profiles` table |
| 2 | `0002_goals.sql` | Independent |
| 3 | `0003_premarket_plans.sql` | Independent |
| 4 | `0004_reflections.sql` | Independent |
| 5 | `0005_study_notes.sql` | Independent |
| 6 | `0006_profile_fields.sql` | Extends profiles with username, avatar_url, bio, timezone |
| 7 | `0007_avatar_storage.sql` | Storage bucket for avatars |
| 8 | `0008_trade_screenshots.sql` | Screenshots bucket and trade image fields |
| 9 | `0009_trade_direction_session_timeframe.sql` | Adds direction, session, timeframe |
| 10 | `0010_trade_screenshots_limit_10.sql` | Screenshot limits |
| 11 | `0011_trade_professional_fields.sql` | Professional trading fields |
| 12 | `0012_fix_constraints_and_indexes.sql` | Constraint fixes |
| 13 | `0013_accounts.sql` | Multi-account support |
| 14 | `0014_account_balance_engine.sql` | Balance recalculation engine |
| 15 | `0015_trade_tags_favorites.sql` | Tags and favorites |
| 16 | `0016_challenges.sql` | Trading challenges |
| 17 | `0017_trade_review.sql` | Trade review workflow |
| 18 | `0018_trade_psychology.sql` | Emotion scores |
| 19 | `0019_admin_role.sql` | Admin panel role and security |

---

## 7. Known Limitations and Future Work

| Item | Notes |
|------|-------|
| Single admin tier | The enum has only 'user' and 'admin'. Adding roles (e.g., 'moderator') requires `ALTER TYPE ... ADD VALUE`, which is non-reversible in Postgres. Plan future roles carefully. |
| No role audit trail | `profiles` does not log when or by whom `role` was changed. Consider a `profiles_audit` trigger for production. |
| Admin Panel UI | The database layer is complete; frontend Admin Panel routes and components are a separate implementation task. |
| Service-role / Admin promotion only | Promoting or demoting users requires service-role SQL or an existing admin. Self-promotion by regular users is blocked at the database level by `protect_profile_role`. |
| is_admin() per-query overhead | The function is called on every RLS-checked query. The partial index mitigates lookup cost. |

---

## 8. Phase 2: Admin Frontend Shell & Overview Dashboard

### 8.1 Overview & Architecture

Phase 2 introduces the production-quality frontend foundation and the initial Overview dashboard for EdgeJournal Admin. It builds directly upon the Phase 1 security foundation (`0019_admin_role.sql`, `profiles.role`, `is_admin()`, and database-enforced RLS policies).

Key architectural decisions:
- **No duplicated infrastructure:** Reuses the existing Supabase client (`src/lib/supabase.js`), authentication context (`src/context/AuthContext.jsx`), design system CSS tokens (`src/index.css`), and Lucide icon library.
- **Frontend protection as UX layer:** `AdminRoute` guards the `/admin` subtree by checking authenticated session and `profile.role === 'admin'`. Unauthenticated visitors are redirected to `/login`, while normal users (`role = 'user'`) are redirected safely to `/`. True security remains fully enforced at the PostgreSQL RLS boundary.
- **Zero service-role exposure:** All client queries run through the standard Supabase client with authenticated user JWTs. No service-role key or privileged secrets are present in frontend bundles.

### 8.2 Component Hierarchy & Routing

```
App.jsx
└── /admin/* (guarded by AdminRoute)
    └── AdminShell
        ├── AdminSidebar (10 items, collapsible desktop + off-canvas mobile drawer)
        ├── AdminHeader (admin identity, 'Admin' badge, live app link, logout)
        └── main (#admin-main-content)
            └── AdminOverview (telemetry cards, recent registrations, security cards)
```

### 8.3 Sidebar Navigation Items (10 Items)

The Admin Sidebar prepares the 10 navigation surfaces specified for the Admin Panel:

| Item | Route | Icon | Status in Phase 2 | Phase Badge |
|------|-------|------|-------------------|-------------|
| **Overview** | `/admin` | `LayoutDashboard` | **Functional** | — |
| **Users** | `/admin/users` | `Users` | Disabled | Phase 3 |
| **Trading Accounts** | `/admin/accounts` | `Wallet` | Disabled | Phase 4 |
| **Trades** | `/admin/trades` | `CandlestickChart` | Disabled | Phase 4 |
| **Analytics** | `/admin/analytics` | `Activity` | Disabled | Future |
| **Edge AI** | `/admin/edge-ai` | `Brain` | Disabled | Future |
| **Reports** | `/admin/reports` | `FileText` | Disabled | Future |
| **Subscriptions** | `/admin/subscriptions` | `CreditCard` | Disabled | Future |
| **Audit Logs** | `/admin/audit-logs` | `ScrollText` | Disabled | Future |
| **Settings** | `/admin/settings` | `Settings` | Disabled | Future |

### 8.4 Data Sources & Telemetry Queries

All queries are encapsulated in `src/lib/adminApi.js`:

1. **User Population Metrics (Real Data):**
   - Query: `supabase.from('profiles').select('*', { count: 'exact', head: true })`
   - Allowed by Phase 1 RLS policy: `"Admins can view all profiles"`.
   - Admin subset: `supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin')`.
   - Standard user subset: `supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'user')`.
   - Efficient head-only count queries without downloading full table payloads.

2. **Recent User Registrations Activity Feed (Real Data):**
   - Query: `supabase.from('profiles').select('id, email, full_name, role, created_at').order('created_at', { ascending: false }).limit(5)`.
   - Displays user name, email, role badge, and registration timestamp.

3. **System Status:**
   - Real telemetry reporting Supabase Auth connection, RLS enforcement (`SECURITY DEFINER` + RLS), and active migration `0019_admin_role`.

### 8.5 Intentionally Deferred Metrics (Phase 4 Security Alignment)

Per the Phase 1 security model, `trades` and `accounts` are strictly scoped to owning users (`auth.uid() = user_id`). No admin SELECT policy currently exists on `trades` or `accounts`:
- **Total Trades:** Marked as **Protected (Phase 4)**. Querying the table as an admin would only return the admin's personal trades, which would constitute fake production statistics.
- **Total Trading Accounts:** Marked as **Protected (Phase 4)**. Multi-account isolation is preserved until the Phase 4 database migration safely introduces administrator RLS policies for accounts.

### 8.6 Loading, Error, and Empty State Handling

- **Loading State:** Clean skeleton pulse loaders for metric cards and recent registrations table.
- **Error State:** User-friendly alert banner with retry functionality. Raw database internals, stack traces, and secrets are strictly suppressed.
- **Empty State:** Dedicated state with icon and descriptive text when zero user registrations exist.
- **Refresh Control:** Top-level "Refresh Telemetry" button with animated rotation state for on-demand re-sync.

### 8.7 Responsive & Accessibility Architecture

- **Desktop (>= 1024px):** Persistent sidebar with spring-physics collapse toggle (220px to 72px).
- **Tablet (768px - 1023px):** Auto-collapses sidebar to compact icon-only mode.
- **Mobile (< 768px):** Desktop sidebar is hidden; accessible hamburger menu button reveals an off-canvas drawer with backdrop blur.
- **Accessibility:**
  - Semantic landmark elements (`<nav>`, `<header>`, `<main>`, `<aside>`, `<section>`).
  - Visible focus outlines (`outline: 2px solid var(--red)`).
  - Keyboard skip-link (`#admin-main-content`).
  - Correct `aria-current="page"`, `aria-disabled="true"`, `role="alert"`, and descriptive `aria-label` tags.

### 8.8 Files Created and Modified

| File | Status | Description |
|------|--------|-------------|
| `src/routes/AdminRoute.jsx` | Created | UX route guard verifying admin credentials |
| `src/layouts/AdminShell.jsx` | Created | Dedicated Admin Panel layout (Sidebar, Topbar, Main) |
| `src/components/admin/AdminSidebar.jsx` | Created | Responsive sidebar with 10 navigation items & phase badges |
| `src/components/admin/AdminHeader.jsx` | Created | Admin topbar with admin identity, role indicator & logout |
| `src/pages/admin/AdminOverview.jsx` | Created | Initial Overview dashboard with real telemetry & RLS states |
| `src/lib/adminApi.js` | Created | Secure aggregate data access module |
| `src/components/__tests__/adminPanel.test.jsx` | Created | Verification test suite (12 tests) |
| `src/App.jsx` | Modified | Mounted `/admin/*` route protected by `AdminRoute` |
| `src/context/AuthContext.jsx` | Modified | Exposed `isAdmin` in auth context |
| `src/lib/profileApi.js` | Modified | Mapped `role` in `fromProfileRow` |
| `src/index.css` | Modified | Added admin responsive layout utilities and spin keyframe |
| `docs/ADMIN_PANEL_ARCHITECTURE.md` | Modified | Updated documentation with Phase 2 specifications |

---

## 9. Phase 3: User Management

### 9.1 Overview & Architecture

Phase 3 introduces the complete User Management module at `/admin/users`. It allows platform administrators to inspect registered user records, search and filter the user population, view detailed metadata, and promote or demote user roles using the established Phase 1 security foundation.

**Zero New Migrations:**
The existing database schema (`profiles` table with `id`, `email`, `full_name`, `username`, `avatar_url`, `bio`, `timezone`, `role`, `created_at`, `updated_at`) and Phase 1 policies fully support all Phase 3 requirements. No schema changes or migrations were added.

### 9.2 Route & Protection

- Route: `/admin/users`
- Protected by `src/routes/AdminRoute.jsx`
- Unauthenticated users: redirected to `/login`
- Normal users (`role = 'user'`): safely denied and redirected to `/`
- Administrators (`role = 'admin'`): granted access to directory and role management actions
- Active navigation item in `AdminSidebar.jsx` (functional, active indicator, no phase badge)

### 9.3 Components & Structure

```
AdminShell
└── /admin/users
    └── AdminUsers (main view)
        ├── Summary Cards (Total Users, Admins, Standard Traders)
        ├── Search & Filter Toolbar (debounced search, role filter, page size, refresh)
        ├── User Table (desktop tabular view / mobile responsive cards)
        ├── Pagination Controls (server-side range query, page numbers, navigation)
        ├── UserDetailsDrawer (accessible slide-out inspection drawer)
        └── RoleConfirmModal (accessible privilege change confirmation dialog)
```

### 9.4 Data Access & Queries (`src/lib/adminApi.js`)

1. **`fetchUsers({ page, pageSize, search, role, sort, ascending })`:**
   - Server-side filtering using PostgREST `or()` filter across `full_name`, `email`, `username`.
   - Input sanitization removing punctuation and wildcards to prevent query syntax injection.
   - Exact count retrieval (`{ count: 'exact' }`) and range slicing (`.range(from, to)`).
   - Maps raw database rows through `fromProfileRow()`.

2. **`fetchUserDetails(userId)`:**
   - Single-row lookup from `public.profiles` by `id`.

3. **`updateUserRole(userId, newRole, currentAdminId)`:**
   - Enforces valid role types (`'user'` | `'admin'`).
   - Restricts self-demotion: throws an error if an administrator attempts to remove their own admin privileges.
   - Issues `UPDATE public.profiles SET role = newRole WHERE id = userId`.
   - Authoritative security enforced by database trigger `protect_profile_role()` and RLS policy `"Admins can update all profiles"`.

### 9.5 Role Management & Safety

- **Promote User -> Admin:** Elevates standard user to administrator.
- **Demote Admin -> User:** Revokes administrator privileges, returning the user to standard tier.
- **Confirmation Modal (`RoleConfirmModal.jsx`):**
  - Explicit confirmation required before executing database changes.
  - Displays target user identity, current role, and target role with clear consequence warning.
- **Self-Demotion Safeguard:**
  - The row corresponding to the currently authenticated administrator displays a "Current Admin" tag with role toggle disabled.
  - The profile drawer displays an informative warning message explaining that self-demotion is restricted.
  - The API function rejects self-demotion requests.
  - The database trigger `protect_profile_role()` serves as the ultimate authority.

### 9.6 State Handling & UI Feedback

- **Loading State:** Skeleton bars for summary cards and table rows during asynchronous queries.
- **Empty State:** Informative empty placeholder when no user profiles exist.
- **Search-No-Results State:** Clear guidance when a search query or role filter returns zero results.
- **Error State:** Friendly error banner with a "Retry" button.
- **Toast Notifications:** Automatic feedback banner on successful role updates or caught database errors.

### 9.7 Intentionally Deferred Features

- **Active / Inactive Status:** The current `profiles` schema contains no account status or suspended column. Adding an activation/deactivation feature without proper database foundations and auth session invalidation would create incomplete security. This is documented and intentionally deferred to a future dedicated account lifecycle phase.

### 9.8 Files Created and Modified

| File | Status | Description |
|------|--------|-------------|
| `src/pages/admin/AdminUsers.jsx` | Created | User Management page (summary cards, search, table, pagination) |
| `src/components/admin/RoleConfirmModal.jsx` | Created | Confirmation dialog for role promotion and demotion |
| `src/components/admin/UserDetailsDrawer.jsx` | Created | Slide-out drawer for inspecting user details and role actions |
| `src/components/__tests__/adminUsers.test.jsx` | Created | 16-test verification suite for User Management |
| `src/lib/adminApi.js` | Modified | Added `fetchUsers`, `fetchUserDetails`, `updateUserRole` |
| `src/components/admin/AdminSidebar.jsx` | Modified | Enabled Users navigation item as functional |
| `src/layouts/AdminShell.jsx` | Modified | Mounted `/admin/users` route and added dynamic header title |
| `src/components/__tests__/adminPanel.test.jsx` | Modified | Updated navigation tests reflecting functional Users link |
| `docs/ADMIN_PANEL_ARCHITECTURE.md` | Modified | Added Section 9 documenting Phase 3 |

---

## 10. Phase 4 — Trading Account & Trade Management

### 10.1 Security Foundation & Migration 0020

Phase 4 enables platform-wide administrative visibility for trading accounts and trade records without compromising the principle of least privilege.

- **Migration:** `supabase/migrations/0020_admin_accounts_trades_rls.sql`
- **Rollback:** `supabase/rollback/0020_admin_accounts_trades_rls_rollback.sql`
- **Security Policies:**
  - `"Admins can view all accounts"` ON `public.accounts` FOR SELECT TO `authenticated` USING (`public.is_admin()`)
  - `"Admins can view all trades"` ON `public.trades` FOR SELECT TO `authenticated` USING (`public.is_admin()`)
- **Key Security Rules:**
  - Admin RLS policies are **SELECT-only** (read-only oversight; mutation access is not granted).
  - Existing owner-only CRUD policies remain unmodified.
  - Safe, idempotent `DO $$` execution blocks.

### 10.2 Navigation & Layout Integration

- **Sidebar (`AdminSidebar.jsx`):**
  - Trading Accounts (`/admin/accounts`) marked functional (`phase: null, functional: true`).
  - Trade Management (`/admin/trades`) marked functional (`phase: null, functional: true`).
- **Shell (`AdminShell.jsx`):**
  - Routes mounted at `/admin/accounts` and `/admin/trades`.
  - Header metadata updated with distinct titles, descriptions, and breadcrumbs.
- **Overview Dashboard (`AdminOverview.jsx`):**
  - Upgraded from deferred Phase 4 placeholders to live platform metrics for accounts and trades.

### 10.3 Trading Account Management (`src/pages/admin/AdminAccounts.jsx`)

- **Summary Metric Cards:** Total Accounts, Active, Inactive, Archived.
- **Search & Filter:** Search by name, broker, platform; status dropdown filter (All, Active, Inactive, Archived).
- **Accounts Table:** Account name, broker, platform, status badge, starting balance, current balance, and calculated P&L.
- **Pagination:** Server-side range pagination with page size and total record count.
- **State Handling:** Skeletons for loading, zero-match empty state, error state with retry.

### 10.4 Trade Management (`src/pages/admin/AdminTrades.jsx`)

- **Summary Metric Cards:** Total Trades, Wins, Losses, Breakeven, Win Rate percentage.
- **Search & Filter:** Search by symbol, trade type, notes; result dropdown filter (All, Win, Loss, Breakeven).
- **Trades Table:** Date/Time, Symbol & Direction (▲ Long / ▼ Short), Type, Account, Entry/Exit Price, P&L (colored with sign), and Result tag.
- **Pagination:** Server-side range pagination with navigation controls.
- **State Handling:** Skeletons for loading, zero-match empty state, error state with retry.

### 10.5 Data Access & Queries (`src/lib/adminApi.js`)

1. **`fetchAdminAccounts({ page, pageSize, search, status, sort, ascending })`:**
   - Server-side text search across `name`, `broker`, `platform`.
   - Optional status filter.
   - Exact count retrieval and range slicing.
   - Maps raw rows through `fromAccountRow()`.
2. **`fetchAdminAccountMetrics()`:**
   - Platform-wide aggregate counts for total, active, inactive, and archived accounts.
3. **`fetchAdminTrades({ page, pageSize, search, result, sort, ascending })`:**
   - Server-side search across `symbol`, `trade_type`, `notes`.
   - Result filter (`all`, `win`, `loss`, `breakeven`).
   - Exact count retrieval and range slicing.
   - Maps raw rows through `fromTradeRow()`.
4. **`fetchAdminTradeMetrics()`:**
   - Platform-wide aggregate metrics: total trades, wins, losses, breakeven, and calculated win rate %.
5. **`fetchAdminMetrics()`:**
   - Updated to return live count metrics for `accounts.total` and `trades.total`.

### 10.6 Files Created and Modified

| File | Status | Description |
|------|--------|-------------|
| `supabase/migrations/0020_admin_accounts_trades_rls.sql` | Created | Admin read-only RLS policies for accounts and trades |
| `supabase/rollback/0020_admin_accounts_trades_rls_rollback.sql` | Created | Idempotent rollback script for migration 0020 |
| `src/pages/admin/AdminAccounts.jsx` | Created | Admin Trading Accounts management page |
| `src/pages/admin/AdminTrades.jsx` | Created | Admin Trades management page |
| `src/components/__tests__/adminAccounts.test.jsx` | Created | 11-test verification suite for Admin Accounts |
| `src/components/__tests__/adminTrades.test.jsx` | Created | 13-test verification suite for Admin Trades |
| `src/lib/adminApi.js` | Modified | Added Phase 4 accounts & trades query and metric functions |
| `src/components/admin/AdminSidebar.jsx` | Modified | Enabled Accounts and Trades navigation links |
| `src/layouts/AdminShell.jsx` | Modified | Mounted `/admin/accounts` and `/admin/trades` routes |
| `src/pages/admin/AdminOverview.jsx` | Modified | Live metric counts for accounts and trades |
| `src/components/__tests__/adminPanel.test.jsx` | Modified | Updated navigation and overview assertions for Phase 4 |
| `docs/ADMIN_PANEL_ARCHITECTURE.md` | Modified | Added Section 10 documenting Phase 4 |

---

## 11. Phase 5 — Advanced Trade Analytics & Performance Intelligence

### 11.1 Overview & Architecture

Phase 5 builds a professional platform-wide trading intelligence layer on top of the Phase 4 database foundation. It enables administrators to monitor trade performance, equity trajectories, dynamic symbol profitability, and account health across all users while strictly respecting the principle of least privilege.

- **Route:** `/admin/analytics` (mounted within `AdminShell.jsx`, guarded by `AdminRoute`).
- **Sidebar Navigation:** Activated `Analytics` link in `AdminSidebar.jsx` (`phase: null, functional: true`).
- **Data Access:** Read-only queries via `src/lib/adminApi.js`, utilizing existing Phase 4 SELECT RLS policies on `accounts` and `trades`.
- **Database Migrations:** None required. Reuses existing schema, columns, and indexes.

### 11.2 KPI Definitions & Calculations

| Metric | Calculation | Notes |
|---|---|---|
| **Total Trades** | Count of all trades within the filtered range | Real database rows only |
| **Winning Trades** | Count where `result = 'Win'` | Validated against actual schema |
| **Losing Trades** | Count where `result = 'Loss'` | Validated against actual schema |
| **Breakeven Trades** | Count where `result = 'Breakeven'` | Validated against actual schema |
| **Win Rate %** | `(Winning Trades / Resolved Trades) × 100` | Resolved trades = Wins + Losses + Breakeven. Open trades excluded from denominator. |
| **Total Net P&L** | `Σ(net_pnl)` across filtered trades | Formatted in currency ($) with sign |
| **Average Trade P&L** | `Total Net P&L / Total Trades` | Average realized profit/loss per closed trade |
| **Average R** | `Σ(rr) / count(valid rr > 0)` | Risk-reward multiple. If no trades log R:R, displays `Not Available`. |
| **Best Trade** | `max(net_pnl)` | Single most profitable trade |
| **Worst Trade** | `min(net_pnl)` | Single largest loss |

### 11.3 Date Range & Account Filtering

- **Date Range Options:**
  - `today` — Today (current UTC date)
  - `7d` — Last 7 Days
  - `30d` — Last 30 Days (default view)
  - `90d` — Last 90 Days
  - `ytd` — This Year (January 1 of current year to today)
  - `all` — All Time (unbounded historical date range)
  - `custom` — Custom date range with Start Date and End Date pickers
- **Query Optimization:** Date bounds are pushed down to the Postgres database using PostgREST operators (`gte('date', startDate)` and `lte('date', endDate)`).
- **Account Filter:** Optional dropdown allowing administrators to inspect performance across the entire platform or scoped to a specific trading account.

### 11.4 Performance Visualizations

Reuses the project's existing chart dependency (`recharts`):
1. **Cumulative Equity Curve:**
   - Composed area chart tracking progressive net P&L accumulation over trade dates.
   - Smooth monotone curve with gradient area fill and custom money tooltip.
   - Correctly handles 0 points (empty state), 1 point, and large historical datasets with date ordering.
2. **Outcome Distribution:**
   - Donut chart breaking down Wins (green), Losses (red), and Breakeven (gray).
   - Augmented by text-equivalent summary badges displaying trade count and percentage so color is never the sole indicator.
3. **Daily Performance Timeline:**
   - Daily net P&L bar chart with green bars for positive days and red bars for drawdown days.
   - Tooltips show trade volume, win rate, and realized P&L per day.

### 11.5 Symbol & Market Intelligence

- **Dynamic Aggregation:** Symbols are read dynamically from `t.instrument`. No instruments are ever hardcoded.
- **Metrics per Symbol:** Trade count, wins, losses, breakeven, win rate %, average trade P&L, and net P&L.
- **Spotlights:** Highlights Top-Performing and Lowest-Performing instruments with trade count indicators to avoid misleading rankings.

### 11.6 Account Performance

- **Relational Aggregation:** Grouped by `account_id` and joined against the platform accounts directory.
- **Metrics per Account:** Account name, broker, currency, total trades, win rate %, average P&L, and net P&L.
- **Spotlight:** Highlights highest-performing accounts by total net P&L.

### 11.7 Directional Bias & Behavioral Telemetry

- **Long vs Short:** Compares Long/Buy vs Short/Sell trade counts, win rates, and net P&L.
- **Session Intelligence:** Aggregates activity across Asia, London, New York, and After Hours sessions.
- **Documented Telemetry Limitations:** Average holding duration is reported as `Not Available` because trade entry forms make exit timestamps optional, leading to incomplete historical duration data.

### 11.8 Security, Privacy & Data Efficiency

- **Read-Only Enforcement:** All Phase 5 analytics components and API endpoints are strictly SELECT-only. No write, update, or delete operations are exposed.
- **Authorization:** Guarded by `AdminRoute` on the client and Postgres RLS (`is_admin()`) on the database.
- **Privacy Preservation:** Analytics expose aggregated performance intelligence; no user credentials, session tokens, or private secrets are retrieved or rendered.
- **Column Pruning:** Queries select only columns necessary for calculations (`id, user_id, account_id, date, entry_time, instrument, direction, session, result, net_pnl, rr, risk_percent, model, created_at`), avoiding large blobs such as screenshots or notes.
- **Bounded Result Sets:** Queries enforce a 5,000-record batch ceiling per date range to prevent client memory exhaustion.

### 11.9 Test Suite & Regression Baseline

A dedicated 20-test verification suite was created in `src/components/__tests__/adminAnalytics.test.jsx`.

- **Access Guarding:** Admin access, normal user denial, and unauthenticated redirects.
- **UI & State:** Full dashboard rendering, loading skeletons, empty states, and query error banners.
- **Filtering:** Date range buttons, custom dates, and account dropdown updates.
- **Mathematical Accuracy:** Win rate calculation (resolved trades only), net P&L, average P&L, and distribution percentages.
- **Dynamic Elements:** Symbol rankings and account tables.
- **Read-Only Verification:** Confirms total absence of mutation or deletion controls.
- **Non-Regression:** Verifies existing `/admin`, `/admin/users`, `/admin/accounts`, and `/admin/trades` routes remain completely intact.

**Results:**
- Previous baseline: 653 tests (33 test files)
- New tests added: 20 tests (1 new test file)
- Final total: 673 passed / 0 failed (34 test files)
- Production build (`npm run build`): PASS

### 11.10 Files Created and Modified

| File | Status | Description |
|------|--------|-------------|
| `src/pages/admin/AdminAnalytics.jsx` | Created | Platform-wide trade analytics dashboard with KPIs, charts, symbol & account intelligence |
| `src/components/__tests__/adminAnalytics.test.jsx` | Created | 20-test verification suite for Phase 5 Analytics |
| `src/lib/adminApi.js` | Modified | Added Phase 5 query & aggregation functions (`fetchAdminAnalyticsData`, `processAdminAnalytics`, `resolveDateRange`, etc.) |
| `src/components/admin/AdminSidebar.jsx` | Modified | Activated Analytics link (`phase: null, functional: true`) |
| `src/layouts/AdminShell.jsx` | Modified | Mounted `/admin/analytics` route and added header metadata |
| `src/components/__tests__/adminPanel.test.jsx` | Modified | Updated navigation assertions for functional Analytics item |
| `docs/ADMIN_PANEL_ARCHITECTURE.md` | Modified | Added Section 11 documenting Phase 5 |

---

## 12. Phase 6 — Platform Reports, Data Export & Audit Architecture

### 12.1 Overview & Architecture

Phase 6 implements a comprehensive, read-only platform reporting dashboard, an authorized CSV data export engine, and a tamper-resistant, append-only administrative audit log system for EdgeJournal.

Key architectural foundations:
- **Zero privilege escalation:** Reports and exports run strictly within the authenticated admin's permissions via Supabase RLS and `public.is_admin()`. No service-role key is present in client bundles.
- **Append-only audit trail:** Migration `0021_admin_audit_logs.sql` introduces `public.admin_audit_logs`. The database enforces that only administrators can read audit records, and log insertions are bound strictly to `auth.uid()` via trigger/RLS and a `SECURITY DEFINER` function `public.log_admin_action()`. No user or admin is granted UPDATE or DELETE permissions.
- **Honest historical data:** Zero retroactive or synthetic audit logs are fabricated. When no actions have yet occurred, the interface displays an honest empty state.
- **Dynamic reporting:** Symbol and account metrics are derived dynamically from database records—no instruments are hardcoded.

### 12.2 Routes & Navigation

| Route | Component | Access Guard | Active Sidebar Item | Status |
|---|---|---|---|---|
| `/admin/reports` | `AdminReports.jsx` | `AdminRoute` | Reports (`phase: null, functional: true`) | **Live** |
| `/admin/audit-logs` | `AdminAuditLogs.jsx` | `AdminRoute` | Audit Logs (`phase: null, functional: true`) | **Live** |

Both routes are protected by `AdminRoute`. Unauthenticated visitors are redirected to `/login`, while authenticated non-administrators (`role = 'user'`) are redirected to `/`.

### 12.3 Reports Architecture & Report Types

The reporting layer (`src/components/admin/AdminReports.jsx` and `fetchAdminReports` in `src/lib/adminApi.js`) exposes five distinct platform report types selectable via tabs or a consolidated report view:

1. **Platform Summary:**
   - Total registered users (`public.profiles`)
   - Total platform trading accounts (`public.accounts`)
   - Total trades executed in the active period (`public.trades`)
   - Win / Loss / Breakeven count distribution
   - Overall Win Rate % (calculated strictly across resolved trades; open trades excluded)
   - Total Net P&L and Average Trade P&L
   - Average R multiple (or `Not Available` if no R logged)

2. **Trading Performance Report:**
   - Execution volume and outcome distribution
   - Realized P&L, Average Trade P&L, Win Rate %
   - Directional bias (Long vs Short trade counts, win rates, and net P&L)
   - Session breakdown (Asia, London, New York, After Hours)

3. **User Activity Report:**
   - New users registered within the filtered period (`profiles.created_at`)
   - Active traders (count of distinct `user_id` values logging executions in the period)
   - Inactive traders / users with no trades (`totalUsers - activeTraders`)
   - Average accounts per user (`totalAccounts / totalUsers`)

4. **Dynamic Symbol Performance Report:**
   - Grouped dynamically by `trades.instrument`
   - Instrument, Trade Count, Wins, Losses, Breakeven, Win Rate %, Average P&L, and Net P&L
   - No instruments are hardcoded; rankings update automatically with real trading data

5. **Account Performance Report:**
   - Grouped dynamically by `trades.account_id` and joined against `accounts`
   - Account Name, Broker, Platform, Currency, Trades, Win Rate %, Net P&L

### 12.4 Date Filtering

Supported reporting periods:
- `today` — Today (current UTC date)
- `7d` — Last 7 Days
- `30d` — Last 30 Days (default view)
- `90d` — Last 90 Days
- `ytd` — This Year (January 1 of current year to today)
- `all` — All Time (unbounded historical date range)
- `custom` — Custom date range with Start Date and End Date pickers

Filtering is processed through `resolveDateRange()` and pushed down to Postgres using PostgREST operators (`gte('date', startDate)` and `lte('date', endDate)`). The active reporting period is visibly highlighted in the UI via an `Active Period` indicator badge.

### 12.5 CSV Data Export Architecture

Administrators can export trade ledger records matching active date and account filters via `exportAdminTradesCsv()`.

**Columns Exported:**
- `Trade ID`
- `Account ID`
- `Instrument`
- `Direction`
- `Date`
- `Result`
- `Net P&L`
- `R`
- `Risk %`
- `Session`
- `Model`
- `Entry Time`
- `Created At`

**Security & Data Privacy Protections:**
- **Zero credential leakage:** Passwords, password hashes, auth tokens, session tokens, service-role secrets, and private user profile data are strictly excluded.
- **Filter fidelity:** The export downloads only the records matching active UI filters. It never dumps the entire database when a filtered period is active.
- **Safe RFC-4180 Escaping:** Quotes are escaped (`""`), cells containing commas or newlines are wrapped in double quotes, and null values render as empty quotes (`""`).
- **Spreadsheet Formula Injection Mitigation:** Non-numeric text values beginning with `=`, `+`, `-`, `@`, `\t`, or `\r` are prefixed with a single quote `'` to prevent DDE/CSV formula execution in spreadsheet applications. Valid negative numbers (e.g., `-150.00`) are preserved.
- **Chunked Pagination:** Large datasets are retrieved in 1,000-row chunks up to a safe 10,000-record boundary, preventing browser memory exhaustion.
- **Honest Feedback:** If 0 rows match the active filter, the UI alerts the administrator and avoids generating a corrupt or empty download.
- **Audit Logging:** Every successful export automatically records an audit event (`action = 'export_trades_csv'`) with row count and filter metadata.

### 12.6 Audit Log Architecture & Schema

**Migration:** `supabase/migrations/0021_admin_audit_logs.sql`
**Rollback:** `supabase/rollback/0021_admin_audit_logs_rollback.sql`

Table Definition:
```sql
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Indexes:
- `idx_admin_audit_logs_created_at` on `created_at DESC`
- `idx_admin_audit_logs_actor` on `actor_user_id`
- `idx_admin_audit_logs_action` on `action`
- `idx_admin_audit_logs_resource` on `resource_type`

### 12.7 Audit Row Level Security (RLS) & Actor Integrity

1. **Row Level Security Enabled:** `ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;`
2. **Read Policy:**
   ```sql
   CREATE POLICY "Admins can view audit logs"
     ON public.admin_audit_logs FOR SELECT
     TO authenticated
     USING (public.is_admin());
   ```
3. **Insert Policy (Actor-Bound):**
   ```sql
   CREATE POLICY "Admins can insert audit logs"
     ON public.admin_audit_logs FOR INSERT
     TO authenticated
     WITH CHECK (public.is_admin() AND actor_user_id = auth.uid());
   ```
4. **Append-Only Enforcement:** Zero UPDATE or DELETE policies exist for any role. Audit history is immutable.
5. **Database Helper Function (`log_admin_action`):**
   `SECURITY DEFINER` function with `search_path = ''` that verifies `public.is_admin()` and assigns `actor_user_id = auth.uid()`. Untrusted clients cannot impersonate other administrators.

### 12.8 Audit Events Logged & Honest History

- **Logged Actions:**
  - `export_trades_csv` — Triggered whenever an administrator downloads a trades CSV export.
  - `update_user_role` — Triggered when user role promotions/demotions occur.
  - `view_report` — Conceptual read actions supported by schema.
- **Zero Fabrication:** The audit ledger strictly logs real events starting from Phase 6 implementation. If zero records exist, the UI renders: *"No audit events recorded yet."*

### 12.9 Pagination & Performance

- **Server-Side Range Queries:** Audit logs are retrieved with PostgREST `.range(from, to)` (default 15/20 rows per page) and `{ count: 'exact' }`.
- **Relational Actor Resolution:** Actor profiles (`email`, `full_name`, `role`) are resolved dynamically from `public.profiles` for unique `actor_user_id` values, avoiding costly joins on every record.
- **Search & Filtering:** Server-side filtering by Action, Resource Type, Date Range, and full-text keyword search across actions and resources.

### 12.10 Test Suite & Regression Baseline

Two new verification suites were added:
- `src/components/__tests__/adminReports.test.jsx` (16 tests)
- `src/components/__tests__/adminAudit.test.jsx` (14 tests)
- `src/components/__tests__/adminPanel.test.jsx` (updated navigation assertions)

**Verification Coverage:**
- Access control (unauthenticated redirects to `/login`, normal users denied and redirected to `/`, admins granted access)
- All 5 report sections rendering with real calculations
- Date filters (today, 7d, 30d, 90d, ytd, all, custom range)
- Empty report handling and error banner with retry
- Dynamic symbols and account metrics
- User activity metrics (active traders, users with no trades, accounts per user)
- CSV export generation, escaping, formula injection mitigation, and filter preservation
- Audit table rendering, metadata expansion, action/resource/search filtering, and pagination
- Append-only audit integrity, actor resolution, and honest empty states
- `logAdminAction` parameter validation, RPC execution, table fallback, and unauthenticated rejection

**Test Results:**
- Previous baseline: 673 passed tests (34 test files)
- New tests added: 30 tests (2 new test files)
- Final total: **703 passed / 0 failed (36 test files)**
- Production build (`npm run build`): **PASS (exit code 0)**

### 12.11 Files Created and Modified

| File | Status | Description |
|---|---|---|
| `supabase/migrations/0021_admin_audit_logs.sql` | Created | Audit log table, indexes, RLS policies, and secure logging helper function |
| `supabase/rollback/0021_admin_audit_logs_rollback.sql` | Created | Idempotent rollback script for migration 0021 |
| `src/components/admin/AdminReports.jsx` | Created | Platform reports dashboard with 5 report sections, date filters, and CSV export |
| `src/pages/admin/AdminReports.jsx` | Created | Page route re-export for `/admin/reports` |
| `src/components/admin/AdminAuditLogs.jsx` | Created | Audit ledger page with actor inspection, filtering, pagination, and honest empty state |
| `src/pages/admin/AdminAuditLogs.jsx` | Created | Page route re-export for `/admin/audit-logs` |
| `src/components/__tests__/adminReports.test.jsx` | Created | 16-test verification suite for Reports and CSV export |
| `src/components/__tests__/adminAudit.test.jsx` | Created | 14-test verification suite for Audit logs and security |
| `src/lib/adminApi.js` | Modified | Added Phase 6 report queries, CSV generator, export downloader, and audit logging API |
| `src/components/admin/AdminSidebar.jsx` | Modified | Enabled Reports and Audit Logs navigation items as functional |
| `src/layouts/AdminShell.jsx` | Modified | Mounted `/admin/reports` and `/admin/audit-logs` routes and added header metadata |
| `src/components/__tests__/adminPanel.test.jsx` | Modified | Updated navigation assertions reflecting 7 functional admin surfaces |
| `docs/ADMIN_PANEL_ARCHITECTURE.md` | Modified | Added Section 12 documenting Phase 6 |

### 12.12 Known Limitations & Future Work

- **Historical Activity Prior to Phase 6:** Because audit logging was established in Phase 6, administrative actions conducted prior to migration 0021 were not captured and are not retroactively synthesized.
- **Export Formats:** Phase 6 implements RFC-4180 CSV export as specified. Additional formats (such as JSON or PDF export) may be evaluated in future operational phases.
- **Export Ceiling:** Client-side CSV export is bounded to 10,000 records to prevent browser memory exhaustion. Platform datasets exceeding this limit should be exported via scheduled backend reporting in future updates.

---

## 13. Phase 7: Subscriptions, Plans & Entitlements

Phase 7 establishes a production-grade, secure subscription and entitlement architecture for EdgeJournal. It introduces plan definitions, user subscription state tracking, an application-wide entitlement evaluation engine, administrator subscription management, and user-facing subscription review.

> [!IMPORTANT]
> **Payment processing is not implemented in Phase 7.**
> No external payment gateways (e.g. Stripe, PayPal, bKash, Nagad) or billing processors are integrated. Subscription records represent authorized application entitlement state, not verified payment transactions.

---

### 13.1 Plan Architecture

The platform defines available subscription tiers in the `public.plans` table:

```sql
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  price numeric(10, 2) NOT NULL DEFAULT 0.00,
  currency text NOT NULL DEFAULT 'USD',
  billing_interval text NOT NULL DEFAULT 'monthly',
  is_active boolean NOT NULL DEFAULT true,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### Seeded Default Plans
Migration `0022_subscriptions_and_plans.sql` idempotently seeds two standard platform plans:
1. **Free Tier (`slug: 'free'`):**
   - Price: $0.00 / month
   - Features: `["journal", "analytics", "basic_reports", "goals", "reflections", "challenges"]`
   - Limits: `{"accounts": 1, "trades": 500, "screenshots_per_trade": 5}`
2. **Pro Tier (`slug: 'pro'`):**
   - Price: $29.00 / month
   - Features: `["journal", "analytics", "advanced_analytics", "multiple_accounts", "reports", "csv_export", "custom_goals", "unlimited_trades", "edge_ai"]`
   - Limits: `{"accounts": 10, "trades": 10000, "screenshots_per_trade": 10}`

---

### 13.2 Subscription Architecture

User subscription states are tracked in `public.subscriptions`:

```sql
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'expired', 'cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_subscriptions_user UNIQUE (user_id)
);
```

#### Subscription Lifecycle Statuses:
- `active`: Fully operational subscription granting all assigned plan entitlements.
- `trialing`: Active trial state.
- `expired`: Subscription has expired. The entitlement engine automatically falls back to Free plan capabilities.
- `cancelled`: Subscription was revoked or cancelled. Falls back to Free tier.

---

### 13.3 Entitlement Model

A centralized, reusable entitlement engine is implemented in `src/lib/entitlements.js`:

- **Canonical Feature Identifiers:**
  - `journal`: Core trade journaling and log entries
  - `analytics`: Standard trading metrics and win-rate curves
  - `advanced_analytics`: Deep-dive symbol rankings, time-of-day intelligence, and equity curves
  - `multiple_accounts`: Management of multiple live, demo, or prop firm accounts
  - `reports`: Platform reporting module
  - `csv_export`: Filtered trade and metrics CSV data export
  - `custom_goals`: Custom milestone target tracking
  - `unlimited_trades`: Volume trade logging up to 10,000 trades
  - `edge_ai`: Future AI command center entitlement flag (reserved identifier)

#### Core Evaluation Engine Functions:
```javascript
// Validates whether subscription status represents active usability
isSubscriptionActive(subscription)

// Resolves plan with fallback to Free tier if subscription is inactive or expired
getEffectivePlan(plan, subscription)

// Evaluates whether a user plan is entitled to access a specific feature
canUseFeature(planOrSubscription, featureName)

// Resolves configured numeric limit (accounts, trades, screenshots)
getPlanLimit(planOrSubscription, limitKey, fallbackValue)
```

---

### 13.4 Plan Limits & Non-Destructive Protection

Limits are evaluated through dedicated guards:
- `checkAccountLimit(currentCount, planOrSubscription)`
- `checkTradeLimit(currentCount, planOrSubscription)`

> [!CAUTION]
> **Data Integrity Guarantee:** Exceeding plan limits never triggers retroactive data deletion. Existing trades, accounts, or screenshots are strictly preserved read-only. Limits guard new additions only.

---

### 13.5 Admin Subscription Management

Administrators manage plans and user subscriptions from `/admin/subscriptions` (`src/components/admin/AdminSubscriptions.jsx`):
- **Plan Overview KPIs:** Real-time counters for Total Plans, Active Plans, Total Subscriptions, and Active Subscriptions.
- **Plan Management Tab:**
  - Inspect all active and inactive plans, user counts, and configured limits.
  - Create New Plan Modal: Configures name, slug, price, currency, interval, active toggle, feature checkboxes, and numeric limits.
  - Edit Plan Modal: Updates plan parameters.
  - Active/Inactive toggle: Safely toggles plan availability without breaking foreign-key references.
- **Subscriber Directory Tab:**
  - Paginated subscriber directory with search by name/email/plan.
  - Filter by status (`active`, `trialing`, `expired`, `cancelled`) and target plan.
  - Change / Assign Plan Modal: Assigns or updates a subscriber's plan tier, status, and expiration date.

---

### 13.6 User Subscription Page

Traders access `/subscription` (`src/pages/Subscription.jsx`):
- Displays Current Plan overview with active status badge.
- Displays subscription metadata: member since / start date, expiration date, trading account limits, and trade logging limits.
- Features checklist visually displays which features are included in the user's active tier.
- Transparent tier comparison grid showing available platform tiers.
- Honest disclaimer: *"Upgrade options are currently managed by the platform administrator."*

---

### 13.7 Feature Gating Integration

- `AuthContext.jsx` exposes `currentPlan`, `subscription`, `subscriptionStatus`, `entitlements`, `planLimits`, `canUse(feature)`, and `getLimit(limitKey)`.
- `AccountsManager.jsx` guards account creation and duplication against plan account limits (`checkAccountLimit`).

---

### 13.8 Row Level Security (RLS)

PostgreSQL RLS is enabled on both `public.plans` and `public.subscriptions`:

#### `public.plans`:
- `Authenticated users can view active plans`: `FOR SELECT TO authenticated USING (is_active = true OR public.is_admin());`
- `Admins can insert plans`: `FOR INSERT TO authenticated WITH CHECK (public.is_admin());`
- `Admins can update plans`: `FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());`

#### `public.subscriptions`:
- `Users can view own subscription`: `FOR SELECT TO authenticated USING (auth.uid() = user_id);`
- `Admins can view all subscriptions`: `FOR SELECT TO authenticated USING (public.is_admin());`
- `Admins can insert subscriptions`: `FOR INSERT TO authenticated WITH CHECK (public.is_admin());`
- `Admins can update subscriptions`: `FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());`

> [!NOTE]
> Standard users have zero INSERT, UPDATE, or DELETE privileges on `subscriptions` and `plans`. Client-side self-elevation or self-upgrade is physically impossible under RLS.

---

### 13.9 Security Model & Database Functions

Administrative subscription assignment is facilitated by the `public.admin_assign_subscription` database function:
- Defined with `SECURITY DEFINER` and `SET search_path = ''`.
- Explicitly verifies `public.is_admin()`. Rejects non-admin execution with an access denied exception.
- Upserts subscription with unique user constraint.

---

### 13.10 Administrative Audit Events

All subscription administration actions are logged to `public.admin_audit_logs` using the Phase 6 audit system:
- `create_plan`: Storing plan name, slug, price, currency.
- `update_plan`: Storing updated plan parameters.
- `activate_plan` / `deactivate_plan`: Storing plan activation toggle.
- `assign_subscription`: Storing target user ID, plan ID, status, and expiry.
- `change_subscription`: Storing changed plan ID, status, and expiry.
- `cancel_subscription`: Storing cancelled subscription ID.

---

### 13.11 Payment Provider Status

- **Status:** **Not Implemented.**
- No Stripe, PayPal, or automated billing provider is configured.
- UI elements explicitly communicate that upgrades are administered directly by the platform administrator.

---

### 13.12 Migration Reference

- **Migration File:** `supabase/migrations/0022_subscriptions_and_plans.sql`
- **Execution:** Additive DDL creating `public.plans`, `public.subscriptions`, performance indexes, RLS policies, default seeded plans, and helper function `admin_assign_subscription`.

---

### 13.13 Rollback Reference

- **Rollback File:** `supabase/rollback/0022_subscriptions_and_plans_rollback.sql`
- **Rollback Scope:** Drops function `admin_assign_subscription`, drops RLS policies on `subscriptions` and `plans`, drops indexes, and drops tables in dependency order (`subscriptions` then `plans`).
- **Execution Status:** Static analysis review performed. The rollback script was NOT executed against active environments to avoid data loss.

---

### 13.14 Test Verification Suite

- **Previous Baseline:** 703 passed tests across 36 test files.
- **New Tests Added:** 44 tests across 2 new test files:
  - `src/components/__tests__/entitlements.test.jsx`: 27 tests covering active status checks, plan fallbacks, feature checks, limit retrieval, and price formatting.
  - `src/components/__tests__/adminSubscriptions.test.jsx`: 17 tests covering access control, plan management, subscriber directory, pagination, user subscription page, and API parameter validation.
- **Final Total:** **747 passed / 0 failed across 38 test files.**
- **Production Build (`npm run build`):** **PASS (exit code 0).**

---

### 13.15 Files Created and Modified

| File | Status | Description |
|---|---|---|
| `supabase/migrations/0022_subscriptions_and_plans.sql` | Created | Plans and subscriptions tables, RLS, indexes, seed tiers, and assignment function |
| `supabase/rollback/0022_subscriptions_and_plans_rollback.sql` | Created | Idempotent rollback script for migration 0022 |
| `src/lib/entitlements.js` | Created | Centralized entitlement evaluation and limit verification engine |
| `src/lib/subscriptionApi.js` | Created | Client-side user subscription API client with Free plan fallback |
| `src/components/admin/AdminSubscriptions.jsx` | Created | Admin subscription management dashboard with plans and subscriber tabs |
| `src/pages/admin/AdminSubscriptions.jsx` | Created | Page route wrapper for `/admin/subscriptions` |
| `src/pages/Subscription.jsx` | Created | User-facing subscription tier review and comparison page |
| `src/components/__tests__/entitlements.test.jsx` | Created | 27-test suite verifying entitlement resolution and limit evaluation |
| `src/components/__tests__/adminSubscriptions.test.jsx` | Created | 17-test suite verifying admin subscriptions UI, route security, and user page |
| `src/lib/adminApi.js` | Modified | Added admin plan and subscription API functions with audit logging |
| `src/context/AuthContext.jsx` | Modified | Exposed user subscription, plan limits, entitlements, and canUse helpers |
| `src/components/admin/AdminSidebar.jsx` | Modified | Enabled Subscriptions as functional navigation item |
| `src/layouts/AdminShell.jsx` | Modified | Mounted `/admin/subscriptions` route with title metadata |
| `src/routes/routes.js` | Modified | Added `/subscription` route configuration |
| `src/components/Sidebar.jsx` | Modified | Added Subscription link in trader sidebar |
| `src/components/accounts/AccountsManager.jsx` | Modified | Guarded account creation against plan limits |
| `src/components/__tests__/adminPanel.test.jsx` | Modified | Updated navigation assertions reflecting 8 functional admin surfaces |
| `docs/ADMIN_PANEL_ARCHITECTURE.md` | Modified | Added Section 13 documenting Phase 7 |

---

### 13.16 Known Limitations & Future Work

- **Payment Processing:** Payment gateways (Stripe, PayPal, bKash) are deferred to a dedicated payment phase.
- **Self-Service Checkout:** Because payments are not enabled, users cannot self-checkout; tiers are assigned by administrators.
- **Edge AI Integration:** `edge_ai` exists as an entitlement identifier only and is deferred to Phase 8+ command center implementation.






