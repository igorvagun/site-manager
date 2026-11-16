import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { routeQuery } from '../lib/nav';
import { useData, addRow, updateRow, removeRow } from '../lib/store';
import { Glass, Icon, IconButton, Badge, EntityForm, Empty, PageHead, SearchBox, Stat, Segmented } from '../components/ui';
import { todayISO, addDays, diffDays, fmtDate, fmtMoney, sum, exportCSV } from '../lib/utils';

export const EQUIP_STATUS = { on_site: 'green', maintenance: 'orange', returned: 'neutral' };

// Days a rented machine has been (or was) on hire, and what that has cost so far.
export function rentalCost(e, today = todayISO()) {
  if (e.kind !== 'rented' || !e.start_date) return { days: 0, cost: 0 };
  const end = e.status === 'returned' && e.returned_on ? e.returned_on : today;
  const days = Math.max(0, diffDays(e.start_date, end) + 1);
  return { days, cost: days * (Number(e.daily_rate) || 0) };
}
export const equipmentAlerts = (list, today = todayISO()) => ({
  overdue: list.filter((e) => e.kind === 'rented' && e.status !== 'returned' && e.return_date && e.return_date < today),
  inspect: list.filter((e) => e.status !== 'returned' && e.inspection_date && e.inspection_date <= addDays(today, 7)),
});

