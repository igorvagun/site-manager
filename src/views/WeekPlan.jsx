import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useData, addRow, updateRow, removeRow } from '../lib/store';
import { TASK_STATUS } from '../lib/constants';
import { Glass, Icon, IconButton, Badge, Empty, PageHead, Stat, EntityForm } from '../components/ui';
import { todayISO, addDays, fmtDate, isRestDay, sum } from '../lib/utils';

// The week ahead: what runs each day, what arrives, and who is on what — with clashes flagged.
export default function WeekPlan() {
  const { t, lang } = useI18n();
  const data = useData();
  const today = todayISO();
  const [start, setStart] = useState(today);
  const [absence, setAbsence] = useState(null);
  const KINDS = { leave: 'neutral', sick: 'orange', other: 'blue' };
  // Planned time off: leave, sick days, courses.
  const awayOn = (w, d) => data.absences.find((a) => a.worker_id === w.id && a.from <= d && a.to >= d);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const workers = data.workers.filter((w) => w.active !== false).sort((a, b) => a.name.localeCompare(b.name));

  const runsOn = (x, d) => x.start_date <= d && x.end_date >= d && x.status !== 'done' && x.status !== 'paused' && !isRestDay(d);
  const tasksOn = (d) => data.tasks.filter((x) => runsOn(x, d)).sort((a, b) => (a.position || 0) - (b.position || 0));
  const eventsOn = (d) => [
    ...data.materials.filter((m) => m.next_delivery === d).map((m) => ({ icon: 'truck', tone: 'purple', text: `${t('delivery')}: ${m.name}` })),
    ...data.equipment.filter((e) => e.status !== 'returned' && e.kind === 'rented' && e.return_date === d).map((e) => ({ icon: 'truck', tone: 'red', text: `${t('return_by')}: ${e.name}` })),
    ...data.equipment.filter((e) => e.status !== 'returned' && e.inspection_date === d).map((e) => ({ icon: 'shield', tone: 'yellow', text: `${t('next_inspection')}: ${e.name}` })),
    ...data.issues.filter((i) => i.status !== 'done' && i.due_date === d).map((i) => ({ icon: 'check', tone: 'orange', text: i.title })),
  ];
  const jobsOf = (w, d) => data.tasks.filter((x) => runsOn(x, d) && (x.workers || []).includes(w.name));
  // A clash is a worker on two tasks the same day, or on a task while away.
  const clashes = sum(workers, (w) => days.filter((d) => jobsOf(w, d).length > 1 || (jobsOf(w, d).length > 0 && awayOn(w, d))).length);
  const unstaffed = days.flatMap((d) => tasksOn(d).filter((x) => !(x.workers || []).length)).filter((x, i, a) => a.indexOf(x) === i);
  const freeToday = workers.filter((w) => !isRestDay(days[0]) && jobsOf(w, days[0]).length === 0 && !awayOn(w, days[0])).length;
  const upcoming = data.absences.filter((a) => a.to >= today).sort((a, b) => a.from.localeCompare(b.from));

  return (
    <>
      <PageHead title={t('nav_weekplan')} subtitle={t('weekplan_sub')}>
        <button className="btn" onClick={() => setAbsence({ worker_id: workers[0]?.id || '', kind: 'leave', from: today, to: today, note: '' })} disabled={!workers.length}>
          <Icon name="plus" size={16} />
          {t('absence')}
        </button>
        <button className="btn" onClick={() => window.print()}>
          <Icon name="printer" size={16} />
          {t('print')}
        </button>
      </PageHead>

      <div className="grid stats three no-print">
        <Stat icon="alert" tone={clashes ? 'red' : 'green'} label={t('wp_clashes')} value={clashes} sub={t('wp_clashes_sub')} />
        <Stat icon="users" tone={unstaffed.length ? 'orange' : 'green'} label={t('wp_unstaffed')} value={unstaffed.length} sub={t('wp_unstaffed_sub')} />
        <Stat icon="clock" tone="blue" label={t('wp_free')} value={freeToday} sub={fmtDate(days[0], lang, { weekday: 'long', day: 'numeric', month: 'short' })} />
      </div>

      <Glass className="toolbar no-print">
        <div className="date-nav">
          <IconButton icon="up" tone="rot-start" label={t('prev_week')} onClick={() => setStart(addDays(start, -7))} />
          <b>
            {fmtDate(days[0], lang)} – {fmtDate(days[6], lang, { day: 'numeric', month: 'short', year: 'numeric' })}
          </b>
          <IconButton icon="up" tone="rot-end" label={t('next_week')} onClick={() => setStart(addDays(start, 7))} />
          {start !== today && <button className="btn ghost" onClick={() => setStart(today)}>{t('today')}</button>}
        </div>
      </Glass>

      <div className="week">
        {days.map((d) => {
          const list = tasksOn(d);
          const ev = eventsOn(d);
          return (
            <Glass key={d} className={`week-day ${d === today ? 'today' : ''} ${isRestDay(d) ? 'rest' : ''}`}>
              <header>
                <b>{fmtDate(d, lang, { weekday: 'short' })}</b>
                <span>{fmtDate(d, lang, { day: 'numeric', month: 'short' })}</span>
              </header>
              {isRestDay(d) && <p className="muted">{t('wp_rest')}</p>}
              {list.map((x) => (
                <div key={x.id} className={`week-task tone-${TASK_STATUS[x.status] || 'neutral'}`}>
                  <b>{x.name}</b>
                  <span>{(x.workers || []).length ? x.workers.map((n) => n.split(' ')[0]).join(', ') : t('no_workers_assigned')}</span>
                </div>
              ))}
              {ev.map((e, i) => (
                <div key={i} className="week-event">
                  <span className={`dot-icon tint-${e.tone}`}><Icon name={e.icon} size={12} /></span>
                  <span>{e.text}</span>
                </div>
              ))}
              {!isRestDay(d) && !list.length && !ev.length && <p className="muted">—</p>}
            </Glass>
          );
        })}
      </div>

      {upcoming.length > 0 && (
        <Glass className="toolbar absences no-print">
          <b>{t('absences')}</b>
          {upcoming.map((a) => {
            const w = data.workers.find((x) => x.id === a.worker_id);
            return (
              <button key={a.id} className={`badge tone-${KINDS[a.kind] || 'neutral'}`} onClick={() => setAbsence(a)} title={t('edit')}>
                {w?.name || '—'} · {t('abs_' + a.kind)} · {fmtDate(a.from, lang)}
                {a.to !== a.from && `–${fmtDate(a.to, lang)}`}
              </button>
            );
          })}
        </Glass>
      )}

      <Glass className="table-wrap" tabIndex={0} role="region" aria-label={t('wp_crew')}>
        {workers.length === 0 ? (
          <Empty icon="users" text={t('no_workers')} />
        ) : (
          <table className="timesheet crew-plan">
            <thead>
              <tr>
                <th>{t('wp_crew')}</th>
                {days.map((d) => (
                  <th key={d} className={`${d === today ? 'today' : ''} ${isRestDay(d) ? 'off' : ''}`}>
                    {fmtDate(d, lang, { weekday: 'short', day: 'numeric' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id}>
                  <td>
                    <b>{w.name}</b>
                    <br />
                    <small>{w.role}</small>
                  </td>
                  {days.map((d) => {
                    const jobs = jobsOf(w, d);
                    return (
                      <td key={d} className={d === today ? 'today' : ''}>
                        {isRestDay(d) ? (
                          <span className="muted">·</span>
                        ) : awayOn(w, d) ? (
                          <>
                            <Badge tone={KINDS[awayOn(w, d).kind] || 'neutral'}>{t('abs_' + awayOn(w, d).kind)}</Badge>
                            {jobs.map((x) => <span key={x.id} className="plan-chip">{x.name}</span>)}
                            {jobs.length > 0 && <Badge tone="red">{t('wp_away_clash')}</Badge>}
                          </>
                        ) : jobs.length === 0 ? (
                          <span className="free">{t('wp_free_cell')}</span>
                        ) : (
                          <>
                            {jobs.map((x) => <span key={x.id} className="plan-chip">{x.name}</span>)}
                            {jobs.length > 1 && <Badge tone="red">{t('wp_clash')}</Badge>}
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Glass>
      {absence && (
        <EntityForm
          title={t('absence')}
          fields={[
            { key: 'worker_id', label: t('full_name'), type: 'select', options: workers.map((w) => ({ value: w.id, label: w.name })) },
            { key: 'kind', label: t('type'), type: 'select', options: Object.keys(KINDS).map((k) => ({ value: k, label: t('abs_' + k) })), half: true },
            { key: 'from', label: t('abs_from'), type: 'date', required: true, half: true },
            { key: 'to', label: t('abs_to'), type: 'date', required: true, half: true },
            { key: 'note', label: t('notes') },
          ]}
          initial={absence}
          onClose={() => setAbsence(null)}
          onSave={(v) => {
            const row = { worker_id: v.worker_id, kind: v.kind, from: v.from, to: v.to >= v.from ? v.to : v.from, note: v.note };
            absence.id ? updateRow('absences', absence.id, row) : addRow('absences', row);
          }}
          onDelete={absence.id ? () => removeRow('absences', absence.id) : null}
        />
      )}
    </>
  );
}
