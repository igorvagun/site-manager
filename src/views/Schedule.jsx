import { useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useData, useUser, addRow, updateRow, removeRow, notify } from '../lib/store';
import { useOptions, TASK_STATUS } from '../lib/constants';
import { TEMPLATES } from '../lib/templates';
import { Glass, Badge, Segmented, Icon, IconButton, EntityForm, Empty, PageHead, SearchBox } from '../components/ui';
import { todayISO, addDays, diffDays, parseISO, fmtDate, fmtMoney, workingDays, taskBudget, plannedProgress, exportCSV, clamp, toISO } from '../lib/utils';

// A task that "follows" another must start after it ends.
export const dependencyOf = (task, tasks) => (task.depends_on ? tasks.find((x) => x.id === task.depends_on && x.id !== task.id) : null);
export const dependencyConflict = (task, tasks) => {
  const dep = dependencyOf(task, tasks);
  return dep && task.status !== 'done' && task.start_date <= dep.end_date ? dep : null;
};
const nextWorkday = (iso) => {
  let d = addDays(iso, 1);
  while (parseISO(d).getDay() === 6) d = addDays(d, 1);
  return d;
};
// Move a task to start right after its predecessor, keeping its length, then push on anything that follows it.
export function shiftPlan(task, tasks) {
  const moves = [];
  const dates = new Map(tasks.map((x) => [x.id, { start: x.start_date, end: x.end_date }]));
  const visit = (x, seen) => {
    if (seen.has(x.id)) return;
    seen.add(x.id);
    const dep = dependencyOf(x, tasks);
    if (!dep || x.status === 'done') return;
    const depEnd = dates.get(dep.id).end;
    const cur = dates.get(x.id);
    if (cur.start > depEnd) return;
    const start = nextWorkday(depEnd);
    const end = addDays(start, diffDays(cur.start, cur.end));
    dates.set(x.id, { start, end });
    moves.push({ id: x.id, name: x.name, start_date: start, end_date: end });
    tasks.filter((y) => y.depends_on === x.id).forEach((y) => visit(y, seen));
  };
  visit(task, new Set());
  return moves;
}

