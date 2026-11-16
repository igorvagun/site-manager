import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { routeQuery } from '../lib/nav';
import { useData, useUser, addRow, updateRow, removeRow } from '../lib/store';
import { Glass, Icon, IconButton, Badge, EntityForm, Empty, PageHead, SearchBox, Stat, Modal } from '../components/ui';
import { todayISO, addDays, fmtDate, uid } from '../lib/utils';

// An action is done when ticked here or, once it became an issue, when that issue is closed.
export const actionDone = (a, issues) => {
  const issue = a.issue_id && issues.find((i) => i.id === a.issue_id);
  return issue ? issue.status === 'done' : !!a.done;
};
export const openActions = (meetings, issues) => meetings.flatMap((m) => (m.actions || []).filter((a) => !actionDone(a, issues)).map((a) => ({ ...a, meeting: m })));

// Site meetings: who was there, what was decided, and who does what by when.
export default function Meetings({ project }) {
  const { t, lang } = useI18n();
  const data = useData();
  const user = useUser();
  const today = todayISO();
  const [q, setQ] = useState(routeQuery);
  const [editing, setEditing] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState({ text: '', assignee: '', due_date: addDays(today, 7) });

  const all = data.meetings;
  const open = all.find((m) => m.id === openId);
  const list = [...all]
    .filter((m) => !q || `${m.title} ${m.attendees} ${m.notes} ${(m.actions || []).map((a) => a.text).join(' ')}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const pending = openActions(all, data.issues);
  const overdue = pending.filter((a) => a.due_date && a.due_date < today);
  const people = [...new Set([...data.workers.filter((w) => w.active !== false).map((w) => w.name), ...data.contacts.map((c) => c.name)])];

  const fields = [
    { key: 'title', label: t('mt_title'), required: true, placeholder: t('mt_title_ph') },
    { key: 'date', label: t('date'), type: 'date', required: true, half: true },
    { key: 'place', label: t('location'), half: true },
    { key: 'attendees', label: t('mt_attendees'), type: 'chips', options: people.map((n) => ({ value: n, label: n })) },
    { key: 'notes', label: t('mt_notes'), type: 'textarea', placeholder: t('mt_notes_ph') },
  ];
  const blank = { title: '', date: today, place: '', attendees: [], notes: '' };
  const setActions = (m, actions) => updateRow('meetings', m.id, { actions });
  const patchAction = (m, id, patch) => setActions(m, m.actions.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const toIssue = async (m, a) => {
    const row = await addRow('issues', {
      title: a.text, type: 'action', priority: 'medium', status: 'open', floor: '', assignee: a.assignee || '', due_date: a.due_date || addDays(today, 7), photo: '', created_by: user.id,
      description: `${t('nav_meetings')}: ${m.title} · ${fmtDate(m.date, lang, { day: 'numeric', month: 'short', year: 'numeric' })}`,
    });
    if (row) patchAction(m, a.id, { issue_id: row.id });
  };

  return (
    <>
      <PageHead title={t('nav_meetings')} subtitle={t('meetings_sub')}>
        <button className="btn primary" onClick={() => setEditing(blank)}>
          <Icon name="plus" size={16} />
          {t('new_meeting')}
        </button>
      </PageHead>

      <div className="grid stats three">
        <Stat icon="note" tone="blue" label={t('mt_total')} value={all.length} sub={list[0] ? `${t('mt_last')}: ${fmtDate(list[0].date, lang)}` : '—'} />
        <Stat icon="list" tone={pending.length ? 'orange' : 'green'} label={t('mt_open_actions')} value={pending.length} sub={t('mt_open_actions_sub')} />
        <Stat icon="clock" tone={overdue.length ? 'red' : 'green'} label={t('mt_overdue')} value={overdue.length} sub={t('mt_overdue_sub')} />
      </div>

      <Glass className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder={t('search')} />
      </Glass>

      {list.length === 0 ? (
        <Glass><Empty icon="note" text={t('no_meetings')} /></Glass>
      ) : (
        <div className="grid job-grid">
          {list.map((m) => {
            const acts = m.actions || [];
            const done = acts.filter((a) => actionDone(a, data.issues)).length;
            const late = acts.filter((a) => !actionDone(a, data.issues) && a.due_date && a.due_date < today).length;
            return (
              <Glass className="job meeting" key={m.id}>
                <header>
                  <div>
                    <button className="task-title" onClick={() => setOpenId(m.id)}>{m.title}</button>
                    <small>{fmtDate(m.date, lang, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}{m.place ? ` · ${m.place}` : ''}</small>
                  </div>
                  <IconButton icon="edit" label={t('edit')} onClick={() => setEditing({ ...blank, ...m })} />
                </header>
                {(m.attendees || []).length > 0 && <p className="doc-notes">{m.attendees.join(', ')}</p>}
                <footer>
                  <Badge tone={acts.length && done === acts.length ? 'green' : 'neutral'}>
                    <Icon name="list" size={12} /> {done}/{acts.length} {t('mt_actions_word')}
                  </Badge>
                  {late > 0 && <Badge tone="red">{late} {t('mt_late_word')}</Badge>}
                  <span className="spacer" />
                  <button className="btn small" onClick={() => setOpenId(m.id)}>{t('open_task')}</button>
                </footer>
              </Glass>
            );
          })}
        </div>
      )}

      {editing && (
        <EntityForm
          title={editing.id ? t('edit_meeting') : t('new_meeting')}
          fields={fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            if (editing.id) return updateRow('meetings', editing.id, v);
            const row = await addRow('meetings', { ...v, actions: [], author: user.name });
            if (row) setOpenId(row.id);
          }}
          onDelete={editing.id ? () => removeRow('meetings', editing.id) : null}
        />
      )}

      {open && (
        <Modal title={open.title} onClose={() => setOpenId(null)} wide>
          <div className="btn-row no-print">
            <button className="btn" onClick={() => window.print()}>
              <Icon name="printer" size={16} />
              {t('print_pdf')}
            </button>
          </div>
          <article className="report">
            <header>
              <div>
                <h2>{t('mt_minutes')}: {open.title}</h2>
                <p>{project?.name}{open.place ? ` · ${open.place}` : ''}</p>
              </div>
              <div className="report-date">
                <b>{fmtDate(open.date, lang, { day: 'numeric', month: 'long', year: 'numeric' })}</b>
                <span>{open.author}</span>
              </div>
            </header>
            {(open.attendees || []).length > 0 && (
              <section>
                <h4>{t('mt_attendees')}</h4>
                <p>{open.attendees.join(', ')}</p>
              </section>
            )}
            {open.notes && (
              <section>
                <h4>{t('mt_notes')}</h4>
                <p className="pre">{open.notes}</p>
              </section>
            )}
            <section>
              <h4>{t('mt_actions')}</h4>
              {(open.actions || []).length === 0 ? (
                <p className="muted">{t('mt_no_actions')}</p>
              ) : (
                <table className="mini-table mt-actions">
                  <thead>
                    <tr>
                      <th>{t('mt_action')}</th>
                      <th>{t('assignee')}</th>
                      <th>{t('due_date')}</th>
                      <th>{t('status')}</th>
                      <th className="no-print" />
                    </tr>
                  </thead>
                  <tbody>
                    {open.actions.map((a) => {
                      const done = actionDone(a, data.issues);
                      const linked = a.issue_id && data.issues.some((i) => i.id === a.issue_id);
                      return (
                        <tr key={a.id} className={done ? 'done' : ''}>
                          <td>{a.text}</td>
                          <td>{a.assignee || '—'}</td>
                          <td className={!done && a.due_date && a.due_date < today ? 'warn-text' : ''}>{a.due_date ? fmtDate(a.due_date, lang) : '—'}</td>
                          <td>
                            {linked ? (
                              <span>{t(done ? 'mt_done' : 'mt_in_issues')}</span>
                            ) : (
                              <label className="mt-check">
                                <input type="checkbox" checked={done} onChange={() => patchAction(open, a.id, { done: !a.done })} aria-label={`${t('mt_done')}: ${a.text}`} />
                                {t(done ? 'mt_done' : 'mt_open')}
                              </label>
                            )}
                          </td>
                          <td className="no-print mt-tools">
                            {!linked && !done && (
                              <button className="btn small" onClick={() => toIssue(open, a)}>
                                <Icon name="arrow" size={13} className="flip-rtl" />
                                {t('mt_to_issue')}
                              </button>
                            )}
                            <IconButton icon="trash" label={t('delete')} size={15} onClick={() => setActions(open, open.actions.filter((x) => x.id !== a.id))} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
          </article>
          <form
            className="mt-add no-print"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.text.trim()) return;
              setActions(open, [...(open.actions || []), { id: uid(), text: draft.text.trim(), assignee: draft.assignee, due_date: draft.due_date || null, done: false, issue_id: null }]);
              setDraft({ ...draft, text: '' });
            }}
          >
            <input className="grow" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} placeholder={t('mt_action_ph')} aria-label={t('mt_action')} />
            <select value={draft.assignee} onChange={(e) => setDraft({ ...draft, assignee: e.target.value })} aria-label={t('assignee')}>
              <option value="">{t('assignee')}…</option>
              {people.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <input type="date" value={draft.due_date || ''} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} aria-label={t('due_date')} />
            <button className="btn primary" type="submit">
              <Icon name="plus" size={15} />
              {t('mt_add_action')}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
