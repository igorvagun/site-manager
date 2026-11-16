import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useData, useUser } from '../lib/store';
import { useOptions } from '../lib/constants';
import { Icon, Modal } from '../components/ui';
import { todayISO, addDays, fmtDate, fmtMoneyFull, sum } from '../lib/utils';
import { computeMetrics } from './Dashboard';
import { subMath } from './Subcontracts';
import { docState } from './Documents';
import { openActions } from './Meetings';

// One printable status report of the whole project, for the client. Money is included only if asked for.
export default function ProjectReport({ onClose }) {
  const { t, lang } = useI18n();
  const data = useData();
  const user = useUser();
  const o = useOptions();
  const [money, setMoney] = useState(false);
  const [note, setNote] = useState('');
  const m = computeMetrics(data);
  const { project, cur, today } = m;
  const long = (d) => (d ? fmtDate(d, lang, { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
  const short = (d) => (d ? fmtDate(d, lang, { day: 'numeric', month: 'short' }) : '—');

  const tasks = [...data.tasks].sort((a, b) => (a.position || 0) - (b.position || 0));
  const current = tasks.filter((x) => x.status !== 'done' && x.start_date <= addDays(today, 14));
  const doneCount = tasks.filter((x) => x.status === 'done').length;
  const lost = sum(data.delays, (x) => x.days);
  const signed = data.inspections.filter((x) => x.status !== 'open');
  const passed = signed.filter((x) => x.status === 'passed').length;
  const closedIssues = data.issues.filter((i) => i.status === 'done').length;
  const urgent = m.openIssues.filter((i) => i.priority === 'high');
  const docs = data.documents.filter((d) => ['expired', 'expiring'].includes(docState(d, today)));
  const actions = openActions(data.meetings, data.issues);
  const subs = data.subcontracts.filter((s) => s.status !== 'done' || Number(s.progress) < 100);
  const approved = data.change_orders.filter((c) => c.status === 'approved');
  const behind = m.progress < m.planned - 3;

  return (
    <Modal title={t('pr_title')} onClose={onClose} wide>
      <div className="pr-options no-print">
        <label className="setting switch-row">
          <span>{t('pr_include_money')}</span>
          <input type="checkbox" role="switch" checked={money} onChange={() => setMoney(!money)} />
        </label>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('pr_note_ph')} aria-label={t('pr_note')} />
        <div className="btn-row">
          <button className="btn primary" onClick={() => window.print()}>
            <Icon name="printer" size={16} />
            {t('print_pdf')}
          </button>
        </div>
      </div>
      <article className="report project-report">
        <header>
          <div>
            <h2>{t('pr_title')}</h2>
            <p>{project.name}{project.address ? ` · ${project.address}` : ''}</p>
          </div>
          <div className="report-date">
            <b>{long(today)}</b>
            <span>{t('client')}: {project.client || '—'}</span>
          </div>
        </header>

        <section className="pr-kpis">
          <div><span>{t('overall_progress')}</span><b>{Math.round(m.progress)}%</b><small>{t('pr_planned')}: {Math.round(m.planned)}%</small></div>
          <div><span>{t('handover')}</span><b>{short(project.end_date)}</b><small>{m.daysLeft != null ? `${m.daysLeft} ${t('days_short')}` : ''}</small></div>
          <div><span>{t('pr_forecast')}</span><b className={m.slipDays > 7 ? 'warn-text' : ''}>{m.forecastEnd ? short(m.forecastEnd) : '—'}</b><small>{m.forecastEnd ? (m.slipDays > 0 ? `+${m.slipDays} ${t('days_short')}` : t('pr_on_time')) : ''}</small></div>
          <div><span>{t('pr_tasks_done')}</span><b>{doneCount}/{tasks.length}</b><small>{m.lateTasks.length ? `${m.lateTasks.length} ${t('pr_late_word')}` : t('pr_none_late')}</small></div>
        </section>
        <p>{t(behind ? 'pr_status_behind' : 'pr_status_ok')}{lost > 0 ? ` ${t('pr_lost_days')}: ${lost}.` : ''}</p>
        {note.trim() && <p className="pre pr-note">{note}</p>}

        <section>
          <h4>{t('pr_current_work')}</h4>
          {current.length === 0 ? <p>—</p> : (
            <table className="mini-table">
              <thead>
                <tr><th>{t('task')}</th><th>{t('floor')}</th><th>{t('start')}</th><th>{t('end')}</th><th>{t('status')}</th><th className="num">{t('progress')}</th></tr>
              </thead>
              <tbody>
                {current.map((x) => (
                  <tr key={x.id}>
                    <td>{x.name}</td>
                    <td>{o.floorLabel(x.floor)}</td>
                    <td>{short(x.start_date)}</td>
                    <td className={x.end_date < today ? 'warn-text' : ''}>{short(x.end_date)}</td>
                    <td>{t('st_' + x.status)}</td>
                    <td className="num">{Math.round(x.progress || 0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {data.delays.length > 0 && (
          <section>
            <h4>{t('dly_lost')}: {lost}</h4>
            <ul>
              {[...data.delays].sort((a, b) => String(a.date).localeCompare(String(b.date))).map((x) => (
                <li key={x.id}>{long(x.date)} — {t('dly_' + x.reason)}, {x.days} {t('days_short')}{x.note ? ` (${x.note})` : ''}</li>
              ))}
            </ul>
          </section>
        )}

        {subs.length > 0 && (
          <section>
            <h4>{t('nav_subs')}</h4>
            <table className="mini-table">
              <thead>
                <tr><th>{t('sub_company')}</th><th>{t('sub_trade')}</th><th>{t('end')}</th><th className="num">{t('sub_progress')}</th>{money && <th className="num">{t('sub_amount')}</th>}{money && <th className="num">{t('sub_paid')}</th>}</tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.trade}</td>
                    <td>{short(s.end_date)}</td>
                    <td className="num">{Math.round(s.progress || 0)}%</td>
                    {money && <td className="num">{fmtMoneyFull(s.amount, cur)}</td>}
                    {money && <td className="num">{fmtMoneyFull(subMath(s).paid, cur)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="pr-two">
          <div>
            <h4>{t('pr_quality_safety')}</h4>
            <ul>
              <li>{t('pr_checks')}: {signed.length}{signed.length ? ` — ${passed} ${t('pr_passed_word')}, ${signed.length - passed} ${t('pr_failed_word')}` : ''}</li>
              <li>{t('open_issues')}: {m.openIssues.length} ({m.overdueIssues.length} {t('pr_overdue_word')}); {t('pr_closed')}: {closedIssues}</li>
              <li>{t('pr_safe_days')}: {m.safeDays}</li>
              <li>{t('pr_open_safety')}: {data.safety.filter((s) => s.status === 'open').length}</li>
            </ul>
          </div>
          <div>
            <h4>{t('pr_attention')}</h4>
            {urgent.length + docs.length + actions.length === 0 ? <p>{t('pr_nothing')}</p> : (
              <ul>
                {urgent.slice(0, 6).map((i) => <li key={i.id}>{t('it_' + i.type)}: {i.title}{i.due_date ? ` — ${short(i.due_date)}` : ''}</li>)}
                {docs.map((d) => <li key={d.id}>{t('ds_' + docState(d, today))}: {d.name} — {short(d.expires_on)}</li>)}
                {actions.slice(0, 6).map((a) => <li key={a.id}>{t('mt_action')}: {a.text}{a.assignee ? ` (${a.assignee})` : ''}{a.due_date ? ` — ${short(a.due_date)}` : ''}</li>)}
              </ul>
            )}
          </div>
        </section>

        {money && (
          <section>
            <h4>{t('nav_budget')}</h4>
            <table className="mini-table">
              <tbody>
                <tr><td>{t('pr_budget_total')}</td><td className="num">{fmtMoneyFull(m.budget, cur)}</td></tr>
                <tr><td>{t('pr_change_orders')} ({approved.length})</td><td className="num">{fmtMoneyFull(m.approvedCO, cur)}</td></tr>
                <tr><td>{t('spent')}</td><td className="num">{fmtMoneyFull(m.spent, cur)} · {m.budget ? Math.round((m.spent / m.budget) * 100) : 0}%</td></tr>
                <tr className="total"><td>{t('forecast')}</td><td className="num">{fmtMoneyFull(m.forecast, cur)}</td></tr>
              </tbody>
            </table>
          </section>
        )}

        <footer>
          <span>{t('pr_prepared_by')}: {user.name}</span>
          <span>{t('client')}: ____________________</span>
        </footer>
      </article>
    </Modal>
  );
}
