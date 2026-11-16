// Small CSV reader for imports: handles quotes, a BOM, and comma / semicolon / tab separators.
export function parseCSV(text) {
  const src = String(text).replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/)[0] || '';
  const sep = [',', ';', '\t'].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim().replace(/^'(?=[=+\-@])/, ''))).filter((r) => r.some((c) => c !== ''));
}

// "2026-11-16", "16/11/2026", "16.11.26" → "2026-11-16" (day first, as written in Israel and Europe)
export function parseDate(v) {
  const s = String(v || '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/.exec(s);
  if (m) return valid(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  return null;
}
function valid(y, mo, d) {
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
export function parseNumber(v) {
  const s = String(v || '').replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  // "1,234.5" and "1234,5" both occur; the last separator is the decimal one if it is followed by 1–2 digits.
  const n = Number(/[.,]\d{1,2}$/.test(s) ? s.replace(/[.,](?=.*[.,])/g, '').replace(',', '.') : s.replace(/[.,]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
