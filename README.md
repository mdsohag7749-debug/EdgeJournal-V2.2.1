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
  context/        DataContext.jsx — the single localStorage-backed data store
  lib/            storage.js, utils.js, calculations.js
  pages/          one file per sidebar tab
  pages/panels/   the slide-in forms (Log Trade, Pre-Market Plan, Reflection, Study, Goal)
```
