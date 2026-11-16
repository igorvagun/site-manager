import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useData } from '../lib/store';
import { nav } from '../lib/nav';
import { Glass, Icon, Empty, PageHead, SearchBox, Segmented } from '../components/ui';
import { fmtDate, fmtTime, toISO } from '../lib/utils';

// Which app a record lives in, and how its fields and coded values are named on screen.
const APP = { delays: 'schedule', meetings: 'meetings', subcontracts: 'subs', documents: 'docs', requests: 'materials', inspections: 'quality', statements: 'budget', tasks: 'schedule', issues: 'issues', expenses: 'budget', budget_lines: 'budget', change_orders: 'budget', workers: 'team', equipment: 'equipment', materials: 'materials', safety: 'safety', drawings: 'drawings', contacts: 'contacts', logs: 'log' };
const ICON = { delays: 'rain', meetings: 'note', subcontracts: 'handshake', documents: 'file', requests: 'truck', inspections: 'clipboard', statements: 'receipt', tasks: 'chart', issues: 'check', expenses: 'wallet', budget_lines: 'wallet', change_orders: 'wallet', workers: 'users', equipment: 'truck', materials: 'box', safety: 'shield', drawings: 'layers', contacts: 'phone', logs: 'book' };
const FIELD = {
  name: 'title', title: 'title', status: 'status', progress: 'progress', start_date: 'start', end_date: 'end', daily_cost: 'daily_cost', workers: 'assigned_workers', notes: 'notes',
  description: 'description', floor: 'floor', priority: 'priority', assignee: 'assignee', due_date: 'due_date', amount: 'amount', category: 'category', vendor: 'vendor', date: 'date',
  planned: 'planned', role: 'position', company: 'company', phone: 'phone', email: 'email', hourly_rate: 'hourly_rate', daily_rate: 'daily_rate', active: 'status', qty: 'qty_on_site',
  min_qty: 'min_qty', next_delivery: 'next_delivery', supplier: 'vendor', location: 'location', severity: 'severity', kind: 'type', type: 'type', return_date: 'return_by',
  inspection_date: 'next_inspection', number: 'co_number', revision: 'revision', discipline: 'discipline', summary: 'work_done', delays: 'delays_issues', weather: 'weather',
  reason: 'dly_reason', days: 'dly_days', attendees: 'mt_attendees',
  trade: 'sub_trade', retention: 'sub_retention', scope: 'sub_scope', issuer: 'doc_issuer', holder: 'doc_holder', issued_on: 'doc_issued', expires_on: 'doc_expires',
  temp: 'temperature', crew_count: 'crew_on_site', started_at: 'started', finished_at: 'finished', id_number: 'id_number', unit: 'unit', reporter: 'reporter', author: 'author',
};
const VALUE_PREFIX = {
  'tasks.status': 'st_', 'issues.status': 'is_', 'issues.priority': 'pr_', 'issues.type': 'it_', 'expenses.status': 'pay_', 'expenses.category': 'cat_', 'budget_lines.category': 'cat_',
  'change_orders.status': 'co_', 'equipment.status': 'eqs_', 'equipment.kind': 'eq_', 'safety.status': 'ss_', 'safety.type': 'sf_', 'safety.severity': 'pr_', 'drawings.discipline': 'disc_',
  'contacts.kind': 'ck_kind_', 'logs.weather': 'w_', 'requests.status': 'rq_', 'inspections.status': 'qcr_', 'inspections.stage': 'qcs_', 'subcontracts.status': 'subs_', 'documents.kind': 'dk_', 'delays.reason': 'dly_',
};

export default function History({ project }) {
  const { t, lang } = useI18n();
  const data = useData();
  const [q, setQ] = useState('');
  const [what, setWhat] = useState('all');

  const show = (collection, field, v) => {
    if (v === '' || v == null) return '—';
    if (Array.isArray(v)) return v.join(', ') || '—';
    if (typeof v === 'boolean') return t(v ? 'active' : 'inactive');
    const prefix = VALUE_PREFIX[`${collection}.${field}`];
    if (prefix) {
      const label = t(prefix + v);
      if (label !== prefix + v) return label;
    }
    if (/_at$/.test(field)) return `${fmtDate(toISO(new Date(v)), lang)} ${fmtTime(v, lang)}`;
    if (/date|delivery/.test(field) && /^\d{4}-\d{2}-\d{2}/.test(String(v))) return fmtDate(String(v), lang, { day: 'numeric', month: 'short', year: 'numeric' });
    if (field === 'progress') return v + '%';
    const s = String(v);
    return s.length > 60 ? s.slice(0, 60) + '…' : s;
  };

  const kinds = [...new Set(data.activity.map((a) => a.collection))];
  const list = [...data.activity]
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .filter((a) => (what === 'all' || a.collection === what) && (!q || `${a.title} ${a.user_name}`.toLowerCase().includes(q.toLowerCase())));
  let lastDay = '';

  return (
    <>
      <PageHead title={t('nav_history')} subtitle={t('history_sub')} />
      <Glass className="toolbar">
        <Segmented value={what} onChange={setWhat} options={[{ value: 'all', label: t('all'), count: data.activity.length }, ...kinds.map((k) => ({ value: k, label: t('hc_' + k) }))]} />
        <SearchBox value={q} onChange={setQ} placeholder={t('history_search')} />
      </Glass>
      {list.length === 0 ? (
        <Glass><Empty icon="clock" text={t('history_empty')} /></Glass>
      ) : (
        <Glass className="card history">
          {list.map((a) => {
            const day = toISO(new Date(a.at));
            const head = day !== lastDay;
            lastDay = day;
            return (
              <div key={a.id}>
                {head && <h4>{fmtDate(day, lang, { weekday: 'long', day: 'numeric', month: 'long' })}</h4>}
                <div className="hist-row">
                  <span className={`dot-icon tint-${a.action === 'delete' ? 'red' : a.action === 'add' ? 'green' : 'blue'}`}>
                    <Icon name={ICON[a.collection] || 'edit'} size={15} />
                  </span>
                  <div className="grow">
                    <p>
                      <b>{a.user_name}</b> {t('ha_' + a.action)} <span className="muted">{t('hc_' + a.collection)}</span>{' '}
                      {a.action === 'delete' ? (
                        <b>{a.title}</b>
                      ) : (
                        <button className="link" onClick={() => nav(`p/${project.id}/${APP[a.collection]}?q=${encodeURIComponent(a.title)}`)}>
                          {a.title || '—'}
                        </button>
                      )}
                    </p>
                    {a.changes.map((c) => (
                      <small key={c.field} className="hist-change">
                        {FIELD[c.field] ? t(FIELD[c.field]) : c.field}: <s>{show(a.collection, c.field, c.from)}</s> <Icon name="arrow" size={11} className="flip-rtl" /> <b>{show(a.collection, c.field, c.to)}</b>
                      </small>
                    ))}
                  </div>
                  <time>{fmtTime(a.at, lang)}</time>
                </div>
              </div>
            );
          })}
        </Glass>
      )}
    </>
  );
}
