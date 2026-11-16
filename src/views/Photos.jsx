import { useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useData } from '../lib/store';
import { useFileURL } from '../lib/files';
import { nav } from '../lib/nav';
import { Glass, Icon, Segmented, Empty, PageHead, Modal } from '../components/ui';
import { fmtDate, toISO } from '../lib/utils';

function Thumb({ item, onOpen }) {
  const file = useFileURL(item.file_id || null);
  const src = item.src || file.url;
  if (!src) return <div className="shot placeholder" />;
  return (
    <button className="shot" onClick={() => onOpen({ ...item, src })} aria-label={item.caption}>
      <img src={src} alt={item.caption} loading="lazy" />
      <span>{item.caption}</span>
    </button>
  );
}

// Every photo taken in the project — from daily logs, issues and task chats — in date order.
export default function Photos({ project }) {
  const { t, lang } = useI18n();
  const data = useData();
  const [source, setSource] = useState('all');
  const [open, setOpen] = useState(null);

  const items = useMemo(() => {
    const out = [];
    data.logs.forEach((l) => (l.photos || []).forEach((src, i) => out.push({ id: `${l.id}:${i}`, kind: 'log', date: l.date, src, caption: (l.summary || '').split('\n')[0].slice(0, 80), app: 'log' })));
    data.issues.filter((i) => i.photo).forEach((i) => out.push({ id: i.id, kind: 'issue', date: toISO(new Date(i.created_at)), src: i.photo, caption: i.title, app: 'issues' }));
    data.messages
      .filter((m) => m.kind === 'image' && m.file_id && !m.deleted)
      .forEach((m) => {
        const task = data.tasks.find((x) => 'task:' + x.id === m.thread);
        out.push({ id: m.id, kind: 'chat', date: toISO(new Date(m.created_at)), file_id: m.file_id, caption: [task?.name, m.sender_name].filter(Boolean).join(' · '), app: task ? 'tasklog' : 'contacts' });
      });
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [data]);

  const shown = items.filter((x) => source === 'all' || x.kind === source);
  const months = [...new Set(shown.map((x) => x.date.slice(0, 7)))];
  const count = (k) => items.filter((x) => k === 'all' || x.kind === k).length;

  return (
    <>
      <PageHead title={t('nav_photos')} subtitle={t('photos_sub')} />
      <Glass className="toolbar">
        <Segmented
          value={source}
          onChange={setSource}
          options={[
            { value: 'all', label: t('all'), count: count('all') },
            { value: 'log', label: t('nav_log'), count: count('log') },
            { value: 'issue', label: t('nav_issues'), count: count('issue') },
            { value: 'chat', label: t('photos_chat'), count: count('chat') },
          ]}
        />
      </Glass>
      {shown.length === 0 ? (
        <Glass><Empty icon="camera" text={t('no_photos')} /></Glass>
      ) : (
        months.map((mo) => (
          <section key={mo} className="shots-month">
            <h3>{fmtDate(mo + '-01', lang, { month: 'long', year: 'numeric' })}</h3>
            <div className="shots">
              {shown.filter((x) => x.date.startsWith(mo)).map((x) => <Thumb key={x.id} item={x} onOpen={setOpen} />)}
            </div>
          </section>
        ))
      )}
      {open && (
        <Modal title={fmtDate(open.date, lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} onClose={() => setOpen(null)} wide>
          <img className="photo-full" src={open.src} alt={open.caption} />
          <div className="modal-foot">
            <span className="grow">{open.caption}</span>
            <button className="btn" onClick={() => nav(`p/${project.id}/${open.app}`)}>
              <Icon name="arrow" size={14} className="flip-rtl" />
              {t('nav_' + open.app)}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
