import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useStore, addRow } from '../lib/store';
import { ACCENTS, WALLPAPERS } from '../lib/apps';
import { Icon, IconButton, Glass, Ring, EntityForm } from '../components/ui';
import { useMetrics } from './Dashboard';
import { nav } from '../lib/nav';
import { todayISO, addDays, fmtDate, fmtMoney, sum, taskBudget } from '../lib/utils';

export function AppIcon({ icon, color, label, onClick, soon, badge, accent }) {
  const { t } = useI18n();
  return (
    <button className={`app ${soon ? 'soon' : ''}`} onClick={onClick} disabled={soon} title={soon ? `${label} — ${t('coming_soon')}` : label}>
      <span className={`app-icon c-${color}`} data-accent={accent}>
        <Icon name={icon} size={30} />
        {badge > 0 && <i className="app-badge">{badge}</i>}
      </span>
      <span className="app-label">{label}</span>
      {soon && <span className="app-soon">{t('soon')}</span>}
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
  const loc = lang === 'he' ? 'he-IL' : 'en-GB';
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
              {t('role_' + user.role)} · {projects.length} {t('projects_word')}
            </p>
          </>
        )}
      </div>

      <div className="widgets">
        <Clock />
        {project ? user.role !== 'worker' && <ProjectWidgets project={project} /> : <PortfolioWidget projects={projects} />}
      </div>

      <nav className="app-grid" aria-label={t('apps')}>
        {!project &&
          projects.map((p) => (
            <AppIcon key={p.id} icon="building" color="accent" accent={p.accent} label={p.name} onClick={() => nav(`p/${p.id}`)} />
          ))}
        {!project && isManager && <AppIcon icon="plus" color="glass" label={t('new_project')} onClick={() => setCreating(true)} />}
        {apps.map((a) => (
          <AppIcon
            key={a.id}
            icon={a.icon}
            color={a.color}
            label={t('nav_' + a.id)}
            soon={a.soon}
            onClick={() => nav(project ? `p/${project.id}/${a.id}` : `app/${a.id}`)}
          />
        ))}
      </nav>

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
