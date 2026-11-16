import { useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useData, useUser } from '../lib/store';
import { PROJECT_APPS } from '../lib/apps';
import { nav } from '../lib/nav';
import { Glass, Icon, IconButton, PageHead, Empty } from '../components/ui';
import { todayISO, toISO, parseISO, fmtDate, pad, isRestDay } from '../lib/utils';

// Everything with a date, from every app of the project, on one month grid.
export default function Calendar({ project }) {
  const { t, lang } = useI18n();
  const data = useData();
  const user = useUser();
  const today = todayISO();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [day, setDay] = useState(today);
  const can = (id) => PROJECT_APPS.some((a) => a.id === id && a.roles.includes(user.role));
  const me = data.workers.find((w) => w.user_id === user.id);
  const lead = user.role !== 'worker';

  const events = useMemo(() => {
    const out = [];
    const add = (date, tone, icon, text, app) => date && out.push({ date: String(date).slice(0, 10), tone, icon, text, app });
    data.tasks
      .filter((x) => lead || (me && (x.workers || []).includes(me.name)))
      .forEach((x) => {
        add(x.start_date, 'blue', 'play', `${t('starts')}: ${x.name}`, 'tasklog');
        add(x.end_date, x.status === 'done' ? 'green' : x.end_date < today ? 'red' : 'orange', 'clock', `${t('due')}: ${x.name}`, 'tasklog');
      });
    data.issues.filter((i) => i.status !== 'done').forEach((i) => add(i.due_date, i.due_date < today ? 'red' : 'orange', 'check', i.title, 'issues'));
    if (can('materials')) data.materials.forEach((m) => add(m.next_delivery, 'purple', 'truck', `${t('delivery')}: ${m.name}`, 'materials'));
    if (can('equipment'))
      data.equipment.filter((e) => e.status !== 'returned').forEach((e) => {
        if (e.kind === 'rented') add(e.return_date, e.return_date < today ? 'red' : 'purple', 'truck', `${t('return_by')}: ${e.name}`, 'equipment');
        add(e.inspection_date, 'yellow', 'shield', `${t('next_inspection')}: ${e.name}`, 'equipment');
      });
    if (can('todo')) data.todos.filter((x) => x.user_id === user.id && !x.done).forEach((x) => add(x.due_date, 'neutral', 'list', x.title, 'todo'));
    if (project?.end_date) add(project.end_date, 'green', 'building', t('handover'), lead ? 'dashboard' : 'schedule');
    return out;
  }, [data, user, lead, me, today, t, project]); // eslint-disable-line react-hooks/exhaustive-deps

  const byDay = useMemo(() => {
    const m = new Map();
    events.forEach((e) => m.set(e.date, [...(m.get(e.date) || []), e]));
    return m;
  }, [events]);

  const [y, mo] = month.split('-').map(Number);
  const first = new Date(y, mo - 1, 1);
  const cells = [];
  const start = new Date(first);
  start.setDate(1 - first.getDay()); // weeks start on Sunday
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  const weeks = cells.slice(35).some((d) => d.getMonth() === mo - 1) ? 6 : 5;
  const shift = (n) => {
    const d = new Date(y, mo - 1 + n, 1);
    setMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  };
  const dayEvents = byDay.get(day) || [];

  return (
    <>
      <PageHead title={t('nav_calendar')} subtitle={t('calendar_sub')} />
      <Glass className="toolbar">
        <div className="date-nav">
          <IconButton icon="up" tone="rot-start" label={t('prev_month')} onClick={() => shift(-1)} />
          <b className="cal-title">{fmtDate(month + '-01', lang, { month: 'long', year: 'numeric' })}</b>
          <IconButton icon="up" tone="rot-end" label={t('next_month')} onClick={() => shift(1)} />
        </div>
        {(month !== today.slice(0, 7) || day !== today) && (
          <button
            className="btn ghost"
            onClick={() => {
              setMonth(today.slice(0, 7));
              setDay(today);
            }}
          >
            {t('today')}
          </button>
        )}
        <span className="spacer" />
        <span className="muted">
          {events.filter((e) => e.date.startsWith(month)).length} {t('cal_events')}
        </span>
      </Glass>

      <div className="cal-layout">
        <Glass className="cal">
          <div className="cal-head">
            {cells.slice(0, 7).map((d) => (
              <span key={d.getDay()} className={isRestDay(d) ? 'off' : ''}>
                {fmtDate(toISO(d), lang, { weekday: 'short' })}
              </span>
            ))}
          </div>
          <div className="cal-grid" style={{ gridTemplateRows: `repeat(${weeks}, minmax(86px, 1fr))` }}>
            {cells.slice(0, weeks * 7).map((d) => {
              const iso = toISO(d);
              const list = byDay.get(iso) || [];
              const other = d.getMonth() !== mo - 1;
              return (
                <button
                  key={iso}
                  className={`cal-day ${other ? 'other' : ''} ${iso === today ? 'today' : ''} ${iso === day ? 'on' : ''} ${isRestDay(d) ? 'off' : ''}`}
                  onClick={() => setDay(iso)}
                  aria-label={`${fmtDate(iso, lang, { day: 'numeric', month: 'long' })}, ${list.length} ${t('cal_events')}`}
                  aria-pressed={iso === day}
                >
                  <span className="cal-num">{d.getDate()}</span>
                  {list.slice(0, 3).map((e, i) => (
                    <span key={i} className={`cal-chip tone-${e.tone}`}>
                      {e.text}
                    </span>
                  ))}
                  {list.length > 3 && <span className="cal-more">+{list.length - 3}</span>}
                </button>
              );
            })}
          </div>
        </Glass>

        <Glass className="card cal-side">
          <header className="card-head">
            <h3>{fmtDate(day, lang, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
          </header>
          {dayEvents.length === 0 ? (
            <Empty icon="calendar" text={t('cal_nothing')} />
          ) : (
            <ul className="list alerts">
              {dayEvents.map((e, i) => (
                <li key={i}>
                  <button onClick={() => nav(`p/${project.id}/${e.app}`)}>
                    <span className={`dot-icon tint-${e.tone === 'neutral' ? 'blue' : e.tone}`}>
                      <Icon name={e.icon} size={15} />
                    </span>
                    <span>{e.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Glass>
      </div>
    </>
  );
}
