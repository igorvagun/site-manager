import { useState, useMemo } from 'react';
import { STATUS_OPTIONS, FLOOR_OPTIONS, workingDays, fmtMoney } from '../lib/utils';

const EMPTY_FORM = {
  name: '',
  floor: 'א',
  status: 'pending',
  startDate: '',
  endDate: '',
  dailyCost: '',
  notes: '',
};

export default function AddTaskModal({ onClose, onAdd }) {
  const [form, setForm] = useState(EMPTY_FORM);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const days = workingDays(form.startDate, form.endDate);
  const totalCost = useMemo(() => days * (parseInt(form.dailyCost) || 0), [days, form.dailyCost]);

  const submit = () => {
    if (!form.name.trim() || !form.startDate || !form.endDate) return;
    onAdd({
      ...form,
      dailyCost: parseInt(form.dailyCost) || 0,
      workers: [],
      progress: 0,
    });
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal">
        <div className="modal-title">⬡ הוספת משימה חדשה</div>

        <div className="form-row">
          <label className="form-label">שם משימה</label>
          <input
            className="form-input"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="תיאור העבודה..."
          />
        </div>

        <div className="form-grid">
          <div className="form-row">
            <label className="form-label">קומה</label>
            <select
              className="form-input"
              value={form.floor}
              onChange={(e) => set('floor', e.target.value)}
            >
              {FLOOR_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label className="form-label">סטטוס</label>
            <select
              className="form-input"
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label className="form-label">התחלה</label>
            <input
              className="form-input"
              type="date"
              value={form.startDate}
              onChange={(e) => set('startDate', e.target.value)}
            />
          </div>

          <div className="form-row">
            <label className="form-label">סיום</label>
            <input
              className="form-input"
              type="date"
              value={form.endDate}
              onChange={(e) => set('endDate', e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">עלות יומית (₪)</label>
          <input
            className="form-input"
            type="number"
            value={form.dailyCost}
            onChange={(e) => set('dailyCost', e.target.value)}
            placeholder="0"
          />
        </div>

        {days > 0 && (
          <div className="cost-preview">
            <span>תצוגה מקדימה</span>
            <span>
              {days} ימי עבודה → {fmtMoney(totalCost)}
            </span>
          </div>
        )}

        <div className="form-row">
          <label className="form-label">הערה</label>
          <textarea
            className="form-input"
            rows={2}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="הערות..."
          />
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            ביטול
          </button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={!form.name.trim()}
          >
            הוסף משימה
          </button>
        </div>
      </div>
    </div>
  );
}
