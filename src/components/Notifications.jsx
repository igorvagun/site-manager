import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useStore } from '../lib/store';
import { nav } from '../lib/nav';
import { Icon } from './ui';
import { fmtDateTime } from '../lib/utils';

const PREF_KEY = (uid) => `site-manager:notify:${uid}`;
export const DEFAULT_PREFS = { shifts: true, tasks: true, messages: true };
export function readPrefs(uid) {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREF_KEY(uid)) || '{}') };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}
export function writePrefs(uid, prefs) {
  try {
    localStorage.setItem(PREF_KEY(uid), JSON.stringify(prefs));
    dispatchEvent(new Event('site-manager:prefs'));
  } catch {
    /* private mode */
  }
}
const SEEN_KEY = (uid) => `site-manager:seen:${uid}`;

// Activity by other people in the projects this person can open, newest first.
function useEvents(user, projects) {
  const { data } = useStore();
  const [prefs, setPrefs] = useState(() => readPrefs(user.id));
  useEffect(() => {
    const on = () => setPrefs(readPrefs(user.id));
    addEventListener('site-manager:prefs', on);
    return () => removeEventListener('site-manager:prefs', on);
  }, [user.id]);

  return useMemo(() => {
    const ids = new Set(projects.map((p) => p.id));
    const pname = (id) => projects.find((p) => p.id === id)?.name || '';
    const since = Date.now() - 7 * 86400000;
    const lead = user.role !== 'worker';
    const out = [];
    const push = (e) => e.at && new Date(e.at) >= since && new Date(e.at) <= Date.now() + 60000 && out.push(e);

    if (prefs.shifts && lead) {
      data.shifts.filter((s) => ids.has(s.project_id)).forEach((s) => {
        const w = data.workers.find((x) => x.id === s.worker_id);
        if (!w) return;
        if (s.in_by !== user.id) push({ id: s.id + ':in', at: s.clock_in, icon: 'play', tone: 'green', key: 'n_clock_in', who: w.name, project: pname(s.project_id), to: `p/${s.project_id}/timeclock` });
        if (s.clock_out && s.out_by !== user.id) push({ id: s.id + ':out', at: s.clock_out, icon: 'stop', tone: 'neutral', key: 'n_clock_out', who: w.name, project: pname(s.project_id), to: `p/${s.project_id}/timeclock` });
      });
    }
    if (prefs.tasks && lead) {
      data.tasks.filter((x) => ids.has(x.project_id)).forEach((x) => {
        const who = (id) => data.users.find((u) => u.id === id)?.name || '';
        if (x.started_by && x.started_by !== user.id) push({ id: x.id + ':s', at: x.started_at, icon: 'play', tone: 'blue', key: 'n_task_started', who: who(x.started_by), what: x.name, project: pname(x.project_id), to: `p/${x.project_id}/tasklog` });
        if (x.finished_by && x.finished_by !== user.id) push({ id: x.id + ':f', at: x.finished_at, icon: 'check', tone: 'green', key: 'n_task_finished', who: who(x.finished_by), what: x.name, project: pname(x.project_id), to: `p/${x.project_id}/tasklog` });
      });
    }
    if (prefs.messages) {
      const myTasks = (m) => {
        if (lead) return true;
        const task = data.tasks.find((x) => 'task:' + x.id === m.thread);
        const me = data.workers.find((w) => w.user_id === user.id && w.project_id === m.project_id);
        return !!task && !!me && (task.workers || []).includes(me.name);
      };
      data.messages
        .filter((m) => ids.has(m.project_id) && m.sender_id !== user.id && !m.deleted && myTasks(m))
        .forEach((m) => {
          const task = data.tasks.find((x) => 'task:' + x.id === m.thread);
          push({ id: m.id, at: m.created_at, icon: 'chat', tone: 'purple', key: 'n_message', who: m.sender_name, what: m.text || '', sub: task?.name, project: pname(m.project_id), to: `p/${m.project_id}/${task ? 'tasklog' : 'contacts'}` });
        });
    }
    return out.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 40);
  }, [data, projects, user, prefs]);
}

export default function Notifications({ user, projects }) {
  const { t, lang } = useI18n();
  const events = useEvents(user, projects);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem(SEEN_KEY(user.id)) || '';
    } catch {
      return '';
    }
  });
  const ref = useRef(null);
  const unseen = events.filter((e) => String(e.at) > seen).length;

  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const toggle = () => {
    if (open) {
      // Mark as read when the list is closed, so new items stay highlighted while it is open.
      const latest = events[0]?.at || seen;
      setSeen(latest);
      try {
        localStorage.setItem(SEEN_KEY(user.id), latest);
      } catch {
        /* private mode */
      }
    }
    setOpen(!open);
  };

  return (
    <div className="notif" ref={ref}>
      <button className="icon-btn" onClick={toggle} aria-label={`${t('notifications')}${unseen ? ` (${unseen})` : ''}`} aria-expanded={open} title={t('notifications')}>
        <Icon name="bell" size={18} />
        {unseen > 0 && <i className="notif-count">{unseen > 9 ? '9+' : unseen}</i>}
      </button>
      {open && (
        <div className="glass notif-panel" role="dialog" aria-label={t('notifications')}>
          <h3>{t('notifications')}</h3>
          {events.length === 0 ? (
            <p className="muted">{t('no_notifications')}</p>
          ) : (
            <ul>
              {events.map((e) => (
                <li key={e.id} className={String(e.at) > seen ? 'new' : ''}>
                  <button
                    onClick={() => {
                      setOpen(false);
                      nav(e.to);
                    }}
                  >
                    <span className={`dot-icon tint-${e.tone === 'neutral' ? 'blue' : e.tone}`}>
                      <Icon name={e.icon} size={14} />
                    </span>
                    <span className="grow">
                      <b>{e.who}</b> {t(e.key)}
                      {e.what ? <>: {e.what}</> : null}
                      <small>
                        {[e.sub, e.project, fmtDateTime(e.at, lang)].filter(Boolean).join(' · ')}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
