import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { routeQuery } from '../lib/nav';
import { useData, useUser, addRow, updateRow, removeRow, notify } from '../lib/store';
import { putFile, deleteFile } from '../lib/files';
import { useOptions, TASK_STATUS } from '../lib/constants';
import { Glass, Icon, IconButton, Badge, Segmented, EntityForm, Empty, PageHead, SearchBox, Modal } from '../components/ui';
import Chat, { FileView, useRecorder } from '../components/Chat';
import { DrawingViewer, DrawingThumb } from './Drawings';
import { useTaskFields } from './Schedule';
import { todayISO, addDays, fmtDateTime, fmtMoney, fmtMoneyFull, fmtHours, taskLabor, uid } from '../lib/utils';

function useNow(ms = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export const startTask = (task, user) =>
  updateRow('tasks', task.id, { started_at: new Date().toISOString(), finished_at: null, started_by: user.id, status: 'active' });
export const finishTask = (task, user) =>
  updateRow('tasks', task.id, {
    started_at: task.started_at || new Date().toISOString(),
    finished_at: new Date().toISOString(),
    finished_by: user.id,
    status: 'done',
    progress: 100,
  });

function TaskDetail({ task, canEdit, onClose, onEdit }) {
  const { t, lang } = useI18n();
  const data = useData();
  const user = useUser();
  const o = useOptions();
  const now = useNow();
  const cur = data.project[0]?.currency || '₪';
  const [desc, setDesc] = useState(task.description || '');
  const [viewDrawing, setViewDrawing] = useState(false);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef(null);
  const labor = taskLabor(task, data.workers, data.shifts, now);
  const drawing = data.drawings.find((d) => d.id === task.drawing_id);
  const media = task.media || [];

  const addMedia = async (blob, kind) => {
    setBusy(true);
    try {
      const file_id = await putFile(blob);
      await updateRow('tasks', task.id, { media: [...media, { id: uid(), kind, file_id, by: user.name, at: new Date().toISOString() }] });
    } catch (e) {
      console.error(e);
      notify('upload_failed', 'error');
    }
    setBusy(false);
  };
  const rec = useRecorder((blob) => addMedia(blob, 'audio'));
  const removeMedia = (m) => {
    if (!confirm(t('confirm_delete'))) return;
    deleteFile(m.file_id);
    updateRow('tasks', task.id, { media: media.filter((x) => x.id !== m.id) });
  };

  return (
    <Modal title={task.name} onClose={onClose} wide>
      <div className="task-detail">
        <div className="task-side">
          <div className="task-meta">
            <Badge tone={TASK_STATUS[task.status] || 'neutral'}>{t('st_' + task.status)}</Badge>
            <span className="tag">{o.floorLabel(task.floor)}</span>
            {canEdit && (
              <button className="btn ghost small" onClick={onEdit}>
                <Icon name="edit" size={13} />
                {t('edit')}
              </button>
            )}
          </div>

          <div className="task-times">
            <div>
              <span>{t('started')}</span>
              <b>{fmtDateTime(task.started_at, lang)}</b>
            </div>
            <div>
              <span>{t('finished')}</span>
              <b>{fmtDateTime(task.finished_at, lang)}</b>
            </div>
          </div>
          <div className="btn-row">
            {!task.started_at && (
              <button className="btn primary" onClick={() => startTask(task, user)}>
                <Icon name="play" size={15} />
                {t('start_task')}
              </button>
            )}
            {task.started_at && !task.finished_at && (
              <button className="btn primary" onClick={() => finishTask(task, user)}>
                <Icon name="check" size={15} />
                {t('finish_task')}
              </button>
            )}
            {task.finished_at && canEdit && (
              <button className="btn" onClick={() => updateRow('tasks', task.id, { finished_at: null, status: 'active', progress: Math.min(task.progress, 95) })}>
                {t('reopen_task')}
              </button>
            )}
          </div>

          <section>
            <h4>
              {t('labor_cost')} <small title={t('labor_cost_hint')}>ⓘ</small>
            </h4>
            {labor.rows.length === 0 ? (
              <p className="muted">{t('no_workers_assigned')}</p>
            ) : (
              <table className="mini-table">
                <tbody>
                  {labor.rows.map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td className="num">{fmtHours(r.hours)} {t('hrs')} × {fmtMoney(r.rate, cur)}</td>
                      <td className="num">{fmtMoneyFull(r.cost, cur)}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td>{t('total')}</td>
                    <td className="num">{fmtHours(labor.hours)} {t('hrs')}</td>
                    <td className="num">{fmtMoneyFull(labor.cost, cur)}</td>
                  </tr>
                </tbody>
              </table>
            )}
            <small className="muted">{t('labor_cost_hint')}</small>
          </section>

          <section>
            <h4>{t('description')}</h4>
            {canEdit ? (
              <textarea
                rows={3}
                value={desc}
                placeholder={t('task_desc_ph')}
                onChange={(e) => setDesc(e.target.value)}
                onBlur={() => desc !== (task.description || '') && updateRow('tasks', task.id, { description: desc })}
              />
            ) : (
              <p>{task.description || <span className="muted">—</span>}</p>
            )}
            <div className="media-list">
              {media.map((m) => (
                <div className="media-item" key={m.id}>
                  <FileView id={m.file_id} kind={m.kind} />
                  <small>
                    {m.by} · {fmtDateTime(m.at, lang)}
                  </small>
                  {canEdit && <IconButton icon="trash" size={14} label={t('delete')} onClick={() => removeMedia(m)} />}
                </div>
              ))}
            </div>
            {canEdit &&
              (rec.recording ? (
                <div className="chat-input recording">
                  <span className="rec-dot" />
                  <b>{rec.clock}</b>
                  <span className="grow">{rec.label}</span>
                  <button className="btn ghost small" onClick={() => rec.stop(false)}>{t('cancel')}</button>
                  <button className="btn primary small" onClick={() => rec.stop(true)}>{t('save')}</button>
                </div>
              ) : (
                <div className="btn-row">
                  <button className="btn small" onClick={rec.start} disabled={busy}>
                    <Icon name="mic" size={14} />
                    {t('add_voice_note')}
                  </button>
                  <button className="btn small" onClick={() => videoRef.current.click()} disabled={busy}>
                    <Icon name="camera" size={14} />
                    {busy ? t('uploading') : t('add_video_note')}
                  </button>
                  <input
                    ref={videoRef}
                    type="file"
                    accept="video/*"
                    capture="environment"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files[0];
                      e.target.value = '';
                      if (!f) return;
                      if (f.size > 40 * 1024 * 1024) return notify('file_too_big', 'error');
                      addMedia(f, 'video');
                    }}
                  />
                </div>
              ))}
          </section>

          <section>
            <h4>{t('attached_drawing')}</h4>
            {drawing ? (
              <button className="drawing-chip" onClick={() => setViewDrawing(true)}>
                <DrawingThumb drawing={drawing} />
                <span>
                  <b>{drawing.number}</b>
                  {drawing.title}
                </span>
              </button>
            ) : (
              <p className="muted">{t('no_drawing_attached')}</p>
            )}
          </section>
        </div>

        <div className="task-chat">
          <h4>
            <Icon name="chat" size={15} /> {t('task_chat')}
          </h4>
          <Chat thread={'task:' + task.id} emptyText={t('task_chat_empty')} />
        </div>
      </div>
      {viewDrawing && drawing && <DrawingViewer drawing={drawing} onClose={() => setViewDrawing(false)} />}
    </Modal>
  );
}

