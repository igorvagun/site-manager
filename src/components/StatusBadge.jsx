import { STATUS_OPTIONS } from '../lib/utils';

export default function StatusBadge({ status }) {
  const s = STATUS_OPTIONS.find((x) => x.value === status) || STATUS_OPTIONS[0];
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}
