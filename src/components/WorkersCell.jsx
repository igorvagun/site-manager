import { useState } from 'react';
import { WORKERS_LIST } from '../lib/utils';

export default function WorkersCell({ workers, onChange }) {
  const [mode, setMode] = useState('select');
  const [selected, setSelected] = useState('');
  const [custom, setCustom] = useState('');

  const available = WORKERS_LIST.filter((w) => !workers.includes(w));

  const add = () => {
    const name = mode === 'custom' ? custom.trim() : selected;
    if (!name || workers.includes(name)) return;
    onChange([...workers, name]);
    setSelected('');
    setCustom('');
  };

  const remove = (name) => onChange(workers.filter((w) => w !== name));

  return (
    <div className="workers-cell">
      <div className="worker-tags">
        {workers.map((w) => (
          <span key={w} className="worker-tag">
            {w}
            <button className="worker-rm" onClick={() => remove(w)}>
              ✕
            </button>
          </span>
        ))}
      </div>
      <div className="worker-add-row">
        {mode === 'select' ? (
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">+ עובד</option>
            {available.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
            <option value="__custom">אחר...</option>
          </select>
        ) : (
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="שם עובד"
            onKeyDown={(e) => e.key === 'Enter' && add()}
            autoFocus
          />
        )}
        {selected === '__custom' && mode !== 'custom' ? (
          <button className="btn-xs" onClick={() => setMode('custom')}>
            ↵
          </button>
        ) : (
          <button className="btn-xs" onClick={add}>
            +
          </button>
        )}
        {mode === 'custom' && (
          <button
            className="btn-xs"
            style={{ background: 'var(--muted)' }}
            onClick={() => {
              setMode('select');
              setCustom('');
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
