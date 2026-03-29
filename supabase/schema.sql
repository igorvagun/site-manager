-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  floor TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  daily_cost INTEGER NOT NULL DEFAULT 0,
  workers TEXT[] DEFAULT ARRAY[]::TEXT[],
  notes TEXT DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow anonymous users (anon role) to perform all operations
CREATE POLICY "Allow all operations for anon" ON tasks
  FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

-- Insert initial 12 tasks
INSERT INTO tasks (name, floor, status, progress, start_date, end_date, daily_cost, workers, notes, position)
VALUES
  (
    'עבודות עפר וחפירה',
    'חוץ',
    'done',
    100,
    '2026-01-05',
    '2026-01-20',
    3200,
    ARRAY['משה', 'אחמד'],
    '',
    1
  ),
  (
    'יסודות ורצפת קרקע',
    'קרקע',
    'done',
    100,
    '2026-01-21',
    '2026-02-10',
    4500,
    ARRAY['יוסי', 'דוד'],
    '',
    2
  ),
  (
    'עמודים ושלד קומה א',
    'א',
    'done',
    100,
    '2026-02-11',
    '2026-02-25',
    5100,
    ARRAY['קרלוס', 'ניר'],
    '',
    3
  ),
  (
    'תקרה קומה א',
    'א',
    'done',
    100,
    '2026-02-26',
    '2026-03-10',
    4800,
    ARRAY['עמיר', 'סמיר'],
    '',
    4
  ),
  (
    'עמודים ושלד קומה ב',
    'ב',
    'active',
    65,
    '2026-03-11',
    '2026-03-28',
    5100,
    ARRAY['יוסי', 'אחמד'],
    'בטון מוזמן ל-25/3',
    5
  ),
  (
    'תקרה קומה ב',
    'ב',
    'active',
    20,
    '2026-03-25',
    '2026-04-10',
    4800,
    ARRAY['משה'],
    '',
    6
  ),
  (
    'עמודים ושלד קומה ג',
    'ג',
    'pending',
    0,
    '2026-04-11',
    '2026-04-28',
    5100,
    ARRAY[]::TEXT[],
    '',
    7
  ),
  (
    'תקרה קומה ג',
    'ג',
    'pending',
    0,
    '2026-04-29',
    '2026-05-15',
    4800,
    ARRAY[]::TEXT[],
    '',
    8
  ),
  (
    'קירות חוץ ובידוד',
    'חוץ',
    'pending',
    0,
    '2026-05-16',
    '2026-06-10',
    3900,
    ARRAY[]::TEXT[],
    '',
    9
  ),
  (
    'גמר פנימי קומות',
    'א',
    'pending',
    0,
    '2026-06-11',
    '2026-07-20',
    6200,
    ARRAY[]::TEXT[],
    '',
    10
  ),
  (
    'חשמל ואינסטלציה',
    'ב',
    'delayed',
    30,
    '2026-03-01',
    '2026-04-15',
    2800,
    ARRAY['דניאל', 'אלי'],
    'קבלן משנה - עיכוב בחומרים',
    11
  ),
  (
    'עבודות חוץ ופיתוח',
    'חוץ',
    'pending',
    0,
    '2026-07-21',
    '2026-08-31',
    3500,
    ARRAY[]::TEXT[],
    '',
    12
  );
