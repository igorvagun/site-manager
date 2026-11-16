import { useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useData } from '../lib/store';
import { useOptions, CATEGORIES, WEATHER } from '../lib/constants';
import { Card, Glass, Ring, Stat, Meter, Icon, Badge, Empty, PageHead } from '../components/ui';
import {
  todayISO,
  addDays,
  diffDays,
  sum,
  fmtMoney,
  fmtMoneyFull,
  fmtDate,
  taskBudget,
  plannedProgress,
  parseISO,
  clamp,
} from '../lib/utils';

export function useMetrics() {
  const data = useData();
  return useMemo(() => {
    const today = todayISO();
    const { tasks, expenses, budget_lines, change_orders, attendance, workers, issues, safety, materials } = data;
    const project = data.project[0] || {};
    const cur = project.currency || '₪';

    const weight = sum(tasks, taskBudget) || 1;
    const progress = sum(tasks, (t) => taskBudget(t) * (t.progress || 0)) / weight;
    const planned = sum(tasks, (t) => taskBudget(t) * plannedProgress(t, today)) / weight;

    const approvedCO = sum(change_orders.filter((c) => c.status === 'approved'), (c) => c.amount);
    const budget = sum(budget_lines, (b) => b.planned) + approvedCO;
    const spent = sum(expenses, (e) => e.amount);
    const forecast = progress > 3 ? spent / (progress / 100) : budget;

    const todayAtt = attendance.filter((a) => a.date === today);
    const onSite = todayAtt.filter((a) => a.status === 'present').length;
    const activeWorkers = workers.filter((w) => w.active !== false).length;

    const openIssues = issues.filter((i) => i.status !== 'done');
    const overdueIssues = openIssues.filter((i) => i.due_date && i.due_date < today);
    const lastIncident = safety
      .filter((s) => s.type === 'incident')
      .map((s) => s.date)
      .sort()
      .pop();
    const safeDays = lastIncident
      ? Math.max(0, diffDays(lastIncident, today))
      : project.start_date
      ? Math.max(0, diffDays(project.start_date, today))
      : 0;
    const lowStock = materials.filter((m) => Number(m.qty) < Number(m.min_qty));
    const lateTasks = tasks.filter((t) => t.status === 'delayed' || (t.status !== 'done' && t.end_date && t.end_date < today));
    const daysLeft = project.end_date ? diffDays(today, project.end_date) : null;

    return {
      today, project, cur, progress, planned, budget, spent, forecast, approvedCO, onSite, activeWorkers,
      openIssues, overdueIssues, safeDays, lowStock, lateTasks, daysLeft,
    };
  }, [data]);
}

