import { useEffect, useState } from 'react';
import { subLate } from './Subcontracts';
import { docsNeedingAttention } from './Documents';
import { useI18n } from '../lib/i18n';
import { useStore, useData, addRow } from '../lib/store';
import { lastOpened, hiddenApps, setHiddenApps, appOrder, setAppOrder } from '../lib/prefs';
import { clockIn, clockOut } from '../lib/clock';
import { startTask, finishTask } from './TaskJournal';
import { equipmentAlerts } from './Equipment';
import { ACCENTS, WALLPAPERS, APP_GROUPS } from '../lib/apps';
import { Icon, IconButton, Glass, Ring, EntityForm } from '../components/ui';
import { useMetrics } from './Dashboard';
import { nav } from '../lib/nav';
import Notifications from '../components/Notifications';
import { todayISO, addDays, fmtDate, fmtTime, fmtMoney, fmtHours, hoursBetween, sum, taskBudget, locale, setWorkCalendar } from '../lib/utils';

export function AppIcon({ icon, color, label, onClick, soon, badge, accent, hidden, pressed }) {
  const { t } = useI18n();
  return (
    <button className={`app ${soon ? 'soon' : ''} ${hidden ? 'is-hidden' : ''}`} onClick={onClick} disabled={soon} aria-pressed={pressed} title={soon ? `${label} — ${t('coming_soon')}` : label}>
      <span className={`app-icon c-${color}`} data-accent={accent}>
        <Icon name={icon} size={30} />
        {badge > 0 && <i className="app-badge">{badge}</i>}
      </span>
      <span className="app-label">{label}</span>
      {soon && <span className="app-soon">{t('soon')}</span>}
      {hidden && <span className="app-soon">{t('hidden')}</span>}
    </button>
  );
}

function Clock() {
  const { lang } = useI18n();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);
  const loc = locale(lang);
  return (
    <Glass className="widget clock">
      <b>{now.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}</b>
      <span>{now.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
    </Glass>
  );
}

// Home: every project at a glance.
function PortfolioWidget({ projects }) {
  const { t } = useI18n();
  const { data } = useStore();
  return (
    <Glass className="widget portfolio">
      <h3>{t('my_projects')}</h3>
      {projects.length === 0 && <p className="muted">{t('no_projects')}</p>}
      {projects.slice(0, 4).map((p) => {
        setWorkCalendar(p);
        const tasks = data.tasks.filter((x) => x.project_id === p.id);
        const w = sum(tasks, taskBudget) || 1;
        const pct = Math.round(sum(tasks, (x) => taskBudget(x) * (x.progress || 0)) / w);
        return (
          <button key={p.id} className="portfolio-row" onClick={() => nav(`p/${p.id}`)} data-accent={p.accent}>
            <span className="grow">{p.name}</span>
            <span className="mini-meter">
              <i style={{ width: pct + '%' }} />
            </span>
            <b>{pct}%</b>
          </button>
        );
      })}
    </Glass>
  );
}

// Numbers shown on the app icons of a project: things waiting for attention.
function useBadges(user, project) {
  const data = useData();
  if (!project) return {};
  const today = todayISO();
  const lead = user.role !== 'worker';
  const me = data.workers.find((w) => w.user_id === user.id);
  const mine = (task) => lead || (!!me && (task?.workers || []).includes(me.name));
  const seen = lastOpened(user.id, project.id, 'tasklog');
  return {
    schedule: data.tasks.filter((x) => mine(x) && (x.status === 'delayed' || (x.status !== 'done' && x.end_date < today))).length,
    issues: data.issues.filter((x) => x.status !== 'done' && x.due_date && x.due_date < today).length,
    safety: data.safety.filter((x) => x.status === 'open').length,
    // Managers also see requests waiting for their approval.
    materials: data.materials.filter((x) => Number(x.qty) < Number(x.min_qty)).length + (user.role === 'manager' ? data.requests.filter((r) => r.status === 'pending').length : 0),
    subs: data.subcontracts.filter((x) => subLate(x, today)).length,
    docs: docsNeedingAttention(data.documents, today).length,
    quality: data.inspections.filter((x) => x.status === 'failed').length,
    equipment: equipmentAlerts(data.equipment, today).overdue.length + data.equipment.filter((e) => e.status !== 'returned' && e.inspection_date && e.inspection_date < today).length,
    todo: data.todos.filter((x) => x.user_id === user.id && !x.done && x.due_date && x.due_date <= today).length,
    tasklog: data.messages.filter(
      (m) => m.thread.startsWith('task:') && m.sender_id !== user.id && !m.deleted && String(m.created_at) > seen && mine(data.tasks.find((x) => 'task:' + x.id === m.thread))
    ).length,
  };
}

