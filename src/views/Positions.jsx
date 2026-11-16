import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useStore, addRow, updateRow, removeRow } from '../lib/store';
import { Glass, Icon, IconButton, EntityForm, Empty, PageHead } from '../components/ui';
import { fmtMoney } from '../lib/utils';

// Account-wide job titles with a default hourly rate, used when adding workers to any project.
export default function Positions() {
  const { t } = useI18n();
  const { data } = useStore();
  const [editing, setEditing] = useState(null);
  const list = [...data.positions].sort((a, b) => a.name.localeCompare(b.name));
  const holders = (name) => data.workers.filter((w) => w.role === name && w.active !== false);

  const fields = [
    { key: 'name', label: t('position_name'), required: true },
    { key: 'hourly_rate', label: t('default_hourly_rate'), type: 'number', min: 0 },
  ];
  const save = (v) => {
    if (!editing.id) return addRow('positions', v);
    // Keep workers attached when a title is renamed.
    if (v.name !== editing.name) holders(editing.name).concat(data.workers.filter((w) => w.role === editing.name && w.active === false)).forEach((w) => updateRow('workers', w.id, { role: v.name }));
    updateRow('positions', editing.id, v);
  };

  return (
    <>
      <PageHead title={t('nav_positions')} subtitle={t('positions_sub')}>
        <button className="btn primary" onClick={() => setEditing({ name: '', hourly_rate: '' })}>
          <Icon name="plus" size={16} />
          {t('new_position')}
        </button>
      </PageHead>
      {list.length === 0 ? (
        <Glass><Empty icon="idcard" text={t('no_positions')} /></Glass>
      ) : (
        <div className="grid material-grid">
          {list.map((p) => {
            const h = holders(p.name);
            const projects = new Set(h.map((w) => w.project_id)).size;
            return (
              <Glass className="material" key={p.id}>
                <header>
                  <span className="dot-icon big tint-blue"><Icon name="idcard" size={20} /></span>
                  <div>
                    <b>{p.name}</b>
                    <small>{fmtMoney(p.hourly_rate, '₪')}/{t('hr')}</small>
                  </div>
                  <IconButton icon="edit" label={t('edit')} onClick={() => setEditing(p)} />
                </header>
                <footer>
                  <span>
                    {h.length} {t('workers')} · {projects} {t('projects_word')}
                  </span>
                </footer>
                {h.length > 0 && (
                  <div className="task-meta">
                    {h.slice(0, 4).map((w) => (
                      <span className="avatar-chip" key={w.id}><i>{w.name.slice(0, 1)}</i>{w.name}</span>
                    ))}
                    {h.length > 4 && <span>+{h.length - 4}</span>}
                  </div>
                )}
              </Glass>
            );
          })}
        </div>
      )}
      {editing && (
        <EntityForm
          title={editing.id ? t('edit_position') : t('new_position')}
          fields={fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={editing.id ? () => removeRow('positions', editing.id) : null}
        />
      )}
    </>
  );
}
