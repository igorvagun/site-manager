import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../lib/i18n';
import { useStore, dismissToast } from '../lib/store';
import { resizeImage, clamp } from '../lib/utils';

const ICONS = {
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  calendar: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zM5 17a3 3 0 0 1 3-3h11M9 8h6',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.2a6.5 6.5 0 0 1 3.5 5.8',
  wallet: 'M4 7a2 2 0 0 1 2-2h11v3M4 7v10a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6a2 2 0 0 1-2-1zM16 13.5h.01',
  check: 'M8.5 12.5l2.5 2.5 4.5-5.5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  shield: 'M12 3l7 3v5.5c0 4.4-2.9 8.2-7 9.5-4.1-1.3-7-5.1-7-9.5V6l7-3zM9 12l2.2 2.2L15 10',
  box: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM4 7.5l8 4.5 8-4.5M12 12v9',
  gear: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.5-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.5l-2.4-1-2 3.5 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.5 2.4-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.5-2-1.5z',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.500 5.600 12 3z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  upload: 'M12 16V5M7 9l5-5 5 5M5 20h14',
  x: 'M6 6l12 12M18 6L6 18',
  alert: 'M12 4l9 16H3L12 4zM12 10v4M12 17.2h.01',
  cloud: 'M7 18a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.500 1.500A3.800 3.800 0 0 1 17.500 18H7z',
  rain: 'M7 15a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.500 1.500A3.800 3.800 0 0 1 17.500 15H7zM8 18l-1 3M12 18l-1 3M16 18l-1 3',
  wind: 'M3 9h10a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 17h7',
  printer: 'M7 8V4h10v4M7 17H5a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z',
  camera: 'M4 8h3l1.500-2.500h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 16.500a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  truck: 'M3 6h11v10H3zM14 10h4l3 3v3h-7M7.500 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.500 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  minus: 'M5 12h14',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.500 9.500a2.500 2.500 0 1 1 3.600 2.200c-.7.4-1.100 1-1.100 1.800M12 16.800h.01',
  hardhat: 'M4 17a8 8 0 0 1 16 0M2.500 17h19v2.500h-19zM10 9.300V5.500h4v3.800',
  chart: 'M4 20V10M10 20V4M16 20v-7M21 20H3',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 12.5l9 5 9-5M3 17l9 5 9-5',
  chat: 'M4 5h16v11H9.5L4 20V5zM8 9.5h8M8 12.5h5',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  phone: 'M6 3h4l1.5 5-2.5 1.5a11 11 0 0 0 5.5 5.5L16 12.5l5 1.5v4a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z',
  logout: 'M9 4H5v16h4M15 8l4 4-4 4M19 12H9',
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  idcard: 'M3 6h18v12H3zM8.5 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5.5 15.5c.6-1.3 1.7-2 3-2s2.4.7 3 2M14 10h4M14 13.5h4',
  building: 'M5 21V4h9v17M14 9h5v12M3 21h18M8 8h3M8 12h3M8 16h3',
  back: 'M15 5l-7 7 7 7',
  mic: 'M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16zM10 20.5a2 2 0 0 0 4 0',
  play: 'M7 4.5v15l12-7.500-12-7.500z',
  stop: 'M6 6h12v12H6z',
  pin: 'M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6zM12 14v7',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6',
};

export function Icon({ name, size = 20, className = '' }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name] || ICONS.help} />
    </svg>
  );
}

