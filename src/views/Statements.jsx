import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useData, addRow, updateRow, removeRow } from '../lib/store';
import { Card, Icon, Badge, EntityForm, Empty, Modal } from '../components/ui';
import { todayISO, fmtDate, fmtMoney, fmtMoneyFull, sum, taskBudget } from '../lib/utils';

// Progress statements for the client: the value of work completed since the last statement.
// Value of a task = its planned cost (working days × daily cost) plus the markup entered here.
export default function Statements() {
  const { t, lang } = useI18n();
  const data = useData();
  const project = data.project[0] || {};
  const cur = project.currency || '₪';
  const [creating, setCreating] = useState(null);
  const [view, setView] = useState(null);
  const list = [...data.statements].sort((a, b) => String(b.number).localeCompare(String(a.number)));

  // Percentage of each task already billed on earlier statements.
  const billed = (taskId) => Math.max(0, ...data.statements.flatMap((s) => s.lines.filter((l) => l.task_id === taskId).map((l) => l.now)));
  const draft = (markup) =>
    [...data.tasks]
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .map((x) => {
        const prev = billed(x.id);
        const now = Math.round(x.progress || 0);
        const value = taskBudget(x) * (1 + (Number(markup) || 0) / 100);
        return { task_id: x.id, name: x.name, value: Math.round(value), prev, now, amount: Math.round((value * (now - prev)) / 100) };
      })
      .filter((l) => l.now > l.prev);
  const preview = creating ? draft(creating.markup) : [];

  return (
    <Card
      title={t('statements')}
      action={
        <button className="btn small" onClick={() => setCreating({ date: todayISO(), markup: list[0]?.markup ?? 15, note: '' })}>
          <Icon name="plus" size={14} />
          {t('new_statement')}
        </button>
      }
    >
      {list.length === 0 ? (
        <Empty icon="receipt" text={t('no_statements')} />
      ) : (
        <ul className="list">
          {list.map((s) => (
            <li key={s.id}>
              <div className="row-btn">
                <button className="mono link" onClick={() => setView(s)}>{s.number}</button>
                <span className="grow">{fmtDate(s.date, lang, { day: 'numeric', month: 'short', year: 'numeric' })} · {s.lines.length} {t('st_lines')}</span>
                <b>{fmtMoney(s.total, cur)}</b>
                <button className={`badge tone-${s.paid ? 'green' : 'orange'}`} onClick={() => updateRow('statements', s.id, { paid: !s.paid })} title={t('toggle_paid')}>
                  {t(s.paid ? 'pay_paid' : 'pay_pending')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <small className="muted">{t('statements_hint')}</small>

      {creating && (
        <EntityForm
          title={`${t('new_statement')} · ${fmtMoneyFull(sum(preview, (l) => l.amount), cur)}`}
          fields={[
            { key: 'date', label: t('date'), type: 'date', required: true, half: true },
            { key: 'markup', label: t('st_markup'), type: 'number', min: 0, half: true },
            { key: 'note', label: t('notes'), type: 'textarea', placeholder: preview.length ? `${preview.length} ${t('st_lines')}` : t('st_nothing') },
          ]}
          initial={creating}
          onClose={() => setCreating(null)}
          onSave={(v) => {
            const lines = draft(v.markup);
            if (!lines.length) return;
            addRow('statements', { number: `ST-${String(data.statements.length + 1).padStart(3, '0')}`, date: v.date, markup: Number(v.markup) || 0, note: v.note, lines, total: sum(lines, (l) => l.amount), paid: false });
          }}
        />
      )}

      {view && (
        <Modal title={`${t('statement')} ${view.number}`} onClose={() => setView(null)} wide>
          <div className="btn-row no-print">
            <button className="btn primary" onClick={() => window.print()}>
              <Icon name="printer" size={16} />
              {t('print_pdf')}
            </button>
            <button className="btn danger" onClick={() => confirm(t('confirm_delete')) && (removeRow('statements', view.id), setView(null))}>
              <Icon name="trash" size={16} />
              {t('delete')}
            </button>
          </div>
          <article className="report">
            <header>
              <div>
                <h2>{t('statement')} {view.number}</h2>
                <p>{project.name} · {project.address}</p>
              </div>
              <div className="report-date">
                <b>{fmtDate(view.date, lang, { day: 'numeric', month: 'long', year: 'numeric' })}</b>
                <span>{t('client')}: {project.client || '—'}</span>
              </div>
            </header>
            <table className="mini-table">
              <thead>
                <tr>
                  <th>{t('task')}</th>
                  <th className="num">{t('st_value')}</th>
                  <th className="num">{t('st_prev')}</th>
                  <th className="num">{t('st_now')}</th>
                  <th className="num">{t('st_due')}</th>
                </tr>
              </thead>
              <tbody>
                {view.lines.map((l) => (
                  <tr key={l.task_id}>
                    <td>{l.name}</td>
                    <td className="num">{fmtMoneyFull(l.value, cur)}</td>
                    <td className="num">{l.prev}%</td>
                    <td className="num">{l.now}%</td>
                    <td className="num">{fmtMoneyFull(l.amount, cur)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td colSpan={4}>{t('st_total_due')}</td>
                  <td className="num">{fmtMoneyFull(view.total, cur)}</td>
                </tr>
              </tbody>
            </table>
            {view.note && <p className="pre">{view.note}</p>}
            <footer>
              <span>{t('report_signature')}: ____________________</span>
              <span>{t('client')}: ____________________</span>
            </footer>
          </article>
        </Modal>
      )}
    </Card>
  );
}