// Cumulative spend vs. a straight-line plan across the project duration.
function SpendChart({ expenses, budget, project, cur }) {
  const { t, lang } = useI18n();
  const [hover, setHover] = useState(null);
  const today = todayISO();
  const start = project.start_date || expenses.map((e) => e.date).sort()[0] || today;
  const end = project.end_date && project.end_date > start ? project.end_date : addDays(today, 30);
  const total = Math.max(1, diffDays(start, end));
  const W = 640;
  const H = 210;
  const P = { l: 8, r: 8, t: 14, b: 24 };
  const maxY = Math.max(budget, sum(expenses, (e) => e.amount)) * 1.08 || 1;
  const x = (iso) => P.l + (clamp(diffDays(start, iso), 0, total) / total) * (W - P.l - P.r);
  const y = (v) => H - P.b - (v / maxY) * (H - P.t - P.b);

  const sorted = [...expenses].filter((e) => e.date).sort((a, b) => a.date.localeCompare(b.date));
  let acc = 0;
  const pts = [{ date: start, v: 0 }];
  sorted.forEach((e) => {
    acc += Number(e.amount) || 0;
    pts.push({ date: e.date < start ? start : e.date, v: acc });
  });
  if (pts[pts.length - 1].date < today && today <= end) pts.push({ date: today, v: acc });
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const area = `${path} L${x(last.date).toFixed(1)},${y(0)} L${x(start)},${y(0)} Z`;
  const plannedAt = (iso) => (budget * clamp(diffDays(start, iso), 0, total)) / total;

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = pts[0];
    pts.forEach((p) => {
      if (Math.abs(x(p.date) - px) < Math.abs(x(best.date) - px)) best = p;
    });
    setHover(best);
  };
  const months = [];
  const m = parseISO(start);
  m.setDate(1);
  m.setMonth(m.getMonth() + 1);
  while (m <= parseISO(end)) {
    months.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-01`);
    m.setMonth(m.getMonth() + 1);
  }
  const step = Math.ceil(months.length / 6);

  return (
    <div className="chart" dir="ltr">
      <div className="legend">
        <span><i className="swatch line bg-blue" />{t('actual_spend')}</span>
        <span><i className="swatch line dashed" />{t('planned_spend')}</span>
      </div>
      <div className="chart-plot">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={t('spend_over_time')}>
          <defs>
            <linearGradient id="spendFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--blue)" stopOpacity="0.28" />
              <stop offset="1" stopColor="var(--blue)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75, 1].map((k) => (
            <line key={k} x1={P.l} x2={W - P.r} y1={y((maxY / 1.08) * k)} y2={y((maxY / 1.08) * k)} className="gridline" />
          ))}
          <line x1={P.l} x2={W - P.r} y1={y(0)} y2={y(0)} className="axis" />
          <line x1={x(start)} y1={y(0)} x2={x(end)} y2={y(budget)} className="plan-line" vectorEffect="non-scaling-stroke" />
          <path d={area} fill="url(#spendFill)" />
          <path d={path} className="spend-line" vectorEffect="non-scaling-stroke" />
          {today >= start && today <= end && <line x1={x(today)} x2={x(today)} y1={P.t} y2={y(0)} className="today-line" vectorEffect="non-scaling-stroke" />}
          {hover && <line x1={x(hover.date)} x2={x(hover.date)} y1={P.t} y2={y(0)} className="crosshair" vectorEffect="non-scaling-stroke" />}
        </svg>
        {hover && (
          <>
            <div className="chart-dot" style={{ left: `${(x(hover.date) / W) * 100}%`, top: `${(y(hover.v) / H) * 100}%` }} />
            <div className="glass tip" style={{ left: `${clamp((x(hover.date) / W) * 100, 16, 84)}%` }} dir={lang === 'he' ? 'rtl' : 'ltr'}>
              <b>{fmtDate(hover.date, lang, { day: 'numeric', month: 'short', year: 'numeric' })}</b>
              <span><i className="swatch bg-blue" />{t('actual_spend')}: {fmtMoneyFull(hover.v, cur)}</span>
              <span><i className="swatch bg-muted" />{t('planned_spend')}: {fmtMoneyFull(plannedAt(hover.date), cur)}</span>
            </div>
          </>
        )}
        <div className="chart-x">
          {months.filter((_, i) => i % step === 0).map((mo) => (
            <span key={mo} style={{ left: `${(x(mo) / W) * 100}%` }}>
              {fmtDate(mo, lang, { month: 'short' })}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function CrewChart({ attendance }) {
  const { t, lang } = useI18n();
  const today = todayISO();
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const date = addDays(today, -i);
    days.push({ date, n: attendance.filter((a) => a.date === date && a.status === 'present').length });
  }
  const max = Math.max(1, ...days.map((d) => d.n));
  return (
    <div className="bars" dir="ltr" role="img" aria-label={t('crew_14d')}>
      {days.map((d) => (
        <div className="bar-col" key={d.date} tabIndex={0}>
          <div className="bar-tip glass" dir={lang === 'he' ? 'rtl' : 'ltr'}>
            <b>{d.n}</b> {t('on_site')}
            <br />
            {fmtDate(d.date, lang, { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
          <div className="bar-track">
            <div className={`bar ${d.date === today ? 'now' : ''}`} style={{ height: `${(d.n / max) * 100}%` }} />
          </div>
          <span>{parseISO(d.date).getDate()}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard({ go }) {
  const { t, lang } = useI18n();
  const data = useData();
  const o = useOptions();
  const m = useMetrics();
  const { today, cur, project } = m;

  const variance = Math.round(m.progress - m.planned);
  const health = variance >= -3 ? 'green' : variance >= -10 ? 'orange' : 'red';
  const budgetPct = m.budget ? (m.spent / m.budget) * 100 : 0;
  const overForecast = m.forecast > m.budget * 1.02;

  const byCat = CATEGORIES.map((c) => ({
    c,
    planned: sum(data.budget_lines.filter((b) => b.category === c), (b) => b.planned),
    actual: sum(data.expenses.filter((e) => e.category === c), (e) => e.amount),
  })).filter((r) => r.planned || r.actual);

  const alerts = [
    ...m.lateTasks.map((x) => ({ tone: 'red', icon: 'clock', text: `${t('alert_late_task')}: ${x.name}`, to: 'schedule' })),
    ...m.overdueIssues.map((x) => ({ tone: 'orange', icon: 'check', text: `${t('alert_overdue_issue')}: ${x.title}`, to: 'issues' })),
    ...data.safety.filter((s) => s.status === 'open').map((x) => ({ tone: 'red', icon: 'shield', text: `${t('alert_open_safety')}: ${x.title}`, to: 'safety' })),
    ...data.equipment.filter((e) => e.kind === 'rented' && e.status !== 'returned' && e.return_date && e.return_date < today).map((x) => ({ tone: 'red', icon: 'truck', text: `${t('alert_equipment')}: ${x.name}`, to: 'equipment' })),
    ...m.lowStock.map((x) => ({ tone: 'yellow', icon: 'box', text: `${t('alert_low_stock')}: ${x.name} (${x.qty} ${x.unit})`, to: 'materials' })),
    ...byCat.filter((r) => r.planned && r.actual / r.planned >= 0.9).map((r) => ({
      tone: 'orange', icon: 'wallet', to: 'budget',
      text: `${t('alert_budget')}: ${t('cat_' + r.c)} — ${Math.round((r.actual / r.planned) * 100)}%`,
    })),
  ];

  const week = addDays(today, 7);
  const upcoming = [
    ...data.tasks.filter((x) => x.start_date > today && x.start_date <= week).map((x) => ({ date: x.start_date, icon: 'calendar', text: `${t('starts')}: ${x.name}` })),
    ...data.tasks.filter((x) => x.status !== 'done' && x.end_date >= today && x.end_date <= week).map((x) => ({ date: x.end_date, icon: 'clock', text: `${t('due')}: ${x.name}` })),
    ...data.materials.filter((x) => x.next_delivery && x.next_delivery >= today && x.next_delivery <= week).map((x) => ({ date: x.next_delivery, icon: 'truck', text: `${t('delivery')}: ${x.name}` })),
    ...m.openIssues.filter((x) => x.due_date >= today && x.due_date <= week).map((x) => ({ date: x.due_date, icon: 'check', text: `${t('due')}: ${x.title}` })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const lastLog = [...data.logs].sort((a, b) => b.date.localeCompare(a.date))[0];
  const activeTasks = data.tasks.filter((x) => x.status === 'active' || x.status === 'delayed');

  return (
    <>
      <PageHead
        title={project.name || t('nav_dashboard')}
        subtitle={[project.address, fmtDate(today, lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })].filter(Boolean).join(' · ')}
      />

      <div className="grid dash-top">
        <Glass className="hero">
          <Ring value={m.progress} size={148} stroke={13} tone={health}>
            <b>{Math.round(m.progress)}%</b>
            <span>{t('complete')}</span>
          </Ring>
          <div className="hero-info">
            <Badge tone={health}>
              {variance >= -3 ? t('on_track') : t('behind')} · {variance > 0 ? '+' : ''}{variance}%
            </Badge>
            <h2>{t('overall_progress')}</h2>
            <p>
              {t('planned_by_today')}: <b>{Math.round(m.planned)}%</b>
            </p>
            <Meter value={m.progress} tone={health} marker={m.planned} />
            <div className="hero-meta">
              <div>
                <span>{t('days_left')}</span>
                <b>{m.daysLeft == null ? '—' : Math.max(0, m.daysLeft)}</b>
              </div>
              <div>
                <span>{t('handover')}</span>
                <b>{fmtDate(project.end_date, lang, { day: 'numeric', month: 'short', year: 'numeric' })}</b>
              </div>
              <div>
                <span>{t('client')}</span>
                <b>{project.client || '—'}</b>
              </div>
            </div>
          </div>
        </Glass>

        <div className="grid stats">
          <Stat icon="users" tone="blue" label={t('on_site_today')} value={`${m.onSite}/${m.activeWorkers}`} sub={t('workers')} />
          <Stat
            icon="wallet"
            tone={budgetPct > 100 ? 'red' : 'purple'}
            label={t('budget_spent')}
            value={fmtMoney(m.spent, cur)}
            sub={`${Math.round(budgetPct)}% ${t('of')} ${fmtMoney(m.budget, cur)}`}
          />
          <Stat
            icon="check"
            tone="orange"
            label={t('open_issues')}
            value={m.openIssues.length}
            sub={m.overdueIssues.length ? `${m.overdueIssues.length} ${t('overdue')}` : t('none_overdue')}
          />
          <Stat icon="shield" tone="green" label={t('days_no_incident')} value={m.safeDays} sub={t('days')} />
        </div>
      </div>

      <div className="grid dash-main">
        <Card
          title={t('spend_over_time')}
          className="span-2"
          action={<Badge tone={overForecast ? 'red' : 'green'}>{t('forecast')}: {fmtMoney(m.forecast, cur)}</Badge>}
        >
          <SpendChart expenses={data.expenses} budget={m.budget} project={project} cur={cur} />
        </Card>

        <Card title={`${t('alerts')} · ${alerts.length}`}>
          {alerts.length ? (
            <ul className="list alerts">
              {alerts.slice(0, 6).map((a, i) => (
                <li key={i}>
                  <button onClick={() => go(a.to)}>
                    <span className={`dot-icon tint-${a.tone}`}><Icon name={a.icon} size={15} /></span>
                    <span>{a.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="check" text={t('no_alerts')} />
          )}
        </Card>

        <Card title={t('budget_by_category')} action={<button className="link" onClick={() => go('budget')}>{t('view_all')}</button>}>
          <div className="cat-rows">
            {byCat.map((r) => {
              const pct = r.planned ? (r.actual / r.planned) * 100 : 100;
              return (
                <div className="cat-row" key={r.c} title={`${fmtMoneyFull(r.actual, cur)} / ${fmtMoneyFull(r.planned, cur)}`}>
                  <div className="cat-top">
                    <span>{t('cat_' + r.c)}</span>
                    <b>{fmtMoney(r.actual, cur)} <i>/ {fmtMoney(r.planned, cur)}</i></b>
                  </div>
                  <Meter value={pct} tone={pct > 100 ? 'red' : pct >= 90 ? 'orange' : 'blue'} />
                </div>
              );
            })}
          </div>
        </Card>

        <Card title={t('in_progress')} action={<button className="link" onClick={() => go('schedule')}>{t('view_all')}</button>}>
          {activeTasks.length ? (
            <ul className="list">
              {activeTasks.map((x) => (
                <li key={x.id} className="task-mini">
                  <div className="cat-top">
                    <span>{x.name}</span>
                    <Badge tone={x.status === 'delayed' ? 'red' : 'blue'}>{t('st_' + x.status)}</Badge>
                  </div>
                  <Meter value={x.progress} tone={x.status === 'delayed' ? 'red' : 'blue'} marker={plannedProgress(x, today)} />
                  <small>
                    {o.floorLabel(x.floor)} · {x.progress}% · {t('due')} {fmtDate(x.end_date, lang)}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="calendar" text={t('no_active_tasks')} />
          )}
        </Card>

        <Card title={t('crew_14d')} action={<button className="link" onClick={() => go('team')}>{t('view_all')}</button>}>
          <CrewChart attendance={data.attendance} />
        </Card>

        <Card title={t('next_7_days')}>
          {upcoming.length ? (
            <ul className="list upcoming">
              {upcoming.slice(0, 6).map((u, i) => (
                <li key={i}>
                  <span className="date-chip">{fmtDate(u.date, lang)}</span>
                  <Icon name={u.icon} size={15} />
                  <span>{u.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="calendar" text={t('nothing_upcoming')} />
          )}
        </Card>

        <Card title={t('latest_log')} className="span-2" action={<button className="link" onClick={() => go('log')}>{t('view_all')}</button>}>
          {lastLog ? (
            <div className="log-mini">
              <div className="log-weather tint-blue">
                <Icon name={WEATHER[lastLog.weather] || 'sun'} size={26} />
                <b>{lastLog.temp}°</b>
              </div>
              <div>
                <small>
                  {fmtDate(lastLog.date, lang, { weekday: 'long', day: 'numeric', month: 'long' })} · {lastLog.crew_count} {t('workers')} · {lastLog.author}
                </small>
                <p>{lastLog.summary}</p>
                {lastLog.delays && <p className="warn-text"><Icon name="alert" size={14} /> {lastLog.delays}</p>}
              </div>
            </div>
          ) : (
            <Empty icon="book" text={t('no_logs')} />
          )}
        </Card>
      </div>
    </>
  );
}
