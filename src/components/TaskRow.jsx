import StatusBadge from './StatusBadge';
import GanttBar from './GanttBar';
import WorkersCell from './WorkersCell';
import NotesDropdown from './NotesDropdown';
import { STATUS_OPTIONS, fmtMoney } from '../lib/utils';

export default function TaskRow({
  task,
  index,
  globalIndex,
  totalTasks,
  onUpdate,
  onDelete,
  onSwapPriority,
}) {
  return (
    <tr key={task.id}>
      <td>
        <div className="swap-btns">
          <button
            className="swap-btn"
            onClick={() => onSwapPriority(globalIndex, -1)}
            disabled={globalIndex === 0}
          >
            ▲
          </button>
          <button
            className="swap-btn"
            onClick={() => onSwapPriority(globalIndex, 1)}
            disabled={globalIndex === totalTasks - 1}
          >
            ▼
          </button>
        </div>
      </td>

      <td style={{ fontFamily: 'var(--mono)', color: 'var(--muted)', fontSize: 12 }}>
        {index + 1}
      </td>

      <td style={{ fontWeight: 600, minWidth: 160 }}>{task.name}</td>

      <td>
        <span className="floor-tag">{task.floor}</span>
      </td>

      <td>
        <select
          value={task.status}
          onChange={(e) => onUpdate(task.id, { status: e.target.value })}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            outline: 'none',
            padding: 0,
            color: 'inherit',
          }}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <StatusBadge status={task.status} />
      </td>

      <td>
        <div className="progress-wrap">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={task.progress}
            onChange={(e) => onUpdate(task.id, { progress: parseInt(e.target.value) })}
          />
          <span className="progress-val">{task.progress}%</span>
        </div>
      </td>

      <td className="gantt-cell">
        <GanttBar task={task} />
      </td>

      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
        {task.start_date}
        <br />
        {task.end_date}
      </td>

      <td>
        <span className="cost-val">{fmtMoney(task.daily_cost)}</span>
      </td>

      <td>
        <WorkersCell
          workers={task.workers || []}
          onChange={(w) => onUpdate(task.id, { workers: w })}
        />
      </td>

      <td>
        <NotesDropdown
          value={task.notes || ''}
          onChange={(n) => onUpdate(task.id, { notes: n })}
        />
      </td>

      <td>
        <button
          className="btn btn-danger"
          style={{ padding: '4px 8px', fontSize: 11 }}
          onClick={() => {
            if (confirm(`מחק "${task.name}"?`)) onDelete(task.id);
          }}
        >
          ✕
        </button>
      </td>
    </tr>
  );
}
