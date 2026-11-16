# Site Manager

Construction site management app with an Apple-style translucent ("liquid glass") interface.
Hebrew (RTL) and English, light and dark themes, desktop and mobile.

## How it is organised

1. **Sign in.** The app recognises the person's role (project manager, foreman, worker) and shows only what that role may use.
2. **Home desktop.** App icons, like a phone home screen: one icon per project, plus New project, Positions (job titles with default hourly rates) and Settings.
3. **Project desktop.** Each project has its own wallpaper and accent colour (changeable in Project settings) and its own set of sub-apps and data.

| Project sub-app | What it does |
| --- | --- |
| Dashboard | Progress vs plan, budget, crew, alerts, cumulative-spend chart, next 7 days |
| Team | Workers of this project with full details, daily attendance and hours |
| Schedule | Task list with inline progress/status, priority reordering, Gantt timeline |
| Daily Log | Site diary: weather, crew, work done, delays, photos, print |
| Budget | Budget vs actual by category, expenses, change orders, forecast |
| Issues | Punch list and RFIs on a drag-and-drop board |
| Safety | Inspections with checklist, toolbox talks, hazards, incidents |
| Materials | On-site stock, minimum levels, deliveries |
| Project settings | Look (wallpaper, accent), details, delete project |

Planned next (shown as "Soon" on the desktop): Drawings library, Task journal with per-task chat
and voice/video notes, Time clock, Receipt capture, Manager to-do, Contacts directory.

Hebrew (RTL) and English, light and dark, desktop and mobile. Lists export to CSV.

## Run

```bash
npm install
npm run dev
```

With no configuration the app runs in **local mode**: data is stored in the browser and
starts with demo content. Three demo accounts are listed on the sign-in screen
(password `demo`). Local mode is a single-browser demo — its sign-in is not real security.

## Cloud sync (optional)

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. Copy `.env.example` to `.env.local` and fill in the URL and anon key.
3. Restart the app, then use Settings → "Load demo data" if you want sample content.

Read the security note at the top of `supabase/schema.sql` before putting real data in it.
