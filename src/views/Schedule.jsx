import { useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useData, addRow, updateRow, removeRow } from '../lib/store';
import { useOptions, TASK_STATUS } from '../lib/constants';
import { Glass, Badge, Segmented, Icon, IconButton, EntityForm, Empty, PageHead, SearchBox } from '../components/ui';
import { todayISO, addDays, diffDays, parseISO, fmtDate, fmtMoney, workingDays, taskBudget, plannedProgress, exportCSV, clamp, toISO } from '../lib/utils';

export function useTaskFields() {
  const { t } = useI18n();
  const o = useOptions();
  const { workers } = useData();
  return [
    { key: 'name', label: t('task_name'), required: true, placeholder: t('task_name_ph') },
    { key: 'floor', label: t('floor'), type: 'select', options: o.floors, half: true },
    { key: 'status', label: t('status'), type: 'select', options: o.taskStatus, half: true },
    { key: 'start_date', label: t('start'), type: 'date', required: true, half: true },
    { key: 'end_date', label: t('end'), type: 'date', required: true, half: true },
    { key: 'daily_cost', label: t('daily_cost'), type: 'number', min: 0, half: true },
    { key: 'progress', label: t('progress'), type: 'range', half: true },
    { key: 'workers', label: t('assigned_workers'), type: 'chips', options: workers.filter((w) => w.active !== false).map((w) => ({ value: w.name, label: w.name })) },
    { key: 'notes', label: t('notes'), type: 'textarea' },
  ];
}

