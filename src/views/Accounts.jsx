import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useStore, useUser, addRow, updateRow, removeRow, notify, DEMO_PASSWORD } from '../lib/store';
import { Glass, Icon, IconButton, Badge, EntityForm, PageHead, SearchBox } from '../components/ui';

const ROLE_TONE = { manager: 'purple', foreman: 'blue', worker: 'green' };

// Who can sign in, and with which role. Workers are linked to an account from the project's Team app.
export default function Accounts() {
  const { t } = useI18n();
  const { data, mode } = useStore();
  const me = useUser();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const list = [...data.users]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((u) => !q || `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()));
  const projectsOf = (u) => {
    if (u.role === 'manager') return data.projects;
    const ids = new Set(data.workers.filter((w) => w.user_id === u.id).map((w) => w.project_id));
    return data.projects.filter((p) => ids.has(p.id));
  };
  const fields = [
    { key: 'name', label: t('full_name'), required: true },
    { key: 'email', label: t('email'), type: 'email', required: true },
    { key: 'role', label: t('account_role'), type: 'select', options: ['manager', 'foreman', 'worker'].map((r) => ({ value: r, label: t('role_' + r) })) },
  ];
  const save = (v) => {
    const email = v.email.trim().toLowerCase();
    if (data.users.some((u) => u.id !== editing.id && (u.email || '').toLowerCase() === email)) return notify('email_taken', 'error');
    // Never let the last manager lock themselves out.
    const role = editing.id === me.id ? me.role : v.role;
    const row = { name: v.name.trim(), email, role };
    editing.id ? updateRow('users', editing.id, row) : addRow('users', row);
  };

  return (
    <>
      <PageHead title={t('nav_accounts')} subtitle={t('accounts_sub')}>
        <button className="btn primary" onClick={() => setEditing({ name: '', email: '', role: 'worker' })}>
          <Icon name="plus" size={16} />
          {t('new_account')}
        </button>
      </PageHead>
      <Glass className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder={t('search')} />
      </Glass>
      {mode === 'local' && (
        <Glass className="notice">
          <Icon name="alert" size={18} />
          <span>
            {t('demo_password_note')} <code>{DEMO_PASSWORD}</code>
          </span>
        </Glass>
      )}
      <div className="grid worker-grid">
        {list.map((u) => {
          const ps = projectsOf(u);
          return (
            <Glass className="worker" key={u.id}>
              <header>
                <div className="avatar">{u.name.slice(0, 1)}</div>
                <div className="worker-id">
                  <b>{u.name}</b>
                  <small dir="ltr">{u.email}</small>
                </div>
                <IconButton icon="edit" label={t('edit')} onClick={() => setEditing(u)} />
              </header>
              <div className="worker-meta">
                <Badge tone={ROLE_TONE[u.role] || 'neutral'}>{t('role_' + u.role)}</Badge>
                {u.id === me.id && <Badge tone="neutral">{t('you')}</Badge>}
              </div>
              <small>{ps.length ? ps.map((p) => p.name).join(' · ') : t('no_project_access')}</small>
            </Glass>
          );
        })}
      </div>
      {editing && (
        <EntityForm
          title={editing.id ? t('edit_account') : t('new_account')}
          fields={editing.id === me.id ? fields.slice(0, 2) : fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={
            editing.id && editing.id !== me.id
              ? () => {
                  data.workers.filter((w) => w.user_id === editing.id).forEach((w) => updateRow('workers', w.id, { user_id: null }));
                  removeRow('users', editing.id);
                }
              : null
          }
        />
      )}
    </>
  );
}
