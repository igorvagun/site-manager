import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useData, addRow, updateRow, removeRow } from '../lib/store';
import { useOptions, CATEGORIES, CO_STATUS } from '../lib/constants';
import { Glass, Card, Icon, Badge, Meter, EntityForm, Empty, PageHead, SearchBox, Stat, IconButton } from '../components/ui';
import { useMetrics } from './Dashboard';
import { todayISO, fmtDate, fmtMoney, fmtMoneyFull, sum, exportCSV } from '../lib/utils';

export default function Budget() {
  const { t, lang } = useI18n();
  const data = useData();
  const o = useOptions();
  const m = useMetrics();
  const { cur } = m;
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [form, setForm] = useState(null); // { kind, row }

  const expenses = [...data.expenses]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((e) => (!cat || e.category === cat) && (!q || `${e.description} ${e.vendor}`.toLowerCase().includes(q.toLowerCase())));
  const unpaid = sum(data.expenses.filter((e) => e.status === 'pending'), (e) => e.amount);
  const remaining = m.budget - m.spent;
  const rows = CATEGORIES.map((c) => {
    const line = data.budget_lines.find((b) => b.category === c);
    return { c, line, planned: line?.planned || 0, actual: sum(data.expenses.filter((e) => e.category === c), (e) => e.amount) };
  });

  const schemas = {
    expenses: {
      title: t('expense'),
      fields: [
        { key: 'description', label: t('description'), required: true },
        { key: 'amount', label: `${t('amount')} (${cur})`, type: 'number', required: true, half: true },
        { key: 'date', label: t('date'), type: 'date', required: true, half: true },
        { key: 'category', label: t('category'), type: 'select', options: o.categories, half: true },
        { key: 'status', label: t('payment'), type: 'select', options: o.payStatus, half: true },
        { key: 'vendor', label: t('vendor') },
      ],
      blank: { description: '', amount: '', date: todayISO(), category: 'materials', status: 'pending', vendor: '' },
    },
    change_orders: {
      title: t('change_order'),
      fields: [
        { key: 'number', label: t('co_number'), required: true, half: true },
        { key: 'date', label: t('date'), type: 'date', half: true },
        { key: 'title', label: t('description'), required: true },
        { key: 'amount', label: `${t('amount')} (${cur}) — ${t('co_amount_hint')}`, type: 'number', required: true, half: true },
        { key: 'status', label: t('status'), type: 'select', options: o.coStatus, half: true },
      ],
      blank: { number: `CO-${String(data.change_orders.length + 1).padStart(3, '0')}`, date: todayISO(), title: '', amount: '', status: 'pending' },
    },
    budget_lines: {
      title: t('budget_line'),
      fields: [
        { key: 'category', label: t('category'), type: 'select', options: o.categories, half: true },
        { key: 'planned', label: `${t('planned')} (${cur})`, type: 'number', min: 0, required: true, half: true },
      ],
    },
  };
  const open = (kind, row) => setForm({ kind, row: row || schemas[kind].blank });
  const s = form && schemas[form.kind];

  return (
    <>
      <PageHead title={t('nav_budget')} subtitle={t('budget_sub')}>
        <button
          className="btn"
          onClick={() =>
            exportCSV('expenses.csv', expenses, [
              { key: 'date', label: t('date') },
              { key: 'description', label: t('description') },
              { label: t('category'), get: (r) => t('cat_' + r.category) },
              { key: 'vendor', label: t('vendor') },
              { key: 'amount', label: t('amount') },
              { label: t('payment'), get: (r) => t('pay_' + r.status) },
            ])
          }
        >
          <Icon name="download" size={16} />
          CSV
        </button>
        <button className="btn" onClick={() => open('change_orders')}>
          <Icon name="plus" size={16} />
          {t('change_order')}
        </button>
        <button className="btn primary" onClick={() => open('expenses')}>
          <Icon name="plus" size={16} />
          {t('new_expense')}
        </button>
      </PageHead>

      <div className="grid stats four">
        <Stat icon="wallet" tone="blue" label={t('total_budget')} value={fmtMoney(m.budget, cur)} sub={`${t('incl_co')} ${fmtMoney(m.approvedCO, cur)}`} />
        <Stat icon="chart" tone="purple" label={t('spent')} value={fmtMoney(m.spent, cur)} sub={`${m.budget ? Math.round((m.spent / m.budget) * 100) : 0}% · ${fmtMoney(unpaid, cur)} ${t('unpaid')}`} />
        <Stat icon="check" tone={remaining < 0 ? 'red' : 'green'} label={t('remaining')} value={fmtMoney(remaining, cur)} sub={`${Math.round(m.progress)}% ${t('complete')}`} />
        <Stat icon="alert" tone={m.forecast > m.budget * 1.02 ? 'red' : 'green'} label={t('forecast')} value={fmtMoney(m.forecast, cur)} sub={t('forecast_hint')} />
      </div>

      <div className="grid two-col">
        <Card title={t('budget_by_category')}>
          <div className="cat-rows">
            {rows.map((r) => {
              const pct = r.planned ? (r.actual / r.planned) * 100 : r.actual ? 100 : 0;
              const tone = pct > 100 ? 'red' : pct >= 90 ? 'orange' : 'blue';
              return (
                <button
                  className="cat-row clickable"
                  key={r.c}
                  onClick={() => open('budget_lines', r.line || { category: r.c, planned: '' })}
                  title={t('edit')}
                >
                  <div className="cat-top">
                    <span>{t('cat_' + r.c)}</span>
                    <b>
                      {fmtMoney(r.actual, cur)} <i>/ {fmtMoney(r.planned, cur)}</i>
                    </b>
                  </div>
                  <Meter value={pct} tone={tone} />
                  <small>
                    {Math.round(pct)}% {t('used')} · {fmtMoney(r.planned - r.actual, cur)} {t('left')}
                  </small>
                </button>
              );
            })}
          </div>
        </Card>

        <Card title={t('change_orders')}>
          {data.change_orders.length ? (
            <ul className="list">
              {[...data.change_orders].sort((a, b) => String(a.number).localeCompare(String(b.number))).map((c) => (
                <li key={c.id}>
                  <button className="row-btn" onClick={() => open('change_orders', c)}>
                    <span className="mono">{c.number}</span>
                    <span className="grow">{c.title}</span>
                    <b className={c.amount < 0 ? 'pos' : ''}>{c.amount > 0 ? '+' : ''}{fmtMoney(c.amount, cur)}</b>
                    <Badge tone={CO_STATUS[c.status]}>{t('co_' + c.status)}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="wallet" text={t('no_change_orders')} />
          )}
        </Card>
      </div>

      <Glass className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder={t('search_expenses')} />
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label={t('category')}>
          <option value="">{t('all_categories')}</option>
          {o.categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <span className="spacer" />
        <b>{fmtMoneyFull(sum(expenses, (e) => e.amount), cur)}</b>
      </Glass>

      <Glass className="table-wrap">
        {expenses.length ? (
          <table>
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('description')}</th>
                <th>{t('category')}</th>
                <th>{t('vendor')}</th>
                <th className="num">{t('amount')}</th>
                <th>{t('payment')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td className="nowrap">{fmtDate(e.date, lang, { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                  <td><b>{e.description}</b></td>
                  <td><span className="tag">{t('cat_' + e.category)}</span></td>
                  <td>{e.vendor}</td>
                  <td className="num">{fmtMoneyFull(e.amount, cur)}</td>
                  <td>
                    <button
                      className={`badge tone-${e.status === 'paid' ? 'green' : 'orange'}`}
                      onClick={() => updateRow('expenses', e.id, { status: e.status === 'paid' ? 'pending' : 'paid' })}
                      title={t('toggle_paid')}
                    >
                      {t('pay_' + e.status)}
                    </button>
                  </td>
                  <td><IconButton icon="edit" label={t('edit')} onClick={() => open('expenses', e)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty icon="wallet" text={t('no_expenses')} />
        )}
      </Glass>

      {form && (
        <EntityForm
          title={s.title}
          fields={s.fields}
          initial={form.row}
          onClose={() => setForm(null)}
          onSave={(v) => (form.row.id ? updateRow(form.kind, form.row.id, v) : addRow(form.kind, v))}
          onDelete={form.row.id ? () => removeRow(form.kind, form.row.id) : null}
        />
      )}
    </>
  );
}
