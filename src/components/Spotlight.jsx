import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../lib/i18n';
import { useStore } from '../lib/store';
import { PROJECT_APPS, HOME_APPS } from '../lib/apps';
import { nav } from '../lib/nav';
import { Icon } from './ui';

// Search across everything this person can open: apps, projects, tasks, people, drawings…
export default function Spotlight({ user, projects, onClose }) {
  const { t } = useI18n();
  const { data } = useStore();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const lead = user.role !== 'worker';

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const ids = new Set(projects.map((p) => p.id));
    const pname = (id) => projects.find((p) => p.id === id)?.name || '';
    const multi = projects.length > 1;
    const hit = (...parts) => parts.filter(Boolean).join(' ').toLowerCase().includes(needle);
    const out = [];
    const group = (key, rows) => rows.slice(0, 6).forEach((r) => out.push({ group: key, ...r }));
    const scoped = (name) => data[name].filter((r) => ids.has(r.project_id));
    const deep = (pid, app, text) => `p/${pid}/${app}?q=${encodeURIComponent(text)}`;
    const allowed = (id) => PROJECT_APPS.some((a) => a.id === id && a.roles.includes(user.role));

    group('grp_projects', projects.filter((p) => !needle || hit(p.name, p.address, p.client)).map((p) => ({ icon: 'building', label: p.name, sub: p.address, to: `p/${p.id}` })));
    if (!needle) return out;

    const apps = [];
    HOME_APPS.filter((a) => a.roles.includes(user.role) && hit(t('nav_' + a.id))).forEach((a) => apps.push({ icon: a.icon, label: t('nav_' + a.id), to: `app/${a.id}` }));
    projects.forEach((p) =>
      PROJECT_APPS.filter((a) => a.view && a.roles.includes(user.role) && hit(t('nav_' + a.id))).forEach((a) =>
        apps.push({ icon: a.icon, label: t('nav_' + a.id), sub: multi ? p.name : '', to: `p/${p.id}/${a.id}` })
      )
    );
    group('grp_apps', apps);

    const mine = (task) => {
      if (lead) return true;
      const me = data.workers.find((w) => w.user_id === user.id && w.project_id === task.project_id);
      return !!me && (task.workers || []).includes(me.name);
    };
    group('grp_tasks', scoped('tasks').filter((x) => mine(x) && hit(x.name, x.description)).map((x) => ({ icon: 'chat', label: x.name, sub: [t('st_' + x.status), multi && pname(x.project_id)].filter(Boolean).join(' · '), to: deep(x.project_id, 'tasklog', x.name) })));
    if (allowed('team')) group('grp_workers', scoped('workers').filter((x) => hit(x.name, x.role, x.phone)).map((x) => ({ icon: 'users', label: x.name, sub: [x.role, multi && pname(x.project_id)].filter(Boolean).join(' · '), to: deep(x.project_id, 'team', x.name) })));
    if (allowed('contacts')) group('grp_contacts', scoped('contacts').filter((x) => hit(x.name, x.company, x.phone)).map((x) => ({ icon: 'phone', label: x.name, sub: x.company, to: deep(x.project_id, 'contacts', x.name) })));
    group('grp_drawings', scoped('drawings').filter((x) => hit(x.number, x.title)).map((x) => ({ icon: 'layers', label: `${x.number || ''} ${x.title}`.trim(), sub: multi ? pname(x.project_id) : '', to: deep(x.project_id, 'drawings', x.title) })));
    group('grp_issues', scoped('issues').filter((x) => hit(x.title, x.description)).map((x) => ({ icon: 'check', label: x.title, sub: t('is_' + x.status), to: deep(x.project_id, 'issues', x.title) })));
    if (allowed('materials')) group('grp_materials', scoped('materials').filter((x) => hit(x.name, x.supplier)).map((x) => ({ icon: 'box', label: x.name, sub: `${x.qty} ${x.unit}`, to: deep(x.project_id, 'materials', x.name) })));
    return out;
  }, [q, data, projects, user, lead, t]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    listRef.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const go = (r) => {
    if (!r) return;
    onClose();
    nav(r.to);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(results.length - 1, s + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === 'Enter') go(results[sel]);
  };

  let last = '';
  return createPortal(
    <div className="overlay spotlight-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="glass spotlight" role="dialog" aria-modal="true" aria-label={t('search_everything')}>
        <div className="spotlight-input">
          <Icon name="search" size={20} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={t('search_everything')}
            aria-label={t('search_everything')}
            role="combobox"
            aria-expanded="true"
            aria-controls="spotlight-list"
          />
          <kbd>esc</kbd>
        </div>
        <div className="spotlight-list" id="spotlight-list" role="listbox" ref={listRef}>
          {results.length === 0 && <p className="muted">{t('no_results')}</p>}
          {results.map((r, i) => {
            const head = r.group !== last;
            last = r.group;
            return (
              <div key={r.group + i}>
                {head && <h4>{t(r.group)}</h4>}
                <button className={`spot-row ${i === sel ? 'on' : ''}`} role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => go(r)}>
                  <span className="dot-icon tint-blue"><Icon name={r.icon} size={15} /></span>
                  <span className="grow">
                    <b>{r.label}</b>
                    {r.sub && <small>{r.sub}</small>}
                  </span>
                  <Icon name="arrow" size={14} className="flip-rtl" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
