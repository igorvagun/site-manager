import { useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { routeQuery } from '../lib/nav';
import { useData, useUser, addRow, updateRow, removeRow, notify } from '../lib/store';
import { putFile, deleteFile, useFileURL } from '../lib/files';
import { Glass, Icon, IconButton, Badge, EntityForm, Empty, PageHead, SearchBox, Segmented, Modal } from '../components/ui';
import { fmtDate, toISO, todayISO, addDays } from '../lib/utils';
import { ISSUE_STATUS, PRIORITY, useOptions } from '../lib/constants';

export const DISCIPLINES = { architecture: 'blue', structure: 'red', electrical: 'yellow', plumbing: 'green', other: 'neutral' };
const MAX = 40 * 1024 * 1024;

function useDrawingURL(d) {
  const file = useFileURL(d?.file_id || null);
  return d?.url ? { url: d.url, missing: false } : file;
}

export function DrawingThumb({ drawing }) {
  const { url } = useDrawingURL(drawing);
  const isImage = (drawing.file_type || '').startsWith('image/');
  return (
    <div className="drawing-thumb">
      {isImage && url ? <img src={url} alt="" loading="lazy" /> : <Icon name={isImage ? 'layers' : 'book'} size={34} />}
      {!isImage && <span>PDF</span>}
    </div>
  );
}

// Full-screen viewer: images zoom and scroll, PDFs use the browser's own viewer.
// Issues can be pinned to a spot on a drawing: tap "Add pin", tap the drawing, describe the problem.
export function DrawingViewer({ drawing, onClose, focusIssue }) {
  const { t, lang } = useI18n();
  const data = useData();
  const user = useUser();
  const o = useOptions();
  const { url, missing } = useDrawingURL(drawing);
  const [zoom, setZoom] = useState(1);
  const [pinning, setPinning] = useState(false);
  const [draft, setDraft] = useState(null);
  const [active, setActive] = useState(focusIssue || null);
  const isImage = (drawing.file_type || '').startsWith('image/');
  const pins = data.issues.filter((i) => i.drawing_id === drawing.id && i.pin_x != null).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const current = pins.find((i) => i.id === active);
  const place = (e) => {
    if (!pinning) return;
    const r = e.currentTarget.getBoundingClientRect();
    setPinning(false);
    setDraft({
      title: '', type: 'punch', priority: 'medium', status: 'open', floor: 'א', assignee: '', due_date: addDays(todayISO(), 7), description: '', photo: '',
      drawing_id: drawing.id,
      pin_x: Math.round(((e.clientX - r.left) / r.width) * 1000) / 10,
      pin_y: Math.round(((e.clientY - r.top) / r.height) * 1000) / 10,
    });
  };
  const issueFields = [
    { key: 'title', label: t('title'), required: true },
    { key: 'type', label: t('type'), type: 'select', options: o.issueType, half: true },
    { key: 'priority', label: t('priority'), type: 'select', options: o.priority, half: true },
    { key: 'assignee', label: t('assignee'), type: 'select', half: true, options: [{ value: '', label: '—' }, ...data.workers.map((w) => ({ value: w.name, label: w.name }))] },
    { key: 'due_date', label: t('due_date'), type: 'date', half: true },
    { key: 'description', label: t('description'), type: 'textarea' },
    { key: 'photo', label: t('photo'), type: 'photo' },
  ];
  return (
    <Modal title={`${drawing.number || ''} ${drawing.title}`.trim()} onClose={onClose} wide>
      <div className="viewer-bar">
        <Badge tone={DISCIPLINES[drawing.discipline] || 'neutral'}>{t('disc_' + drawing.discipline)}</Badge>
        {drawing.revision && <span className="tag">{t('revision')} {drawing.revision}</span>}
        <span className="spacer" />
        {isImage && (
          <button className={`btn small ${pinning ? 'primary' : ''}`} onClick={() => setPinning(!pinning)} aria-pressed={pinning}>
            <Icon name="pin" size={14} />
            {pinning ? t('pin_tap_drawing') : `${t('add_pin')}${pins.length ? ` · ${pins.length}` : ''}`}
          </button>
        )}
        {isImage && (
          <>
            <IconButton icon="minus" label={t('zoom_out')} onClick={() => setZoom((z) => Math.max(0.5, z - 0.5))} />
            <b>{Math.round(zoom * 100)}%</b>
            <IconButton icon="plus" label={t('zoom_in')} onClick={() => setZoom((z) => Math.min(5, z + 0.5))} />
          </>
        )}
        {url && (
          <a className="btn small" href={url} target="_blank" rel="noreferrer" download={isImage ? undefined : drawing.file_name}>
            <Icon name="download" size={14} />
            {t('open_file')}
          </a>
        )}
      </div>
      <div className="viewer">
        {missing ? (
          <Empty icon="alert" text={t('file_missing')} />
        ) : !url ? (
          <div className="loading"><div className="spinner" /></div>
        ) : isImage ? (
          <div className={`pin-stage ${pinning ? 'pinning' : ''}`} style={{ width: zoom * 100 + '%' }} onClick={place}>
            <img src={url} alt={drawing.title} />
            {pins.map((i, n) => (
              <button
                key={i.id}
                className={`map-pin tone-${ISSUE_STATUS[i.status] || 'orange'} ${active === i.id ? 'on' : ''}`}
                style={{ left: i.pin_x + '%', top: i.pin_y + '%' }}
                aria-label={`${n + 1}. ${i.title}`}
                title={i.title}
                onClick={(e) => {
                  e.stopPropagation();
                  setActive(active === i.id ? null : i.id);
                }}
              >
                <span>{n + 1}</span>
              </button>
            ))}
          </div>
        ) : (
          <iframe src={url} title={drawing.title} />
        )}
      </div>
      {current && (
        <div className="pin-card">
          <div className="task-meta">
            <Badge tone={ISSUE_STATUS[current.status]}>{t('is_' + current.status)}</Badge>
            <Badge tone={PRIORITY[current.priority]}>{t('pr_' + current.priority)}</Badge>
            {current.assignee && <span className="avatar-chip"><i>{current.assignee.slice(0, 1)}</i>{current.assignee}</span>}
            {current.due_date && <span>{t('due')} {fmtDate(current.due_date, lang)}</span>}
          </div>
          <b>{current.title}</b>
          {current.description && <p>{current.description}</p>}
          {current.photo && <img src={current.photo} alt="" />}
          <div className="btn-row">
            {current.status !== 'done' && (
              <button className="btn small primary" onClick={() => updateRow('issues', current.id, { status: current.status === 'open' ? 'in_progress' : 'done' })}>
                {t(current.status === 'open' ? 'is_in_progress' : 'is_done')}
              </button>
            )}
            {user.role !== 'worker' && (
              <button className="btn small danger" onClick={() => confirm(t('confirm_delete')) && (removeRow('issues', current.id), setActive(null))}>
                <Icon name="trash" size={13} />
                {t('delete')}
              </button>
            )}
          </div>
        </div>
      )}
      {draft && (
        <EntityForm
          title={t('new_pin_issue')}
          fields={issueFields}
          initial={draft}
          onClose={() => setDraft(null)}
          onSave={async (v) => {
            const row = await addRow('issues', v);
            if (row) setActive(row.id);
          }}
        />
      )}
    </Modal>
  );
}

export default function Drawings() {
  const { t, lang } = useI18n();
  const data = useData();
  const user = useUser();
  const canEdit = user.role !== 'worker';
  const [q, setQ] = useState(routeQuery);
  const [disc, setDisc] = useState('all');
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const list = [...data.drawings]
    .sort((a, b) => String(a.number).localeCompare(String(b.number)))
    .filter((d) => (disc === 'all' || d.discipline === disc) && (!q || `${d.number} ${d.title}`.toLowerCase().includes(q.toLowerCase())));
  const pinCount = (d) => data.issues.filter((i) => i.drawing_id === d.id && i.pin_x != null && i.status !== 'done').length;
  const discOptions = Object.keys(DISCIPLINES).map((k) => ({ value: k, label: t('disc_' + k) }));
  const fields = [
    { key: 'title', label: t('title'), required: true },
    { key: 'number', label: t('drawing_number'), half: true },
    { key: 'revision', label: t('revision'), half: true },
    { key: 'discipline', label: t('discipline'), type: 'select', options: discOptions },
  ];

  const upload = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    setBusy(true);
    for (const f of files) {
      if (f.size > MAX) {
        notify('file_too_big', 'error');
        continue;
      }
      if (!f.type.startsWith('image/') && f.type !== 'application/pdf') {
        notify('drawing_bad_type', 'error');
        continue;
      }
      try {
        const file_id = await putFile(f);
        const base = f.name.replace(/\.[^.]+$/, '');
        const row = await addRow('drawings', { title: base, number: '', revision: 'A', discipline: 'architecture', file_id, file_name: f.name, file_type: f.type, uploaded_by: user.name });
        if (files.length === 1 && row) setEditing(row);
      } catch (err) {
        console.error(err);
        notify('upload_failed', 'error');
      }
    }
    setBusy(false);
  };

  return (
    <>
      <PageHead title={t('nav_drawings')} subtitle={t('drawings_sub')}>
        {canEdit && (
          <>
            <button className="btn primary" onClick={() => fileRef.current.click()} disabled={busy}>
              <Icon name="upload" size={16} />
              {busy ? t('uploading') : t('upload_drawing')}
            </button>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={upload} />
          </>
        )}
      </PageHead>

      <Glass className="toolbar">
        <Segmented value={disc} onChange={setDisc} options={[{ value: 'all', label: t('all'), count: data.drawings.length }, ...discOptions]} />
        <SearchBox value={q} onChange={setQ} placeholder={t('search_drawings')} />
      </Glass>

      {list.length === 0 ? (
        <Glass><Empty icon="layers" text={t('no_drawings')} /></Glass>
      ) : (
        <div className="grid drawing-grid">
          {list.map((d) => (
            <Glass className="drawing" key={d.id}>
              <button className="drawing-open" onClick={() => setViewing(d)} aria-label={`${t('open_file')}: ${d.title}`}>
                <DrawingThumb drawing={d} />
              </button>
              <div className="drawing-info">
                <div className="task-meta">
                  {d.number && <b className="mono">{d.number}</b>}
                  <Badge tone={DISCIPLINES[d.discipline] || 'neutral'}>{t('disc_' + d.discipline)}</Badge>
                  {d.revision && <span className="tag">{t('revision')} {d.revision}</span>}
                  {pinCount(d) > 0 && <span className="tag pin-tag"><Icon name="pin" size={12} /> {pinCount(d)}</span>}
                </div>
                <button className="task-title" onClick={() => setViewing(d)}>{d.title}</button>
                <small>
                  {d.uploaded_by} · {fmtDate(toISO(new Date(d.created_at)), lang)}
                </small>
              </div>
              {canEdit && <IconButton icon="edit" label={t('edit')} onClick={() => setEditing(d)} />}
            </Glass>
          ))}
        </div>
      )}

      {viewing && <DrawingViewer drawing={viewing} onClose={() => setViewing(null)} />}
      {editing && (
        <EntityForm
          title={t('edit_drawing')}
          fields={fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => updateRow('drawings', editing.id, { title: v.title, number: v.number, revision: v.revision, discipline: v.discipline })}
          onDelete={() => {
            data.tasks.filter((x) => x.drawing_id === editing.id).forEach((x) => updateRow('tasks', x.id, { drawing_id: null }));
            data.issues.filter((x) => x.drawing_id === editing.id).forEach((x) => updateRow('issues', x.id, { drawing_id: null, pin_x: null, pin_y: null }));
            deleteFile(editing.file_id);
            removeRow('drawings', editing.id);
          }}
        />
      )}
    </>
  );
}
