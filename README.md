# EdgeJournal

A forex/futures trading journal web app. React + Vite, all data stored locally in the browser (`localStorage`) — no backend, no database, no account system.

## Tech stack

- React 18 + Vite
- `recharts` for the equity curve and trade breakdown charts
- `lucide-react` for icons
- Plain CSS (design tokens in `src/index.css`) — no CSS framework

## Run locally

```bash
npm install
npm run dev
```

Then open the printed local URL (usually `http://localhost:5173`).

## Build

```bash
npm run build
npm run preview   # preview the production build locally
```

## Deploy to Vercel via GitHub

1. Push this project to a new GitHub repository.
2. In Vercel, click **Add New → Project** and import that repository.
3. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`.
4. Deploy — no environment variables are required since everything runs client-side.

`vercel.json` is already included so client-side navigation doesn't 404 on refresh.

## How data works

Every tab (Trading Journal, Pre-Market Plan, Reflections, Study, Goals, System settings) reads and writes to `localStorage` under keys prefixed `njh_`. There is no server — this means:

- Data is per-browser, per-device. It will **not** sync across devices or browsers automatically.
- Clearing site data / browser storage will erase your journal.
- Use **System → Export JSON Backup** regularly, and **Import JSON Backup** to restore or move data to another browser/device.

## Project structure

```
src/
  components/     shared UI: Sidebar, SidePanel, Lightbox, ImageUpload, ConfirmDialog, StatCard, CalendarHeatmap
  components/auth/  reusable auth UI: AuthLayout, FormField, PasswordField, AuthButton, SocialButtons, AuthLoading
  context/        DataContext.jsx — trades/goals/plans (Supabase-backed) + reflections/study (localStorage-backed)
                  AuthContext.jsx — Supabase auth (session, login/register/logout/password reset)
  lib/            storage.js, utils.js, calculations.js, supabase.js — Supabase client, tradesApi.js/goalsApi.js/plansApi.js — row <-> app object mapping
  layouts/        AppShell.jsx — the authenticated app's Sidebar/Header/routes wrapper
  routes/         routes.js — dashboard/journal/etc. route config
                  ProtectedRoute.jsx, GuestRoute.jsx — auth route guards
  pages/          one file per sidebar tab
  pages/auth/     Login.jsx, Register.jsx, ForgotPassword.jsx
  pages/panels/   the slide-in forms (Log Trade, Pre-Market Plan, Reflection, Study, Goal)
supabase/
  migrations/     0001_profiles_and_trades.sql — profiles + trades tables, RLS policies, triggers
                  0002_goals.sql — goals table, RLS policies, triggers
                  0003_premarket_plans.sql — premarket_plans table, RLS policies, triggers
```

## Authentication (Supabase)

Auth is backed by [Supabase](https://supabase.com) (`@supabase/supabase-js`). To run it locally:

1. Create a Supabase project (or use an existing one).
2. Copy `.env.example` to `.env`.
3. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from **Project Settings → API** in your Supabase dashboard.
4. Restart the dev server (`npm run dev`) so Vite picks up the new env vars.

What's wired up:

- **Login / Register / Logout** — `supabase.auth.signInWithPassword`, `signUp`, `signOut`.
- **Forgot Password** — `supabase.auth.resetPasswordForEmail`. This only requests the email; a dedicated "set a new password" page isn't part of this pass, so recovery links currently land on `/login`.
- **Session persistence & auto login** — Supabase persists the session in the browser; on load, `AuthContext` calls `getSession()` before rendering any protected page, so a returning visitor with a valid session skips the login form entirely.
- **Auth state listener** — `supabase.auth.onAuthStateChange` keeps the app's `isAuthenticated` state in sync with sign-in/out events, including from other tabs.
- **Route protection** — `ProtectedRoute` guards the whole authenticated app (dashboard, journal, etc.); `GuestRoute` guards the auth pages themselves so an already-signed-in visitor is bounced to the dashboard instead of seeing the login form again.

If email confirmation is turned on for your Supabase project (the default), registering shows a "confirm your email" screen instead of signing straight in.

## Database (Supabase)

Three migrations live in `supabase/migrations/`. Run them in order against your Supabase project — either paste each into **SQL Editor → New query** in the dashboard, or `supabase db push` if you're using the CLI.

- **`0001_profiles_and_trades.sql`** creates:
  - **`profiles`** — one row per auth user (`id`, `email`, `full_name`), auto-populated by a trigger on signup from the `full_name` passed to `supabase.auth.signUp`. Not yet surfaced in the UI — this is foundational schema for future profile features.
  - **`trades`** — mirrors the trade shape the app already used in `localStorage` (date, instrument, entry/exit price, P&L, checklists, notes, screenshot, etc.), now with a `user_id` column.
- **`0002_goals.sql`** creates **`goals`** — mirrors the goal shape the app already used in `localStorage` (title, period, target date, sub-items, etc.), now with a `user_id` column.
- **`0003_premarket_plans.sql`** creates **`premarket_plans`** — mirrors the pre-market plan shape the app already used in `localStorage` (date, bias, economic events, targets, game plan, notes, chart screenshots), now with a `user_id` column.

**Row Level Security** is enabled on every table above, with `select`/`insert`/`update`/`delete` policies scoped to `auth.uid()` — every authenticated user can only ever read or write their own rows, enforced by Postgres itself regardless of what the client sends.

**What moved, what didn't:** `trades`, `goals`, and `premarket_plans` have all moved from `localStorage` to Supabase (`src/context/DataContext.jsx`'s `useTradesCollection`/`useGoalsCollection`/`usePlansCollection`, backed by `src/lib/tradesApi.js`/`goalsApi.js`/`plansApi.js` for the camelCase ↔ snake_case mapping). Dashboard statistics, the Trading Journal table, the Pre-Market Plan tab, and JSON backup/restore all read from these Supabase-backed collections now. Reflections, study notes, and system settings are unchanged and still live in `localStorage`, as called out in System → Data Safety Notice.


