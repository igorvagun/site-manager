export const WORKERS_LIST = [
  'יוסי',
  'משה',
  'אחמד',
  'דוד',
  'קרלוס',
  'ניר',
  'עמיר',
  'סמיר',
  'דניאל',
  'אלי',
];

export const STATUS_OPTIONS = [
  { value: 'pending', label: 'ממתין', cls: 'badge-pending' },
  { value: 'active', label: 'פעיל', cls: 'badge-active' },
  { value: 'done', label: 'בוצע', cls: 'badge-done' },
  { value: 'delayed', label: 'מאחר', cls: 'badge-delayed' },
  { value: 'paused', label: 'עצור', cls: 'badge-paused' },
];

export const FLOOR_OPTIONS = ['מרתף', 'קרקע', 'א', 'ב', 'ג', 'ד', 'גג', 'חוץ'];

export function workingDays(start, end) {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (s > e) return 0;
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    if (cur.getDay() !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function fmtMoney(n) {
  if (n >= 1000000) return '₪' + (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return '₪' + (n / 1000).toFixed(0) + 'K';
  return '₪' + n;
}
