export const LOCALES = { he: 'he-IL', en: 'en-GB', ru: 'ru-RU' };
export const locale = (lang) => LOCALES[lang] || 'en-GB';
// Working calendar of the project currently being computed: rest days (0 = Sunday … 6 = Saturday)
// and the standard shift. Set from the open project; defaults to Sunday–Friday, 07:00–16:00.
const DEFAULT_CAL = { rest: [6], start: 7, end: 16 };
let cal = DEFAULT_CAL;
const hm = (v, fallback) => {
  if (typeof v === 'number') return v;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v || '');
  return m ? Number(m[1]) + Number(m[2]) / 60 : fallback;
};
export function setWorkCalendar(project) {
  if (!project) return (cal = DEFAULT_CAL);
  const rest = Array.isArray(project.rest_days) ? project.rest_days.map(Number).filter((n) => n >= 0 && n <= 6) : DEFAULT_CAL.rest;
  const start = hm(project.shift_start, DEFAULT_CAL.start);
  const end = hm(project.shift_end, DEFAULT_CAL.end);
  // Never allow a week with no working day, or a shift that ends before it starts.
  cal = { rest: rest.length < 7 ? rest : DEFAULT_CAL.rest, start, end: end > start ? end : start + 9 };
  return cal;
}
export const workCalendar = () => cal;
export const isRestDay = (d) => cal.rest.includes((typeof d === 'string' ? parseISO(d) : d).getDay());
export const shiftHours = () => cal.end - cal.start;
export const nextWorkday = (iso) => {
  let d = addDays(iso, 1);
  for (let i = 0; i < 7 && isRestDay(d); i++) d = addDays(d, 1);
  return d;
};
const at = (day, hours) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(hours), Math.round((hours % 1) * 60));

export const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());
export const parseISO = (s) => {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
export const addDays = (iso, n) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
export const diffDays = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
export const uid = () =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));

// Working days between two dates, by the project's working calendar.
export function workingDays(start, end) {
  if (!start || !end) return 0;
  const s = parseISO(start);
  const e = parseISO(end);
  if (s > e) return 0;
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    if (!cal.rest.includes(cur.getDay())) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function fmtMoney(n, currency = '₪') {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (a >= 1e6) return `${sign}${currency}${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e4) return `${sign}${currency}${Math.round(a / 1e3)}K`;
  return `${sign}${currency}${Math.round(a).toLocaleString('en-US')}`;
}
export const fmtMoneyFull = (n, currency = '₪') => `${currency}${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

export function fmtDate(iso, lang = 'he', opts = { day: 'numeric', month: 'short' }) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(locale(lang), opts).format(parseISO(iso));
}

export const sum = (arr, fn = (x) => x) => arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0);
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

export function taskBudget(t) {
  return workingDays(t.start_date, t.end_date) * (Number(t.daily_cost) || 0);
}

// Expected % complete today if the task ran linearly between its dates.
export function plannedProgress(t, today = todayISO()) {
  if (!t.start_date || !t.end_date) return 0;
  if (today < t.start_date) return 0;
  if (today >= t.end_date) return 100;
  const total = workingDays(t.start_date, t.end_date) || 1;
  return Math.round((workingDays(t.start_date, today) / total) * 100);
}

export function downloadFile(name, content, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function exportCSV(name, rows, columns) {
  const esc = (v) => {
    let s = v == null ? '' : Array.isArray(v) ? v.join('; ') : String(v);
    // Neutralise spreadsheet formula injection.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => esc(c.get ? c.get(r) : r[c.key])).join(',')).join('\n');
  downloadFile(name, '﻿' + head + '\n' + body, 'text/csv;charset=utf-8');
}

// Downscale a picked image so it fits comfortably in storage.
export function resizeImage(file, max = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export const fmtTime = (ts, lang = 'he') =>
  ts ? new Date(ts).toLocaleTimeString(locale(lang), { hour: '2-digit', minute: '2-digit' }) : '—';
export const fmtDateTime = (ts, lang = 'he') =>
  ts ? `${fmtDate(toISO(new Date(ts)), lang)} ${fmtTime(ts, lang)}` : '—';
export const fmtHours = (h) => (Math.round((Number(h) || 0) * 10) / 10).toLocaleString('en-US');
export const hoursBetween = (a, b) => Math.max(0, (new Date(b) - new Date(a)) / 3600000);
export const hourlyRate = (w) => Number(w?.hourly_rate) || (Number(w?.daily_rate) || 0) / (shiftHours() || 9);


// Hours one worker spent inside [start, end]: overlap with their clocked shifts on each day,
// or with the project's standard shift on working days when they have no clock entry that day.
export function laborHours(start, end, workerShifts = []) {
  const from = new Date(start);
  const to = new Date(end);
  if (!(to > from)) return 0;
  let total = 0;
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < 400 && day <= to; i++) {
    const iso = toISO(day);
    const clocked = workerShifts.filter((s) => s.date === iso && s.clock_in);
    const spans = clocked.length
      ? clocked.map((s) => [new Date(s.clock_in), s.clock_out ? new Date(s.clock_out) : to])
      : cal.rest.includes(day.getDay())
      ? []
      : [[at(day, cal.start), at(day, cal.end)]];
    spans.forEach(([a, b]) => {
      const lo = Math.max(a, from);
      const hi = Math.min(b, to);
      if (hi > lo) total += (hi - lo) / 3600000;
    });
    day.setDate(day.getDate() + 1);
  }
  return total;
}

// Labour hours and cost of a task from its start/finish marks and its crew's hourly rates.
export function taskLabor(task, workers, shifts, now = new Date()) {
  if (!task.started_at) return { hours: 0, cost: 0, rows: [] };
  const end = task.finished_at || now;
  const rows = (task.workers || []).map((name) => {
    const w = workers.find((x) => x.name === name);
    const hours = laborHours(task.started_at, end, w ? shifts.filter((s) => s.worker_id === w.id) : []);
    const rate = hourlyRate(w);
    return { name, hours, rate, cost: hours * rate };
  });
  return { hours: sum(rows, (r) => r.hours), cost: sum(rows, (r) => r.cost), rows };
}
