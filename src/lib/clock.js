import { getState, addRow, updateRow } from './store';
import { todayISO, hoursBetween } from './utils';

// Time-clock actions. They also keep the daily attendance record in step,
// so the dashboard head-count and labour totals follow the clock.
const scoped = (name) => getState().data[name].filter((r) => r.project_id === getState().projectId);

export function openShift(workerId) {
  return scoped('shifts').find((s) => s.worker_id === workerId && s.clock_in && !s.clock_out) || null;
}

export function clockIn(worker, byUserId) {
  if (openShift(worker.id)) return;
  const date = todayISO();
  addRow('shifts', { worker_id: worker.id, date, clock_in: new Date().toISOString(), clock_out: null, in_by: byUserId, out_by: null });
  const att = scoped('attendance').find((a) => a.worker_id === worker.id && a.date === date);
  if (!att) addRow('attendance', { worker_id: worker.id, date, status: 'present', hours: 0 });
  else if (att.status !== 'present') updateRow('attendance', att.id, { status: 'present' });
}

export function syncAttendance(workerId, date) {
  const hours = scoped('shifts')
    .filter((s) => s.worker_id === workerId && s.date === date && s.clock_in && s.clock_out)
    .reduce((n, s) => n + hoursBetween(s.clock_in, s.clock_out), 0);
  const rounded = Math.round(hours * 2) / 2;
  const att = scoped('attendance').find((a) => a.worker_id === workerId && a.date === date);
  if (att) updateRow('attendance', att.id, { status: 'present', hours: rounded });
  else addRow('attendance', { worker_id: workerId, date, status: 'present', hours: rounded });
}

export async function clockOut(shift, byUserId) {
  await updateRow('shifts', shift.id, { clock_out: new Date().toISOString(), out_by: byUserId });
  syncAttendance(shift.worker_id, shift.date);
}
