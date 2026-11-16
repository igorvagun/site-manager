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
| Drawings | Library of project drawings (images, PDF) with a zooming viewer |
| Task journal | Start/finish marks, labour cost from hourly rates, attached drawing, voice and video notes, a chat per task |
| Time clock | Workers clock in and out; managers see today, the weekly hours table and labour cost |
| Receipts | Photograph a receipt and save it as a project expense (AI reading when connected) |
| To-do | The manager's private checklist: lists, priorities, due dates, sub-steps, pinning |
| Contacts | Directory of contractors, engineers, architects, suppliers; call, WhatsApp or in-app chat |
| AI analyst | Day / week / month statistics from all tasks, chats and shifts; written conclusions when AI is connected |
| Project settings | Look (wallpaper, accent), details, delete project |

Chats (per task, per worker, per contact) support text, voice notes, photos, video, files, replies and reactions.
A bell on the desktop notifies managers when workers clock in or out, when tasks start or finish, and of new messages;
each kind can be switched off in Settings.

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
| Drawings | Library of project drawings (images, PDF) with a zooming viewer |
| Task journal | Start/finish marks, labour cost from hourly rates, attached drawing, voice and video notes, a chat per task |
| Time clock | Workers clock in and out; managers see today, the weekly hours table and labour cost |
| Receipts | Photograph a receipt and save it as a project expense (AI reading when connected) |
| To-do | The manager's private checklist: lists, priorities, due dates, sub-steps, pinning |
| Contacts | Directory of contractors, engineers, architects, suppliers; call, WhatsApp or in-app chat |
| AI analyst | Day / week / month statistics from all tasks, chats and shifts; written conclusions when AI is connected |
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

## AI features (optional)

Receipt reading and the AI analyst's written conclusions call Claude through the Supabase Edge Function in
`supabase/functions/ai`, so the API key never reaches the browser:

```bash
supabase secrets set ANTHROPIC_API_KEY=...
supabase functions deploy ai
```

Without it the app still works: receipts are typed in by hand and the analyst page shows computed statistics only.

## Files

Drawings, recordings and photos are stored in the browser (IndexedDB) in local mode and in the Supabase Storage
bucket `files` in cloud mode. JSON backups contain data only, not these files.
