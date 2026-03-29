import TaskRow from './TaskRow';
import { STATUS_OPTIONS } from '../lib/utils';

export default function TaskTable({
  tasks,
  filterStatus,
  filterFloor,
  search,
  onUpdate,
  onDelete,
  onSwapPriority,
}) {
  const visible = tasks.filter((t) => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterFloor && t.floor !== filterFloor) return false;
    if (search && !t.name.includes(search)) return false;
    return true;
  });

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th style={{ width: 40 }}>עדיפות</th>
            <th>#</th>
            <th>שם משימה</th>
            <th>קומה</th>
            <th>סטטוס</th>
            <th>התקדמות</th>
            <th className="gantt-cell">גאנט</th>
            <th>תאריכים</th>
            <th>עלות/יום</th>
            <th>עובדים</th>
            <th>הערות</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr className="empty-row">
              <td colSpan={12}>// אין משימות תואמות //</td>
            </tr>
          ) : (
            visible.map((task, idx) => {
              const globalIdx = tasks.indexOf(task);
              return (
                <TaskRow
                  key={task.id}
                  task={task}
                  index={idx}
                  globalIndex={globalIdx}
                  totalTasks={tasks.length}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  onSwapPriority={onSwapPriority}
                />
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
