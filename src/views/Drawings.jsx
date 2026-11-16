import { useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { routeQuery } from '../lib/nav';
import { useData, useUser, addRow, updateRow, removeRow, notify } from '../lib/store';
import { putFile, deleteFile, useFileURL } from '../lib/files';
import { Glass, Icon, IconButton, Badge, EntityForm, Empty, PageHead, SearchBox, Segmented, Modal } from '../components/ui';
import { fmtDate, toISO } from '../lib/utils';

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
export function DrawingViewer({ drawing, onClose }) {
  const { t } = useI18n();
  const { url, missing } = useDrawingURL(drawing);
  const [zoom, setZoom] = useState(1);
  const isImage = (drawing.file_type || '').startsWith('image/');
  return (
    <Modal title={`${drawing.number || ''} ${drawing.title}`.trim()} onClose={onClose} wide>
      <div className="viewer-bar">
        <Badge tone={DISCIPLINES[drawing.discipline] || 'neutral'}>{t('disc_' + drawing.discipline)}</Badge>
        {drawing.revision && <span className="tag">{t('revision')} {drawing.revision}</span>}
        <span className="spacer" />
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
          <img src={url} alt={drawing.title} style={{ width: zoom * 100 + '%' }} />
        ) : (
          <iframe src={url} title={drawing.title} />
        )}
      </div>
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
            deleteFile(editing.file_id);
            removeRow('drawings', editing.id);
          }}
        />
      )}
    </>
  );
}