export default function TaskJournal() {
  const { t, lang } = useI18n();
  const data = useData();
  const user = useUser();
  const o = useOptions();
  const now = useNow();
  const cur = data.project[0]?.currency || '₪';
  const canEdit = user.role !== 'worker';
  const me = data.workers.find((w) => w.user_id === user.id);
  const baseFields = useTaskFields();
  const [tab, setTab] = useState('active');
  const [q, setQ] = useState(routeQuery);
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(null);
  const today = todayISO();

  // Workers see only the tasks they are assigned to.
  const mine = canEdit ? data.tasks : data.tasks.filter((x) => me && (x.workers || []).includes(me.name));
  const group = (x) => (x.finished_at || x.status === 'done' ? 'done' : x.started_at ? 'active' : 'planned');
  const list = mine
    // A search looks through every tab, not just the selected one.
    .filter((x) => (q ? x.name.toLowerCase().includes(q.toLowerCase()) : group(x) === tab))
    .sort((a, b) => (tab === 'done' ? String(b.finished_at).localeCompare(String(a.finished_at)) : (a.position || 0) - (b.position || 0)));
  const count = (g) => mine.filter((x) => group(x) === g).length;
  const open = data.tasks.find((x) => x.id === openId);

  const fields = [
    ...baseFields.filter((f) => !['progress', 'notes'].includes(f.key)),
    { key: 'drawing_id', label: t('attached_drawing'), type: 'select', options: [{ value: '', label: '—' }, ...data.drawings.map((d) => ({ value: d.id, label: `${d.number || ''} ${d.title}`.trim() }))] },
    { key: 'description', label: t('description'), type: 'textarea', placeholder: t('task_desc_ph') },
  ];
  const blank = {
    name: '', floor: 'א', status: 'pending', start_date: today, end_date: addDays(today, 7), daily_cost: '', progress: 0, workers: [], notes: '',
    description: '', drawing_id: '', depends_on: '', media: [], position: Math.max(0, ...data.tasks.map((x) => x.position || 0)) + 1,
  };

  return (
    <>
      <PageHead title={t('nav_tasklog')} subtitle={t('tasklog_sub')}>
        {canEdit && (
          <button className="btn primary" onClick={() => setEditing(blank)}>
            <Icon name="plus" size={16} />
            {t('new_task')}
          </button>
        )}
      </PageHead>

      <Glass className="toolbar">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'active', label: t('tab_active'), count: count('active') },
            { value: 'planned', label: t('tab_planned'), count: count('planned') },
            { value: 'done', label: t('tab_done'), count: count('done') },
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder={t('search_tasks')} />
      </Glass>

      {list.length === 0 ? (
        <Glass><Empty icon="chat" text={t('no_tasks')} /></Glass>
      ) : (
        <div className="grid job-grid">
          {list.map((x) => {
            const labor = taskLabor(x, data.workers, data.shifts, now);
            const msgs = data.messages.filter((m) => m.thread === 'task:' + x.id && !m.deleted).length;
            const g = group(x);
            return (
              <Glass className="job" key={x.id}>
                <header>
                  <button className="task-title" onClick={() => setOpenId(x.id)}>{x.name}</button>
                  <Badge tone={TASK_STATUS[x.status] || 'neutral'}>{t('st_' + x.status)}</Badge>
                </header>
                <div className="task-meta">
                  <span className="tag">{o.floorLabel(x.floor)}</span>
                  {(x.workers || []).map((w) => (
                    <span className="avatar-chip" key={w}><i>{w.slice(0, 1)}</i>{w}</span>
                  ))}
                  {(x.workers || []).length === 0 && <span className="muted">{t('no_workers_assigned')}</span>}
                </div>
                <div className="job-facts">
                  <div>
                    <span>{g === 'done' ? t('finished') : t('started')}</span>
                    <b>{fmtDateTime(g === 'done' ? x.finished_at : x.started_at, lang)}</b>
                  </div>
                  <div>
                    <span>{t('labor_hours')}</span>
                    <b>{fmtHours(labor.hours)}</b>
                  </div>
                  <div>
                    <span>{t('labor_cost')}</span>
                    <b>{fmtMoney(labor.cost, cur)}</b>
                  </div>
                </div>
                <footer>
                  <button className="btn small" onClick={() => setOpenId(x.id)}>
                    <Icon name="chat" size={14} />
                    {t('open_task')}
                    {msgs > 0 && <span className="seg-count">{msgs}</span>}
                  </button>
                  {x.drawing_id && <span className="tag"><Icon name="layers" size={12} /> {t('drawing')}</span>}
                  {(x.media || []).length > 0 && <span className="tag"><Icon name="mic" size={12} /> {(x.media || []).length}</span>}
                  <span className="spacer" />
                  {g === 'planned' && (
                    <button className="btn primary small" onClick={() => startTask(x, user)}>
                      <Icon name="play" size={13} />
                      {t('start_task')}
                    </button>
                  )}
                  {g === 'active' && (
                    <button className="btn primary small" onClick={() => finishTask(x, user)}>
                      <Icon name="check" size={13} />
                      {t('finish_task')}
                    </button>
                  )}
                </footer>
              </Glass>
            );
          })}
        </div>
      )}

      {open && !editing && <TaskDetail task={open} canEdit={canEdit} onClose={() => setOpenId(null)} onEdit={() => setEditing({ ...blank, ...open, drawing_id: open.drawing_id || '' })} />}
      {editing && (
        <EntityForm
          title={editing.id ? t('edit_task') : t('new_task')}
          fields={fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => {
            const row = { ...v, drawing_id: v.drawing_id || null, depends_on: v.depends_on && v.depends_on !== editing.id ? v.depends_on : null };
            editing.id ? updateRow('tasks', editing.id, row) : addRow('tasks', row);
          }}
          onDelete={
            editing.id
              ? () => {
                  (editing.media || []).forEach((m) => deleteFile(m.file_id));
                  data.messages.filter((m) => m.thread === 'task:' + editing.id).forEach((m) => {
                    if (m.file_id) deleteFile(m.file_id);
                    removeRow('messages', m.id);
                  });
                  setOpenId(null);
                  removeRow('tasks', editing.id);
                }
              : null
          }
        />
      )}
    </>
  );
}
