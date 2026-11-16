import { useEffect, useState } from 'react';
import { useI18n } from './lib/i18n';
import { initStore, useStore } from './lib/store';
import { Icon, Toasts, IconButton } from './components/ui';
import Dashboard from './views/Dashboard';
import Schedule from './views/Schedule';
import DailyLog from './views/DailyLog';
import Team from './views/Team';
import Budget from './views/Budget';
import Issues from './views/Issues';
import Safety from './views/Safety';
import Materials from './views/Materials';
import Settings from './views/Settings';

const NAV = [
  { id: 'dashboard', icon: 'grid', view: Dashboard },
  { id: 'schedule', icon: 'calendar', view: Schedule },
  { id: 'log', icon: 'book', view: DailyLog },
  { id: 'team', icon: 'users', view: Team },
  { id: 'budget', icon: 'wallet', view: Budget },
  { id: 'issues', icon: 'check', view: Issues },
  { id: 'safety', icon: 'shield', view: Safety },
  { id: 'materials', icon: 'box', view: Materials },
  { id: 'settings', icon: 'gear', view: Settings },
];

const readHash = () => {
  const h = location.hash.replace('#/', '');
  return NAV.some((n) => n.id === h) ? h : 'dashboard';
};

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('site-manager:theme') || 'auto';
    } catch {
      return 'auto';
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
  const { loading, mode, data } = useStore();
  const [route, setRoute] = useState(readHash);
  const [theme, setTheme, isDark] = useTheme();

  useEffect(() => {
    initStore(lang);
    const onHash = () => setRoute(readHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (id) => {
    location.hash = '#/' + id;
    document.querySelector('.content')?.scrollTo({ top: 0 });
    scrollTo({ top: 0 });
  };
  const View = NAV.find((n) => n.id === route).view;
  const project = data.project[0];
  const controls = (
    <div className="pill-group">
      <button className="pill" onClick={() => setLang(lang === 'he' ? 'en' : 'he')} aria-label={t('language')}>
        <Icon name="globe" size={16} />
        {lang === 'he' ? 'English' : 'עברית'}
      </button>
      <IconButton icon={isDark ? 'sun' : 'moon'} label={t('toggle_theme')} onClick={() => setTheme(isDark ? 'light' : 'dark')} />
    </div>
  );

  return (
    <>
      <div className="wallpaper" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>

      <div className="shell">
        <nav className="glass sidebar" aria-label={t('navigation')}>
          <div className="brand">
            <div className="brand-mark">
              <Icon name="hardhat" size={22} />
            </div>
            <div className="brand-text">
              <b>Site Manager</b>
              <span>{project?.name || t('app_tagline')}</span>
            </div>
          </div>
          <div className="nav-items">
            {NAV.map((n) => (
              <button
                key={n.id}
                className={`nav-item ${route === n.id ? 'on' : ''}`}
                aria-current={route === n.id ? 'page' : undefined}
                onClick={() => go(n.id)}
              >
                <Icon name={n.icon} size={20} />
                <span>{t('nav_' + n.id)}</span>
              </button>
            ))}
          </div>
          <div className="sidebar-foot">
            {controls}
            <div className="mode">
              <span className={`mode-dot ${mode}`} />
              <span>{t(mode === 'cloud' ? 'mode_cloud' : 'mode_local')}</span>
            </div>
          </div>
        </nav>

        <main className="content">
          <div className="topbar">
            <div className="glass topbar-inner">
              <b>Site Manager</b>
              {controls}
            </div>
          </div>
          {loading ? (
            <div className="loading">
              <div className="spinner" />
              {t('loading')}
            </div>
          ) : (
            <div className="view" key={route}>
              <View go={go} theme={theme} setTheme={setTheme} />
            </div>
          )}
        </main>
      </div>
      <Toasts />
    </>
  );
}