// For anyone on the crew: clock in/out and their own tasks, right on the desktop.
function MyDay({ project, user, me }) {
  const { t, lang } = useI18n();
  const data = useData();
  const today = todayISO();
  const open = data.shifts.find((s) => s.worker_id === me.id && s.clock_in && !s.clock_out);
  const hours = sum(data.shifts.filter((s) => s.worker_id === me.id && s.date === today), (s) => hoursBetween(s.clock_in, s.clock_out || new Date()));
  const tasks = data.tasks
    .filter((x) => (x.workers || []).includes(me.name) && !x.finished_at && x.status !== 'done')
    .sort((a, b) => Number(!!b.started_at) - Number(!!a.started_at) || String(a.start_date).localeCompare(String(b.start_date)))
    .slice(0, 3);
  return (
    <Glass className="widget myday">
      <div className="myday-clock">
        <div>
          <h3>{t('my_day')}</h3>
          <b>{open ? `${t('on_shift_since')} ${fmtTime(open.clock_in, lang)}` : hours > 0 ? t('shift_finished') : t('shift_not_started')}</b>
          <span>
            {t('today')}: {fmtHours(hours)} {t('hrs')}
          </span>
        </div>
        {open ? (
          <button className="punch-btn out small" onClick={() => clockOut(open, user.id)}>
            <Icon name="stop" size={18} />
            {t('end_shift')}
          </button>
        ) : (
          <button className="punch-btn small" onClick={() => clockIn(me, user.id)}>
            <Icon name="play" size={18} />
            {t('start_shift')}
          </button>
        )}
      </div>
      <div className="myday-tasks">
        <h3>{t('my_tasks')}</h3>
        {tasks.length === 0 && <p className="muted">{t('no_my_tasks')}</p>}
        {tasks.map((x) => (
          <div className="myday-task" key={x.id}>
            <button className="grow" onClick={() => nav(`p/${project.id}/tasklog?q=${encodeURIComponent(x.name)}`)}>
              {x.name}
            </button>
            {x.started_at ? (
              <button className="btn small" onClick={() => finishTask(x, user)}>
                <Icon name="check" size={13} />
                {t('finish_task')}
              </button>
            ) : (
              <button className="btn small" onClick={() => startTask(x, user)}>
                <Icon name="play" size={13} />
                {t('start_task')}
              </button>
            )}
          </div>
        ))}
      </div>
    </Glass>
  );
}

