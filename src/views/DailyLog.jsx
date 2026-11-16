import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useData, addRow, updateRow, removeRow } from '../lib/store';
import { useOptions, WEATHER } from '../lib/constants';
import { Glass, Icon, IconButton, EntityForm, Empty, PageHead, SearchBox, Modal } from '../components/ui';
import { todayISO, fmtDate, exportCSV } from '../lib/utils';

export default function DailyLog() {
  const { t, lang } = useI18n();
  const data = useData();
  const o = useOptions();
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState('');
  const [photo, setPhoto] = useState(null);
  const today = todayISO();

  const logs = [...data.logs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((l) => !q || `${l.summary} ${l.delays} ${l.author}`.toLowerCase().includes(q.toLowerCase()));

  const fields = [
    { key: 'date', label: t('date'), type: 'date', required: true, half: true },
    { key: 'author', label: t('author'), half: true },
    { key: 'weather', label: t('weather'), type: 'select', options: o.weather, half: true },
    { key: 'temp', label: t('temperature'), type: 'number', half: true },
    { key: 'crew_count', label: t('crew_on_site'), type: 'number', min: 0, half: true },
    { key: 'summary', label: t('work_done'), type: 'textarea', required: true, placeholder: t('work_done_ph') },
    { key: 'delays', label: t('delays_issues'), type: 'textarea', placeholder: t('delays_ph') },
    { key: 'photos', label: t('photos'), type: 'photos' },
  ];
  // Draft of today's entry from what the other apps already know; the author edits it before saving.
  const draft = () => {
    const done = data.tasks.filter((x) => x.finished_at && x.finished_at.slice(0, 10) === new Date().toISOString().slice(0, 10));
    const active = data.tasks.filter((x) => x.status === 'active');
    const deliveries = data.materials.filter((m) => m.next_delivery === today);
    const lines = [
      ...done.map((x) => `✓ ${x.name}`),
      ...active.map((x) => `• ${x.name} — ${x.progress || 0}%`),
      ...deliveries.map((m) => `${t('delivery')}: ${m.name}`),
    ];
    const late = data.tasks.filter((x) => x.status === 'delayed' || (x.status !== 'done' && x.end_date < today));
    return { summary: lines.join('\n'), delays: late.map((x) => `${t('alert_late_task')}: ${x.name}`).join('\n') };
  };
  const blank = {
    date: today,
    author: data.project[0]?.manager || '',
    weather: 'sunny',
    temp: 22,
    crew_count: data.attendance.filter((a) => a.date === today && a.status === 'present').length,
    summary: '',
    delays: '',
    photos: [],
  };
  const newEntry = () => setEditing(logs.some((l) => l.date === today) ? blank : { ...blank, ...draft() });

  return (
    <>
      <PageHead title={t('nav_log')} subtitle={t('log_sub')}>
        <button className="btn" onClick={() => window.print()}>
          <Icon name="printer" size={16} />
          {t('print')}
        </button>
        <button
          className="btn"
          onClick={() =>
            exportCSV('daily-logs.csv', logs, [
              { key: 'date', label: t('date') },
              { label: t('weather'), get: (r) => t('w_' + r.weather) },
              { key: 'temp', label: t('temperature') },
              { key: 'crew_count', label: t('crew_on_site') },
              { key: 'summary', label: t('work_done') },
              { key: 'delays', label: t('delays_issues') },
              { key: 'author', label: t('author') },
            ])
          }
        >
          <Icon name="download" size={16} />
          CSV
        </button>
        <button className="btn primary" onClick={newEntry}>
          <Icon name="plus" size={16} />
          {t('new_log')}
        </button>
      </PageHead>

      <Glass className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder={t('search_logs')} />
      </Glass>

      {logs.length === 0 ? (
        <Glass><Empty icon="book" text={t('no_logs')} /></Glass>
      ) : (
        <div className="timeline">
          {logs.map((l) => (
            <Glass className="log-card" key={l.id}>
              <div className="log-weather tint-blue">
                <Icon name={WEATHER[l.weather] || 'sun'} size={26} />
                <b>{l.temp}°</b>
                <small>{t('w_' + l.weather)}</small>
              </div>
              <div className="log-body">
                <header>
                  <h3>
                    {fmtDate(l.date, lang, { weekday: 'long', day: 'numeric', month: 'long' })}
                    {l.date === today && <span className="badge tone-blue">{t('today')}</span>}
                  </h3>
                  <IconButton icon="edit" label={t('edit')} onClick={() => setEditing(l)} />
                </header>
                <small>
                  <Icon name="users" size={13} /> {l.crew_count} {t('workers')}
                  {l.author && <> · {l.author}</>}
                </small>
                <p>{l.summary}</p>
                {l.delays && (
                  <p className="warn-text">
                    <Icon name="alert" size={14} /> {l.delays}
                  </p>
                )}
                {l.photos?.length > 0 && (
                  <div className="photos readonly">
                    {l.photos.map((src, i) => (
                      <button className="photo" key={i} onClick={() => setPhoto(src)} aria-label={t('photos')}>
                        <img src={src} alt="" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Glass>
          ))}
        </div>
      )}

      {editing && (
        <EntityForm
          title={editing.id ? t('edit_log') : t('new_log')}
          fields={fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => (editing.id ? updateRow('logs', editing.id, v) : addRow('logs', v))}
          onDelete={editing.id ? () => removeRow('logs', editing.id) : null}
        />
      )}
      {photo && (
        <Modal title={t('photos')} onClose={() => setPhoto(null)} wide>
          <img className="photo-full" src={photo} alt="" />
        </Modal>
      )}
    </>
  );
}
