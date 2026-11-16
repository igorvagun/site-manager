import { useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useData } from '../lib/store';
import { aiAvailable, aiCall } from '../lib/ai';
import { Glass, Card, Icon, Segmented, Stat, Empty, PageHead } from '../components/ui';
import { todayISO, addDays, toISO, fmtMoney, fmtMoneyFull, fmtHours, hoursBetween, hourlyRate, laborHours, sum } from '../lib/utils';

// Everything that happened in the period, gathered from all sub-apps.
// The numbers shown here are computed locally; the same digest is what the AI agent reads.
export function buildDigest(data, days) {
  const today = todayISO();
  const from = addDays(today, -(days - 1));
  const start = new Date(from + 'T00:00:00');
  const now = new Date();
  const inRange = (ts) => ts && new Date(ts) >= start && new Date(ts) <= now;
  const dayIn = (iso) => iso && iso >= from && iso <= today;

  const tasks = data.tasks
    .filter((t) => t.started_at && new Date(t.started_at) <= now && (!t.finished_at || new Date(t.finished_at) >= start))
    .map((t) => {
      const lo = new Date(Math.max(new Date(t.started_at), start));
      const hi = t.finished_at ? new Date(Math.min(new Date(t.finished_at), now)) : now;
      const rows = (t.workers || []).map((name) => {
        const w = data.workers.find((x) => x.name === name);
        const hours = laborHours(lo, hi, w ? data.shifts.filter((s) => s.worker_id === w.id) : []);
        return { hours, cost: hours * hourlyRate(w) };
      });
      const thread = data.messages.filter((m) => m.thread === 'task:' + t.id && !m.deleted && inRange(m.created_at));
      return {
        name: t.name,
        status: t.status,
        progress: t.progress,
        planned_end: t.end_date,
        started_in_period: inRange(t.started_at),
        finished_in_period: inRange(t.finished_at),
        late: t.status !== 'done' && t.end_date < today,
        workers: t.workers || [],
        hours: sum(rows, (r) => r.hours),
        cost: sum(rows, (r) => r.cost),
        description: t.description || '',
        messages: thread.map((m) => ({ from: m.sender_name, at: m.created_at, text: m.text || `[${m.kind}]` })),
      };
    });

  const shifts = data.shifts.filter((s) => dayIn(s.date));
  const shiftHours = sum(shifts, (s) => (s.clock_in ? hoursBetween(s.clock_in, s.clock_out || now) : 0));
  const late = shifts.filter((s) => {
    const d = new Date(s.clock_in);
    return d.getHours() * 60 + d.getMinutes() > 7 * 60 + 10;
  }).length;
  const expenses = data.expenses.filter((e) => dayIn(e.date));
  const logs = data.logs.filter((l) => dayIn(l.date));

  return {
    period: { from, to: today, days },
    project: data.project[0]?.name || '',
    totals: {
      tasks_started: tasks.filter((t) => t.started_in_period).length,
      tasks_finished: tasks.filter((t) => t.finished_in_period).length,
      tasks_late: tasks.filter((t) => t.late).length,
      task_hours: sum(tasks, (t) => t.hours),
      task_labor_cost: sum(tasks, (t) => t.cost),
      messages: sum(tasks, (t) => t.messages.length),
      shifts: shifts.length,
      shift_hours: shiftHours,
      late_arrivals: late,
      expenses: sum(expenses, (e) => e.amount),
    },
    tasks,
    daily_logs: logs.map((l) => ({ date: l.date, weather: l.weather, crew: l.crew_count, summary: l.summary, delays: l.delays })),
    expenses: expenses.map((e) => ({ date: e.date, category: e.category, description: e.description, amount: e.amount })),
    open_issues: data.issues.filter((i) => i.status !== 'done').map((i) => ({ title: i.title, priority: i.priority, due: i.due_date })),
    open_safety: data.safety.filter((s) => s.status === 'open').map((s) => ({ title: s.title, severity: s.severity })),
    generated_at: toISO(now),
  };
}