// A new project starts empty; this walks the manager through filling it.
function GettingStarted({ project }) {
  const { t } = useI18n();
  const data = useData();
  const steps = [
    { app: 'team', icon: 'users', label: t('gs_team'), done: data.workers.length > 0 },
    { app: 'tasklog', icon: 'chat', label: t('gs_tasks'), done: data.tasks.length > 0 },
    { app: 'drawings', icon: 'layers', label: t('gs_drawings'), done: data.drawings.length > 0 },
    { app: 'budget', icon: 'wallet', label: t('gs_budget'), done: data.budget_lines.length > 0 },
    { app: 'contacts', icon: 'phone', label: t('gs_contacts'), done: data.contacts.length > 0 },
  ];
  const left = steps.filter((s) => !s.done).length;
  if (data.workers.length > 0 && data.tasks.length > 0) return null;
  return (
    <Glass className="widget getting-started">
      <h3>
        {t('gs_title')} · {steps.length - left}/{steps.length}
      </h3>
      <div className="gs-steps">
        {steps.map((s) => (
          <button key={s.app} className={`gs-step ${s.done ? 'done' : ''}`} onClick={() => nav(`p/${project.id}/${s.app}`)}>
            <span className={`check ${s.done ? 'on' : ''}`}>{s.done && <Icon name="check" size={14} />}</span>
            <Icon name={s.icon} size={16} />
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </Glass>
  );
}

// Project desktop: this project's vital signs.
function ProjectWidgets({ project }) {
  const { t, lang } = useI18n();
  const m = useMetrics();
  const variance = Math.round(m.progress - m.planned);
  const tone = variance >= -3 ? 'green' : variance >= -10 ? 'orange' : 'red';
  return (
    <>
      <Glass as="button" className="widget progress" onClick={() => nav(`p/${project.id}/dashboard`)}>
        <Ring value={m.progress} size={92} stroke={9} tone={tone}>
          <b>{Math.round(m.progress)}%</b>
        </Ring>
        <div>
          <h3>{t('overall_progress')}</h3>
          <span>
            {t('days_left')}: <b>{m.daysLeft == null ? '—' : Math.max(0, m.daysLeft)}</b>
          </span>
          <span>
            {t('handover')}: <b>{fmtDate(project.end_date, lang, { day: 'numeric', month: 'short', year: '2-digit' })}</b>
          </span>
        </div>
      </Glass>
      <Glass className="widget facts">
        <div>
          <span>{t('on_site_today')}</span>
          <b>
            {m.onSite}/{m.activeWorkers}
          </b>
        </div>
        <div>
          <span>{t('budget_spent')}</span>
          <b>{fmtMoney(m.spent, m.cur)}</b>
        </div>
        <div>
          <span>{t('open_issues')}</span>
          <b>{m.openIssues.length}</b>
        </div>
      </Glass>
    </>
  );
}

export default function Desktop({ user, project, projects, apps, controls, onLogout }) {
  const { t } = useI18n();
  const [creating, setCreating] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [arranging, setArranging] = useState(false);
  const [hidden, setHidden] = useState(() => hiddenApps(user.id));
  const [order, setOrder] = useState(() => appOrder(user.id));
  const rank = (a) => (order.includes(a.id) ? order.indexOf(a.id) : 1000 + apps.indexOf(a));
  const move = (list, a, dir) => {
    const ids = list.map((x) => x.id);
    const i = ids.indexOf(a.id);
    if (i + dir < 0 || i + dir >= ids.length) return;
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    // Keep the order of the other groups, replace this group's run.
    const next = [...order.filter((id) => !ids.includes(id)), ...ids];
    setOrder(next);
    setAppOrder(user.id, next);
  };
  const toggleHidden = (id) => {
    const next = hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id];
    setHidden(next);
    setHiddenApps(user.id, next);
  };
  const live = projects.filter((p) => !p.archived);
  const archived = projects.filter((p) => p.archived);
  const store = useStore().data;
  const scoped = useData();
  const badges = useBadges(user, project);
  const me = project ? scoped.workers.find((w) => w.user_id === user.id) : null;
  // On the home desktop each project icon shows how many things need attention there.
  const projectBadge = (p) => {
    if (user.role === 'worker') return 0;
    const d = todayISO();
    const of = (name) => store[name].filter((r) => r.project_id === p.id);
    return (
      of('tasks').filter((x) => x.status === 'delayed' || (x.status !== 'done' && x.end_date < d)).length +
      of('issues').filter((x) => x.status !== 'done' && x.due_date && x.due_date < d).length +
      of('safety').filter((x) => x.status === 'open').length
    );
  };
  const isManager = user.role === 'manager';
  const today = todayISO();
  const hour = new Date().getHours();
  const greeting = t(hour < 12 ? 'good_morning' : hour < 18 ? 'good_afternoon' : 'good_evening');

  const projectFields = [
    { key: 'name', label: t('project_name'), required: true },
    { key: 'address', label: t('address') },
    { key: 'client', label: t('client'), half: true },
    { key: 'manager', label: t('site_manager'), half: true },
    { key: 'start_date', label: t('start'), type: 'date', half: true },
    { key: 'end_date', label: t('handover'), type: 'date', half: true },
    { key: 'wallpaper', label: t('wallpaper'), type: 'select', half: true, options: WALLPAPERS.map((w) => ({ value: w, label: t('wall_' + w) })) },
    { key: 'accent', label: t('accent_color'), type: 'select', half: true, options: ACCENTS.map((a) => ({ value: a, label: t('accent_' + a) })) },
  ];
  // Give each new project a look that differs from the ones already on the desktop.
  const used = projects.map((p) => p.wallpaper);
  const nextWall = WALLPAPERS.find((w) => w !== 'aurora' && !used.includes(w)) || 'forest';
  const blank = {
    name: '', address: '', client: '', manager: user.name, start_date: today, end_date: addDays(today, 180), currency: '₪',
    wallpaper: nextWall, accent: { ocean: 'blue', sunset: 'orange', forest: 'green', rose: 'pink', graphite: 'indigo' }[nextWall] || 'blue',
  };

  return (
    <div className="desktop">
      <header className="glass status-bar">
        <div className="status-start">
          {project ? (
            <button className="pill back" onClick={() => nav('')}>
              <Icon name="back" size={18} className="flip-rtl" />
              <span>{t('home')}</span>
            </button>
          ) : (
            <span className="status-brand">
              <span className="brand-mark small">
                <Icon name="hardhat" size={15} />
              </span>
              Site Manager
            </span>
          )}
        </div>
        <div className="status-end">
          <Notifications user={user} projects={projects} />
          {controls}
          <span className="user-chip" title={user.email}>
            <span className="avatar small">{user.name.slice(0, 1)}</span>
            <span className="user-name">
              <b>{user.name}</b>
              <small>{t('role_' + user.role)}</small>
            </span>
          </span>
          <IconButton icon="logout" label={t('sign_out')} onClick={onLogout} tone="flip-rtl" />
        </div>
      </header>

      <div className="desk-head">
        {project ? (
          <>
            <h1>{project.name}</h1>
            <p>{[project.address, project.client].filter(Boolean).join(' · ')}</p>
          </>
        ) : (
          <>
            <h1>
              {greeting}, {user.name.split(' ')[0]}
            </h1>
            <p>
              {t('role_' + user.role)} · {live.length} {t('projects_word')}
            </p>
          </>
        )}
      </div>

      <div className="widgets">
        {!(project && user.role === 'worker') && <Clock />}
        {project && me && <MyDay project={project} user={user} me={me} />}
        {project && isManager && <GettingStarted project={project} />}
        {project ? user.role !== 'worker' && <ProjectWidgets project={project} /> : <PortfolioWidget projects={live} />}
      </div>

      {!project && (
        <nav className="app-grid" aria-label={t('apps')}>
          {!project &&
            (showArchive ? projects : live).map((p) => (
              <AppIcon key={p.id} icon={p.archived ? 'archive' : 'building'} color="accent" accent={p.accent} label={p.name} badge={projectBadge(p)} onClick={() => nav(`p/${p.id}`)} />
            ))}
          {!project && isManager && <AppIcon icon="plus" color="glass" label={t('new_project')} onClick={() => setCreating(true)} />}
          {!project && apps.map((a) => (
            <AppIcon
              key={a.id}
              icon={a.icon}
              color={a.color}
              label={t('nav_' + a.id)}
              soon={a.soon}
              badge={badges[a.id] || 0}
              onClick={() => nav(project ? `p/${project.id}/${a.id}` : `app/${a.id}`)}
            />
          ))}
        </nav>
      )}
      {project &&
        APP_GROUPS.map((g) => {
          const list = apps.filter((a) => a.group === g && (arranging || !hidden.includes(a.id))).sort((a, b) => rank(a) - rank(b));
          if (!list.length) return null;
          return (
            <section className="app-group" key={g} aria-label={t('group_' + g)}>
              <h2>{t('group_' + g)}</h2>
              <nav className="app-grid">
                {list.map((a, i) => (
                  <div className="app-slot" key={a.id}>
                    <AppIcon
                      icon={a.icon}
                      color={a.color}
                      label={t('nav_' + a.id)}
                      badge={arranging ? 0 : badges[a.id] || 0}
                      hidden={hidden.includes(a.id)}
                      pressed={arranging ? !hidden.includes(a.id) : undefined}
                      onClick={() => (arranging ? toggleHidden(a.id) : nav(`p/${project.id}/${a.id}`))}
                    />
                    {arranging && (
                      <div className="app-move">
                        <IconButton icon="up" tone="rot-start" size={14} label={`${t('move_earlier')}: ${t('nav_' + a.id)}`} onClick={() => move(list, a, -1)} disabled={i === 0} />
                        <IconButton icon="up" tone="rot-end" size={14} label={`${t('move_later')}: ${t('nav_' + a.id)}`} onClick={() => move(list, a, 1)} disabled={i === list.length - 1} />
                      </div>
                    )}
                  </div>
                ))}
              </nav>
            </section>
          );
        })}
      {project && (
        <div className="arrange-bar">
          {arranging && <span className="muted">{t('arrange_hint')}</span>}
          <button className={`btn ${arranging ? 'primary' : 'ghost'}`} onClick={() => setArranging(!arranging)}>
            <Icon name={arranging ? 'check' : 'gear'} size={15} />
            {arranging ? t('done') : hidden.length ? `${t('arrange')} · ${hidden.length} ${t('hidden_count')}` : t('arrange')}
          </button>
        </div>
      )}

      {!project && archived.length > 0 && (
        <button className="btn ghost archive-toggle" onClick={() => setShowArchive(!showArchive)}>
          <Icon name="archive" size={15} />
          {showArchive ? t('hide_archive') : `${t('show_archive')} · ${archived.length}`}
        </button>
      )}
      {creating && (
        <EntityForm
          title={t('new_project')}
          fields={projectFields}
          initial={blank}
          onClose={() => setCreating(false)}
          onSave={async (v) => {
            const row = await addRow('projects', v);
            if (row) nav(`p/${row.id}`);
          }}
        />
      )}
    </div>
  );
}
