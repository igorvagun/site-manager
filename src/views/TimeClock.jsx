import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useData, useUser, updateRow, removeRow, notify } from '../lib/store';
import { clockIn, clockOut, syncAttendance } from '../lib/clock';
import { Glass, Icon, IconButton, Badge, EntityForm, Empty, PageHead, Stat } from '../components/ui';
import { todayISO, addDays, parseISO, fmtDate, fmtTime, fmtMoney, fmtHours, hoursBetween, hourlyRate, sum, exportCSV, pad } from '../lib/utils';

const toLocalInput = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function TimeClock() {
  const { t, lang } = useI18n();
  const data = useData();
  const user = useUser();
  const cur = data.project[0]?.currency || '₪';
  const lead = user.role !== 'worker';
  const me = data.workers.find((w) => w.user_id === user.id);
  const today = todayISO();
  const [now, setNow] = useState(() => new Date());
  const [weekEnd, setWeekEnd] = useState(today);
  const [editing, setEditing] = useState(null);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(id);
  }, []);

  const hoursOf = (s) => (s.clock_in ? hoursBetween(s.clock_in, s.clock_out || now) : 0);
  const shiftsOf = (wid, date) => data.shifts.filter((s) => s.worker_id === wid && s.date === date);
  const openOf = (wid) => data.shifts.find((s) => s.worker_id === wid && s.clock_in && !s.clock_out);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekEnd, i - 6));
  const workers = data.workers.filter((w) => w.active !== false).sort((a, b) => a.name.localeCompare(b.name));
  const weekHours = (w) => sum(days, (d) => sum(shiftsOf(w.id, d), hoursOf));
  const onNow = workers.filter((w) => openOf(w.id));
  const todayHours = sum(workers, (w) => sum(shiftsOf(w.id, today), hoursOf));

  const myOpen = me && openOf(me.id);
  const myToday = me ? sum(shiftsOf(me.id, today), hoursOf) : 0;

  const fields = [
    { key: 'clock_in', label: t('clock_in_time'), type: 'datetime-local', required: true, half: true },
    { key: 'clock_out', label: t('clock_out_time'), type: 'datetime-local', half: true },
  ];

  return (
    <>
      <PageHead title={t('nav_timeclock')} subtitle={t('timeclock_sub')}>
        {lead && (
          <button
            className="btn"
            onClick={() =>
              exportCSV(`timesheet-${weekEnd}.csv`, workers, [
                { key: 'name', label: t('full_name') },
                { key: 'role', label: t('position') },
                ...days.map((d) => ({ label: d, get: (w) => fmtHours(sum(shiftsOf(w.id, d), hoursOf)) })),
                { label: t('total'), get: (w) => fmtHours(weekHours(w)) },
                { label: t('hourly_rate'), get: (w) => Math.round(hourlyRate(w)) },
                { label: t('labor_cost'), get: (w) => Math.round(weekHours(w) * hourlyRate(w)) },
              ])
            }
          >
            <Icon name="download" size={16} />
            CSV
          </button>
        )}
      </PageHead>

      {me && (
        <Glass className={`punch ${myOpen ? 'on' : ''}`}>
          <div>
            <small>{fmtDate(today, lang, { weekday: 'long', day: 'numeric', month: 'long' })}</small>
            <h2>{myOpen ? `${t('on_shift_since')} ${fmtTime(myOpen.clock_in, lang)}` : myToday > 0 ? t('shift_finished') : t('shift_not_started')}</h2>
            <p>
              {t('today')}: <b>{fmtHours(myToday)} {t('hrs')}</b> · {t('this_week')}: <b>{fmtHours(weekHours(me))} {t('hrs')}</b>
            </p>
          </div>
          {myOpen ? (
            <button className="punch-btn out" onClick={() => clockOut(myOpen, user.id)}>
              <Icon name="stop" size={26} />
              {t('end_shift')}
            </button>
          ) : (
            <button className="punch-btn" onClick={() => clockIn(me, user.id)}>
              <Icon name="play" size={26} />
              {t('start_shift')}
            </button>
          )}
        </Glass>
      )}
      {!me && !lead && <Glass><Empty icon="clock" text={t('no_worker_profile')} /></Glass>}

      {lead && (
        <>
          <div className="grid stats three">
            <Stat icon="users" tone="green" label={t('on_shift_now')} value={`${onNow.length}/${workers.length}`} sub={t('workers')} />
            <Stat icon="clock" tone="blue" label={t('hours_today')} value={fmtHours(todayHours)} sub={t('hours')} />
            <Stat
              icon="wallet"
              tone="purple"
              label={t('labor_cost_week')}
              value={fmtMoney(sum(workers, (w) => weekHours(w) * hourlyRate(w)), cur)}
              sub={`${fmtDate(days[0], lang)} – ${fmtDate(days[6], lang)}`}
            />
          </div>

          <Glass className="card">
            <header className="card-head">
              <h3>{t('today')}</h3>
            </header>
            <ul className="list clock-list">
              {workers.map((w) => {
                const open = openOf(w.id);
                const done = shiftsOf(w.id, today).filter((s) => s.clock_out);
                return (
                  <li key={w.id}>
                    <span className="avatar small">{w.name.slice(0, 1)}</span>
                    <span className="grow">
                      <b>{w.name}</b>
                      <small>{w.role}</small>
                    </span>
                    {open ? (
                      <Badge tone="green">{t('on_shift_since')} {fmtTime(open.clock_in, lang)}</Badge>
                    ) : done.length ? (
                      <Badge tone="neutral">
                        {fmtTime(done[0].clock_in, lang)}–{fmtTime(done[done.length - 1].clock_out, lang)} · {fmtHours(sum(done, hoursOf))} {t('hrs')}
                      </Badge>
                    ) : (
                      <Badge tone="orange">{t('shift_not_started')}</Badge>
                    )}
                    {open ? (
                      <button className="btn small" onClick={() => clockOut(open, user.id)}>{t('end_shift')}</button>
                    ) : (
                      <button className="btn small" onClick={() => clockIn(w, user.id)}>{t('start_shift')}</button>
                    )}
                  </li>
                );
              })}
            </ul>
            {workers.length === 0 && <Empty icon="users" text={t('no_workers')} />}
          </Glass>

          <Glass className="toolbar">
            <div className="date-nav">
              <IconButton icon="up" tone="rot-start" label={t('prev_week')} onClick={() => setWeekEnd(addDays(weekEnd, -7))} />
              <b>
                {fmtDate(days[0], lang)} – {fmtDate(days[6], lang, { day: 'numeric', month: 'short', year: 'numeric' })}
              </b>
              <IconButton icon="up" tone="rot-end" label={t('next_week')} onClick={() => setWeekEnd(addDays(weekEnd, 7))} disabled={weekEnd >= today} />
              {weekEnd !== today && <button className="btn ghost" onClick={() => setWeekEnd(today)}>{t('this_week')}</button>}
            </div>
          </Glass>

          <Glass className="table-wrap">
            <table className="timesheet">
              <thead>
                <tr>
                  <th>{t('full_name')}</th>
                  {days.map((d) => (
                    <th key={d} className={`num ${d === today ? 'today' : ''} ${parseISO(d).getDay() === 6 ? 'off' : ''}`}>
                      {fmtDate(d, lang, { weekday: 'short' })}
                      <br />
                      {parseISO(d).getDate()}
                    </th>
                  ))}
                  <th className="num">{t('total')}</th>
                  <th className="num">{t('labor_cost')}</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <b>{w.name}</b>
                      <br />
                      <small>{fmtMoney(hourlyRate(w), cur)}/{t('hr')}</small>
                    </td>
                    {days.map((d) => {
                      const list = shiftsOf(w.id, d);
                      const h = sum(list, hoursOf);
                      return (
                        <td key={d} className={`num ${d === today ? 'today' : ''}`}>
                          {list.length ? (
                            <button
                              className={`hours-cell ${list.some((s) => !s.clock_out) ? 'open' : ''}`}
                              title={list.map((s) => `${fmtTime(s.clock_in, lang)}–${s.clock_out ? fmtTime(s.clock_out, lang) : '…'}`).join(', ')}
                              onClick={() => setEditing({ ...list[0], clock_in: toLocalInput(list[0].clock_in), clock_out: toLocalInput(list[0].clock_out) })}
                            >
                              {fmtHours(h)}
                            </button>
                          ) : (
                            <span className="muted">·</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="num">{fmtHours(weekHours(w))}</td>
                    <td className="num">{fmtMoney(weekHours(w) * hourlyRate(w), cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Glass>
        </>
      )}

      {editing && (
        <EntityForm
          title={`${t('edit_shift')} — ${data.workers.find((w) => w.id === editing.worker_id)?.name || ''}`}
          fields={fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            const cin = new Date(v.clock_in);
            const cout = v.clock_out ? new Date(v.clock_out) : null;
            if (cout && cout <= cin) return notify('date_order', 'error');
            const date = `${cin.getFullYear()}-${pad(cin.getMonth() + 1)}-${pad(cin.getDate())}`;
            await updateRow('shifts', editing.id, { clock_in: cin.toISOString(), clock_out: cout ? cout.toISOString() : null, date });
            syncAttendance(editing.worker_id, date);
          }}
          onDelete={async () => {
            await removeRow('shifts', editing.id);
            syncAttendance(editing.worker_id, editing.date);
          }}
        />
      )}
    </>
  );
}
