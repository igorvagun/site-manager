-- Site Manager — Supabase schema.
-- Safe to re-run. After running, open the app → Settings → "Load demo data" to seed sample content.
-- Sign-in uses Supabase Auth (email + password); create an Auth user for each row in `users`.
--
-- SECURITY NOTE: the policies below give the public anon key full read/write access,
-- matching the original single-table setup. Anyone with the app URL can change data,
-- including private to-do lists, chats and stored files.
-- Before real use, enable Supabase Auth and replace them with `TO authenticated` policies.

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  floor TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  daily_cost NUMERIC NOT NULL DEFAULT 0,
  workers TEXT[] DEFAULT ARRAY[]::TEXT[],
  notes TEXT DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT '',
  address TEXT DEFAULT '',
  client TEXT DEFAULT '',
  manager TEXT DEFAULT '',
  start_date DATE,
  end_date DATE,
  currency TEXT DEFAULT '₪',
  wallpaper TEXT DEFAULT 'aurora',
  accent TEXT DEFAULT 'blue',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-project working calendar: rest days (0 = Sunday … 6 = Saturday) and the standard shift.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS rest_days JSONB DEFAULT '[6]'::JSONB;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS shift_start TEXT DEFAULT '07:00';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS shift_end TEXT DEFAULT '16:00';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- App profiles. `email` must match the Supabase Auth account; `role` decides what the person sees.
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'worker', -- manager | foreman | worker
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT DEFAULT '',
  company TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  daily_rate NUMERIC NOT NULL DEFAULT 0,
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  email TEXT DEFAULT '',
  id_number TEXT DEFAULT '',
  start_date DATE,
  emergency_contact TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'present',
  hours NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS attendance_date_idx ON attendance (date);

CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  author TEXT DEFAULT '',
  weather TEXT DEFAULT 'sunny',
  temp NUMERIC DEFAULT 0,
  crew_count INTEGER DEFAULT 0,
  summary TEXT DEFAULT '',
  delays TEXT DEFAULT '',
  photos JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  vendor TEXT DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  planned NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL,
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'punch',
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  floor TEXT DEFAULT '',
  assignee TEXT DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  due_date DATE,
  photo TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS safety (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'inspection',
  date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'low',
  status TEXT NOT NULL DEFAULT 'closed',
  reporter TEXT DEFAULT '',
  checklist JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT DEFAULT '',
  qty NUMERIC NOT NULL DEFAULT 0,
  min_qty NUMERIC NOT NULL DEFAULT 0,
  supplier TEXT DEFAULT '',
  location TEXT DEFAULT '',
  next_delivery DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ───── Phase 2 tables ─────
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS started_by UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS finished_by UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS drawing_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS media JSONB DEFAULT '[]'::JSONB; -- voice / video notes
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_id TEXT;             -- file id of the receipt photo

-- An issue can be pinned to a spot on a drawing (position in % of the image).
ALTER TABLE issues ADD COLUMN IF NOT EXISTS drawing_id UUID;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS pin_x NUMERIC;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS pin_y NUMERIC;

CREATE TABLE IF NOT EXISTS drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  number TEXT DEFAULT '',
  revision TEXT DEFAULT '',
  discipline TEXT DEFAULT 'architecture',
  file_id TEXT,          -- object name in the "files" storage bucket
  file_name TEXT DEFAULT '',
  file_type TEXT DEFAULT '',
  url TEXT,              -- inline demo drawings only
  uploaded_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One table for every conversation: thread is "task:<id>", "worker:<id>" or "contact:<id>".
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread TEXT NOT NULL,
  sender_id UUID,
  sender_name TEXT DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'text', -- text | audio | video | image | file
  text TEXT DEFAULT '',
  file_id TEXT,
  file_name TEXT DEFAULT '',
  reply_to UUID,
  reactions JSONB DEFAULT '{}'::JSONB,
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messages_thread_idx ON messages (thread, created_at);

CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  in_by UUID,
  out_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS shifts_date_idx ON shifts (date);

CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  list TEXT DEFAULT '',
  priority TEXT DEFAULT 'medium',
  due_date DATE,
  done BOOLEAN DEFAULT FALSE,
  done_at TIMESTAMPTZ,
  pinned BOOLEAN DEFAULT FALSE,
  notes TEXT DEFAULT '',
  subtasks JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT DEFAULT '',
  kind TEXT DEFAULT 'contractor',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS depends_on UUID; -- the task this one must start after

CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'rented',   -- rented | owned
  status TEXT NOT NULL DEFAULT 'on_site', -- on_site | maintenance | returned
  supplier TEXT DEFAULT '',
  daily_rate NUMERIC NOT NULL DEFAULT 0,
  start_date DATE,
  return_date DATE,
  returned_on DATE,
  inspection_date DATE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE issues ADD COLUMN IF NOT EXISTS created_by UUID;

-- Reusable task chains saved from real schedules. steps: [{ name, days, cost }]
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Planned time off, shown in the week plan.
CREATE TABLE IF NOT EXISTS absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'leave', -- leave | sick | other
  "from" DATE NOT NULL,
  "to" DATE NOT NULL,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- History: who changed what. changes: [{ field, from, to }]
CREATE TABLE IF NOT EXISTS activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID,
  user_name TEXT DEFAULT '',
  action TEXT NOT NULL,       -- add | update | delete
  collection TEXT NOT NULL,
  row_id UUID,
  title TEXT DEFAULT '',
  changes JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS activity_at_idx ON activity (at);

-- Material requests: pending → approved → ordered → delivered (or rejected).
CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID,
  name TEXT DEFAULT '',
  unit TEXT DEFAULT '',
  qty NUMERIC NOT NULL DEFAULT 0,
  needed_by DATE,
  note TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by TEXT DEFAULT '',
  approved_by TEXT, approved_at TIMESTAMPTZ,
  rejected_by TEXT, rejected_at TIMESTAMPTZ,
  ordered_by TEXT, ordered_at TIMESTAMPTZ,
  delivered_by TEXT, delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quality checks. items: [{ text, state: pass|fail|na, note, issue_id }]
CREATE TABLE IF NOT EXISTS inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage TEXT NOT NULL,
  date DATE NOT NULL,
  task_id UUID,
  floor TEXT DEFAULT '',
  location TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open', -- open | passed | failed
  inspector TEXT DEFAULT '',
  signed_at TIMESTAMPTZ,
  items JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Progress statements for the client. lines: [{ task_id, name, value, prev, now, amount }]
CREATE TABLE IF NOT EXISTS statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL,
  date DATE NOT NULL,
  markup NUMERIC DEFAULT 0,
  note TEXT DEFAULT '',
  lines JSONB NOT NULL DEFAULT '[]'::JSONB,
  total NUMERIC NOT NULL DEFAULT 0,
  paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subcontracts. payments: [{ id, date, amount, note, expense_id }]
CREATE TABLE IF NOT EXISTS subcontracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trade TEXT DEFAULT '',
  contact_id UUID,
  scope TEXT DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  retention NUMERIC DEFAULT 0,
  retention_released BOOLEAN DEFAULT FALSE,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active', -- active | paused | done
  progress NUMERIC DEFAULT 0,
  payments JSONB NOT NULL DEFAULT '[]'::JSONB,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project documents: permits, insurance, certificates, licences.
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'other',
  number TEXT DEFAULT '',
  issuer TEXT DEFAULT '',
  holder TEXT DEFAULT '',
  issued_on DATE,
  expires_on DATE,
  file_id TEXT, file_name TEXT, file_type TEXT,
  added_by TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- The account's own quality checklists (shared by all projects). items: [text]
CREATE TABLE IF NOT EXISTS checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '';

-- Lost working days (weather, late deliveries…) recorded against the schedule.
CREATE TABLE IF NOT EXISTS delays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  days INT NOT NULL DEFAULT 1,
  reason TEXT NOT NULL DEFAULT 'weather', -- weather | supply | inspection | other
  note TEXT DEFAULT '',
  title TEXT DEFAULT '',
  moved INT DEFAULT 0,
  by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meetings. attendees: [name]; actions: [{ id, text, assignee, due_date, done, issue_id }]
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  date DATE NOT NULL,
  place TEXT DEFAULT '',
  attendees JSONB NOT NULL DEFAULT '[]'::JSONB,
  notes TEXT DEFAULT '',
  actions JSONB NOT NULL DEFAULT '[]'::JSONB,
  author TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- File storage for drawings, voice and video notes, chat attachments and receipt photos.
INSERT INTO storage.buckets (id, name, public) VALUES ('files', 'files', FALSE) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "site-manager files" ON storage.objects;
CREATE POLICY "site-manager files" ON storage.objects FOR ALL USING (bucket_id = 'files') WITH CHECK (bucket_id = 'files');

-- Every project-scoped table points at its project; deleting a project removes its rows.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['tasks','workers','attendance','logs','expenses',
                           'budget_lines','change_orders','issues','safety','materials',
                           'drawings','messages','shifts','todos','contacts','equipment','absences','activity','requests','inspections','statements','subcontracts','documents','delays','meetings']
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (project_id)', t || '_project_idx', t);
  END LOOP;
END $$;

-- Row level security + realtime for every table.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects','users','positions','templates','checklists','tasks','workers','attendance','logs','expenses',
                           'budget_lines','change_orders','issues','safety','materials',
                           'drawings','messages','shifts','todos','contacts','equipment','absences','activity','requests','inspections','statements','subcontracts','documents','delays','meetings']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all operations for anon" ON %I', t);
    EXECUTE format('CREATE POLICY "Allow all operations for anon" ON %I FOR ALL USING (TRUE) WITH CHECK (TRUE)', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = t
    ) AND EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;
  END LOOP;
END $$;