export default function Insights() {
  const { t, lang } = useI18n();
  const data = useData();
  const cur = data.project[0]?.currency || '₪';
  const [days, setDays] = useState(7);
  const [ai, setAi] = useState({ state: 'idle', text: '' });
  const digest = useMemo(() => buildDigest(data, days), [data, days]);
  const T = digest.totals;

  const run = async () => {
    setAi({ state: 'loading', text: '' });
    try {
      const r = await aiCall('summary', { digest, lang });
      setAi({ state: 'done', text: r.text || '' });
    } catch (e) {
      console.error(e);
      setAi({ state: 'error', text: '' });
    }
  };

  return (
    <>
      <PageHead title={t('nav_insights')} subtitle={t('insights_sub')} />
      <Glass className="toolbar">
        <Segmented
          value={days}
          onChange={(v) => {
            setDays(v);
            setAi({ state: 'idle', text: '' });
          }}
          options={[
            { value: 1, label: t('period_day') },
            { value: 7, label: t('period_week') },
            { value: 30, label: t('period_month') },
          ]}
        />
        <span className="muted">
          {digest.period.from} → {digest.period.to}
        </span>
      </Glass>

      <div className="grid stats four">
        <Stat icon="check" tone="green" label={t('ins_tasks_finished')} value={T.tasks_finished} sub={`${T.tasks_started} ${t('ins_started')} · ${T.tasks_late} ${t('ins_late')}`} />
        <Stat icon="clock" tone="blue" label={t('ins_task_hours')} value={fmtHours(T.task_hours)} sub={`${fmtMoney(T.task_labor_cost, cur)} ${t('labor_cost').toLowerCase()}`} />
        <Stat icon="users" tone="purple" label={t('ins_shifts')} value={T.shifts} sub={`${fmtHours(T.shift_hours)} ${t('hours')} · ${T.late_arrivals} ${t('ins_late_arrivals')}`} />
        <Stat icon="chat" tone="orange" label={t('ins_messages')} value={T.messages} sub={`${fmtMoney(T.expenses, cur)} ${t('ins_expenses')}`} />
      </div>

      <div className="grid two-col">
        <Card title={t('ins_by_task')}>
          {digest.tasks.length === 0 ? (
            <Empty icon="calendar" text={t('ins_no_activity')} />
          ) : (
            <table className="mini-table">
              <thead>
                <tr>
                  <th>{t('task')}</th>
                  <th className="num">{t('hours')}</th>
                  <th className="num">{t('labor_cost')}</th>
                  <th className="num"><Icon name="chat" size={13} /></th>
                </tr>
              </thead>
              <tbody>
                {[...digest.tasks].sort((a, b) => b.cost - a.cost).map((x) => (
                  <tr key={x.name}>
                    <td>
                      {x.name}
                      {x.late && <span className="warn-text"> · {t('past_due')}</span>}
                    </td>
                    <td className="num">{fmtHours(x.hours)}</td>
                    <td className="num">{fmtMoneyFull(x.cost, cur)}</td>
                    <td className="num">{x.messages.length || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title={t('ai_conclusions')} action={<Icon name="sparkle" size={18} />}>
          {!aiAvailable() ? (
            <div className="notice plain">
              <p><b>{t('ai_not_connected')}</b></p>
              <p>{t('ai_not_connected_long')}</p>
            </div>
          ) : (
            <>
              {ai.state === 'idle' && <p className="muted">{t('ai_idle_hint')}</p>}
              {ai.state === 'loading' && <p className="scan-note"><span className="spinner small" /> {t('ai_working')}</p>}
              {ai.state === 'error' && <p className="form-error">{t('ai_failed')}</p>}
              {ai.state === 'done' && <div className="ai-text">{ai.text}</div>}
              <div className="btn-row">
                <button className="btn primary" onClick={run} disabled={ai.state === 'loading'}>
                  <Icon name="sparkle" size={16} />
                  {t(ai.state === 'done' ? 'ai_regenerate' : 'ai_generate')}
                </button>
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
