import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useData, addRow, updateRow, removeRow } from '../lib/store';
import { deleteFile } from '../lib/files';
import { Glass, Icon, IconButton, Badge, EntityForm, Empty, PageHead, SearchBox, Segmented } from '../components/ui';
import { ChatModal } from '../components/Chat';

export const CONTACT_KINDS = { contractor: 'orange', engineer: 'blue', architect: 'purple', supplier: 'green', client: 'red', inspector: 'yellow', other: 'neutral' };
const digits = (p) => String(p || '').replace(/[^\d+]/g, '');
// wa.me needs an international number; Israeli local numbers start with 0.
const waNumber = (p) => digits(p).replace(/^\+/, '').replace(/^0/, '972');

export default function Contacts() {
  const { t } = useI18n();
  const data = useData();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [editing, setEditing] = useState(null);
  const [chat, setChat] = useState(null);

  const kinds = Object.keys(CONTACT_KINDS).map((k) => ({ value: k, label: t('ck_kind_' + k) }));
  const list = [...data.contacts]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((c) => (kind === 'all' || c.kind === kind) && (!q || `${c.name} ${c.company} ${c.phone} ${c.notes}`.toLowerCase().includes(q.toLowerCase())));
  const used = kinds.filter((k) => data.contacts.some((c) => c.kind === k.value));
  const fields = [
    { key: 'name', label: t('full_name'), required: true },
    { key: 'company', label: t('company'), half: true },
    { key: 'kind', label: t('contact_kind'), type: 'select', options: kinds, half: true },
    { key: 'phone', label: t('phone'), type: 'tel', half: true },
    { key: 'email', label: t('email'), type: 'email', half: true },
    { key: 'notes', label: t('notes'), type: 'textarea' },
  ];
  const unread = (c) => data.messages.filter((m) => m.thread === 'contact:' + c.id && !m.deleted).length;

  return (
    <>
      <PageHead title={t('nav_contacts')} subtitle={t('contacts_sub')}>
        <button className="btn primary" onClick={() => setEditing({ name: '', company: '', kind: 'contractor', phone: '', email: '', notes: '' })}>
          <Icon name="plus" size={16} />
          {t('new_contact')}
        </button>
      </PageHead>

      <Glass className="toolbar">
        <Segmented value={kind} onChange={setKind} options={[{ value: 'all', label: t('all'), count: data.contacts.length }, ...used]} />
        <SearchBox value={q} onChange={setQ} placeholder={t('search_contacts')} />
      </Glass>

      {list.length === 0 ? (
        <Glass><Empty icon="phone" text={t('no_contacts')} /></Glass>
      ) : (
        <div className="grid worker-grid">
          {list.map((c) => (
            <Glass className="worker" key={c.id}>
              <header>
                <div className="avatar">{c.name.replace(/^[^\s]+['׳.]\s*/, '').slice(0, 1)}</div>
                <div className="worker-id">
                  <b>{c.name}</b>
                  <small>{c.company}</small>
                </div>
                <IconButton icon="edit" label={t('edit')} onClick={() => setEditing(c)} />
              </header>
              <div className="worker-meta">
                <Badge tone={CONTACT_KINDS[c.kind] || 'neutral'}>{t('ck_kind_' + c.kind)}</Badge>
                {c.phone && <span dir="ltr">{c.phone}</span>}
              </div>
              {c.notes && <small>{c.notes}</small>}
              <div className="contact-actions">
                <button className="btn primary small" onClick={() => setChat(c)}>
                  <Icon name="chat" size={14} />
                  {t('message')}
                  {unread(c) > 0 && <span className="seg-count">{unread(c)}</span>}
                </button>
                {c.phone && (
                  <a className="btn small" href={`tel:${digits(c.phone)}`}>
                    <Icon name="phone" size={14} />
                    {t('call')}
                  </a>
                )}
                {c.phone && (
                  <a className="btn small" href={`https://wa.me/${waNumber(c.phone)}`} target="_blank" rel="noreferrer">
                    WhatsApp
                  </a>
                )}
                {c.email && (
                  <a className="btn small" href={`mailto:${c.email}`} aria-label={t('email')} title={c.email}>
                    <Icon name="mail" size={14} />
                  </a>
                )}
              </div>
            </Glass>
          ))}
        </div>
      )}

      {chat && <ChatModal thread={'contact:' + chat.id} title={chat.name} subtitle={[t('ck_kind_' + chat.kind), chat.company].filter(Boolean).join(' · ')} onClose={() => setChat(null)} />}
      {editing && (
        <EntityForm
          title={editing.id ? t('edit_contact') : t('new_contact')}
          fields={fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => (editing.id ? updateRow('contacts', editing.id, v) : addRow('contacts', v))}
          onDelete={
            editing.id
              ? () => {
                  data.messages.filter((m) => m.thread === 'contact:' + editing.id).forEach((m) => {
                    if (m.file_id) deleteFile(m.file_id);
                    removeRow('messages', m.id);
                  });
                  removeRow('contacts', editing.id);
                }
              : null
          }
        />
      )}
    </>
  );
}
