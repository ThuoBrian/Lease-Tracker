# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lease-Tracker is a web-based asset lease management platform for organizations that lease Laptops and PDAs (tablets) to internal projects. It provides inventory management, role-based access, automated billing (UGX 5,000/PDA/day, UGX 20,000/Laptop/day), and monthly financial reconciliation.

**Stack:** React (Vite) + Tailwind CSS + Supabase (PostgreSQL, Auth, RLS) + GitHub Pages

## Repository Layout

```
Code/
  frontend/    # React (Vite) SPA — all UI code lives here
  backend/
    schema.sql                           # Full Supabase schema + RLS (run in SQL Editor)
    edge-functions/daily-alerts/index.ts # Supabase Edge Function for in-app alert triggers
docs/
  input/
    initial-prompt.txt  # Original rough requirements
    golden-prompt.txt   # Refined spec used to build the app
.github/workflows/deploy.yml  # GitHub Actions: build → deploy to gh-pages branch
```

## Development Commands

All commands run from `Code/frontend/`:

```bash
npm install       # Install dependencies
npm run dev       # Start dev server (http://localhost:5173)
npm run build     # Production build (output: dist/)
npm run preview   # Preview production build locally
```

## Environment Variables

Copy `Code/frontend/.env.example` to `Code/frontend/.env` and fill in:
- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — your Supabase anon/public key

For GitHub Actions deployment, add these as repository secrets.

## Architecture Notes

**Frontend structure** (`Code/frontend/src/`):
- `lib/supabase.js` — Supabase client singleton
- `lib/constants.js` — roles, rates, permissions lists
- `lib/utils.js` — `formatUGX`, `leaseDays`, `calcDepreciation`, `downloadCSV`, `downloadPDF`
- `contexts/AuthContext.jsx` — session + profile (role) state; `useAuth()` hook
- `components/` — Layout, Sidebar, ProtectedRoute, StatusBadge, SkeletonTable, EmptyState, ConfirmDialog, NotificationDropdown
- `pages/` — one file per route: Dashboard, Inventory (shared laptop/PDA), BookLease, MyLeases, Finance, Projects, People, Reports, Settings

**Routing:** HashRouter (required for GitHub Pages static hosting). Routes are defined in `App.jsx`.

**Auth flow:** Supabase email+password → session stored in localStorage → `AuthContext` fetches the user's row from `public.users` to get their role → `ProtectedRoute` guards each route by role.

**Permissions:** Role checks use the constants in `lib/constants.js` (`ADMIN_ROLES`, `FINANCE_ROLES`, `REPORTS_ROLES`). Server-side enforcement is via Supabase RLS policies in `schema.sql`.

**Depreciation:** Straight-line, computed client-side in `calcDepreciation()` in `utils.js`. Useful life defaults are in `constants.js` and can be overridden by Admin in Settings (stored in the `settings` table).

**Billing:** Cost locked at booking time — `daily_rate_ugx × (end_date − start_date + 1)`. Rates come from the `settings` table. Early returns write `adjusted_cost_ugx`.

**Deployment:** GitHub Actions (`deploy.yml`) runs `npm run build` with Supabase secrets injected, then pushes `dist/` to the `gh-pages` branch. Vite `base` is set to `/Lease-Tracker/` in `vite.config.js`.

**Database:** Run `Code/backend/schema.sql` once in the Supabase SQL Editor to create all tables, enums, RLS policies, triggers, and seed the settings table. The `daily-alerts` Edge Function triggers daily at 06:00 UTC via pg_cron.
