import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { routeQuery } from '../lib/nav';
import { useData, addRow, updateRow, removeRow, notify } from '../lib/store';
import { Glass, Icon, IconButton, Badge, EntityForm, Empty, PageHead, SearchBox, Stat, Segmented, Modal, Meter } from '../components/ui';
import { todayISO, fmtDate, fmtMoney, fmtMoneyFull, sum, uid, exportCSV } from '../lib/utils';

export const SUB_STATUS = { active: 'blue', paused: 'yellow', done: 'green' };

// Where a subcontract stands: what the work done is worth, what is held back, what was paid and what is owed now.
export function subMath(s) {
  const amount = Number(s.amount) || 0;
  const earned = Math.round((amount * (Number(s.progress) || 0)) / 100);
  const held = s.retention_released ? 0 : Math.round((earned * (Number(s.retention) || 0)) / 100);
  const paid = sum(s.payments || [], (p) => p.amount);
  const due = Math.max(0, earned - held - paid);
  return { amount, earned, held, paid, due, overpaid: Math.max(0, paid - (earned - held)), left: amount - paid };
}
export const subLate = (s, today = todayISO()) => s.status !== 'done' && !!s.end_date && s.end_date < today;

export default function Subcontracts() {
  const { t, lang } = useI18n();
  const data = useData();
  const cur = data.project[0]?.currency || '₪';
  const today = todayISO();
  const [q, setQ] = useState(routeQuery);
  const [tab, setTab] = useState('active');
  const [editing, setEditing] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [pay, setPay] = useState(null);

  const all = data.subcontracts;
  const open = all.find((s) => s.id === openId);
  const list = [...all]
    .filter((s) => (tab === 'all' || (tab === 'active' ? s.status !== 'done' : s.status === 'done')) && (!q || `${s.name} ${s.trade} ${s.scope}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => subMath(b).due - subMath(a).due || a.name.localeCompare(b.name));
  const total = (k) => sum(all, (s) => subMath(s)[k]);
  const contractors = data.contacts.filter((c) => c.kind === 'contractor' || c.kind === 'supplier');

  const fields = [
    { key: 'name', label: t('sub_company'), required: true, half: true },
    { key: 'trade', label: t('sub_trade'), half: true, placeholder: t('sub_trade_ph') },
    { key: 'contact_id', label: t('sub_contact'), type: 'select', options: [{ value: '', label: '—' }, ...contractors.map((c) => ({ value: c.id, label: `${c.name}${c.company ? ` · ${c.company}` : ''}` }))] },
    { key: 'scope', label: t('sub_scope'), type: 'textarea' },
    { key: 'amount', label: `${t('sub_amount')} (${cur})`, type: 'number', min: 0, required: true, half: true },
    { key: 'retention', label: t('sub_retention'), type: 'number', min: 0, max: 100, half: true },
    { key: 'start_date', label: t('start'), type: 'date', half: true },
    { key: 'end_date', label: t('end'), type: 'date', half: true },
    { key: 'status', label: t('status'), type: 'select', half: true, options: Object.keys(SUB_STATUS).map((k) => ({ value: k, label: t('subs_' + k) })) },
    { key: 'progress', label: t('sub_progress'), type: 'range' },
    { key: 'notes', label: t('notes'), type: 'textarea' },
  ];
  const blank = { name: '', trade: '', contact_id: '', scope: '', amount: '', retention: 5, start_date: today, end_date: '', status: 'active', progress: 0, notes: '' };

  const addPayment = async () => {
    const amount = Number(pay.amount) || 0;
    if (amount <= 0 || !pay.date) return notify('sub_pay_invalid', 'error');
    let expense_id = null;
    if (pay.expense) {
      const row = await addRow('expenses', { date: pay.date, category: 'subcontractors', description: `${open.name} — ${pay.note || t('sub_payment')}`, vendor: open.name, amount, status: 'paid' });
      expense_id = row?.id || null;
    }
    await updateRow('subcontracts', open.id, { payments: [...(open.payments || []), { id: uid(), date: pay.date, amount, note: pay.note, expense_id }] });
    setPay(null);
  };
  const removePayment = (p) => {
    if (!confirm(t('confirm_delete'))) return;
    updateRow('subcontracts', open.id, { payments: open.payments.filter((x) => x.id !== p.id) });
    if (p.expense_id) removeRow('expenses', p.expense_id, { silent: true });
  };

  return (
    <>
      <PageHead title={t('nav_subs')} subtitle={t('subs_sub')}>
        <button
          className="btn"
          onClick={() =>
            exportCSV('subcontracts.csv', list, [
              { key: 'name', label: t('sub_company') },
              { key: 'trade', label: t('sub_trade') },
              { label: t('status'), get: (s) => t('subs_' + s.status) },
              { key: 'amount', label: t('sub_amount') },
              { key: 'progress', label: t('sub_progress') },
              { label: t('sub_earned'), get: (s) => subMath(s).earned },
              { label: t('sub_held'), get: (s) => subMath(s).held },
              { label: t('sub_paid'), get: (s) => subMath(s).paid },
              { label: t('sub_due'), get: (s) => subMath(s).due },
              { key: 'end_date', label: t('end') },
            ])
          }
        >
          <Icon name="download" size={16} />
          CSV
        </button>
        <button className="btn primary" onClick={() => setEditing(blank)}>
          <Icon name="plus" size={16} />
          {t('new_sub')}
        </button>
      </PageHead>

      <div className="grid stats four">
        <Stat icon="handshake" tone="blue" label={t('sub_contracts')} value={fmtMoney(total('amount'), cur)} sub={`${all.filter((s) => s.status !== 'done').length} ${t('sub_active_word')}`} />
        <Stat icon="chart" tone="purple" label={t('sub_earned')} value={fmtMoney(total('earned'), cur)} sub={total('amount') ? `${Math.round((total('earned') / total('amount')) * 100)}% ${t('sub_of_contracts')}` : '—'} />
        <Stat icon="wallet" tone="green" label={t('sub_paid')} value={fmtMoney(total('paid'), cur)} sub={`${fmtMoney(total('held'), cur)} ${t('sub_held_word')}`} />
        <Stat icon="clock" tone={total('due') ? 'orange' : 'green'} label={t('sub_due')} value={fmtMoney(total('due'), cur)} sub={t('sub_due_sub')} />
      </div>

      <Glass className="toolbar">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'active', label: t('sub_tab_active'), count: all.filter((s) => s.status !== 'done').length },
            { value: 'done', label: t('subs_done'), count: all.filter((s) => s.status === 'done').length },
            { value: 'all', label: t('all') },
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder={t('search')} />
      </Glass>

      {list.length === 0 ? (
        <Glass><Empty icon="handshake" text={t('no_subs')} /></Glass>
      ) : (
        <div className="grid job-grid">
          {list.map((s) => {
            const m = subMath(s);
            return (
              <Glass className="job sub" key={s.id}>
                <header>
                  <div>
                    <button className="task-title" onClick={() => setOpenId(s.id)}>{s.name}</button>
                    <small>{s.trade}</small>
                  </div>
                  <IconButton icon="edit" label={t('edit')} onClick={() => setEditing({ ...blank, ...s, contact_id: s.contact_id || '', start_date: s.start_date || '', end_date: s.end_date || '' })} />
                </header>
                <div className="task-meta">
                  <Badge tone={SUB_STATUS[s.status] || 'neutral'}>{t('subs_' + s.status)}</Badge>
                  {subLate(s, today) && <Badge tone="red"><Icon name="clock" size={12} /> {t('sub_late')}</Badge>}
                  {s.end_date && <span>{t('end')} {fmtDate(s.end_date, lang)}</span>}
                </div>
                <div className="sub-progress">
                  <Meter value={s.progress} tone={s.status === 'done' ? 'green' : 'blue'} marker={m.amount ? (m.paid / m.amount) * 100 : null} />
                  <span>
                    {t('sub_progress')} <b>{Math.round(s.progress)}%</b> · {t('sub_paid')} <b>{m.amount ? Math.round((m.paid / m.amount) * 100) : 0}%</b>
                  </span>
                </div>
                <div className="job-facts">
                  <div>
                    <span>{t('sub_amount')}</span>
                    <b>{fmtMoney(m.amount, cur)}</b>
                  </div>
                  <div>
                    <span>{t('sub_paid')}</span>
                    <b>{fmtMoney(m.paid, cur)}</b>
                  </div>
                  <div>
                    <span>{t('sub_due')}</span>
                    <b className={m.due ? 'warn-text' : ''}>{fmtMoney(m.due, cur)}</b>
                  </div>
                </div>
                <footer>
                  {m.overpaid > 0 && <Badge tone="red">{t('sub_overpaid')} {fmtMoney(m.overpaid, cur)}</Badge>}
                  <span className="spacer" />
                  <button className="btn small" onClick={() => setOpenId(s.id)}>{t('sub_payments')} ({(s.payments || []).length})</button>
                </footer>
              </Glass>
            );
          })}
        </div>
      )}

      {editing && (
        <EntityForm
          title={editing.id ? t('edit_sub') : t('new_sub')}
          fields={fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => {
            const row = { ...v, contact_id: v.contact_id || null, amount: Number(v.amount) || 0, retention: Number(v.retention) || 0, progress: Number(v.progress) || 0 };
            editing.id ? updateRow('subcontracts', editing.id, row) : addRow('subcontracts', { ...row, payments: [], retention_released: false });
          }}
          onDelete={editing.id ? () => removeRow('subcontracts', editing.id) : null}
        />
      )}

      {open && (() => {
        const m = subMath(open);
        const contact = data.contacts.find((c) => c.id === open.contact_id);
        return (
          <Modal title={open.name} onClose={() => (setOpenId(null), setPay(null))} wide>
            <div className="task-meta">
              <Badge tone={SUB_STATUS[open.status] || 'neutral'}>{t('subs_' + open.status)}</Badge>
              {open.trade && <span className="tag">{open.trade}</span>}
              {contact && <span>{contact.name}{contact.phone ? ` · ${contact.phone}` : ''}</span>}
              {open.start_date && <span>{fmtDate(open.start_date, lang)} – {open.end_date ? fmtDate(open.end_date, lang) : '…'}</span>}
            </div>
            {open.scope && <p className="sub-scope">{open.scope}</p>}
            <label className="sub-slider">
              <span>{t('sub_progress')} <b>{Math.round(open.progress)}%</b></span>
              <input type="range" min="0" max="100" step="5" value={open.progress} aria-label={t('sub_progress')} onChange={(e) => updateRow('subcontracts', open.id, { progress: Number(e.target.value) })} />
            </label>
            <dl className="sub-sums">
              <div><dt>{t('sub_amount')}</dt><dd>{fmtMoneyFull(m.amount, cur)}</dd></div>
              <div><dt>{t('sub_earned')} ({Math.round(open.progress)}%)</dt><dd>{fmtMoneyFull(m.earned, cur)}</dd></div>
              <div>
                <dt>
                  {t('sub_held')} ({open.retention || 0}%)
                  {Number(open.retention) > 0 && (
                    <button className="link" onClick={() => updateRow('subcontracts', open.id, { retention_released: !open.retention_released })}>
                      {t(open.retention_released ? 'sub_hold_again' : 'sub_release')}
                    </button>
                  )}
                </dt>
                <dd>{open.retention_released ? t('sub_released') : `− ${fmtMoneyFull(m.held, cur)}`}</dd>
              </div>
              <div><dt>{t('sub_paid')}</dt><dd>− {fmtMoneyFull(m.paid, cur)}</dd></div>
              <div className="total"><dt>{t('sub_due')}</dt><dd className={m.overpaid ? 'warn-text' : ''}>{m.overpaid ? `${t('sub_overpaid')} ${fmtMoneyFull(m.overpaid, cur)}` : fmtMoneyFull(m.due, cur)}</dd></div>
            </dl>

            <h3 className="sub-h">{t('sub_payments')}</h3>
            {(open.payments || []).length === 0 ? (
              <p className="muted">{t('sub_no_payments')}</p>
            ) : (
              <ul className="sub-pays">
                {[...open.payments].sort((a, b) => String(b.date).localeCompare(String(a.date))).map((p) => (
                  <li key={p.id}>
                    <span>{fmtDate(p.date, lang, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span className="grow">{p.note}</span>
                    {p.expense_id && data.expenses.some((e) => e.id === p.expense_id) && <Badge tone="blue">{t('sub_in_expenses')}</Badge>}
                    <b>{fmtMoneyFull(p.amount, cur)}</b>
                    <IconButton icon="trash" label={t('delete')} size={15} onClick={() => removePayment(p)} />
                  </li>
                ))}
              </ul>
            )}

            {pay ? (
              <div className="sub-payform">
                <div className="field half">
                  <label htmlFor="pay-date">{t('date')}</label>
                  <input id="pay-date" type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} />
                </div>
                <div className="field half">
                  <label htmlFor="pay-amount">{t('amount')} ({cur})</label>
                  <input id="pay-amount" type="number" min="0" inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="pay-note">{t('notes')}</label>
                  <input id="pay-note" value={pay.note} placeholder={t('sub_pay_note_ph')} onChange={(e) => setPay({ ...pay, note: e.target.value })} />
                </div>
                <label className="setting switch-row">
                  <span>{t('sub_add_expense')}</span>
                  <input type="checkbox" role="switch" checked={pay.expense} onChange={() => setPay({ ...pay, expense: !pay.expense })} />
                </label>
                {Number(pay.amount) > m.due && <p className="warn-text sub-warn">{t('sub_pay_over')} ({fmtMoneyFull(m.due, cur)})</p>}
              </div>
            ) : null}

            <div className="modal-foot">
              <span className="spacer" />
              {pay ? (
                <>
                  <button className="btn" onClick={() => setPay(null)}>{t('cancel')}</button>
                  <button className="btn primary" onClick={addPayment}>
                    <Icon name="check" size={16} />
                    {t('sub_save_payment')}
                  </button>
                </>
              ) : (
                <button className="btn primary" onClick={() => setPay({ date: today, amount: m.due || '', note: '', expense: true })}>
                  <Icon name="plus" size={16} />
                  {t('sub_record_payment')}
                </button>
              )}
            </div>
          </Modal>
        );
      })()}
    </>
  );
}
