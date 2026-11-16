import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useData, useUser, addRow, updateRow, removeRow } from '../lib/store';
import { useOptions, PRIORITY } from '../lib/constants';
import { Glass, Icon, IconButton, Badge, EntityForm, Empty, PageHead, SearchBox } from '../components/ui';
import { todayISO, fmtDate } from '../lib/utils';

const RANK = { high: 0, medium: 1, low: 2 };

// The manager's private checklist: lists, priorities, due dates, sub-steps, pinning.
export default function Todo() {
  const { t, lang } = useI18n();
  const data = useData();
  const user = useUser();
  const o = useOptions();
  const today = todayISO();
  const [view, setView] = useState('open');
  const [q, setQ] = useState('');
  const [quick, setQuick] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null);
  const [step, setStep] = useState('');

  const mine = data.todos.filter((x) => x.user_id === user.id);
  const lists = [...new Set(mine.map((x) => x.list).filter(Boolean))].sort();
  const smart = {
    open: (x) => !x.done,
    today: (x) => !x.done && x.due_date && x.due_date <= today,
    overdue: (x) => !x.done && x.due_date && x.due_date < today,
    done: (x) => x.done,
  };
  const match = smart[view] || ((x) => !x.done && x.list === view.slice(5));
  const list = mine
    .filter((x) => match(x) && (!q || x.title.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (RANK[a.priority] ?? 3) - (RANK[b.priority] ?? 3) || String(a.due_date || '9').localeCompare(String(b.due_date || '9')));
  const count = (k) => mine.filter(smart[k] || ((x) => !x.done && x.list === k.slice(5))).length;
  const currentList = view.startsWith('list:') ? view.slice(5) : '';

  const add = (e) => {
    e.preventDefault();
    if (!quick.trim()) return;
    addRow('todos', { user_id: user.id, title: quick.trim(), list: currentList, priority: 'medium', due_date: view === 'today' ? today : null, done: false, pinned: false, notes: '', subtasks: [] });
    setQuick('');
  };
  const fields = [
    { key: 'title', label: t('title'), required: true },
    { key: 'list', label: t('todo_list'), half: true, placeholder: t('todo_list_ph') },
    { key: 'priority', label: t('priority'), type: 'select', options: o.priority, half: true },
    { key: 'due_date', label: t('due_date'), type: 'date', half: true },
    { key: 'notes', label: t('notes'), type: 'textarea' },
  ];
  const nav = [
    { id: 'open', icon: 'list', label: t('todo_open') },
    { id: 'today', icon: 'calendar', label: t('todo_today') },
    { id: 'overdue', icon: 'alert', label: t('todo_overdue') },
    ...lists.map((l) => ({ id: 'list:' + l, icon: 'book', label: l })),
    { id: 'done', icon: 'check', label: t('todo_done') },
  ];

  return (
    <>
      <PageHead title={t('nav_todo')} subtitle={t('todo_sub')} />
      <div className="todo-layout">
        <Glass className="todo-nav">
          {nav.map((n) => (
            <button key={n.id} className={`nav-row ${view === n.id ? 'on' : ''}`} onClick={() => setView(n.id)}>
              <Icon name={n.icon} size={17} />
              <span className="grow">{n.label}</span>
              <span className="seg-count">{count(n.id)}</span>
            </button>
          ))}
        </Glass>

        <div className="stack">
          <Glass className="toolbar">
            <form className="quick-add" onSubmit={add}>
              <Icon name="plus" size={16} />
              <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder={t('todo_quick_ph')} aria-label={t('todo_quick_ph')} />
              <button className="btn primary small" type="submit" disabled={!quick.trim()}>{t('add')}</button>
            </form>
            <SearchBox value={q} onChange={setQ} placeholder={t('search')} />
          </Glass>

          {list.length === 0 ? (
            <Glass><Empty icon="check" text={t('todo_empty')} /></Glass>
          ) : (
            <div className="todo-list">
              {list.map((x) => {
                const subs = x.subtasks || [];
                const doneSubs = subs.filter((s) => s.done).length;
                const overdue = !x.done && x.due_date && x.due_date < today;
                const isOpen = expanded === x.id;
                return (
                  <Glass className={`todo ${x.done ? 'done' : ''}`} key={x.id}>
                    <div className="todo-row">
                      <button
                        className={`check ${x.done ? 'on' : ''}`}
                        role="checkbox"
                        aria-checked={!!x.done}
                        aria-label={x.title}
                        onClick={() => updateRow('todos', x.id, { done: !x.done, done_at: x.done ? null : new Date().toISOString() })}
                      >
                        {x.done && <Icon name="check" size={16} />}
                      </button>
                      <button className="todo-title" onClick={() => setExpanded(isOpen ? null : x.id)}>
                        <b>{x.title}</b>
                        <span className="task-meta">
                          {x.list && <span className="tag">{x.list}</span>}
                          {x.due_date && (
                            <span className={overdue ? 'warn-text' : ''}>
                              <Icon name="clock" size={12} /> {fmtDate(x.due_date, lang)}
                            </span>
                          )}
                          {subs.length > 0 && <span>{doneSubs}/{subs.length} {t('steps')}</span>}
                          {x.notes && <Icon name="edit" size={12} />}
                        </span>
                      </button>
                      <Badge tone={PRIORITY[x.priority] || 'neutral'}>{t('pr_' + x.priority)}</Badge>
                      <IconButton icon="pin" size={16} tone={x.pinned ? 'active' : ''} label={t(x.pinned ? 'unpin' : 'pin')} onClick={() => updateRow('todos', x.id, { pinned: !x.pinned })} />
                      <IconButton icon="edit" size={16} label={t('edit')} onClick={() => setEditing({ ...x, due_date: x.due_date || '', list: x.list || '' })} />
                    </div>
                    {isOpen && (
                      <div className="todo-body">
                        {x.notes && <p>{x.notes}</p>}
                        {subs.map((s, i) => (
                          <label key={i} className={`step ${s.done ? 'done' : ''}`}>
                            <input
                              type="checkbox"
                              checked={!!s.done}
                              onChange={(e) => updateRow('todos', x.id, { subtasks: subs.map((y, j) => (j === i ? { ...y, done: e.target.checked } : y)) })}
                            />
                            <span>{s.t}</span>
                            <IconButton icon="x" size={12} label={t('remove')} onClick={() => updateRow('todos', x.id, { subtasks: subs.filter((_, j) => j !== i) })} />
                          </label>
                        ))}
                        <form
                          className="quick-add"
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!step.trim()) return;
                            updateRow('todos', x.id, { subtasks: [...subs, { t: step.trim(), done: false }] });
                            setStep('');
                          }}
                        >
                          <Icon name="plus" size={14} />
                          <input value={step} onChange={(e) => setStep(e.target.value)} placeholder={t('add_step')} aria-label={t('add_step')} />
                        </form>
                      </div>
                    )}
                  </Glass>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <EntityForm
          title={t('edit_todo')}
          fields={fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => updateRow('todos', editing.id, { title: v.title, list: (v.list || '').trim(), priority: v.priority, due_date: v.due_date || null, notes: v.notes })}
          onDelete={() => removeRow('todos', editing.id)}
        />
      )}
    </>
  );
}
