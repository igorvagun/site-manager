import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useData, useUser, addRow, updateRow, removeRow } from '../lib/store';
import { useOptions, WEATHER } from '../lib/constants';
import { Glass, Icon, IconButton, EntityForm, Empty, PageHead, SearchBox, Modal } from '../components/ui';
import { todayISO, fmtDate, fmtTime, fmtHours, fmtMoneyFull, hoursBetween, sum, exportCSV } from '../lib/utils';

// One-page report for a day, assembled from the log entry and what the other apps recorded that day.
function DayReport({ log, onClose }) {
  const { t, lang } = useI18n();
  const data = useData();
  const project = data.project[0] || {};
  const cur = project.currency || '₪';
  const day = log.date;
  const shifts = data.shifts.filter((s) => s.date === day);
  const crew = data.workers
    .map((w) => {
      const mine = shifts.filter((s) => s.worker_id === w.id);
      return mine.length ? { w, first: mine[0].clock_in, last: mine[mine.length - 1].clock_out, hours: sum(mine, (s) => (s.clock_out ? hoursBetween(s.clock_in, s.clock_out) : 0)) } : null;
    })
    .filter(Boolean);
  const onDay = (ts) => ts && fmtDate(ts.slice(0, 10), 'en') && new Date(ts).toDateString() === new Date(day + 'T12:00:00').toDateString();
  const tasks = data.tasks.filter((x) => x.started_at && new Date(x.started_at) <= new Date(day + 'T23:59:59') && (!x.finished_at || new Date(x.finished_at) >= new Date(day + 'T00:00:00')));
  const issues = data.issues.filter((i) => onDay(i.created_at));
  const expenses = data.expenses.filter((e) => e.date === day);
  const safety = data.safety.filter((s) => s.date === day);

  return (
    <Modal title={t('daily_report')} onClose={onClose} wide>
      <div className="btn-row no-print">
        <button className="btn primary" onClick={() => window.print()}>
          <Icon name="printer" size={16} />
          {t('print_pdf')}
        </button>
      </div>
      <article className="report">
        <header>
          <div>
            <h2>{project.name}</h2>
            <p>{[project.address, project.client].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="report-date">
            <b>{fmtDate(day, lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</b>
            <span>
              {t('w_' + log.weather)}, {log.temp}° · {log.author}
            </span>
          </div>
        </header>

        <section>
          <h4>{t('work_done')}</h4>
          <p className="pre">{log.summary || '—'}</p>
        </section>
        {log.delays && (
          <section>
            <h4>{t('delays_issues')}</h4>
            <p className="pre">{log.delays}</p>
          </section>
        )}

        <section>
          <h4>
            {t('report_crew')} · {crew.length || log.crew_count}
          </h4>
          {crew.length ? (
            <table className="mini-table">
              <tbody>
                {crew.map((c) => (
                  <tr key={c.w.id}>
                    <td>{c.w.name}</td>
                    <td>{c.w.role}</td>
                    <td className="num">
                      {fmtTime(c.first, lang)}–{c.last ? fmtTime(c.last, lang) : '…'}
                    </td>
                    <td className="num">{c.last ? `${fmtHours(c.hours)} ${t('hrs')}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">{t('report_no_clock')}</p>
          )}
        </section>

        {tasks.length > 0 && (
          <section>
            <h4>{t('report_tasks')}</h4>
            <table className="mini-table">
              <tbody>
                {tasks.map((x) => (
                  <tr key={x.id}>
                    <td>{x.name}</td>
                    <td>{(x.workers || []).join(', ')}</td>
                    <td className="num">{onDay(x.finished_at) ? t('finished') : onDay(x.started_at) ? t('started') : t('st_' + x.status)}</td>
                    <td className="num">{x.progress || 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        {(issues.length > 0 || safety.length > 0) && (
          <section>
            <h4>{t('report_issues')}</h4>
            <ul>
              {issues.map((i) => <li key={i.id}>{t('it_' + i.type)}: {i.title} ({t('pr_' + i.priority)})</li>)}
              {safety.map((s) => <li key={s.id}>{t('sf_' + s.type)}: {s.title}</li>)}
            </ul>
          </section>
        )}
        {expenses.length > 0 && (
          <section>
            <h4>
              {t('report_expenses')} · {fmtMoneyFull(sum(expenses, (e) => e.amount), cur)}
            </h4>
            <ul>
              {expenses.map((e) => <li key={e.id}>{e.description} — {fmtMoneyFull(e.amount, cur)}{e.vendor ? ` (${e.vendor})` : ''}</li>)}
            </ul>
          </section>
        )}
        {log.photos?.length > 0 && (
          <section>
            <h4>{t('photos')}</h4>
            <div className="report-photos">
              {log.photos.map((src, i) => <img key={i} src={src} alt="" />)}
            </div>
          </section>
        )}
        <footer>
          <span>{t('report_signature')}: ____________________</span>
          <span>Site Manager</span>
        </footer>
      </article>
    </Modal>
  );
}

export default function DailyLog() {
  const { t, lang } = useI18n();
  const data = useData();
  const o = useOptions();
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState('');
  const [photo, setPhoto] = useState(null);
  const [report, setReport] = useState(null);
  const lead = useUser().role !== 'worker'; // the diary is written by managers and foremen; workers read it
  const today = todayISO();

  const logs = [...data.logs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((l) => !q || `${l.summary} ${l.delays} ${l.author}`.toLowerCase().includes(q.toLowerCase()));

  const fields = [
    { key: 'date', label: t('date'), type: 'date', required: true, half: true },
    { key: 'author', label: t('author'), half: true },
    { key: 'weather', label: t('weather'), type: 'select', options: o.weather, half: true },
    { key: 'temp', label: t('temperature'), type: 'number', half: true },
    { key: 'crew_count', label: t('crew_on_site'), type: 'number', min: 0, half: true },
    { key: 'summary', label: t('work_done'), type: 'textarea', required: true, placeholder: t('work_done_ph') },
    { key: 'delays', label: t('delays_issues'), type: 'textarea', placeholder: t('delays_ph') },
    { key: 'photos', label: t('photos'), type: 'photos' },
  ];
  // Draft of today's entry from what the other apps already know; the author edits it before saving.
  const draft = () => {
    const done = data.tasks.filter((x) => x.finished_at && x.finished_at.slice(0, 10) === new Date().toISOString().slice(0, 10));
    const active = data.tasks.filter((x) => x.status === 'active');
    const deliveries = data.materials.filter((m) => m.next_delivery === today);
    const lines = [
      ...done.map((x) => `✓ ${x.name}`),
      ...active.map((x) => `• ${x.name} — ${x.progress || 0}%`),
      ...deliveries.map((m) => `${t('delivery')}: ${m.name}`),
    ];
    const late = data.tasks.filter((x) => x.status === 'delayed' || (x.status !== 'done' && x.end_date < today));
    return { summary: lines.join('\n'), delays: late.map((x) => `${t('alert_late_task')}: ${x.name}`).join('\n') };
  };
  const blank = {
    date: today,
    author: data.project[0]?.manager || '',
    weather: 'sunny',
    temp: 22,
    crew_count: data.attendance.filter((a) => a.date === today && a.status === 'present').length,
    summary: '',
    delays: '',
    photos: [],
  };
  const newEntry = () => setEditing(logs.some((l) => l.date === today) ? blank : { ...blank, ...draft() });

  return (
    <>
      <PageHead title={t('nav_log')} subtitle={t('log_sub')}>
        <button className="btn" onClick={() => window.print()}>
          <Icon name="printer" size={16} />
          {t('print')}
        </button>
        <button
          className="btn"
          onClick={() =>
            exportCSV('daily-logs.csv', logs, [
              { key: 'date', label: t('date') },
              { label: t('weather'), get: (r) => t('w_' + r.weather) },
              { key: 'temp', label: t('temperature') },
              { key: 'crew_count', label: t('crew_on_site') },
              { key: 'summary', label: t('work_done') },
              { key: 'delays', label: t('delays_issues') },
              { key: 'author', label: t('author') },
            ])
          }
        >
          <Icon name="download" size={16} />
          CSV
        </button>
        <button className="btn primary" onClick={newEntry} hidden={!lead}>
          <Icon name="plus" size={16} />
          {t('new_log')}
        </button>
      </PageHead>

      <Glass className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder={t('search_logs')} />
      </Glass>

      {logs.length === 0 ? (
        <Glass><Empty icon="book" text={t('no_logs')} /></Glass>
      ) : (
        <div className="timeline">
          {logs.map((l) => (
            <Glass className="log-card" key={l.id}>
              <div className="log-weather tint-blue">
                <Icon name={WEATHER[l.weather] || 'sun'} size={26} />
                <b>{l.temp}°</b>
                <small>{t('w_' + l.weather)}</small>
              </div>
              <div className="log-body">
                <header>
                  <h3>
                    {fmtDate(l.date, lang, { weekday: 'long', day: 'numeric', month: 'long' })}
                    {l.date === today && <span className="badge tone-blue">{t('today')}</span>}
                  </h3>
                  <span className="spacer" />
                  <button className="btn small" onClick={() => setReport(l)}>
                    <Icon name="printer" size={14} />
                    {t('daily_report')}
                  </button>
                  {lead && <IconButton icon="edit" label={t('edit')} onClick={() => setEditing(l)} />}
                </header>
                <small>
                  <Icon name="users" size={13} /> {l.crew_count} {t('workers')}
                  {l.author && <> · {l.author}</>}
                </small>
                <p>{l.summary}</p>
                {l.delays && (
                  <p className="warn-text">
                    <Icon name="alert" size={14} /> {l.delays}
                  </p>
                )}
                {l.photos?.length > 0 && (
                  <div className="photos readonly">
                    {l.photos.map((src, i) => (
                      <button className="photo" key={i} onClick={() => setPhoto(src)} aria-label={t('photos')}>
                        <img src={src} alt="" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Glass>
          ))}
        </div>
      )}

      {editing && (
        <EntityForm
          title={editing.id ? t('edit_log') : t('new_log')}
          fields={fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => (editing.id ? updateRow('logs', editing.id, v) : addRow('logs', v))}
          onDelete={editing.id ? () => removeRow('logs', editing.id) : null}
        />
      )}
      {report && <DayReport log={report} onClose={() => setReport(null)} />}
      {photo && (
        <Modal title={t('photos')} onClose={() => setPhoto(null)} wide>
          <img className="photo-full" src={photo} alt="" />
        </Modal>
      )}
    </>
  );
}
