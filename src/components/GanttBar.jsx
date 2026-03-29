import { workingDays } from '../lib/utils';

export default function GanttBar({ task }) {
  const days = workingDays(task.start_date, task.end_date);
  const done = Math.round((days * task.progress) / 100);
  const colors = {
    done: '#00ff9d',
    active: '#00d4ff',
    pending: '#4a5a6b',
    delayed: '#ff3860',
    paused: '#ffd700',
  };
  const color = colors[task.status] || '#4a5a6b';
  const pct = days > 0 ? (done / days) * 100 : 0;

  return (
    <div className="gantt-wrap" title={`${done}/${days} ימי עבודה`}>
      <div
        className="gantt-bar"
        style={{
          width: pct + '%',
          background: `linear-gradient(90deg, ${color}88, ${color})`,
        }}
      />
      <div className="gantt-days">{days}י</div>
    </div>
  );
}
