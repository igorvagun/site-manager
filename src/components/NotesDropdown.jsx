import { useState } from 'react';

export default function NotesDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const save = () => {
    onChange(draft);
    setOpen(false);
  };

  return (
    <div className="notes-wrap">
      <div
        className="notes-trigger"
        onClick={() => {
          setDraft(value);
          setOpen(!open);
        }}
      >
        📝 {value ? value.slice(0, 18) + (value.length > 18 ? '…' : '') : 'הערה...'}
      </div>
      {open && (
        <div className="notes-popup">
          <textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="הוסף הערה..."
            autoFocus
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
            <button
              className="btn-xs"
              style={{ background: 'var(--muted)', color: 'var(--bg)' }}
              onClick={() => setOpen(false)}
            >
              ביטול
            </button>
            <button className="btn-xs" onClick={save}>
              שמור
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
