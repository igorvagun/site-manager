import { useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { routeQuery } from '../lib/nav';
import { useData, useUser, addRow, updateRow, removeRow, notify } from '../lib/store';
import { putFile, deleteFile, useFileURL } from '../lib/files';
import { Glass, Icon, IconButton, Badge, EntityForm, Empty, PageHead, SearchBox, Stat, Segmented } from '../components/ui';
import { todayISO, addDays, diffDays, fmtDate, exportCSV } from '../lib/utils';

export const DOC_KINDS = ['permit', 'insurance', 'certificate', 'license', 'contract', 'other'];
export const DOC_SOON = 30; // days before expiry when a document starts asking for attention
const TONE = { expired: 'red', expiring: 'orange', valid: 'green', none: 'neutral' };
const MAX = 40 * 1024 * 1024;

export function docState(d, today = todayISO()) {
  if (!d.expires_on) return 'none';
  if (d.expires_on < today) return 'expired';
  return d.expires_on <= addDays(today, DOC_SOON) ? 'expiring' : 'valid';
}
export const docsNeedingAttention = (list, today = todayISO()) => list.filter((d) => ['expired', 'expiring'].includes(docState(d, today)));

function FileLink({ doc }) {
  const { t } = useI18n();
  const { url, missing } = useFileURL(doc.file_id);
  if (missing) return <span className="file-missing">{t('file_missing')}</span>;
  if (!url) return null;
  return (
    <a className="btn small" href={url} target="_blank" rel="noreferrer" download={doc.file_type === 'application/pdf' || (doc.file_type || '').startsWith('image/') ? undefined : doc.file_name}>
      <Icon name="file" size={14} />
      {t('open_file')}
    </a>
  );
}

// Permits, insurance, certificates and licences of the project, each with its expiry date.
export default function Documents() {
  const { t, lang } = useI18n();
  const data = useData();
  const user = useUser();
  const today = todayISO();
  const [q, setQ] = useState(routeQuery);
  const [tab, setTab] = useState('all');
  const [kind, setKind] = useState('all');
  const [editing, setEditing] = useState(null);
  const fileRef = useRef(null);
  const target = useRef(null);

  const all = data.documents;
  const attention = docsNeedingAttention(all, today);
  const order = { expired: 0, expiring: 1, valid: 2, none: 3 };
  const list = [...all]
    .filter((d) => (tab === 'all' || (tab === 'attention' ? attention.includes(d) : !attention.includes(d))) && (kind === 'all' || d.kind === kind))
    .filter((d) => !q || `${d.name} ${d.number} ${d.issuer} ${d.holder}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => order[docState(a, today)] - order[docState(b, today)] || String(a.expires_on || '9').localeCompare(String(b.expires_on || '9')) || a.name.localeCompare(b.name));
  const count = (s) => all.filter((d) => docState(d, today) === s).length;

  const fields = [
    { key: 'name', label: t('doc_name'), required: true },
    { key: 'kind', label: t('type'), type: 'select', half: true, options: DOC_KINDS.map((k) => ({ value: k, label: t('dk_' + k) })) },
    { key: 'number', label: t('doc_number'), half: true },
    { key: 'issuer', label: t('doc_issuer'), half: true },
    { key: 'holder', label: t('doc_holder'), half: true, placeholder: t('doc_holder_ph') },
    { key: 'issued_on', label: t('doc_issued'), type: 'date', half: true },
    { key: 'expires_on', label: t('doc_expires'), type: 'date', half: true },
    { key: 'notes', label: t('notes'), type: 'textarea' },
  ];
  const blank = { name: '', kind: 'permit', number: '', issuer: '', holder: '', issued_on: today, expires_on: '', notes: '' };

  const attach = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    const doc = all.find((d) => d.id === target.current);
    if (!f || !doc) return;
    if (f.size > MAX) return notify('file_too_big', 'error');
    try {
      const file_id = await putFile(f);
      if (doc.file_id) deleteFile(doc.file_id);
      updateRow('documents', doc.id, { file_id, file_name: f.name, file_type: f.type });
    } catch (err) {
      console.error(err);
      notify('upload_failed', 'error');
    }
  };
  // A renewal keeps the same record: new dates for the same length of time, and the old ones stay in the history.
  const renew = (d) => {
    const span = d.issued_on && d.expires_on ? diffDays(d.issued_on, d.expires_on) : 365;
    const from = d.expires_on && d.expires_on > today ? d.expires_on : today;
    setEditing({ ...blank, ...d, issued_on: from, expires_on: addDays(from, span), renewing: true });
  };
  const left = (d) => {
    const n = diffDays(today, d.expires_on);
    return n < 0 ? `${t('doc_expired_ago')} ${-n} ${t('days_short')}` : n === 0 ? t('doc_expires_today') : `${t('doc_in')} ${n} ${t('days_short')}`;
  };

  return (
    <>
      <PageHead title={t('nav_docs')} subtitle={t('docs_sub')}>
        <button
          className="btn"
          onClick={() =>
            exportCSV('documents.csv', list, [
              { key: 'name', label: t('doc_name') },
              { label: t('type'), get: (d) => t('dk_' + d.kind) },
              { key: 'number', label: t('doc_number') },
              { key: 'issuer', label: t('doc_issuer') },
              { key: 'holder', label: t('doc_holder') },
              { key: 'issued_on', label: t('doc_issued') },
              { key: 'expires_on', label: t('doc_expires') },
              { label: t('status'), get: (d) => t('ds_' + docState(d, today)) },
            ])
          }
        >
          <Icon name="download" size={16} />
          CSV
        </button>
        <button className="btn primary" onClick={() => setEditing(blank)}>
          <Icon name="plus" size={16} />
          {t('new_doc')}
        </button>
      </PageHead>

      <div className="grid stats four">
        <Stat icon="file" tone="blue" label={t('doc_total')} value={all.length} sub={`${all.filter((d) => d.file_id).length} ${t('doc_with_file')}`} />
        <Stat icon="check" tone="green" label={t('ds_valid')} value={count('valid') + count('none')} sub={`${count('none')} ${t('doc_no_expiry_word')}`} />
        <Stat icon="clock" tone={count('expiring') ? 'orange' : 'green'} label={t('ds_expiring')} value={count('expiring')} sub={t('doc_soon_sub')} />
        <Stat icon="alert" tone={count('expired') ? 'red' : 'green'} label={t('ds_expired')} value={count('expired')} sub={t('doc_expired_sub')} />
      </div>

      <Glass className="toolbar">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'all', label: t('all'), count: all.length },
            { value: 'attention', label: t('doc_attention'), count: attention.length },
            { value: 'ok', label: t('doc_in_order'), count: all.length - attention.length },
          ]}
        />
        <select className="filter" value={kind} onChange={(e) => setKind(e.target.value)} aria-label={t('type')}>
          <option value="all">{t('doc_all_kinds')}</option>
          {DOC_KINDS.map((k) => <option key={k} value={k}>{t('dk_' + k)}</option>)}
        </select>
        <SearchBox value={q} onChange={setQ} placeholder={t('search')} />
      </Glass>
      <input ref={fileRef} type="file" hidden onChange={attach} />

      {list.length === 0 ? (
        <Glass><Empty icon="file" text={t('no_docs')} /></Glass>
      ) : (
        <div className="grid job-grid">
          {list.map((d) => {
            const st = docState(d, today);
            return (
              <Glass className={`job doc ${st}`} key={d.id}>
                <header>
                  <div>
                    <b>{d.name}</b>
                    <small>{[d.issuer, d.number && `№ ${d.number}`].filter(Boolean).join(' · ')}</small>
                  </div>
                  <IconButton icon="edit" label={t('edit')} onClick={() => setEditing({ ...blank, ...d, issued_on: d.issued_on || '', expires_on: d.expires_on || '' })} />
                </header>
                <div className="task-meta">
                  <Badge tone={TONE[st]}>{t('ds_' + st)}</Badge>
                  <span className="tag">{t('dk_' + d.kind)}</span>
                  {d.holder && <span>{d.holder}</span>}
                </div>
                <div className="job-facts">
                  <div>
                    <span>{t('doc_issued')}</span>
                    <b>{d.issued_on ? fmtDate(d.issued_on, lang, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</b>
                  </div>
                  <div>
                    <span>{t('doc_expires')}</span>
                    <b>{d.expires_on ? fmtDate(d.expires_on, lang, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</b>
                  </div>
                  <div>
                    <span>{t('doc_time_left')}</span>
                    <b className={st === 'expired' || st === 'expiring' ? 'warn-text' : ''}>{d.expires_on ? left(d) : t('doc_no_expiry')}</b>
                  </div>
                </div>
                {d.notes && <p className="doc-notes">{d.notes}</p>}
                <footer>
                  {d.file_id ? (
                    <FileLink doc={d} />
                  ) : (
                    <button className="btn small" onClick={() => ((target.current = d.id), fileRef.current.click())}>
                      <Icon name="upload" size={14} />
                      {t('doc_attach')}
                    </button>
                  )}
                  {d.file_id && <IconButton icon="upload" label={t('doc_replace')} size={15} onClick={() => ((target.current = d.id), fileRef.current.click())} />}
                  <span className="spacer" />
                  {d.expires_on && (
                    <button className={`btn small ${st === 'expired' || st === 'expiring' ? 'primary' : ''}`} onClick={() => renew(d)}>
                      {t('doc_renew')}
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
          title={editing.renewing ? `${t('doc_renew')}: ${editing.name}` : editing.id ? t('edit_doc') : t('new_doc')}
          fields={fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => {
            const { renewing, ...row } = v;
            if (row.issued_on && row.expires_on && row.expires_on < row.issued_on) return notify('doc_bad_dates', 'error');
            editing.id ? updateRow('documents', editing.id, row) : addRow('documents', { ...row, added_by: user.name });
          }}
          onDelete={
            editing.id && !editing.renewing
              ? () => {
                  if (editing.file_id) deleteFile(editing.file_id);
                  removeRow('documents', editing.id);
                }
              : null
          }
        />
      )}
    </>
  );
}
