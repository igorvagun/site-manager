# Site Manager

Construction site management app with an Apple-style translucent ("liquid glass") interface.
Hebrew (RTL) and English, light and dark themes, desktop and mobile.

## Modules

| Screen | What it does |
| --- | --- |
| Dashboard | Overall progress vs plan, budget, crew, alerts, cumulative-spend chart, next 7 days |
| Schedule | Task list with inline progress/status, priority reordering, Gantt timeline |
| Daily Log | Site diary: weather, crew, work done, delays, progress photos, print |
| Team | Workers, daily attendance and hours, labor cost per day |
| Budget | Budget vs actual by category, expenses, change orders, forecast at completion |
| Issues | Punch list and RFIs on a drag-and-drop board |
| Safety | Inspections with checklist, toolbox talks, hazards, incidents |
| Materials | On-site stock, minimum levels, deliveries |
| Settings | Project details, language, theme, JSON backup/restore, demo data |

Every list exports to CSV.

## Run

```bash
npm install
npm run dev
```

With no configuration the app runs in **local mode**: data is stored in the browser and
starts with demo content.

## Cloud sync (optional)

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. Copy `.env.example` to `.env.local` and fill in the URL and anon key.
3. Restart the app, then use Settings → "Load demo data" if you want sample content.

Read the security note at the top of `supabase/schema.sql` before putting real data in it.
