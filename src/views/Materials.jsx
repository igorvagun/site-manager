import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { routeQuery } from '../lib/nav';
import { useData, addRow, updateRow, removeRow } from '../lib/store';
import { Glass, Icon, Badge, Meter, EntityForm, Empty, PageHead, SearchBox, Stat, IconButton, Segmented } from '../components/ui';
import { todayISO, addDays, fmtDate, exportCSV } from '../lib/utils';

export default function Materials() {
  const { t, lang } = useI18n();
  const data = useData();
  const today = todayISO();
  const [q, setQ] = useState(routeQuery);
  const [only, setOnly] = useState('all');
  const [editing, setEditing] = useState(null);

  const isLow = (m) => Number(m.qty) < Number(m.min_qty);
  const list = [...data.materials]
    .sort((a, b) => Number(isLow(b)) - Number(isLow(a)) || a.name.localeCompare(b.name))
    .filter((m) => (only === 'all' || isLow(m)) && (!q || `${m.name} ${m.supplier} ${m.location}`.toLowerCase().includes(q.toLowerCase())));
  const low = data.materials.filter(isLow);
  const deliveries = data.materials.filter((m) => m.next_delivery && m.next_delivery >= today && m.next_delivery <= addDays(today, 7));

  const fields = [
    { key: 'name', label: t('material'), required: true },
    { key: 'qty', label: t('qty_on_site'), type: 'number', min: 0, half: true },
    { key: 'unit', label: t('unit'), half: true },
    { key: 'min_qty', label: t('min_qty'), type: 'number', min: 0, half: true },
    { key: 'next_delivery', label: t('next_delivery'), type: 'date', half: true },
    { key: 'supplier', label: t('vendor'), half: true },
    { key: 'location', label: t('location'), half: true },
  ];
  const step = (m, dir) => {
    const s = Math.max(1, Math.round((Number(m.min_qty) || 10) / 10));
    updateRow('materials', m.id, { qty: Math.max(0, (Number(m.qty) || 0) + dir * s) });
  };

  return (
    <>
      <PageHead title={t('nav_materials')} subtitle={t('materials_sub')}>
        <button
          className="btn"
          onClick={() =>
            exportCSV('materials.csv', list, [
              { key: 'name', label: t('material') },
              { key: 'qty', label: t('qty_on_site') },
              { key: 'unit', label: t('unit') },
              { key: 'min_qty', label: t('min_qty') },
              { key: 'supplier', label: t('vendor') },
              { key: 'location', label: t('location') },
              { key: 'next_delivery', label: t('next_delivery') },
            ])
          }
        >
          <Icon name="download" size={16} />
          CSV
        </button>
        <button className="btn primary" onClick={() => setEditing({ name: '', qty: '', unit: '', min_qty: '', next_delivery: '', supplier: '', location: '' })}>
          <Icon name="plus" size={16} />
          {t('new_material')}
        </button>
      </PageHead>

      <div className="grid stats three">
        <Stat icon="box" tone="blue" label={t('items_tracked')} value={data.materials.length} sub={t('materials_word')} />
        <Stat icon="alert" tone={low.length ? 'orange' : 'green'} label={t('low_stock')} value={low.length} sub={t('below_min')} />
        <Stat icon="truck" tone="purple" label={t('deliveries_week')} value={deliveries.length} sub={t('next_7_days')} />
      </div>

      <Glass className="toolbar">
        <Segmented
          value={only}
          onChange={setOnly}
          options={[
            { value: 'all', label: t('all'), count: data.materials.length },
            { value: 'low', label: t('low_stock'), count: low.length },
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder={t('search_materials')} />
      </Glass>

      {list.length === 0 ? (
        <Glass><Empty icon="box" text={t('no_materials')} /></Glass>
      ) : (
        <div className="grid material-grid">
          {list.map((m) => {
            const lowNow = isLow(m);
            const scale = Math.max(Number(m.min_qty) * 2, Number(m.qty), 1);
            return (
              <Glass className="material" key={m.id}>
                <header>
                  <div>
                    <b>{m.name}</b>
                    <small>{[m.supplier, m.location].filter(Boolean).join(' · ')}</small>
                  </div>
                  <IconButton icon="edit" label={t('edit')} onClick={() => setEditing({ ...m, next_delivery: m.next_delivery || '' })} />
                </header>
                <div className="qty-row">
                  <IconButton icon="minus" label={t('decrease')} onClick={() => step(m, -1)} disabled={Number(m.qty) <= 0} />
                  <div className="qty">
                    <b>{Number(m.qty).toLocaleString('en-US')}</b>
                    <span>{m.unit}</span>
                  </div>
                  <IconButton icon="plus" label={t('increase')} onClick={() => step(m, 1)} />
                </div>
                <Meter value={Number(m.qty)} max={scale} tone={lowNow ? 'orange' : 'green'} marker={(Number(m.min_qty) / scale) * 100} />
                <footer>
                  <span>{t('min_qty')}: {Number(m.min_qty).toLocaleString('en-US')} {m.unit}</span>
                  {lowNow && <Badge tone="orange">{t('low_stock')}</Badge>}
                  {m.next_delivery && (
                    <Badge tone={m.next_delivery < today ? 'red' : 'blue'}>
                      <Icon name="truck" size={12} /> {fmtDate(m.next_delivery, lang)}
                    </Badge>
                  )}
                </footer>
              </Glass>
            );
          })}
        </div>
      )}

      {editing && (
        <EntityForm
          title={editing.id ? t('edit_material') : t('new_material')}
          fields={fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => (editing.id ? updateRow('materials', editing.id, v) : addRow('materials', v))}
          onDelete={editing.id ? () => removeRow('materials', editing.id) : null}
        />
      )}
    </>
  );
}
