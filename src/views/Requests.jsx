import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useData, useUser, addRow, updateRow, removeRow } from '../lib/store';
import { Glass, Icon, Badge, EntityForm, Empty } from '../components/ui';
import { todayISO, addDays, fmtDate } from '../lib/utils';

export const REQ_STATUS = { pending: 'orange', approved: 'blue', ordered: 'purple', delivered: 'green', rejected: 'red' };

// Material requests: the foreman asks, the manager approves, then it is ordered and received into stock.
export default function Requests() {
  const { t, lang } = useI18n();
  const data = useData();
  const user = useUser();
  const isManager = user.role === 'manager';
  const today = todayISO();
  const [editing, setEditing] = useState(null);
  const list = [...data.requests].sort((a, b) => Number(a.status === 'delivered' || a.status === 'rejected') - Number(b.status === 'delivered' || b.status === 'rejected') || String(a.needed_by).localeCompare(String(b.needed_by)));

  const fields = [
    { key: 'material_id', label: t('material'), type: 'select', options: [...data.materials.map((m) => ({ value: m.id, label: `${m.name} (${m.unit})` })), { value: '', label: t('req_other') }] },
    { key: 'name', label: t('req_new_name'), required: true, when: (f) => !f.material_id, half: true },
    { key: 'unit', label: t('unit'), when: (f) => !f.material_id, half: true },
    { key: 'qty', label: t('req_qty'), type: 'number', min: 0, required: true, half: true },
    { key: 'needed_by', label: t('req_needed_by'), type: 'date', required: true, half: true },
    { key: 'note', label: t('notes'), type: 'textarea' },
  ];
  const blank = { material_id: data.materials[0]?.id || '', name: '', unit: '', qty: '', needed_by: addDays(today, 3), note: '' };
  const label = (r) => {
    const m = data.materials.find((x) => x.id === r.material_id);
    return m ? { name: m.name, unit: m.unit } : { name: r.name, unit: r.unit };
  };
  const step = (r, status) => updateRow('requests', r.id, { status, [`${status}_by`]: user.name, [`${status}_at`]: new Date().toISOString() });
  // Receiving a delivery puts the quantity into stock (creating the material if it is new).
  const receive = async (r) => {
    const m = data.materials.find((x) => x.id === r.material_id);
    if (m) await updateRow('materials', m.id, { qty: (Number(m.qty) || 0) + (Number(r.qty) || 0) });
    else {
      const row = await addRow('materials', { name: r.name, unit: r.unit || '', qty: Number(r.qty) || 0, min_qty: 0, supplier: '', location: '', next_delivery: null });
      if (row) await updateRow('requests', r.id, { material_id: row.id });
    }
    step(r, 'delivered');
  };

  return (
    <>
      <div className="btn-row" style={{ marginTop: 0 }}>
        <button className="btn primary" onClick={() => setEditing(blank)}>
          <Icon name="plus" size={16} />
          {t('new_request')}
        </button>
      </div>
      {list.length === 0 ? (
        <Glass><Empty icon="truck" text={t('no_requests')} /></Glass>
      ) : (
        <div className="grid material-grid">
          {list.map((r) => {
            const l = label(r);
            const late = ['pending', 'approved', 'ordered'].includes(r.status) && r.needed_by < today;
            return (
              <Glass className="material" key={r.id}>
                <header>
                  <div>
                    <b>{l.name}</b>
                    <small>
                      {r.requested_by} · {fmtDate(String(r.created_at).slice(0, 10), lang)}
                    </small>
                  </div>
                  <Badge tone={REQ_STATUS[r.status]}>{t('rq_' + r.status)}</Badge>
                </header>
                <div className="qty">
                  <b>{Number(r.qty).toLocaleString('en-US')}</b>
                  <span>{l.unit}</span>
                </div>
                <div className="task-meta">
                  <span className={late ? 'warn-text' : ''}>
                    <Icon name="clock" size={12} /> {t('req_needed_by')} {fmtDate(r.needed_by, lang)}
                  </span>
                </div>
                {r.note && <small>{r.note}</small>}
                <footer>
                  {r.status === 'pending' && isManager && (
                    <>
                      <button className="btn small primary" onClick={() => step(r, 'approved')}>{t('approve')}</button>
                      <button className="btn small danger" onClick={() => step(r, 'rejected')}>{t('reject')}</button>
                    </>
                  )}
                  {r.status === 'pending' && !isManager && <span className="muted">{t('req_waiting')}</span>}
                  {r.status === 'approved' && <button className="btn small primary" onClick={() => step(r, 'ordered')}>{t('mark_ordered')}</button>}
                  {r.status === 'ordered' && <button className="btn small primary" onClick={() => receive(r)}>{t('mark_received')}</button>}
                  <span className="spacer" />
                  {(r.status === 'pending' || isManager) && (
                    <button className="btn small ghost" onClick={() => confirm(t('confirm_delete')) && removeRow('requests', r.id)} aria-label={`${t('delete')}: ${l.name}`}>
                      <Icon name="trash" size={13} />
                    </button>
                  )}
                </footer>
              </Glass>
            );
          })}
        </div>
      )}
      {editing && (
        <EntityForm
          title={t('new_request')}
          fields={fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => addRow('requests', { material_id: v.material_id || null, name: v.material_id ? '' : v.name.trim(), unit: v.material_id ? '' : v.unit, qty: Number(v.qty) || 0, needed_by: v.needed_by, note: v.note, status: 'pending', requested_by: user.name })}
        />
      )}
    </>
  );
}
