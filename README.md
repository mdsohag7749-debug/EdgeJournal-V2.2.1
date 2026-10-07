# EdgeJournal v2.3.0

A full-stack trading journal web application for forex and futures traders.
Built with **React 18 + Vite**, powered by **Supabase** (auth, database, storage, RLS),
deployed via **Vercel**, and equipped with **Edge AI Command Center** for journal intelligence.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, React Router 6, Framer Motion |
| Charts | Recharts |
| Icons | Lucide React |
| CSS | Vanilla CSS (design tokens in `src/index.css`) |
| Backend | Supabase (PostgreSQL, Auth, Storage, RLS) |
| AI Server | Vercel Serverless Functions (Node.js ESM) |
| AI Provider | Google Gemini (server-side only) |
| PWA | vite-plugin-pwa + Workbox |
| Testing | Vitest + Testing Library + jsdom |
| Deployment | Vercel |

---

## Environment Variables

### Client-side (VITE_ prefix) -- bundled into browser

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/publishable key |
| `VITE_AI_ENABLED` | Yes | `true` to show Edge AI UI |
| `VITE_AI_PROVIDER` | Yes | `remote` (routes through server bridge) |

### Server-side -- Vercel env vars only, NEVER in client bundle

| Variable | Required | Description |
|---|---|---|
| `AI_ENABLED` | Yes | `true` to enable server AI processing |
| `AI_PROVIDER` | Yes | `gemini` |
| `GEMINI_API_KEY` | Yes | Google Gemini API key (never in browser) |
| `GEMINI_MODEL` | Yes | e.g. `gemini-3.5-flash-lite` |
| `SUPABASE_URL` | Yes (AI) | Supabase project URL (server copy) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (AI) | Service role key (never in browser) |
| `AI_TIMEOUT_MS` | Optional | Default: 30000 |
| `AI_RATE_LIMIT_MAX` | Optional | Default: 20 per window |

Copy `.env.example` to `.env` for local development.

---

## Supabase Setup

1. Create a Supabase project.
2. Run migrations in order from `supabase/migrations/` (0001 through 0024).
3. Each migration is idempotent -- safe to re-run.
4. Apply via the Supabase SQL Editor or `supabase db push`.
5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Project Settings > API.

RLS is enabled on all tables. Do not disable it.

---

## Vercel Setup

1. Connect the GitHub repository to Vercel.
2. Framework preset: Vite. Build command: `npm run build`. Output directory: `dist`.
3. Root directory: `/` (repository root).
4. Add all server-side environment variables in Vercel Project > Settings > Environment Variables.
5. `vercel.json` handles SPA routing, security headers, and `/api/*` routing automatically.

---

## Admin Setup

Promote a user to admin via the Supabase SQL Editor:

```sql
UPDATE public.profiles SET role = 'admin' WHERE id = '<your-user-uuid>';
```

Or use the included script: `supabase/set_admin_mdsohag7749.sql`

Admin panel is at `/admin` (guarded by AdminRoute -- requires `role = 'admin'` in profiles).
Role escalation is blocked at the database level by the `protect_profile_role` trigger.

### Admin Routes

| Route | Description |
|---|---|
| `/admin` | Platform overview and metrics |
| `/admin/users` | User management and role assignment |
| `/admin/accounts` | All trading accounts |
| `/admin/trades` | All trades (read-only oversight) |
| `/admin/analytics` | Platform-wide analytics |
| `/admin/reports` | Reports and CSV export |
| `/admin/subscriptions` | Plan assignment and management |
| `/admin/audit-logs` | Append-only audit trail |
| `/admin/settings` | System settings |
| `/admin/ai` | Edge AI telemetry and controls |

---

## Subscription System

- Plans are in `public.plans` (seeded by migration 0022).
- Subscriptions are in `public.subscriptions` (one per user).
- Users cannot self-upgrade -- subscriptions are admin-assigned only.
- Entitlement evaluation is in `src/lib/entitlements.js`.