export default function Equipment() {
  const { t, lang } = useI18n();
  const data = useData();
  const cur = data.project[0]?.currency || '₪';
  const today = todayISO();
  const [q, setQ] = useState(routeQuery);
  const [tab, setTab] = useState('on_site');
  const [editing, setEditing] = useState(null);

  const all = data.equipment;
  const { overdue, inspect } = equipmentAlerts(all, today);
  const list = [...all]
    .filter((e) => (tab === 'all' || (tab === 'on_site' ? e.status !== 'returned' : e.status === 'returned')) && (!q || `${e.name} ${e.supplier}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => Number(overdue.includes(b)) - Number(overdue.includes(a)) || a.name.localeCompare(b.name));
  const active = all.filter((e) => e.status !== 'returned');
  const perDay = sum(active.filter((e) => e.kind === 'rented'), (e) => e.daily_rate);

  const fields = [
    { key: 'name', label: t('equipment_name'), required: true },
    { key: 'kind', label: t('ownership'), type: 'select', half: true, options: ['rented', 'owned'].map((k) => ({ value: k, label: t('eq_' + k) })) },
    { key: 'status', label: t('status'), type: 'select', half: true, options: Object.keys(EQUIP_STATUS).map((k) => ({ value: k, label: t('eqs_' + k) })) },
    { key: 'supplier', label: t('vendor'), half: true, when: (f) => f.kind === 'rented' },
    { key: 'daily_rate', label: `${t('rent_per_day')} (${cur})`, type: 'number', min: 0, half: true, when: (f) => f.kind === 'rented' },
    { key: 'start_date', label: t('on_site_from'), type: 'date', half: true },
    { key: 'return_date', label: t('return_by'), type: 'date', half: true, when: (f) => f.kind === 'rented' },
    { key: 'inspection_date', label: t('next_inspection'), type: 'date', half: true },
    { key: 'notes', label: t('notes'), type: 'textarea' },
  ];
  const blank = { name: '', kind: 'rented', status: 'on_site', supplier: '', daily_rate: '', start_date: today, return_date: '', inspection_date: '', notes: '' };

  return (
    <>
      <PageHead title={t('nav_equipment')} subtitle={t('equipment_sub')}>
        <button
          className="btn"
          onClick={() =>
            exportCSV('equipment.csv', list, [
              { key: 'name', label: t('equipment_name') },
              { label: t('ownership'), get: (e) => t('eq_' + e.kind) },
              { label: t('status'), get: (e) => t('eqs_' + e.status) },
              { key: 'supplier', label: t('vendor') },
              { key: 'daily_rate', label: t('rent_per_day') },
              { key: 'start_date', label: t('on_site_from') },
              { key: 'return_date', label: t('return_by') },
              { label: t('rent_to_date'), get: (e) => rentalCost(e, today).cost },
              { key: 'inspection_date', label: t('next_inspection') },
            ])
          }
        >
          <Icon name="download" size={16} />
          CSV
        </button>
        <button className="btn primary" onClick={() => setEditing(blank)}>
          <Icon name="plus" size={16} />
          {t('new_equipment')}
        </button>
      </PageHead>

      <div className="grid stats four">
        <Stat icon="truck" tone="blue" label={t('eq_on_site')} value={active.length} sub={`${active.filter((e) => e.kind === 'rented').length} ${t('eq_rented_word')}`} />
        <Stat icon="wallet" tone="purple" label={t('rent_per_day')} value={fmtMoney(perDay, cur)} sub={`${fmtMoney(sum(all, (e) => rentalCost(e, today).cost), cur)} ${t('rent_to_date').toLowerCase()}`} />
        <Stat icon="clock" tone={overdue.length ? 'red' : 'green'} label={t('eq_overdue')} value={overdue.length} sub={t('eq_overdue_sub')} />
        <Stat icon="shield" tone={inspect.length ? 'orange' : 'green'} label={t('eq_inspections')} value={inspect.length} sub={t('next_7_days')} />
      </div>

      <Glass className="toolbar">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'on_site', label: t('eq_on_site'), count: active.length },
            { value: 'returned', label: t('eqs_returned'), count: all.length - active.length },
            { value: 'all', label: t('all') },
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder={t('search')} />
      </Glass>

      {list.length === 0 ? (
        <Glass><Empty icon="truck" text={t('no_equipment')} /></Glass>
      ) : (
        <div className="grid material-grid">
          {list.map((e) => {
            const rc = rentalCost(e, today);
            const late = overdue.includes(e);
            const due = inspect.includes(e);
            return (
              <Glass className="material" key={e.id}>
                <header>
                  <div>
                    <b>{e.name}</b>
                    <small>{e.kind === 'rented' ? e.supplier || t('eq_rented') : t('eq_owned')}</small>
                  </div>
                  <IconButton icon="edit" label={t('edit')} onClick={() => setEditing({ ...blank, ...e, return_date: e.return_date || '', inspection_date: e.inspection_date || '', start_date: e.start_date || '' })} />
                </header>
                <div className="task-meta">
                  <Badge tone={EQUIP_STATUS[e.status] || 'neutral'}>{t('eqs_' + e.status)}</Badge>
                  <Badge tone={e.kind === 'rented' ? 'purple' : 'blue'}>{t('eq_' + e.kind)}</Badge>
                </div>
                {e.kind === 'rented' && (
                  <div className="job-facts">
                    <div>
                      <span>{t('rent_per_day')}</span>
                      <b>{fmtMoney(e.daily_rate, cur)}</b>
                    </div>
                    <div>
                      <span>{t('days')}</span>
                      <b>{rc.days}</b>
                    </div>
                    <div>
                      <span>{t('rent_to_date')}</span>
                      <b>{fmtMoney(rc.cost, cur)}</b>
                    </div>
                  </div>
                )}
                <footer>
                  {e.kind === 'rented' && e.return_date && e.status !== 'returned' && (
                    <Badge tone={late ? 'red' : 'neutral'}>
                      <Icon name="clock" size={12} /> {t('return_by')} {fmtDate(e.return_date, lang)}
                    </Badge>
                  )}
                  {e.inspection_date && e.status !== 'returned' && (
                    <Badge tone={e.inspection_date < today ? 'red' : due ? 'orange' : 'neutral'}>
                      <Icon name="shield" size={12} /> {fmtDate(e.inspection_date, lang)}
                    </Badge>
                  )}
                  <span className="spacer" />
                  {e.status !== 'returned' && e.kind === 'rented' && (
                    <button className="btn small" onClick={() => updateRow('equipment', e.id, { status: 'returned', returned_on: today })}>
                      {t('mark_returned')}
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
          title={editing.id ? t('edit_equipment') : t('new_equipment')}
          fields={fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => {
            const row = { ...v, daily_rate: Number(v.daily_rate) || 0, returned_on: v.status === 'returned' ? editing.returned_on || today : null };
            editing.id ? updateRow('equipment', editing.id, row) : addRow('equipment', row);
          }}
          onDelete={editing.id ? () => removeRow('equipment', editing.id) : null}
        />
      )}
    </>
  );
}
