import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { routeQuery } from '../lib/nav';
import { useData, useUser, addRow, updateRow, removeRow } from '../lib/store';
import { useOptions, ISSUE_STATUS, PRIORITY } from '../lib/constants';
import { Glass, Icon, Badge, Segmented, EntityForm, PageHead, SearchBox } from '../components/ui';
import { todayISO, addDays, fmtDate, exportCSV } from '../lib/utils';
import { DrawingViewer } from './Drawings';

const ORDER = Object.keys(ISSUE_STATUS);
const RANK = { high: 0, medium: 1, low: 2 };

export default function Issues() {
  const { t, lang } = useI18n();
  const data = useData();
  const o = useOptions();
  const today = todayISO();
  const [type, setType] = useState('all');
  const [q, setQ] = useState(routeQuery);
  const [editing, setEditing] = useState(null);
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const [pinView, setPinView] = useState(null);
  // Anyone can raise an issue and move it along; only managers and foremen edit or delete other people's.
  const user = useUser();
  const lead = user.role !== 'worker';
  const canEdit = (i) => lead || i.created_by === user.id;

  const list = data.issues
    .filter((i) => (type === 'all' || i.type === type) && (!q || `${i.title} ${i.description} ${i.assignee}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (RANK[a.priority] ?? 3) - (RANK[b.priority] ?? 3) || String(a.due_date).localeCompare(String(b.due_date)));

  const fields = [
    { key: 'title', label: t('title'), required: true },
    { key: 'type', label: t('type'), type: 'select', options: o.issueType, half: true },
    { key: 'priority', label: t('priority'), type: 'select', options: o.priority, half: true },
    { key: 'status', label: t('status'), type: 'select', options: o.issueStatus, half: true },
    { key: 'floor', label: t('floor'), type: 'select', options: o.floors, half: true },
    { key: 'assignee', label: t('assignee'), type: 'select', half: true, options: [{ value: '', label: '—' }, ...data.workers.map((w) => ({ value: w.name, label: w.name }))] },
    { key: 'due_date', label: t('due_date'), type: 'date', half: true },
    { key: 'description', label: t('description'), type: 'textarea' },
    { key: 'photo', label: t('photo'), type: 'photo' },
  ];
  const blank = { title: '', type: type === 'rfi' ? 'rfi' : 'punch', priority: 'medium', status: 'open', floor: 'א', assignee: '', due_date: addDays(today, 7), description: '', photo: '' };
  const count = (k) => data.issues.filter((i) => k === 'all' || i.type === k).length;

  return (
    <>
      <PageHead title={t('nav_issues')} subtitle={t('issues_sub')}>
        <button
          className="btn"
          onClick={() =>
            exportCSV('issues.csv', list, [
              { label: t('type'), get: (r) => t('it_' + r.type) },
              { key: 'title', label: t('title') },
              { key: 'description', label: t('description') },
              { label: t('floor'), get: (r) => o.floorLabel(r.floor) },
              { key: 'assignee', label: t('assignee') },
              { label: t('priority'), get: (r) => t('pr_' + r.priority) },
              { label: t('status'), get: (r) => t('is_' + r.status) },
              { key: 'due_date', label: t('due_date') },
            ])
          }
        >
          <Icon name="download" size={16} />
          CSV
        </button>
        <button className="btn primary" onClick={() => setEditing(blank)}>
          <Icon name="plus" size={16} />
          {t('new_issue')}
        </button>
      </PageHead>

      <Glass className="toolbar">
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: 'all', label: t('all'), count: count('all') },
            { value: 'punch', label: t('it_punch'), count: count('punch') },
            { value: 'rfi', label: t('it_rfi'), count: count('rfi') },
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder={t('search_issues')} />
      </Glass>

      <div className="board">
        {ORDER.map((st) => {
          const col = list.filter((i) => i.status === st);
          return (
            <Glass
              key={st}
              className={`column ${over === st ? 'over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setOver(st); }}
              onDragLeave={() => setOver(null)}
              onDrop={() => {
                if (drag && drag.status !== st) updateRow('issues', drag.id, { status: st });
                setDrag(null);
                setOver(null);
              }}
            >
              <header>
                <i className={`status-dot bg-${ISSUE_STATUS[st]}`} />
                <h3>{t('is_' + st)}</h3>
                <span className="seg-count">{col.length}</span>
              </header>
              {col.length === 0 && <p className="col-empty">{t('drop_here')}</p>}
              {col.map((i) => {
                const overdue = i.status !== 'done' && i.due_date && i.due_date < today;
                const idx = ORDER.indexOf(st);
                return (
                  <article
                    key={i.id}
                    className="issue"
                    draggable
                    onDragStart={() => setDrag(i)}
                    onDragEnd={() => { setDrag(null); setOver(null); }}
                  >
                    <div className="issue-top">
                      <Badge tone={i.type === 'rfi' ? 'purple' : 'blue'}>{t('it_' + i.type)}</Badge>
                      <Badge tone={PRIORITY[i.priority]}>{t('pr_' + i.priority)}</Badge>
                    </div>
                    <button className="issue-title" onClick={() => canEdit(i) && setEditing(i)}>{i.title}</button>
                    {i.description && <p>{i.description}</p>}
                    {i.photo && <img src={i.photo} alt="" />}
                    <footer>
                      <span className="tag">{o.floorLabel(i.floor)}</span>
                      {i.drawing_id && data.drawings.some((d) => d.id === i.drawing_id) && (
                        <button className="tag pin-tag" onClick={() => setPinView(i)} title={t('show_on_drawing')}>
                          <Icon name="pin" size={12} /> {data.drawings.find((d) => d.id === i.drawing_id).number || t('drawing')}
                        </button>
                      )}
                      {i.assignee && <span className="avatar-chip"><i>{i.assignee.slice(0, 1)}</i>{i.assignee}</span>}
                      {i.due_date && (
                        <span className={overdue ? 'warn-text' : ''}>
                          <Icon name="clock" size={12} /> {fmtDate(i.due_date, lang)}
                        </span>
                      )}
                    </footer>
                    <div className="issue-move">
                      {idx > 0 && (
                        <button className="btn ghost small" onClick={() => updateRow('issues', i.id, { status: ORDER[idx - 1] })}>
                          {t('move_back')}
                        </button>
                      )}
                      <span className="spacer" />
                      {idx < ORDER.length - 1 && (
                        <button className="btn small" onClick={() => updateRow('issues', i.id, { status: ORDER[idx + 1] })}>
                          {t('is_' + ORDER[idx + 1])}
                          <Icon name="arrow" size={13} className="flip-rtl" />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </Glass>
          );
        })}
      </div>

      {pinView && <DrawingViewer drawing={data.drawings.find((d) => d.id === pinView.drawing_id)} focusIssue={pinView.id} onClose={() => setPinView(null)} />}
      {editing && (
        <EntityForm
          title={editing.id ? t('edit_issue') : t('new_issue')}
          fields={fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => (editing.id ? updateRow('issues', editing.id, v) : addRow('issues', { ...v, created_by: user.id }))}
          onDelete={editing.id && lead ? () => removeRow('issues', editing.id) : null}
        />
      )}
    </>
  );
}
