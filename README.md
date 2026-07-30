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

Trading Journal, Pre-Market Plan, Reflections, Study, and Goals data live in Supabase (per-user, protected by Row Level Security). System settings (trading models and checklists) still read and write to `localStorage` under keys prefixed `njh_`. This means:

- Trades, goals, pre-market plans, reflections, and study notes sync to your Supabase account and follow you across devices/browsers once you sign in.
- Trading models and checklists are per-browser, per-device — clearing site data / browser storage will reset those to the defaults.
- Use **System → Export JSON Backup** regularly, and **Import JSON Backup** to restore or move data to another browser/device.

## Project structure

```
src/
  components/     shared UI: Sidebar, SidePanel, Lightbox, ImageUpload, ConfirmDialog, StatCard, CalendarHeatmap
  components/auth/  reusable auth UI: AuthLayout, FormField, PasswordField, AuthButton, SocialButtons, AuthLoading
  context/        DataContext.jsx — trades/goals/plans/reflections/study (all Supabase-backed)
                  AuthContext.jsx — Supabase auth (session, login/register/logout/password reset)
  lib/            storage.js, utils.js, calculations.js, supabase.js — Supabase client, tradesApi.js/goalsApi.js/plansApi.js/reflectionsApi.js/studyApi.js — row <-> app object mapping
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
                  0004_reflections.sql — reflections table, RLS policies, triggers
                  0005_study_notes.sql — study_notes table, RLS policies, triggers
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

Five migrations live in `supabase/migrations/`. Run them in order against your Supabase project — either paste each into **SQL Editor → New query** in the dashboard, or `supabase db push` if you're using the CLI.

- **`0001_profiles_and_trades.sql`** creates:
  - **`profiles`** — one row per auth user (`id`, `email`, `full_name`), auto-populated by a trigger on signup from the `full_name` passed to `supabase.auth.signUp`. Not yet surfaced in the UI — this is foundational schema for future profile features.
  - **`trades`** — mirrors the trade shape the app already used in `localStorage` (date, instrument, entry/exit price, P&L, checklists, notes, screenshot, etc.), now with a `user_id` column.
- **`0002_goals.sql`** creates **`goals`** — mirrors the goal shape the app already used in `localStorage` (title, period, target date, sub-items, etc.), now with a `user_id` column.
- **`0003_premarket_plans.sql`** creates **`premarket_plans`** — mirrors the pre-market plan shape the app already used in `localStorage` (date, bias, economic events, targets, game plan, notes, chart screenshots), now with a `user_id` column.
- **`0004_reflections.sql`** creates **`reflections`** — mirrors the reflection shape the app already used in `localStorage` (period, date, rating, title, reflection, went well, lessons, improvements), now with a `user_id` column.
- **`0005_study_notes.sql`** creates **`study_notes`** — mirrors the study entry shape the app already used in `localStorage` (date, session type, title, description, chart screenshot), now with a `user_id` column.

**Row Level Security** is enabled on every table above, with `select`/`insert`/`update`/`delete` policies scoped to `auth.uid()` — every authenticated user can only ever read or write their own rows, enforced by Postgres itself regardless of what the client sends.

**What moved, what didn't:** `trades`, `goals`, `premarket_plans`, `reflections`, and `study_notes` have all moved from `localStorage` to Supabase (`src/context/DataContext.jsx`'s `useTradesCollection`/`useGoalsCollection`/`usePlansCollection`/`useReflectionsCollection`/`useStudyCollection`, backed by `src/lib/tradesApi.js`/`goalsApi.js`/`plansApi.js`/`reflectionsApi.js`/`studyApi.js` for the camelCase ↔ snake_case mapping). Dashboard statistics, the Trading Journal table, the Pre-Market Plan tab, the Reflections tab, the Study tab, and JSON backup/restore all read from these Supabase-backed collections now. Trading models and checklists (System settings) are unchanged and still live in `localStorage`, as called out in System → Data Safety Notice.

## Trade Screenshot Upload (Supabase Storage)

Each trade can now have 0–5 screenshots, stored in Supabase Storage rather than as inline base64 (unlike the older single "Execution Screenshot" field, which is unchanged and still lives on the trade row itself).

**Setup:**

1. Run `supabase/migrations/0008_trade_screenshots.sql` in **SQL Editor → New query** (or `supabase db push`). This single migration:
   - Creates the **`trade-screenshots`** Storage bucket (private, 10 MB file size limit, restricted to `image/jpeg`, `image/jpg`, `image/png`, `image/webp`).
   - Adds `select`/`insert`/`update`/`delete` policies on `storage.objects` so a user can only read/write files under their own `{auth.uid()}/` folder.
   - Creates **`trade_screenshots`** (`trade_id`, `user_id`, `storage_path`, `file_name`, `file_size`, `created_at`) as the gallery's source of truth, with the same per-user RLS pattern as every other table, plus a trigger that rejects a 6th insert for the same trade (server-side backstop for the 0–5 limit already enforced in the UI).
   - You do **not** need to create the bucket manually in the dashboard — the `insert into storage.buckets` statement does that for you.
2. No other configuration is needed; the existing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env vars are reused.

**How it works:** `src/lib/screenshotApi.js` uploads via a signed upload URL (`createSignedUploadUrl` + a raw `XMLHttpRequest` PUT so real upload-progress events are available), stores each file at `trade-screenshots/{auth.uid()}/{trade_id}/{uuid}.{ext}`, and reads them back via short-lived signed URLs (`createSignedUrls`) since the bucket is private. `src/components/TradeScreenshots.jsx` renders the upload/replace/delete grid inside `TradeFormPanel` (only once a trade has been saved and has a real id) and a lazy-loading (`loading="lazy"`), read-only gallery + Lightbox preview inside the Trade Details expanded row in `TradingJournal.jsx`. Deleting an image removes both the Storage object and its `trade_screenshots` row; replacing uploads the new file first, then deletes the old one.

## Progressive Web App & Offline Support

EdgeJournal is installable and works offline for previously loaded data.

**Setup:**

1. `npm install` (pulls in the new `vite-plugin-pwa` dev dependency).
2. `npm run dev` or `npm run build && npm run preview` — `devOptions.enabled` is on, so the service worker registers in dev too, not just in a production build.
3. Nothing else to configure — no new env vars, no Supabase migration.

**What's included:**

- **Installable** — `vite.config.js`'s `VitePWA(...)` plugin generates `manifest.json` (name, icons in `public/pwa-*.png`, theme color) and a Workbox service worker at build time; `index.html` links the manifest and `src/main.jsx` registers the service worker (`src/pwa.js`, `registerType: 'autoUpdate'`). `src/components/InstallPrompt.jsx` turns the browser's native `beforeinstallprompt` event into a small dismissible "Install EdgeJournal" card (Chrome/Edge/Android only — iOS Safari has no install-prompt event and installs via the share sheet instead).
- **Precached app shell** — HTML/JS/CSS/icons are precached by Workbox (`globPatterns` in `vite.config.js`), so the app opens offline. Google Fonts (stylesheet + `.woff2` files) and Supabase Storage images (avatars, trade screenshots) are cached at runtime as you use the app, so previously viewed fonts/images keep rendering offline too.
- **Offline data + queue** (`src/lib/offlineQueue.js`, wired into `src/context/DataContext.jsx`) — every Supabase-backed collection (trades, goals, pre-market plans, reflections, study notes) now:
  - caches its last successful fetch to `localStorage`, and falls back to that cache if a reload happens while offline, so the Dashboard, Trading Journal, and Analytics stay browsable with the last-synced data.
  - queues any create/edit/delete made while offline (or that fails mid-request due to a dropped connection) instead of losing it — the new record shows up immediately in the UI tagged as pending.
  - automatically replays the whole queue, oldest first, the moment the browser comes back online (checked on an `online` event plus a 20s background retry, in case the browser doesn't fire that event reliably).
- **Status UI** — `src/components/OfflineBanner.jsx` (a banner while offline), `src/components/SyncStatus.jsx` (a "N changes pending sync" pill while the queue isn't empty, and a "Synced N changes" toast once it drains). All three are additive overlays wired into `src/layouts/AppShell.jsx` — no existing page or component was restructured.


