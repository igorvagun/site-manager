import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useData, useUser, updateRow, removeRow, notify } from '../lib/store';
import { clockIn, clockOut, syncAttendance } from '../lib/clock';
import { Glass, Icon, IconButton, Badge, EntityForm, Empty, PageHead, Stat, Segmented } from '../components/ui';
import { todayISO, addDays, parseISO, fmtDate, fmtTime, fmtMoney, fmtMoneyFull, fmtHours, hoursBetween, hourlyRate, sum, exportCSV, pad, shiftHours, isRestDay } from '../lib/utils';

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
  const [mode, setMode] = useState('week');
  const [month, setMonth] = useState(today.slice(0, 7));
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

  // Month summary for payroll. Overtime is an estimate: hours above 9 in a day, first 2 at 125%, the rest at 150%.
  const shiftMonth = (delta) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  };
  const payroll = workers.map((w) => {
    const byDay = {};
    data.shifts.filter((s) => s.worker_id === w.id && s.date.startsWith(month)).forEach((s) => (byDay[s.date] = (byDay[s.date] || 0) + hoursOf(s)));
    const dayHours = Object.values(byDay);
    const std = shiftHours(); // the project's standard shift
    const regular = sum(dayHours, (h) => Math.min(h, std));
    const ot125 = sum(dayHours, (h) => Math.min(Math.max(h - std, 0), 2));
    const ot150 = sum(dayHours, (h) => Math.max(h - std - 2, 0));
    const rate = hourlyRate(w);
    return { w, days: dayHours.length, hours: sum(dayHours), regular, overtime: ot125 + ot150, rate, pay: regular * rate + ot125 * rate * 1.25 + ot150 * rate * 1.5 };
  });
  const monthLabel = fmtDate(month + '-01', lang, { month: 'long', year: 'numeric' });

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
            <Segmented value={mode} onChange={setMode} options={[{ value: 'week', label: t('view_week') }, { value: 'month', label: t('view_payroll') }]} />
            {mode === 'month' && (
              <>
                <div className="date-nav">
                  <IconButton icon="up" tone="rot-start" label={t('prev_month')} onClick={() => shiftMonth(-1)} />
                  <b>{monthLabel}</b>
                  <IconButton icon="up" tone="rot-end" label={t('next_month')} onClick={() => shiftMonth(1)} disabled={month >= today.slice(0, 7)} />
                </div>
                <span className="spacer" />
                <button
                  className="btn"
                  onClick={() =>
                    exportCSV(`payroll-${month}.csv`, payroll, [
                      { label: t('full_name'), get: (r) => r.w.name },
                      { label: t('position'), get: (r) => r.w.role },
                      { label: t('id_number'), get: (r) => r.w.id_number },
                      { label: t('days_worked'), get: (r) => r.days },
                      { label: t('regular_hours'), get: (r) => fmtHours(r.regular) },
                      { label: t('overtime_hours'), get: (r) => fmtHours(r.overtime) },
                      { label: t('hourly_rate'), get: (r) => Math.round(r.rate) },
                      { label: t('pay_estimate'), get: (r) => Math.round(r.pay) },
                    ])
                  }
                >
                  <Icon name="download" size={16} />
                  CSV
                </button>
              </>
            )}
            {mode === 'week' && (
            <div className="date-nav">
              <IconButton icon="up" tone="rot-start" label={t('prev_week')} onClick={() => setWeekEnd(addDays(weekEnd, -7))} />
              <b>
                {fmtDate(days[0], lang)} – {fmtDate(days[6], lang, { day: 'numeric', month: 'short', year: 'numeric' })}
              </b>
              <IconButton icon="up" tone="rot-end" label={t('next_week')} onClick={() => setWeekEnd(addDays(weekEnd, 7))} disabled={weekEnd >= today} />
              {weekEnd !== today && <button className="btn ghost" onClick={() => setWeekEnd(today)}>{t('this_week')}</button>}
            </div>
            )}
          </Glass>

          {mode === 'month' && (
            <Glass className="table-wrap">
              <table className="timesheet">
                <thead>
                  <tr>
                    <th>{t('full_name')}</th>
                    <th className="num">{t('days_worked')}</th>
                    <th className="num">{t('regular_hours')}</th>
                    <th className="num">{t('overtime_hours')}</th>
                    <th className="num">{t('hourly_rate')}</th>
                    <th className="num">{t('pay_estimate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.map((r) => (
                    <tr key={r.w.id}>
                      <td>
                        <b>{r.w.name}</b>
                        <br />
                        <small>{r.w.role}</small>
                      </td>
                      <td className="num">{r.days}</td>
                      <td className="num">{fmtHours(r.regular)}</td>
                      <td className="num">{r.overtime > 0 ? fmtHours(r.overtime) : '—'}</td>
                      <td className="num">{fmtMoney(r.rate, cur)}</td>
                      <td className="num">{fmtMoneyFull(r.pay, cur)}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td><b>{t('total')}</b></td>
                    <td className="num">{sum(payroll, (r) => r.days)}</td>
                    <td className="num">{fmtHours(sum(payroll, (r) => r.regular))}</td>
                    <td className="num">{fmtHours(sum(payroll, (r) => r.overtime))}</td>
                    <td />
                    <td className="num">{fmtMoneyFull(sum(payroll, (r) => r.pay), cur)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="table-note">{t('payroll_note').replace('{h}', fmtHours(shiftHours()))}</p>
            </Glass>
          )}

          {mode === 'week' && (
          <Glass className="table-wrap">
            <table className="timesheet">
              <thead>
                <tr>
                  <th>{t('full_name')}</th>
                  {days.map((d) => (
                    <th key={d} className={`num ${d === today ? 'today' : ''} ${isRestDay(d) ? 'off' : ''}`}>
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
          )}
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
