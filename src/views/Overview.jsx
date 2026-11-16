import { useI18n } from '../lib/i18n';
import { useStore, SCOPED } from '../lib/store';
import { nav } from '../lib/nav';
import { computeMetrics } from './Dashboard';
import { Glass, Badge, Meter, Empty, PageHead, Stat, Icon } from '../components/ui';
import { fmtDate, fmtMoney, sum, exportCSV } from '../lib/utils';

// All projects side by side, with the same numbers each project's dashboard shows.
export default function Overview() {
  const { t, lang } = useI18n();
  const { data } = useStore();
  const rows = data.projects.map((p) => {
    const scoped = { project: [p] };
    SCOPED.forEach((c) => (scoped[c] = data[c].filter((r) => r.project_id === p.id)));
    const m = computeMetrics(scoped);
    const variance = Math.round(m.progress - m.planned);
    return { p, m, variance, tone: variance >= -3 ? 'green' : variance >= -10 ? 'orange' : 'red', budgetPct: m.budget ? (m.spent / m.budget) * 100 : 0 };
  });
  const cur = rows[0]?.m.cur || '₪';

  return (
    <>
      <PageHead title={t('nav_overview')} subtitle={t('overview_sub')}>
        <button
          className="btn"
          onClick={() =>
            exportCSV('projects.csv', rows, [
              { label: t('project_name'), get: (r) => r.p.name },
              { label: t('progress'), get: (r) => Math.round(r.m.progress) },
              { label: t('planned'), get: (r) => Math.round(r.m.planned) },
              { label: t('total_budget'), get: (r) => Math.round(r.m.budget) },
              { label: t('spent'), get: (r) => Math.round(r.m.spent) },
              { label: t('on_site_today'), get: (r) => r.m.onSite },
              { label: t('open_issues'), get: (r) => r.m.openIssues.length },
              { label: t('ov_late_tasks'), get: (r) => r.m.lateTasks.length },
              { label: t('handover'), get: (r) => r.p.end_date },
              { label: t('pace_forecast'), get: (r) => r.m.forecastEnd || '' },
            ])
          }
        >
          <Icon name="download" size={16} />
          CSV
        </button>
      </PageHead>

      <div className="grid stats four">
        <Stat icon="building" tone="blue" label={t('grp_projects')} value={rows.length} sub={`${rows.filter((r) => r.tone !== 'green').length} ${t('ov_behind')}`} />
        <Stat icon="wallet" tone="purple" label={t('total_budget')} value={fmtMoney(sum(rows, (r) => r.m.budget), cur)} sub={`${fmtMoney(sum(rows, (r) => r.m.spent), cur)} ${t('spent').toLowerCase()}`} />
        <Stat icon="users" tone="green" label={t('on_site_today')} value={`${sum(rows, (r) => r.m.onSite)}/${sum(rows, (r) => r.m.activeWorkers)}`} sub={t('workers')} />
        <Stat icon="alert" tone="orange" label={t('ov_attention')} value={sum(rows, (r) => r.m.lateTasks.length + r.m.overdueIssues.length)} sub={t('ov_attention_sub')} />
      </div>

      {rows.length === 0 ? (
        <Glass><Empty icon="building" text={t('no_projects')} /></Glass>
      ) : (
        <Glass className="table-wrap">
          <table className="overview">
            <thead>
              <tr>
                <th>{t('project_name')}</th>
                <th>{t('progress')}</th>
                <th>{t('budget_spent')}</th>
                <th className="num">{t('on_site_today')}</th>
                <th className="num">{t('ov_late_tasks')}</th>
                <th className="num">{t('open_issues')}</th>
                <th>{t('handover')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, m, variance, tone, budgetPct }) => (
                <tr key={p.id} className="clickable" onClick={() => nav(`p/${p.id}`)}>
                  <td>
                    <button className="task-title" data-accent={p.accent} onClick={() => nav(`p/${p.id}`)}>
                      {p.name}
                    </button>
                    <br />
                    <small>{p.client}</small>
                  </td>
                  <td className="ov-bar">
                    <div className="cat-top">
                      <b>{Math.round(m.progress)}%</b>
                      <Badge tone={tone}>
                        {variance > 0 ? '+' : ''}
                        {variance}%
                      </Badge>
                    </div>
                    <Meter value={m.progress} tone={tone} marker={m.planned} />
                  </td>
                  <td className="ov-bar">
                    <div className="cat-top">
                      <b>{fmtMoney(m.spent, m.cur)}</b>
                      <span className="muted">{Math.round(budgetPct)}%</span>
                    </div>
                    <Meter value={budgetPct} tone={budgetPct > 100 ? 'red' : budgetPct > progressCap(m) ? 'orange' : 'blue'} />
                  </td>
                  <td className="num">
                    {m.onSite}/{m.activeWorkers}
                  </td>
                  <td className="num">{m.lateTasks.length ? <Badge tone="red">{m.lateTasks.length}</Badge> : '—'}</td>
                  <td className="num">
                    {m.openIssues.length}
                    {m.overdueIssues.length > 0 && <small className="warn-text"> ({m.overdueIssues.length})</small>}
                  </td>
                  <td className="nowrap">
                    {fmtDate(p.end_date, lang, { day: 'numeric', month: 'short', year: '2-digit' })}
                    {m.forecastEnd && Math.abs(m.slipDays) > 0 && (
                      <>
                        <br />
                        <small className={m.slipDays > 7 ? 'warn-text' : ''}>
                          {m.slipDays > 0 ? '+' : '−'}
                          {Math.abs(m.slipDays)} {t('days_short')}
                        </small>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Glass>
      )}
    </>
  );
}

// Spending well ahead of progress is worth a second look.
const progressCap = (m) => m.progress + 15;