export function useTaskFields() {
  const { t } = useI18n();
  const o = useOptions();
  const { workers, tasks } = useData();
  return [
    { key: 'name', label: t('task_name'), required: true, placeholder: t('task_name_ph') },
    { key: 'floor', label: t('floor'), type: 'select', options: o.floors, half: true },
    { key: 'status', label: t('status'), type: 'select', options: o.taskStatus, half: true },
    { key: 'start_date', label: t('start'), type: 'date', required: true, half: true },
    { key: 'end_date', label: t('end'), type: 'date', required: true, half: true },
    { key: 'daily_cost', label: t('daily_cost'), type: 'number', min: 0, half: true },
    { key: 'progress', label: t('progress'), type: 'range', half: true },
    { key: 'depends_on', label: t('follows_task'), type: 'select', options: [{ value: '', label: t('no_dependency') }, ...[...tasks].sort((a, b) => (a.position || 0) - (b.position || 0)).map((x) => ({ value: x.id, label: x.name }))] },
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
                    className={`gantt-bar tone-${TASK_STATUS[x.status] || 'neutral'} ${dependencyConflict(x, tasks) ? 'clash' : ''}`}
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
  const [templating, setTemplating] = useState(false);
  // Workers can read the schedule; planning and money are for managers and foremen.
  const canEdit = useUser().role !== 'worker';
  const [savingTpl, setSavingTpl] = useState(false);
  // Built-in templates plus the ones saved from real schedules: key → [[name, working days, cost per day], …]
  const custom = data.templates || [];
  const templateSteps = (key) => (TEMPLATES[key] ? TEMPLATES[key].map(([k, d, c]) => [t(k), d, c]) : (custom.find((x) => x.id === key)?.steps || []).map((x) => [x.name, x.days, x.cost]));
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
  const shift = (x) => {
    const moves = shiftPlan(x, all);
    moves.forEach((m) => updateRow('tasks', m.id, { start_date: m.start_date, end_date: m.end_date }));
    if (moves.length) notify('schedule_shifted');
  };
  const blank = {
    depends_on: '',
    name: '', floor: 'א', status: 'pending', start_date: today, end_date: addDays(today, 14), daily_cost: '', progress: 0, workers: [], notes: '',
    position: (Math.max(0, ...all.map((x) => x.position || 0)) || 0) + 1,
  };

  return (
    <>
      <PageHead title={t('nav_schedule')} subtitle={`${visible.length} ${t('tasks_shown')}${canEdit ? ` · ${fmtMoney(visible.reduce((s, x) => s + taskBudget(x), 0), cur)}` : ''}`}>
        {canEdit && (
          <>
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
        <button className="btn" onClick={() => setTemplating(true)}>
          <Icon name="layers" size={16} />
          {t('from_template')}
        </button>
        <button className="btn" onClick={() => setSavingTpl(true)} disabled={visible.length === 0} title={t('save_template_hint')}>
          <Icon name="upload" size={16} />
          {t('save_template')}
        </button>
        <button className="btn primary" onClick={() => setEditing(blank)}>
          <Icon name="plus" size={16} />
          {t('new_task')}
        </button>
          </>
        )}
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
        <Gantt tasks={visible} onEdit={canEdit ? setEditing : () => {}} />
      ) : visible.length === 0 ? (
        <Glass><Empty icon="calendar" text={t('no_tasks')} /></Glass>
      ) : (
        <div className="task-list">
          {visible.map((x) => {
            const late = x.status !== 'done' && x.end_date < today;
            const behind = x.status !== 'done' && x.progress < plannedProgress(x, today) - 10;
            const days = workingDays(x.start_date, x.end_date);
            const dep = dependencyOf(x, all);
            const clash = dependencyConflict(x, all);
            return (
              <Glass className="task-row" key={x.id}>
                {!filtered && canEdit && (
                  <div className="reorder">
                    <IconButton icon="up" label={t('move_up')} size={14} onClick={() => move(x, -1)} disabled={all.indexOf(x) === 0} />
                    <IconButton icon="down" label={t('move_down')} size={14} onClick={() => move(x, 1)} disabled={all.indexOf(x) === all.length - 1} />
                  </div>
                )}
                <div className="task-main">
                  <button className="task-title" onClick={() => canEdit && setEditing({ ...x, depends_on: x.depends_on || '' })}>{x.name}</button>
                  <div className="task-meta">
                    <span className="tag">{o.floorLabel(x.floor)}</span>
                    <span className={late ? 'warn-text' : ''}>
                      {fmtDate(x.start_date, lang)} – {fmtDate(x.end_date, lang)}
                    </span>
                    <span>{days} {t('work_days')}</span>
                    {canEdit && <span>{fmtMoney(x.daily_cost, cur)}/{t('day')} · {fmtMoney(taskBudget(x), cur)}</span>}
                    {(late || behind) && <Badge tone="red">{late ? t('past_due') : t('behind')}</Badge>}
                  </div>
                  {dep && (
                    <div className="task-meta">
                      <span className={clash ? 'warn-text' : ''}>
                        ↳ {t('dep_after')}: {dep.name} ({fmtDate(dep.end_date, lang)})
                      </span>
                      {clash && (
                        <>
                          <Badge tone="red">{t('dep_conflict')}</Badge>
                          <button className="btn small" onClick={() => shift(x)} hidden={!canEdit}>
                            <Icon name="arrow" size={13} className="flip-rtl" />
                            {t('shift_schedule')}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {(x.workers?.length > 0 || x.notes) && (
                    <div className="task-meta">
                      {(x.workers || []).map((w) => <span className="avatar-chip" key={w}><i>{w.slice(0, 1)}</i>{w}</span>)}
                      {x.notes && <span className="note"><Icon name="edit" size={12} /> {x.notes}</span>}
                    </div>
                  )}
                </div>
                <div className="task-progress">
                  <input
                    type="range" min={0} max={100} step={5} value={x.progress || 0} disabled={!canEdit}
                    aria-label={t('progress')}
                    onChange={(e) => patch(x, { progress: Number(e.target.value) })}
                    style={{ '--pct': (x.progress || 0) + '%' }}
                    className={`tone-${TASK_STATUS[x.status] || 'neutral'}`}
                  />
                  <b>{x.progress || 0}%</b>
                </div>
                <label className={`status-select badge tone-${TASK_STATUS[x.status] || 'neutral'}`}>
                  <select value={x.status} onChange={(e) => patch(x, { status: e.target.value })} aria-label={t('status')} disabled={!canEdit}>
                    {o.taskStatus.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  {t('st_' + x.status)}
                  <Icon name="down" size={12} />
                </label>
                {canEdit && <IconButton icon="edit" label={t('edit')} onClick={() => setEditing({ ...x, depends_on: x.depends_on || '' })} />}
              </Glass>
            );
          })}
        </div>
      )}

      {savingTpl && (
        <EntityForm
          title={t('save_template')}
          fields={[
            { key: 'name', label: t('template_name'), required: true, placeholder: t('template_name_ph') },
            { key: 'drop', label: t('template_replace'), type: 'select', options: [{ value: '', label: '—' }, ...custom.map((x) => ({ value: x.id, label: x.name }))], when: () => custom.length > 0 },
          ]}
          initial={{ name: '', drop: '' }}
          onClose={() => setSavingTpl(false)}
          onSave={(v) => {
            // The tasks on screen, in order, with their working-day lengths and daily cost.
            const steps = visible.map((x) => ({ name: x.name, days: Math.max(1, workingDays(x.start_date, x.end_date)), cost: Number(x.daily_cost) || 0 }));
            if (v.drop) removeRow('templates', v.drop, { silent: true });
            addRow('templates', { name: v.name.trim(), steps });
            notify('template_saved');
          }}
        />
      )}
      {templating && (
        <EntityForm
          title={t('from_template')}
          fields={[
            { key: 'template', label: t('template'), type: 'select', options: [...Object.keys(TEMPLATES).map((k) => ({ value: k, label: `${t('tplset_' + k)} · ${TEMPLATES[k].length}` })), ...custom.map((x) => ({ value: x.id, label: `★ ${x.name} · ${x.steps.length}` }))] },
            { key: 'start_date', label: t('start'), type: 'date', required: true, half: true },
            { key: 'floor', label: t('floor'), type: 'select', options: o.floors, half: true },
            { key: 'suffix', label: t('template_suffix'), placeholder: t('template_suffix_ph') },
          ]}
          initial={{ template: 'floor_cycle', start_date: all.length ? nextWorkday([...all].map((x) => x.end_date).sort().pop()) : today, floor: 'א', suffix: '' }}
          onClose={() => setTemplating(false)}
          onSave={async (v) => {
            // Each step starts the working day after the previous one ends and depends on it.
            let start = v.start_date;
            let prev = null;
            let pos = Math.max(0, ...all.map((x) => x.position || 0));
            for (const [stepName, days, cost] of templateSteps(v.template)) {
              let end = start;
              for (let n = 1; n < days; n++) end = nextWorkday(end);
              const row = await addRow('tasks', {
                name: [stepName, v.suffix.trim()].filter(Boolean).join(' — '),
                floor: v.floor, status: 'pending', progress: 0, start_date: start, end_date: end, daily_cost: cost,
                workers: [], notes: '', description: '', media: [], drawing_id: null, depends_on: prev, position: ++pos,
              });
              prev = row?.id || null;
              start = nextWorkday(end);
            }
            notify('template_added');
          }}
        />
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
            v.depends_on = v.depends_on && v.depends_on !== editing.id ? v.depends_on : null;
            editing.id ? updateRow('tasks', editing.id, v) : addRow('tasks', v);
          }}
          onDelete={editing.id ? () => removeRow('tasks', editing.id) : null}
        />
      )}
    </>
  );
}
