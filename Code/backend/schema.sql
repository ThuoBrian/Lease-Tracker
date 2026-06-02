-- =============================================================================
-- Lease-Tracker — Supabase Schema
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New Query)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('admin','finance','project_manager','field_manager','research_associate');
CREATE TYPE asset_type AS ENUM ('laptop','pda');
CREATE TYPE asset_status AS ENUM ('available','leased','maintenance');
CREATE TYPE asset_condition AS ENUM ('good','fair','poor');
CREATE TYPE lease_status AS ENUM ('active','returned','cancelled');
CREATE TYPE notification_type AS ENUM ('pickup_ready','expiry_reminder','overdue','system');

-- ---------------------------------------------------------------------------
-- USERS  (mirrors auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE public.users (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name        TEXT NOT NULL,
  email            TEXT UNIQUE NOT NULL,
  role             user_role NOT NULL DEFAULT 'research_associate',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-insert a users row when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'research_associate')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- SETTINGS
-- ---------------------------------------------------------------------------
CREATE TABLE public.settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

INSERT INTO public.settings (key, value) VALUES
  ('pda_daily_rate_ugx',       '5000'),
  ('laptop_daily_rate_ugx',    '20000'),
  ('laptop_useful_life_years', '3'),
  ('pda_useful_life_years',    '2');

-- ---------------------------------------------------------------------------
-- ASSETS
-- ---------------------------------------------------------------------------
CREATE TABLE public.assets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type     asset_type NOT NULL,
  asset_tag      TEXT UNIQUE NOT NULL,
  serial_number  TEXT UNIQUE NOT NULL,
  model          TEXT NOT NULL,
  manufacturer   TEXT,
  purchase_date  DATE NOT NULL,
  purchase_cost  NUMERIC(12,2) NOT NULL,
  status         asset_status NOT NULL DEFAULT 'available',
  condition      asset_condition NOT NULL DEFAULT 'good',
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assets_type_status ON public.assets (asset_type, status);

-- Keep updated_at current
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER assets_updated_at BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- PROJECTS
-- ---------------------------------------------------------------------------
CREATE TABLE public.projects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name      TEXT NOT NULL,
  project_code      TEXT UNIQUE NOT NULL,
  grant_code        TEXT,
  budget_holder_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  field_manager_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- LEASES
-- ---------------------------------------------------------------------------
CREATE TABLE public.leases (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id          UUID NOT NULL REFERENCES public.assets(id),
  project_id        UUID NOT NULL REFERENCES public.projects(id),
  booked_by_id      UUID NOT NULL REFERENCES public.users(id),
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  daily_rate_ugx    NUMERIC(10,2) NOT NULL,
  total_cost_ugx    NUMERIC(12,2) NOT NULL,
  adjusted_cost_ugx NUMERIC(12,2),
  status            lease_status NOT NULL DEFAULT 'active',
  returned_date     DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT leases_dates_check CHECK (end_date > start_date)
);

CREATE INDEX idx_leases_asset_status ON public.leases (asset_id, status);
CREATE INDEX idx_leases_project ON public.leases (project_id);
CREATE INDEX idx_leases_booked_by ON public.leases (booked_by_id);

CREATE TRIGGER leases_updated_at BEFORE UPDATE ON public.leases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Prevent double-booking: only one active lease per asset at a time
CREATE OR REPLACE FUNCTION public.check_asset_availability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.leases
    WHERE asset_id = NEW.asset_id
      AND status = 'active'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Already assigned';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER before_lease_insert
  BEFORE INSERT ON public.leases
  FOR EACH ROW EXECUTE FUNCTION public.check_asset_availability();

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------------------------
CREATE TABLE public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type       notification_type NOT NULL DEFAULT 'system',
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications (user_id, is_read, created_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper: current user's role
CREATE OR REPLACE FUNCTION public.my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role::TEXT FROM public.users WHERE id = auth.uid();
$$;

-- USERS policies
CREATE POLICY "Users: read own row"       ON public.users FOR SELECT USING (id = auth.uid() OR public.my_role() = 'admin');
CREATE POLICY "Users: admin full write"   ON public.users FOR ALL    USING (public.my_role() = 'admin');

-- SETTINGS policies
CREATE POLICY "Settings: all read"        ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Settings: admin write"     ON public.settings FOR ALL    USING (public.my_role() = 'admin');

-- ASSETS policies
CREATE POLICY "Assets: all authenticated read" ON public.assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Assets: admin write"            ON public.assets FOR INSERT WITH CHECK (public.my_role() = 'admin');
CREATE POLICY "Assets: admin update"           ON public.assets FOR UPDATE USING (public.my_role() IN ('admin'));
CREATE POLICY "Assets: admin delete"           ON public.assets FOR DELETE USING (public.my_role() = 'admin');
-- Allow system (service role) to update status when lease is created/returned
CREATE POLICY "Assets: lease status update"    ON public.assets FOR UPDATE TO authenticated USING (true);

-- PROJECTS policies
CREATE POLICY "Projects: all authenticated read" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Projects: admin write"            ON public.projects FOR ALL    USING (public.my_role() = 'admin');

-- LEASES policies
CREATE POLICY "Leases: own or privileged read" ON public.leases FOR SELECT TO authenticated USING (
  booked_by_id = auth.uid()
  OR public.my_role() IN ('admin', 'finance')
  OR (public.my_role() = 'project_manager' AND project_id IN (
    SELECT id FROM public.projects WHERE budget_holder_id = auth.uid()
  ))
);
CREATE POLICY "Leases: authenticated insert" ON public.leases FOR INSERT TO authenticated WITH CHECK (booked_by_id = auth.uid());
CREATE POLICY "Leases: admin update"         ON public.leases FOR UPDATE USING (public.my_role() = 'admin' OR booked_by_id = auth.uid());

-- NOTIFICATIONS policies
CREATE POLICY "Notifications: own only"      ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Notifications: own update"    ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Notifications: authenticated insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================================================
-- VIEWS (convenience)
-- =============================================================================

CREATE VIEW public.active_leases AS
  SELECT
    l.*,
    a.asset_tag, a.asset_type, a.model,
    p.project_name, p.project_code,
    u.full_name AS booked_by_name
  FROM public.leases l
  JOIN public.assets   a ON a.id = l.asset_id
  JOIN public.projects p ON p.id = l.project_id
  JOIN public.users    u ON u.id = l.booked_by_id
  WHERE l.status = 'active';