export function Glass({ as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag className={`glass ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function Card({ title, action, className = '', children }) {
  return (
    <Glass as="section" className={`card ${className}`}>
      {(title || action) && (
        <header className="card-head">
          <h3>{title}</h3>
          {action}
        </header>
      )}
      {children}
    </Glass>
  );
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`badge tone-${tone}`}>{children}</span>;
}

export function Segmented({ options, value, onChange, small }) {
  return (
    <div className={`segmented ${small ? 'small' : ''}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <Icon name={o.icon} size={15} />}
          {o.label}
          {o.count != null && <span className="seg-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Ring({ value = 0, size = 120, stroke = 10, tone = 'blue', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = clamp(value, 0, 100);
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className={`ring-val stroke-${tone}`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${(c * v) / 100} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function Meter({ value, max = 100, tone = 'blue', marker }) {
  const pct = max > 0 ? clamp((value / max) * 100, 0, 100) : 0;
  return (
    <div className="meter">
      <div className={`meter-fill bg-${tone}`} style={{ width: pct + '%' }} />
      {marker != null && <div className="meter-marker" style={{ insetInlineStart: clamp(marker, 0, 100) + '%' }} />}
    </div>
  );
}

export function Stat({ icon, tone = 'blue', label, value, sub }) {
  return (
    <Glass className="stat">
      <div className={`stat-icon tint-${tone}`}>
        <Icon name={icon} size={20} />
      </div>
      <div className="stat-body">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </Glass>
  );
}

export function Empty({ icon = 'box', text }) {
  return (
    <div className="empty">
      <Icon name={icon} size={30} />
      <p>{text}</p>
    </div>
  );
}

export function IconButton({ icon, label, onClick, tone = '', size = 18, ...rest }) {
  return (
    <button className={`icon-btn ${tone}`} onClick={onClick} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={size} />
    </button>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      const all = document.querySelectorAll('.overlay');
      if (all[all.length - 1]?.contains(ref.current)) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.activeElement;
    ref.current?.querySelector('input,select,textarea,button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  // Rendered at the document root so a dialog opened from inside another dialog is not clipped by it.
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`glass modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header className="modal-head">
          <h2>{title}</h2>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}

function PhotoField({ value, onChange, multiple }) {
  const { t } = useI18n();
  const list = multiple ? value || [] : value ? [value] : [];
  const pick = async (e) => {
    const files = [...e.target.files].slice(0, 6);
    const urls = [];
    for (const f of files) {
      try {
        urls.push(await resizeImage(f));
      } catch {
        /* unreadable image — skip */
      }
    }
    if (!urls.length) return;
    onChange(multiple ? [...list, ...urls].slice(0, 8) : urls[0]);
    e.target.value = '';
  };
  return (
    <div className="photos">
      {list.map((src, i) => (
        <div className="photo" key={i}>
          <img src={src} alt="" />
          <button
            type="button"
            aria-label={t('remove')}
            onClick={() => onChange(multiple ? list.filter((_, j) => j !== i) : '')}
          >
            <Icon name="x" size={12} />
          </button>
        </div>
      ))}
      <label className="photo add">
        <Icon name="camera" size={20} />
        <span>{t('add_photo')}</span>
        <input type="file" accept="image/*" multiple={multiple} onChange={pick} hidden />
      </label>
    </div>
  );
}

export function Field({ field, value, onChange }) {
  const f = field;
  const common = { id: 'f-' + f.key, value: value ?? '', onChange: (e) => onChange(e.target.value) };
  let control;
  switch (f.type) {
    case 'select':
      control = (
        <select {...common}>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    case 'textarea':
      control = <textarea rows={3} placeholder={f.placeholder} {...common} />;
      break;
    case 'number':
      control = (
        <input
          type="number"
          inputMode="decimal"
          min={f.min}
          step={f.step || 'any'}
          placeholder="0"
          {...common}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      );
      break;
    case 'range':
      control = (
        <div className="range-row">
          <input type="range" min={0} max={100} step={5} {...common} value={value || 0} style={{ '--pct': (value || 0) + '%' }} onChange={(e) => onChange(Number(e.target.value))} />
          <b>{value || 0}%</b>
        </div>
      );
      break;
    case 'chips':
      control = (
        <div className="chips">
          {f.options.map((o) => {
            const on = (value || []).includes(o.value);
            return (
              <button
                type="button"
                key={o.value}
                className={`chip ${on ? 'on' : ''}`}
                aria-pressed={on}
                onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...(value || []), o.value])}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      );
      break;
    case 'checklist':
      control = (
        <div className="checklist">
          {f.options.map((o) => {
            const ok = !!(value || {})[o.value];
            return (
              <label key={o.value} className={ok ? 'ok' : 'bad'}>
                <input type="checkbox" checked={ok} onChange={(e) => onChange({ ...(value || {}), [o.value]: e.target.checked })} />
                <span>{o.label}</span>
              </label>
            );
          })}
        </div>
      );
      break;
    case 'photo':
    case 'photos':
      control = <PhotoField value={value} onChange={onChange} multiple={f.type === 'photos'} />;
      break;
    default:
      control = <input type={f.type || 'text'} placeholder={f.placeholder} {...common} />;
  }
  return (
    <div className={`field ${f.half ? 'half' : ''}`}>
      <label htmlFor={'f-' + f.key}>
        {f.label}
        {f.required && <i> *</i>}
      </label>
      {control}
    </div>
  );
}

// Generic create/edit dialog driven by a field schema.
export function EntityForm({ title, fields, initial, onSave, onDelete, onClose, wide }) {
  const { t } = useI18n();
  const [form, setForm] = useState(initial);
  const [tried, setTried] = useState(false);
  const shown = fields.filter((f) => !f.when || f.when(form));
  const missing = shown.filter((f) => f.required && (form[f.key] === '' || form[f.key] == null));
  const dateError = form.start_date && form.end_date && form.end_date < form.start_date;
  const submit = (e) => {
    e.preventDefault();
    setTried(true);
    if (missing.length || dateError) return;
    const out = { ...form };
    fields.forEach((f) => {
      if (f.type === 'number') out[f.key] = Number(out[f.key]) || 0;
      if (f.type === 'date' && !out[f.key]) out[f.key] = null;
    });
    onSave(out);
    onClose();
  };
  return (
    <Modal title={title} onClose={onClose} wide={wide}>
      <form onSubmit={submit} noValidate>
        <div className="form-grid">
          {shown.map((f) => (
            <Field key={f.key} field={f} value={form[f.key]} onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))} />
          ))}
        </div>
        {tried && missing.length > 0 && (
          <p className="form-error" role="alert">
            {t('required_missing')}: {missing.map((f) => f.label).join(', ')}
          </p>
        )}
        {tried && dateError && (
          <p className="form-error" role="alert">
            {t('date_order')}
          </p>
        )}
        <div className="modal-foot">
          {onDelete && (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                if (confirm(t('confirm_delete'))) {
                  onDelete();
                  onClose();
                }
              }}
            >
              <Icon name="trash" size={16} />
              {t('delete')}
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="submit" className="btn primary">
            {t('save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function Toasts() {
  const { toasts } = useStore();
  const { t } = useI18n();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((x) => (
        <div key={x.id} className={`glass toast ${x.type}`}>
          <Icon name={x.type === 'error' ? 'alert' : 'check'} size={18} />
          {t(x.message)}
          {x.action && (
            <button
              className="toast-action"
              onClick={() => {
                dismissToast(x.id);
                x.action.run();
              }}
            >
              {t(x.action.label)}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function PageHead({ title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }) {
  return (
    <label className="search">
      <Icon name="search" size={16} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </label>
  );
}