function Gantt({ tasks, onEdit }) {
  const { t, lang } = useI18n();
  const today = todayISO();
  const { start, total, months } = useMemo(() => {
    const dates = tasks.flatMap((x) => [x.start_date, x.end_date]).filter(Boolean).sort();
    const s0 = parseISO(dates[0] || today);
    s0.setDate(1);
    const e0 = parseISO(dates[dates.length - 1] || today);
    e0.setMonth(e0.getMonth() + 1, 0);
    const start = toISO(s0);
    const total = diffDays(start, toISO(e0)) + 1;
    const months = [];
    const m = new Date(s0);
    while (m <= e0) {
      const iso = toISO(m);
      const next = new Date(m.getFullYear(), m.getMonth() + 1, 1);
      months.push({ iso, left: (diffDays(start, iso) / total) * 100, width: (diffDays(iso, toISO(next)) / total) * 100 });
      m.setMonth(m.getMonth() + 1);
    }
    return { start, total, months };
  }, [tasks, today]);

  const pos = (iso) => (clamp(diffDays(start, iso), 0, total) / total) * 100;
  const todayPos = today >= start && diffDays(start, today) <= total ? pos(today) : null;

  if (!tasks.length) return <Empty icon="calendar" text={t('no_tasks')} />;
  return (
    <Glass className="gantt">
      <div className="gantt-scroll">
        <div className="gantt-inner" style={{ minWidth: Math.max(720, months.length * 96 + 220) }}>
          <div className="gantt-row gantt-headrow">
            <div className="gantt-name">{t('task')}</div>
            <div className="gantt-track">
              {months.map((m) => (
                <div key={m.iso} className="gantt-month" style={{ insetInlineStart: m.left + '%', width: m.width + '%' }}>
                  {fmtDate(m.iso, lang, { month: 'short', year: '2-digit' })}
                </div>
              ))}
            </div>
          </div>
          {tasks.map((x) => {
            const left = pos(x.start_date);
            const width = Math.max(1.2, pos(addDays(x.end_date, 1)) - left);
            return (
              <div className="gantt-row" key={x.id}>
                <button className="gantt-name" onClick={() => onEdit(x)} title={x.name}>
                  <i className={`status-dot bg-${TASK_STATUS[x.status] || 'neutral'}`} />
                  <span>{x.name}</span>
                </button>
                <div className="gantt-track">
                  {months.map((m) => (
                    <div key={m.iso} className="gantt-col" style={{ insetInlineStart: m.left + '%', width: m.width + '%' }} />
                  ))}
                  {todayPos != null && <div className="gantt-today" style={{ insetInlineStart: todayPos + '%' }} />}
                  <button
                    className={`gantt-bar tone-${TASK_STATUS[x.status] || 'neutral'}`}
                    style={{ insetInlineStart: left + '%', width: width + '%' }}
                    onClick={() => onEdit(x)}
                    title={`${x.name} · ${fmtDate(x.start_date, lang)} – ${fmtDate(x.end_date, lang)} · ${x.progress}%`}
                  >
                    <i style={{ width: x.progress + '%' }} />
                    <span>{x.progress}%</span>
                  </button>
                </div>
              </div>
            );
          })}
          {todayPos != null && (
            <div className="gantt-row gantt-footrow">
              <div className="gantt-name" />
              <div className="gantt-track">
                <div className="gantt-today-label" style={{ insetInlineStart: todayPos + '%' }}>{t('today')}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Glass>
  );
}

export default function Schedule() {
  const { t, lang } = useI18n();
  const data = useData();
  const o = useOptions();
  const fields = useTaskFields();
  const cur = data.project[0]?.currency || '₪';
  const [mode, setMode] = useState('list');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [floor, setFloor] = useState('');
  const [editing, setEditing] = useState(null);
  const today = todayISO();

  const all = useMemo(() => [...data.tasks].sort((a, b) => (a.position || 0) - (b.position || 0)), [data.tasks]);
  const visible = all.filter(
    (x) => (!status || x.status === status) && (!floor || x.floor === floor) && (!q || x.name.toLowerCase().includes(q.toLowerCase()))
  );
  const filtered = !!(q || status || floor);

  const patch = (x, p) => {
    const next = { ...p };
    if (p.progress === 100) next.status = 'done';
    else if (p.progress != null && p.progress < 100 && x.status === 'done') next.status = 'active';
    if (p.status === 'done') next.progress = 100;
    updateRow('tasks', x.id, next);
  };
  const move = (x, dir) => {
    const i = all.indexOf(x);
    const other = all[i + dir];
    if (!other) return;
    // Renumber so ordering stays stable even if stored positions collide.
    const order = [...all];
    [order[i], order[i + dir]] = [order[i + dir], order[i]];
    order.forEach((r, idx) => {
      if (r.position !== idx + 1) updateRow('tasks', r.id, { position: idx + 1 });
    });
  };
  const blank = {
    name: '', floor: 'א', status: 'pending', start_date: today, end_date: addDays(today, 14), daily_cost: '', progress: 0, workers: [], notes: '',
    position: (Math.max(0, ...all.map((x) => x.position || 0)) || 0) + 1,
  };

  return (
    <>
      <PageHead title={t('nav_schedule')} subtitle={`${visible.length} ${t('tasks_shown')} · ${fmtMoney(visible.reduce((s, x) => s + taskBudget(x), 0), cur)}`}>
        <button
          className="btn"
          onClick={() =>
            exportCSV('schedule.csv', visible, [
              { key: 'name', label: t('task_name') },
              { label: t('floor'), get: (r) => o.floorLabel(r.floor) },
              { label: t('status'), get: (r) => t('st_' + r.status) },
              { key: 'progress', label: t('progress') },
              { key: 'start_date', label: t('start') },
              { key: 'end_date', label: t('end') },
              { key: 'daily_cost', label: t('daily_cost') },
              { key: 'workers', label: t('assigned_workers') },
              { key: 'notes', label: t('notes') },
            ])
          }
        >
          <Icon name="download" size={16} />
          CSV
        </button>
        <button className="btn primary" onClick={() => setEditing(blank)}>
          <Icon name="plus" size={16} />
          {t('new_task')}
        </button>
      </PageHead>

      <Glass className="toolbar">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'list', label: t('list'), icon: 'grid' },
            { value: 'gantt', label: t('gantt'), icon: 'chart' },
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder={t('search_tasks')} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('status')}>
          <option value="">{t('all_statuses')}</option>
          {o.taskStatus.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={floor} onChange={(e) => setFloor(e.target.value)} aria-label={t('floor')}>
          <option value="">{t('all_floors')}</option>
          {o.floors.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {filtered && (
          <button className="btn ghost" onClick={() => { setQ(''); setStatus(''); setFloor(''); }}>
            <Icon name="x" size={14} />
            {t('clear')}
          </button>
        )}
      </Glass>

      {mode === 'gantt' ? (
        <Gantt tasks={visible} onEdit={setEditing} />
      ) : visible.length === 0 ? (
        <Glass><Empty icon="calendar" text={t('no_tasks')} /></Glass>
      ) : (
        <div className="task-list">
          {visible.map((x) => {
            const late = x.status !== 'done' && x.end_date < today;
            const behind = x.status !== 'done' && x.progress < plannedProgress(x, today) - 10;
            const days = workingDays(x.start_date, x.end_date);
            return (
              <Glass className="task-row" key={x.id}>
                {!filtered && (
                  <div className="reorder">
                    <IconButton icon="up" label={t('move_up')} size={14} onClick={() => move(x, -1)} disabled={all.indexOf(x) === 0} />
                    <IconButton icon="down" label={t('move_down')} size={14} onClick={() => move(x, 1)} disabled={all.indexOf(x) === all.length - 1} />
                  </div>
                )}
                <div className="task-main">
                  <button className="task-title" onClick={() => setEditing(x)}>{x.name}</button>
                  <div className="task-meta">
                    <span className="tag">{o.floorLabel(x.floor)}</span>
                    <span className={late ? 'warn-text' : ''}>
                      {fmtDate(x.start_date, lang)} – {fmtDate(x.end_date, lang)}
                    </span>
                    <span>{days} {t('work_days')}</span>
                    <span>{fmtMoney(x.daily_cost, cur)}/{t('day')} · {fmtMoney(taskBudget(x), cur)}</span>
                    {(late || behind) && <Badge tone="red">{late ? t('past_due') : t('behind')}</Badge>}
                  </div>
                  {(x.workers?.length > 0 || x.notes) && (
                    <div className="task-meta">
                      {(x.workers || []).map((w) => <span className="avatar-chip" key={w}><i>{w.slice(0, 1)}</i>{w}</span>)}
                      {x.notes && <span className="note"><Icon name="edit" size={12} /> {x.notes}</span>}
                    </div>
                  )}
                </div>
                <div className="task-progress">
                  <input
                    type="range" min={0} max={100} step={5} value={x.progress || 0}
                    aria-label={t('progress')}
                    onChange={(e) => patch(x, { progress: Number(e.target.value) })}
                    style={{ '--pct': (x.progress || 0) + '%' }}
                    className={`tone-${TASK_STATUS[x.status] || 'neutral'}`}
                  />
                  <b>{x.progress || 0}%</b>
                </div>
                <label className={`status-select badge tone-${TASK_STATUS[x.status] || 'neutral'}`}>
                  <select value={x.status} onChange={(e) => patch(x, { status: e.target.value })} aria-label={t('status')}>
                    {o.taskStatus.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  {t('st_' + x.status)}
                  <Icon name="down" size={12} />
                </label>
                <IconButton icon="edit" label={t('edit')} onClick={() => setEditing(x)} />
              </Glass>
            );
          })}
        </div>
      )}

      {editing && (
        <EntityForm
          title={editing.id ? t('edit_task') : t('new_task')}
          fields={fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => {
            if (v.progress === 100) v.status = 'done';
            if (v.status === 'done') v.progress = 100;
            editing.id ? updateRow('tasks', editing.id, v) : addRow('tasks', v);
          }}
          onDelete={editing.id ? () => removeRow('tasks', editing.id) : null}
        />
      )}
    </>
  );
}
