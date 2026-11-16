import { useEffect, useState } from 'react';
import { useI18n, LANGS, LANG_NAMES } from './lib/i18n';
import { initStore, useStore, useUser, setProject, logout } from './lib/store';
import { PROJECT_APPS, HOME_APPS } from './lib/apps';
import { Icon, Toasts, IconButton } from './components/ui';
import Login from './views/Login';
import Desktop from './views/Desktop';
import { nav } from './lib/nav';
import { homeStyle, markOpened } from './lib/prefs';
import Spotlight from './components/Spotlight';

// #/                    → home desktop
// #/app/<id>            → account-level app
// #/p/<projectId>       → project desktop
// #/p/<projectId>/<id>  → project app
const readRoute = () => {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'app' && parts[1]) return { app: parts[1], query };
  if (parts[0] === 'p' && parts[1]) return { pid: parts[1], app: parts[2] || null, query };
  return { query };
};

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('site-manager:theme') || 'light';
    } catch {
      return 'light';
    }
  });
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const d = theme === 'dark' || (theme === 'auto' && mq.matches);
      document.documentElement.dataset.theme = d ? 'dark' : 'light';
      setDark(d);
    };
    apply();
    mq.addEventListener('change', apply);
    try {
      localStorage.setItem('site-manager:theme', theme);
    } catch {
      /* private mode */
    }
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
  return [theme, setTheme, dark];
}

export default function App() {
  const { t, lang, setLang } = useI18n();
  const { loading, data, projectId } = useStore();
  const user = useUser();
  const [route, setRoute] = useState(readRoute);
  const [theme, setTheme, isDark] = useTheme();
  const [searching, setSearching] = useState(false);
  const [prefsTick, setPrefsTick] = useState(0);

  useEffect(() => {
    initStore(lang);
    const onHash = () => setRoute(readRoute());
    const onPrefs = () => setPrefsTick((n) => n + 1);
    // Cmd/Ctrl+K opens search from anywhere.
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearching((s) => !s);
      }
    };
    addEventListener('hashchange', onHash);
    addEventListener('site-manager:prefs', onPrefs);
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('hashchange', onHash);
      removeEventListener('site-manager:prefs', onPrefs);
      removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Which projects this person may open: managers see all, others only where they are on the crew.
  const myProjects = !user
    ? []
    : user.role === 'manager'
    ? data.projects
    : data.projects.filter((p) => data.workers.some((w) => w.project_id === p.id && w.user_id === user.id));
  const project = route.pid ? myProjects.find((p) => p.id === route.pid) : null;
  const apps = (project ? PROJECT_APPS : HOME_APPS).filter((a) => user && a.roles.includes(user.role));
  const app = route.app ? apps.find((a) => a.id === route.app && a.view) : null;

  useEffect(() => {
    setProject(project ? project.id : null);
  }, [project]);

  // Each project carries its own look; the home desktop uses the default one.
  useEffect(() => {
    const el = document.documentElement;
    const home = user ? homeStyle(user.id) : { wallpaper: 'aurora', accent: 'blue' };
    el.dataset.wall = project?.wallpaper || home.wallpaper;
    el.dataset.accent = project?.accent || home.accent;
  }, [project?.wallpaper, project?.accent, user?.id, !!project, prefsTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Remember when each project app was last opened (drives the "new" badges on its icon).
  useEffect(() => {
    if (user && project && app) markOpened(user.id, project.id, app.id);
  }, [user?.id, project?.id, app?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unknown or forbidden route → fall back to the nearest valid screen.
  useEffect(() => {
    if (loading || !user) return;
    if (route.pid && !project) nav('');
    else if (route.app && !app) nav(project ? `p/${project.id}` : '');
  }, [loading, user, route, project, app]);

  const controls = (
    <div className="pill-group">
      {user && <IconButton icon="search" label={`${t('search_everything')} (Ctrl+K)`} onClick={() => setSearching(true)} />}
      <label className="pill lang-pick">
        <Icon name="globe" size={16} />
        <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('language')}>
          {LANGS.map((l) => (
            <option key={l} value={l}>
              {LANG_NAMES[l]}
            </option>
          ))}
        </select>
      </label>
      <IconButton icon={isDark ? 'sun' : 'moon'} label={t('toggle_theme')} onClick={() => setTheme(isDark ? 'light' : 'dark')} />
    </div>
  );

  let body;
  if (loading) {
    body = (
      <div className="loading">
        <div className="spinner" />
        {t('loading')}
      </div>
    );
  } else if (!user) {
    body = <Login controls={controls} />;
  } else if (app && (!project || projectId === project.id)) {
    const View = app.view;
    const backTo = project ? `p/${project.id}` : '';
    body = (
      <div className="window">
        <header className="glass window-bar">
          <button className="pill back" onClick={() => nav(backTo)}>
            <Icon name="back" size={18} className="flip-rtl" />
            <span>{project ? project.name : t('home')}</span>
          </button>
          <div className="window-title">
            <span className={`app-icon tiny c-${app.color}`}>
              <Icon name={app.icon} size={13} />
            </span>
            {t('nav_' + app.id)}
          </div>
          {controls}
        </header>
        <main className="view" key={route.pid + ':' + app.id + ':' + route.query}>
          <View go={(id) => nav(`${backTo}/${id}`)} theme={theme} setTheme={setTheme} project={project} />
        </main>
      </div>
    );
  } else if (!route.pid || (project && projectId === project.id)) {
    body = (
      <Desktop
        key={project?.id || 'home'}
        user={user}
        project={project}
        projects={myProjects}
        apps={apps}
        controls={controls}
        onLogout={() => {
          logout();
          nav('');
        }}
      />
    );
  } else {
    body = null;
  }

  return (
    <>
      <div className="wallpaper" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      {body}
      {searching && user && <Spotlight user={user} projects={myProjects} onClose={() => setSearching(false)} />}
      <Toasts />
    </>
  );
}
