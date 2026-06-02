# Lease Tracker

A web-based asset lease management platform for organizations that lease Laptops and PDAs (tablets) to internal projects. It provides full inventory visibility, automated billing, role-based access control, and monthly financial reconciliation — deployable as a static site on GitHub Pages backed by Supabase.

---

## Features

**Inventory Management**
- Separate views for Laptop and PDA inventory
- Status tracking: Available, Leased, Maintenance
- Per-asset lease history and depreciation book value
- Bulk CSV import and multi-select bulk delete (Admin only)
- CSV template download for easy data preparation

**Lease Booking**
- Any authenticated user can book available assets for their assigned projects
- Cost calculated automatically at booking time and locked (UGX 5,000/PDA/day, UGX 20,000/Laptop/day)
- Server-side availability check prevents double-booking — returns "Already assigned" on conflict
- Early return support with adjusted cost calculation

**Finance & Reporting**
- Monthly billing summary per project (Laptop and PDA costs broken out)
- Lease Summary, Asset Utilization, Project Billing, and Depreciation reports
- Export to CSV or PDF; browser-native print with clean print styles

**Depreciation Tracking**
- Straight-line depreciation with configurable useful life per asset type
- Default: 3 years for Laptops, 2 years for PDAs
- Assets at zero book value are flagged as "Fully Depreciated"

**In-App Alerts**
- Notification bell in the top bar with unread count badge
- Daily automated alerts: pickup-ready, expiry reminder (2 days out), overdue
- Mark individual or all notifications as read

**People & Project Management**
- Admin can invite users by email (Supabase Auth invitation) and assign roles
- Admin can create, edit, and archive projects with budget holders and field managers

**Access Control**
- Five roles with distinct permissions enforced both in the UI and via Supabase Row Level Security

---

## User Roles

| Action | Admin | Finance | Project Manager | Field Manager | Research Assoc. |
|---|:---:|:---:|:---:|:---:|:---:|
| View inventory | Yes | Yes | Yes | Yes | Yes |
| Book a lease | Yes | Yes | Yes | Yes | Yes |
| View own leases | Yes | Yes | Yes | Yes | Yes |
| View all leases / reports | Yes | Yes | Yes* | | |
| Finance summary | Yes | Yes | | | |
| Depreciation report | Yes | Yes | | | |
| Add / edit / delete assets | Yes | | | | |
| Bulk import assets | Yes | | | | |
| Add / edit / archive projects | Yes | | | | |
| Add / edit / deactivate users | Yes | | | | |
| Manage settings | Yes | | | | |

*Project Managers see only leases and reports for their assigned projects.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 (Vite), Tailwind CSS v3, React Router v7 (HashRouter), TanStack Query v5 |
| Backend | Supabase (PostgreSQL, Auth, Row Level Security) |
| Hosting | GitHub Pages (static) |
| CI/CD | GitHub Actions |
| Utilities | PapaParse (CSV import), jsPDF + AutoTable (PDF export), date-fns, Lucide React |

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A [Supabase](https://supabase.com) account (free tier is sufficient)
- A GitHub repository with Pages enabled

### 1. Clone the repository

```bash
git clone https://github.com/<your-org>/Lease-Tracker.git
cd Lease-Tracker
```

### 2. Set up the database

1. Create a new project in [Supabase](https://supabase.com).
2. Go to **SQL Editor** and run the full contents of `Code/backend/schema.sql`. This creates all tables, enums, RLS policies, triggers, and seeds the default settings.
3. Copy your **Project URL** and **anon/public key** from **Project Settings → API**.

### 3. Configure environment variables

```bash
cp Code/frontend/.env.example Code/frontend/.env
```

Edit `Code/frontend/.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Create the first Admin user

In the Supabase dashboard go to **Authentication → Users → Invite user** and invite yourself. Once the account exists, run this in the SQL Editor:

```sql
UPDATE public.users SET role = 'admin' WHERE email = 'your@email.com';
```

### 5. Run locally

```bash
cd Code/frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and sign in.

---

## Deployment (GitHub Pages)

The GitHub Actions workflow at `.github/workflows/deploy.yml` builds the frontend and deploys to the `gh-pages` branch on every push to `main`.

**Setup steps:**

1. In your GitHub repository go to **Settings → Secrets and variables → Actions** and add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

2. Go to **Settings → Pages** and set the source to the `gh-pages` branch.

3. Push to `main`. The app will be live at:
   ```
   https://<your-org>.github.io/Lease-Tracker/
   ```

> The Vite base path is set to `/Lease-Tracker/` in `vite.config.js`. If your repository has a different name, update that value before deploying.

---

## Daily Alerts (Edge Function)

The `Code/backend/edge-functions/daily-alerts/index.ts` Supabase Edge Function generates in-app notifications daily. To activate it:

1. Deploy the function via the Supabase CLI:
   ```bash
   supabase functions deploy daily-alerts
   ```

2. Enable the `pg_cron` and `pg_net` extensions in **Database → Extensions**.

3. Schedule it at 06:00 UTC in the SQL Editor:
   ```sql
   SELECT cron.schedule(
     'daily-alerts',
     '0 6 * * *',
     $$
       SELECT net.http_post(
         url := 'https://<project-ref>.supabase.co/functions/v1/daily-alerts',
         headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb
       );
     $$
   );
   ```

---

## Business Rules

**Billing**
- Rate is set automatically based on asset type at booking time and cannot be changed retroactively.
- Day count is inclusive of both start and end date (1 Jun – 5 Jun = 5 days).
- Early returns store an `adjusted_cost_ugx` alongside the original `total_cost_ugx` for audit.

**Depreciation**
- Method: straight-line over configurable useful life (default 3 years for Laptops, 2 years for PDAs).
- Floor: book value never goes below UGX 0.
- Useful life is configurable per asset type by Admin in **Settings**.

**Asset status transitions**

```
available  →  leased       (on lease creation)
leased     →  available    (on lease return or cancellation)
available  →  maintenance  (Admin manual action)
maintenance → available    (Admin manual action)
leased     →  maintenance  (blocked — return the lease first)
```

---

## Project Structure

```
Lease-Tracker/
├── .github/
│   └── workflows/deploy.yml       # GitHub Actions CI/CD
├── Code/
│   ├── frontend/                  # React (Vite) SPA
│   │   ├── src/
│   │   │   ├── lib/               # supabase.js, utils.js, constants.js
│   │   │   ├── contexts/          # AuthContext.jsx
│   │   │   ├── components/        # Shared UI components
│   │   │   └── pages/             # One file per route
│   │   ├── .env.example
│   │   ├── vite.config.js
│   │   └── tailwind.config.js
│   └── backend/
│       ├── schema.sql             # Full database schema + RLS
│       └── edge-functions/
│           └── daily-alerts/      # Supabase Edge Function
└── docs/
    └── input/
        ├── initial-prompt.txt     # Original requirements
        └── golden-prompt.txt      # Refined specification
```

---

## License

Internal use. Contact the repository owner for permissions.
