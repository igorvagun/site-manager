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

// Working week: Sunday–Friday (Saturday off).
export function workingDays(start, end) {
  if (!start || !end) return 0;
  const s = parseISO(start);
  const e = parseISO(end);
  if (s > e) return 0;
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    if (cur.getDay() !== 6) count++;
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
  return new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', opts).format(parseISO(iso));
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
