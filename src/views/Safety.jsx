import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useData, addRow, updateRow, removeRow } from '../lib/store';
import { useOptions, SAFETY_TYPES, PRIORITY, CHECKLIST } from '../lib/constants';
import { Glass, Icon, Badge, Segmented, EntityForm, Empty, PageHead, Stat, IconButton } from '../components/ui';
import { useMetrics } from './Dashboard';
import { todayISO, fmtDate, exportCSV } from '../lib/utils';

const ICON = { incident: 'alert', near_miss: 'alert', hazard: 'alert', inspection: 'shield', toolbox: 'users' };

export default function Safety() {
  const { t, lang } = useI18n();
  const data = useData();
  const o = useOptions();
  const m = useMetrics();
  const today = todayISO();
  const [type, setType] = useState('all');
  const [editing, setEditing] = useState(null);

  const month = today.slice(0, 7);
  const list = [...data.safety].sort((a, b) => b.date.localeCompare(a.date)).filter((s) => type === 'all' || s.type === type);
  const openCount = data.safety.filter((s) => s.status === 'open').length;
  const allChecked = Object.fromEntries(CHECKLIST.map((k) => [k, true]));

  const fields = [
    { key: 'type', label: t('type'), type: 'select', options: o.safetyType, half: true },
    { key: 'date', label: t('date'), type: 'date', required: true, half: true },
    { key: 'title', label: t('title'), required: true },
    { key: 'severity', label: t('severity'), type: 'select', options: o.priority, half: true },
    { key: 'status', label: t('status'), type: 'select', options: o.safetyStatus, half: true },
    { key: 'reporter', label: t('reporter') },
    { key: 'checklist', label: t('inspection_checklist'), type: 'checklist', options: o.checklist, when: (f) => f.type === 'inspection' },
    { key: 'description', label: t('details_actions'), type: 'textarea' },
  ];
  const blank = (ty = 'inspection') => ({
    type: ty, date: today, title: '', severity: 'low', status: ty === 'hazard' || ty === 'incident' ? 'open' : 'closed',
    reporter: data.project[0]?.manager || '', checklist: allChecked, description: '',
  });

  return (
    <>
      <PageHead title={t('nav_safety')} subtitle={t('safety_sub')}>
        <button
          className="btn"
          onClick={() =>
            exportCSV('safety.csv', list, [
              { key: 'date', label: t('date') },
              { label: t('type'), get: (r) => t('sf_' + r.type) },
              { key: 'title', label: t('title') },
              { key: 'description', label: t('details_actions') },
              { label: t('severity'), get: (r) => t('pr_' + r.severity) },
              { label: t('status'), get: (r) => t('ss_' + r.status) },
              { key: 'reporter', label: t('reporter') },
            ])
          }
        >
          <Icon name="download" size={16} />
          CSV
        </button>
        <button className="btn" onClick={() => setEditing(blank('hazard'))}>
          <Icon name="alert" size={16} />
          {t('report_hazard')}
        </button>
        <button className="btn primary" onClick={() => setEditing(blank())}>
          <Icon name="plus" size={16} />
          {t('new_record')}
        </button>
      </PageHead>

      <div className="grid stats four">
        <Stat icon="shield" tone="green" label={t('days_no_incident')} value={m.safeDays} sub={t('days')} />
        <Stat icon="alert" tone={openCount ? 'red' : 'green'} label={t('open_items')} value={openCount} sub={t('need_action')} />
        <Stat icon="check" tone="blue" label={t('inspections_month')} value={data.safety.filter((s) => s.type === 'inspection' && s.date.startsWith(month)).length} sub={fmtDate(today, lang, { month: 'long' })} />
        <Stat icon="users" tone="purple" label={t('toolbox_month')} value={data.safety.filter((s) => s.type === 'toolbox' && s.date.startsWith(month)).length} sub={fmtDate(today, lang, { month: 'long' })} />
      </div>

      <Glass className="toolbar">
        <Segmented
          value={type}
          onChange={setType}
          options={[{ value: 'all', label: t('all') }, ...o.safetyType]}
        />
      </Glass>

      {list.length === 0 ? (
        <Glass><Empty icon="shield" text={t('no_safety')} /></Glass>
      ) : (
        <div className="timeline">
          {list.map((s) => {
            const fails = s.type === 'inspection' && s.checklist ? CHECKLIST.filter((k) => !s.checklist[k]) : [];
            return (
              <Glass className="safety-card" key={s.id}>
                <div className={`dot-icon big tint-${SAFETY_TYPES[s.type]}`}>
                  <Icon name={ICON[s.type] || 'shield'} size={20} />
                </div>
                <div className="log-body">
                  <header>
                    <h3>{s.title}</h3>
                    <IconButton icon="edit" label={t('edit')} onClick={() => setEditing({ ...s, checklist: s.checklist || allChecked })} />
                  </header>
                  <div className="task-meta">
                    <Badge tone={SAFETY_TYPES[s.type]}>{t('sf_' + s.type)}</Badge>
                    <span>{fmtDate(s.date, lang, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    {s.reporter && <span>{s.reporter}</span>}
                    {s.type !== 'toolbox' && s.type !== 'inspection' && <Badge tone={PRIORITY[s.severity]}>{t('severity')}: {t('pr_' + s.severity)}</Badge>}
                    {s.status === 'open' ? (
                      <button className="badge tone-red" onClick={() => updateRow('safety', s.id, { status: 'closed' })} title={t('mark_closed')}>
                        {t('ss_open')} · {t('mark_closed')}
                      </button>
                    ) : (
                      <Badge tone="green">{t('ss_closed')}</Badge>
                    )}
                  </div>
                  {s.description && <p>{s.description}</p>}
                  {s.type === 'inspection' && s.checklist && (
                    <div className="check-chips">
                      {CHECKLIST.map((k) => (
                        <span key={k} className={s.checklist[k] ? 'ok' : 'bad'}>
                          <Icon name={s.checklist[k] ? 'check' : 'x'} size={13} />
                          {t('ck_' + k)}
                        </span>
                      ))}
                      {fails.length === 0 && <b>{t('all_passed')}</b>}
                    </div>
                  )}
                </div>
              </Glass>
            );
          })}
        </div>
      )}

      {editing && (
        <EntityForm
          title={editing.id ? t('edit_record') : t('new_record')}
          fields={fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => {
            const row = { ...v, checklist: v.type === 'inspection' ? v.checklist : null };
            editing.id ? updateRow('safety', editing.id, row) : addRow('safety', row);
          }}
          onDelete={editing.id ? () => removeRow('safety', editing.id) : null}
        />
      )}
    </>
  );
}
