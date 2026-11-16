import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useData, useUser, addRow, updateRow, removeRow, notify } from '../lib/store';
import { QC } from '../lib/checklists';
import { useOptions } from '../lib/constants';
import { Glass, Icon, IconButton, Badge, EntityForm, Empty, PageHead, Stat, Modal, Segmented } from '../components/ui';
import { todayISO, addDays, fmtDate } from '../lib/utils';

const TONE = { open: 'orange', passed: 'green', failed: 'red' };

// Acceptance of work by stage: tick every item, sign off, and turn failures into issues.
export default function Quality() {
  const { t, lang } = useI18n();
  const data = useData();
  const user = useUser();
  const o = useOptions();
  const today = todayISO();
  const [tab, setTab] = useState('all');
  const [creating, setCreating] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [lists, setLists] = useState(false); // manage own checklists
  const [draft, setDraft] = useState(null);
  const [extra, setExtra] = useState('');
  const own = data.checklists;
  const title = (x) => x.title || t('qcs_' + x.stage);
  const list = [...data.inspections].sort((a, b) => String(b.date).localeCompare(String(a.date))).filter((x) => tab === 'all' || x.status === tab);
  const open = data.inspections.find((x) => x.id === openId);
  const count = (s) => data.inspections.filter((x) => s === 'all' || x.status === s).length;
  const taskName = (id) => data.tasks.find((x) => x.id === id)?.name;

  const fields = [
    { key: 'stage', label: t('qc_stage'), type: 'select', options: [...Object.keys(QC).map((k) => ({ value: k, label: t('qcs_' + k) })), ...own.map((c) => ({ value: 'own:' + c.id, label: c.name }))], half: true },
    { key: 'date', label: t('date'), type: 'date', required: true, half: true },
    { key: 'task_id', label: t('task'), type: 'select', options: [{ value: '', label: '—' }, ...data.tasks.filter((x) => x.status !== 'pending').map((x) => ({ value: x.id, label: x.name }))] },
    { key: 'floor', label: t('floor'), type: 'select', options: o.floors, half: true },
    { key: 'location', label: t('qc_location'), half: true, placeholder: t('qc_location_ph') },
  ];
  const setItem = (insp, i, patch) => updateRow('inspections', insp.id, { items: insp.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const sign = (insp) => {
    if (insp.items.some((it) => !it.state)) return notify('qc_incomplete', 'error');
    updateRow('inspections', insp.id, { status: insp.items.some((it) => it.state === 'fail') ? 'failed' : 'passed', inspector: user.name, signed_at: new Date().toISOString() });
  };
  const raise = async (insp, it, i) => {
    const row = await addRow('issues', {
      title: it.text, type: 'punch', priority: 'high', status: 'open', floor: insp.floor, assignee: '', due_date: addDays(today, 3), photo: '', created_by: user.id,
      description: [`${t('nav_quality')}: ${title(insp)}`, insp.location, it.note].filter(Boolean).join(' · '),
    });
    if (row) setItem(insp, i, { issue_id: row.id });
  };

  return (
    <>
      <PageHead title={t('nav_quality')} subtitle={t('quality_sub')}>
        <button className="btn" onClick={() => setLists(true)}>
          <Icon name="list" size={16} />
          {t('qc_my_lists')}
        </button>
        <button className="btn primary" onClick={() => setCreating({ stage: 'concrete', date: today, task_id: '', floor: 'א', location: '' })}>
          <Icon name="plus" size={16} />
          {t('new_inspection')}
        </button>
      </PageHead>

      <div className="grid stats three">
        <Stat icon="clipboard" tone="blue" label={t('qc_total')} value={count('all')} sub={`${count('open')} ${t('qc_open_word')}`} />
        <Stat icon="check" tone="green" label={t('qc_passed')} value={count('passed')} sub={count('all') ? `${Math.round((count('passed') / Math.max(1, count('passed') + count('failed'))) * 100)}% ${t('qc_first_time')}` : '—'} />
        <Stat icon="alert" tone={count('failed') ? 'red' : 'green'} label={t('qc_failed')} value={count('failed')} sub={t('qc_failed_sub')} />
      </div>

      <Glass className="toolbar">
        <Segmented value={tab} onChange={setTab} options={['all', 'open', 'passed', 'failed'].map((s) => ({ value: s, label: s === 'all' ? t('all') : t('qcr_' + s), count: count(s) }))} />
      </Glass>

      {list.length === 0 ? (
        <Glass><Empty icon="clipboard" text={t('no_inspections')} /></Glass>
      ) : (
        <div className="grid job-grid">
          {list.map((x) => {
            const done = x.items.filter((it) => it.state).length;
            const fails = x.items.filter((it) => it.state === 'fail').length;
            return (
              <Glass className="job" key={x.id}>
                <header>
                  <button className="task-title" onClick={() => setOpenId(x.id)}>
                    {title(x)}
                    {x.location ? ` — ${x.location}` : ''}
                  </button>
                  <Badge tone={TONE[x.status]}>{t('qcr_' + x.status)}</Badge>
                </header>
                <div className="task-meta">
                  <span className="tag">{o.floorLabel(x.floor)}</span>
                  <span>{fmtDate(x.date, lang, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  {taskName(x.task_id) && <span>{taskName(x.task_id)}</span>}
                </div>
                <div className="qc-dots" aria-label={`${done}/${x.items.length}`}>
                  {x.items.map((it, i) => <i key={i} className={it.state || ''} />)}
                  <span>
                    {done}/{x.items.length}
                    {fails > 0 && <b className="warn-text"> · {fails} {t('qc_fails')}</b>}
                  </span>
                </div>
                <footer>
                  <button className="btn small" onClick={() => setOpenId(x.id)}>{t(x.status === 'open' ? 'qc_continue' : 'open_task')}</button>
                  <span className="spacer" />
                  {x.inspector && <small>{x.inspector}</small>}
                </footer>
              </Glass>
            );
          })}
        </div>
      )}

      {creating && (
        <EntityForm
          title={t('new_inspection')}
          fields={fields}
          initial={creating}
          onClose={() => setCreating(null)}
          onSave={async (v) => {
            // The checklist text is copied in, so later wording changes do not rewrite a signed record.
            const mine = own.find((c) => 'own:' + c.id === v.stage);
            const texts = mine ? mine.items : (QC[v.stage] || []).map((k) => t(k));
            const row = await addRow('inspections', { ...v, stage: mine ? 'custom' : v.stage, title: mine ? mine.name : '', task_id: v.task_id || null, status: 'open', inspector: '', items: texts.map((text) => ({ text, state: '', note: '' })) });
            if (row) setOpenId(row.id);
          }}
        />
      )}

      {open && (
        <Modal title={`${title(open)}${open.location ? ` — ${open.location}` : ''}`} onClose={() => setOpenId(null)} wide>
          <div className="task-meta">
            <Badge tone={TONE[open.status]}>{t('qcr_' + open.status)}</Badge>
            <span className="tag">{o.floorLabel(open.floor)}</span>
            <span>{fmtDate(open.date, lang, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            {taskName(open.task_id) && <span>{taskName(open.task_id)}</span>}
            {open.inspector && <span>{t('qc_signed_by')} {open.inspector}</span>}
          </div>
          <ol className="qc-list">
            {open.items.map((it, i) => (
              <li key={i} className={it.state || ''}>
                <span className="grow">{it.text}</span>
                <div className="qc-states" role="group" aria-label={it.text}>
                  {[['pass', 'check', 'qc_pass'], ['fail', 'x', 'qc_fail'], ['na', 'minus', 'qc_na']].map(([s, icon, key]) => (
                    <button key={s} className={`qc-btn ${s} ${it.state === s ? 'on' : ''}`} aria-pressed={it.state === s} aria-label={t(key)} title={t(key)} disabled={open.status !== 'open'} onClick={() => setItem(open, i, { state: it.state === s ? '' : s })}>
                      <Icon name={icon} size={16} />
                    </button>
                  ))}
                </div>
                {it.state === 'fail' && (
                  <div className="qc-fail">
                    <input defaultValue={it.note} placeholder={t('qc_note_ph')} aria-label={t('notes')} disabled={open.status !== 'open'} onBlur={(e) => e.target.value !== it.note && setItem(open, i, { note: e.target.value })} />
                    {it.issue_id && data.issues.some((x) => x.id === it.issue_id) ? (
                      <Badge tone="blue">{t('qc_issue_raised')}</Badge>
                    ) : (
                      <button className="btn small" onClick={() => raise(open, it, i)}>
                        <Icon name="plus" size={13} />
                        {t('qc_raise_issue')}
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
          {open.status === 'open' && (
            <form
              className="qc-add"
              onSubmit={(e) => {
                e.preventDefault();
                if (!extra.trim()) return;
                updateRow('inspections', open.id, { items: [...open.items, { text: extra.trim(), state: '', note: '' }] });
                setExtra('');
              }}
            >
              <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={t('qc_add_item_ph')} aria-label={t('qc_add_item')} />
              <button className="btn small" type="submit">
                <Icon name="plus" size={13} />
                {t('qc_add_item')}
              </button>
            </form>
          )}
          <div className="modal-foot">
            <button className="btn danger" onClick={() => confirm(t('confirm_delete')) && (removeRow('inspections', open.id), setOpenId(null))}>
              <Icon name="trash" size={16} />
              {t('delete')}
            </button>
            <span className="spacer" />
            {open.status === 'open' ? (
              <button className="btn primary" onClick={() => sign(open)}>
                <Icon name="check" size={16} />
                {t('qc_sign')}
              </button>
            ) : (
              <button className="btn" onClick={() => updateRow('inspections', open.id, { status: 'open', inspector: '' })}>{t('qc_reopen')}</button>
            )}
          </div>
        </Modal>
      )}

      {lists && (
        <Modal title={t('qc_my_lists')} onClose={() => (setLists(false), setDraft(null))} wide>
          {draft ? (
            <form
              className="qc-editor"
              onSubmit={(e) => {
                e.preventDefault();
                const items = draft.text.split('\n').map((x) => x.trim()).filter(Boolean);
                if (!draft.name.trim() || !items.length) return notify('qc_list_invalid', 'error');
                draft.id ? updateRow('checklists', draft.id, { name: draft.name.trim(), items }) : addRow('checklists', { name: draft.name.trim(), items, created_by: user.id });
                setDraft(null);
              }}
            >
              <div className="field">
                <label htmlFor="cl-name">{t('qc_list_name')}</label>
                <input id="cl-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={t('qc_list_name_ph')} />
              </div>
              {!draft.id && (
                <div className="field">
                  <label htmlFor="cl-base">{t('qc_copy_from')}</label>
                  <select id="cl-base" value="" onChange={(e) => e.target.value && setDraft({ ...draft, text: QC[e.target.value].map((k) => t(k)).join('\n') })}>
                    <option value="">—</option>
                    {Object.keys(QC).map((k) => <option key={k} value={k}>{t('qcs_' + k)}</option>)}
                  </select>
                </div>
              )}
              <div className="field">
                <label htmlFor="cl-items">{t('qc_list_items')}</label>
                <textarea id="cl-items" rows={9} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} placeholder={t('qc_list_items_ph')} />
              </div>
              <div className="modal-foot">
                <span className="spacer" />
                <button type="button" className="btn" onClick={() => setDraft(null)}>{t('cancel')}</button>
                <button type="submit" className="btn primary">{t('save')}</button>
              </div>
            </form>
          ) : (
            <>
              <p className="muted">{t('qc_my_lists_hint')}</p>
              {own.length === 0 ? (
                <Empty icon="list" text={t('qc_no_lists')} />
              ) : (
                <ul className="sub-pays">
                  {own.map((c) => (
                    <li key={c.id}>
                      <b className="grow">{c.name}</b>
                      <span>{c.items.length} {t('qc_items_word')}</span>
                      <IconButton icon="edit" label={t('edit')} size={15} onClick={() => setDraft({ id: c.id, name: c.name, text: c.items.join('\n') })} />
                      <IconButton icon="trash" label={t('delete')} size={15} onClick={() => confirm(t('confirm_delete')) && removeRow('checklists', c.id)} />
                    </li>
                  ))}
                </ul>
              )}
              <div className="modal-foot">
                <span className="spacer" />
                <button className="btn primary" onClick={() => setDraft({ name: '', text: '' })}>
                  <Icon name="plus" size={16} />
                  {t('qc_new_list')}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
