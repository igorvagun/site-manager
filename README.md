# Site Manager

Construction site management app with an Apple-style translucent interface in light pastel colours.
Hebrew (RTL), English and Russian; desktop and phone; installable and usable offline.

## How it is organised

1. **Sign in.** The app recognises the person's role — project manager, foreman or worker — and shows only what that role may use.
2. **Home desktop.** App icons, like a phone home screen: one icon per project, plus New project, All projects (side-by-side comparison), Accounts, Positions and Settings.
3. **Project desktop.** Each project has its own wallpaper and accent colour, its own data, and its own set of sub-apps. Icons carry a count of things needing attention.

### Project sub-apps

| App | What it does |
| --- | --- |
| Dashboard | Progress vs plan, handover forecast at the current pace, budget, crew, alerts, spend chart, next 7 days |
| Team | Workers with full details, daily attendance, chat with each worker |
| Schedule | Task list and Gantt, priorities, dependencies with one-tap shifting, built-in and your own task templates |
| Calendar | Every dated item of the project on a month grid |
| Daily Log | Site diary pre-drafted from the day's tasks; photos; printable daily report |
| Budget | Budget vs actual by category, expenses, change orders, forecast |
| Issues | Punch list and RFIs on a drag-and-drop board; issues can be pinned to a drawing |
| Safety | Inspections with checklist, toolbox talks, hazards, incidents |
| Materials | On-site stock, minimum levels, deliveries |
| Equipment | Machinery on site, rentals with running cost, return dates, inspections |
| Photos | Every photo from daily logs, issues and task chats, by date |
| Drawings | Library of drawings (images, PDF), zooming viewer, issue pins |
| Task journal | Start/finish marks, labour cost from hourly rates and clocked hours, attached drawing, voice and video notes, a chat per task |
| Time clock | Workers clock in and out; managers see today, the weekly table and a monthly payroll estimate |
| Receipts | Photograph a receipt and save it as a project expense (AI reading when connected) |
| To-do | The manager's private checklist: lists, priorities, due dates, sub-steps, pinning |
| Contacts | Contractors, engineers, architects, suppliers; call, WhatsApp or in-app chat |
| AI analyst | Day / week / month statistics from tasks, chats and shifts; written conclusions when AI is connected |
| Project settings | Look (wallpaper, accent), details, delete project |

### Across the app

- **Search** (magnifier or Ctrl/Cmd+K) finds projects, apps, tasks, people, drawings, issues and materials.
- **Notifications** (bell) for clock-ins, tasks started or finished, and new messages; each kind can be switched off.
- **My day** on the project desktop: clock in/out and your own tasks.
- **Chats** — per task, per worker, per contact — with text, voice notes, photos, video, files, replies and reactions.
- **Undo** for a few seconds after any delete. Lists export to CSV; workers and tasks can be imported from CSV.
- **Working calendar** per project (rest days, standard shift) in Project settings; all date and cost maths follows it.

### Roles

| | Manager | Foreman | Worker |
| --- | --- | --- | --- |
| Create projects, accounts, positions | yes | no | no |
| Budget, to-do, AI analyst, project settings | yes | no | no |
| Team, materials, equipment, receipts, contacts, dashboard | yes | yes | no |
| Edit the schedule, see costs and pay rates | yes | yes | no |
| Write the daily log, keep safety records, edit or delete any issue | yes | yes | no |
| Own tasks, time clock, drawings, calendar; raise issues, report hazards, read the daily log | yes | yes | yes |

## Run

```bash
npm install
npm run dev
```

With no configuration the app runs in **local mode**: data is stored in this browser and starts with demo
content in the language chosen at first launch. Demo accounts are listed on the sign-in screen (password `demo`).
Local mode is a single-browser demo: its sign-in and role limits are not real security.

`npm run build` produces the production build, which registers a service worker so the app can be installed
and opened offline.

## Cloud sync (optional, not yet tested against a live project)

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. Copy `.env.example` to `.env.local` and fill in the project URL and anon key.
3. Create a Supabase Auth user for each row in the `users` table (same email).
4. Restart the app; Settings → "Load demo data" adds sample content.

Read the security note at the top of `supabase/schema.sql` first: its policies are open to anyone with the
anon key and must be tightened before real data goes in.

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

## Estimates to check against your own rules

- **Labour cost of a task:** hours between start and finish × each worker's hourly rate, using the time clock, or the project's standard shift when there is no entry.
- **Payroll:** hours above the project's standard shift in a day count as overtime — the first 2 at 125%, the rest at 150%.
- **Handover forecast:** project length ÷ (actual progress ÷ planned progress).