| Plan | Accounts | Trades | Screenshots | Edge AI |
|---|---|---|---|---|
| Free | 1 | 500 | 5/trade | No |
| Pro | 10 | 10,000 | 10/trade | Yes |

Payment/checkout is not included in this version.

---

## Edge AI Setup

Edge AI routes all requests through `/api/ai/analyze` (Vercel serverless).
No AI credentials ever reach the browser.

Server-side flow: JWT verify -> account ownership -> entitlement check -> daily limit check ->
system settings check -> server builds prompt -> Gemini API call -> log usage -> return sanitized response.

Edge AI is analytical only. It cannot place trades or take autonomous actions.

---

## Migration History

| Migration | Description |
|---|---|
| 0001 | Profiles and trades, RLS, triggers |
| 0002 | Goals |
| 0003 | Pre-market plans |
| 0004 | Reflections |
| 0005 | Study notes |
| 0006 | Profile bio, timezone, username |
| 0007 | Avatar storage bucket |
| 0008 | Trade screenshots (signed URLs) |
| 0009 | Trade direction, session, timeframe |
| 0010 | Screenshot limit per trade |
| 0011 | Professional trade fields |
| 0012 | Constraint and index fixes |
| 0013 | Trading accounts and balance engine |
| 0014 | Account balance calculation functions |
| 0015 | Trade tags and favorites |
| 0016 | Challenges |
| 0017 | Trade review checklist (jsonb) |
| 0018 | Trade psychology (jsonb) |
| 0019 | Admin role, is_admin(), protect_profile_role trigger |
| 0020 | Admin read-only RLS on accounts and trades |
| 0021 | Audit logs + log_admin_action() |
| 0022 | Plans and subscriptions, RLS, plan seed |
| 0023 | System settings, RLS, settings seed |
| 0024 | AI usage logs, RLS, AI settings seed |

Rollback scripts for 0019-0024 are in `supabase/rollback/`.

---

## Security Model

- RLS enabled on every table; users can only access their own rows.
- Admins read all data via `public.is_admin()` (SECURITY DEFINER function).
- `protect_profile_role` trigger blocks self-promotion to admin.
- Subscriptions are admin-only insert/update.
- Audit logs are append-only (no UPDATE/DELETE policies).
- System settings: public read for `is_public = true`; admin-only write.
- No `dangerouslySetInnerHTML`, `eval()`, or `new Function()` in client code.
- Prompt injection blocked client-side and server-side.
- HTTP headers: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy.

---

## Running Locally

```bash
npm install
cp .env.example .env
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, GEMINI_API_KEY, etc.
npm run dev
```

---

## Testing

```bash
npm test                     # run all 781 tests
npm test -- --reporter=verbose
npm run test:coverage
```

Phase 10 baseline: **781 passed / 0 failed / 40 test files**.

---

## Deployment Steps

1. Push to GitHub (connected repository).
2. Vercel auto-builds on push to main.
3. Verify environment variables are set in Vercel.
4. Confirm Supabase Auth > URL Configuration includes the production domain.
5. Smoke test: login, dashboard, trade creation, Edge AI, admin panel.

---

## Rollback Procedure

```bash
git revert HEAD && git push   # code rollback
```

For database rollback, run the appropriate script from `supabase/rollback/` in the Supabase SQL Editor.

---

## Backup and Recovery

- Supabase provides automated daily backups on paid plans.
- For Free tier: export via Supabase Dashboard > Database > Backups.
- Recovery requires: Supabase URL, anon key, service role key, Gemini API key, Vercel access, GitHub access.
- Never delete or truncate production tables without a verified backup.

---

## Known Limitations

1. Subscription assignment is manual (no payment/checkout integration).
2. AI in-memory rate limiter is per-serverless-instance; database daily limit is authoritative.
3. Password reset redirects to /login (no dedicated password-update page).
4. Offline support limited to PWA precached shell.
5. Mobile app (React Native/Expo) scaffolded in `mobile/` but not production-deployed.
6. recharts bundle (580 kB min) triggers Vite chunk size warning -- expected behavior.
7. Supabase Auth email confirmation must be configured to match the production domain.
