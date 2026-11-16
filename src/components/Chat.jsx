import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useData, useUser, addRow, updateRow, notify } from '../lib/store';
import { putFile, deleteFile, useFileURL, dataURLToBlob } from '../lib/files';
import { Icon, IconButton, Modal } from './ui';
import { fmtDate, fmtTime, toISO, resizeImage } from '../lib/utils';

const REACTIONS = ['👍', '✅', '❗'];
const MAX_FILE = 40 * 1024 * 1024;

// Shows a stored audio / video / image / generic file.
export function FileView({ id, kind, name, onOpen }) {
  const { t } = useI18n();
  const { url, missing } = useFileURL(id);
  if (missing) return <span className="file-missing">{t('file_missing')}</span>;
  if (!url) return <span className="file-loading">{t('loading')}</span>;
  if (kind === 'audio') return <audio controls preload="metadata" src={url} />;
  if (kind === 'video') return <video controls preload="metadata" src={url} />;
  if (kind === 'image')
    return (
      <button className="msg-image" onClick={() => onOpen?.(url)} aria-label={name || t('photo')}>
        <img src={url} alt={name || ''} />
      </button>
    );
  return (
    <a className="file-link" href={url} download={name || 'file'}>
      <Icon name="download" size={16} />
      {name || t('file')}
    </a>
  );
}

// Voice recorder: start() asks for the microphone, stop(true) resolves with the recording.
export function useRecorder(onDone) {
  const { t } = useI18n();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const ref = useRef({});
  useEffect(() => () => ref.current.stream?.getTracks().forEach((x) => x.stop()), []);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return notify('mic_unsupported', 'error');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((x) => x.stop());
        clearInterval(ref.current.timer);
        setRecording(false);
        if (ref.current.keep && chunks.length) onDone(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
      };
      ref.current = { rec, stream, keep: false, timer: setInterval(() => setSeconds((s) => s + 1), 1000) };
      setSeconds(0);
      setRecording(true);
      rec.start();
    } catch {
      notify('mic_denied', 'error');
    }
  };
  const stop = (keep) => {
    ref.current.keep = keep;
    if (ref.current.rec?.state !== 'inactive') ref.current.rec?.stop();
  };
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return { recording, clock, start, stop, label: t('recording') };
}

function Bubble({ m, mine, parent, onReply, onReact, onDelete, onOpen }) {
  const { t, lang } = useI18n();
  const reactions = Object.entries(m.reactions || {}).filter(([, ids]) => ids.length);
  return (
    <div className={`msg ${mine ? 'mine' : ''}`}>
      <div className="bubble">
        {!mine && <b className="msg-sender">{m.sender_name}</b>}
        {m.deleted ? (
          <i className="msg-deleted">{t('message_deleted')}</i>
        ) : (
          <>
            {parent && (
              <div className="msg-quote">
                <b>{parent.sender_name}</b>
                <span>{parent.deleted ? t('message_deleted') : parent.text || t('kind_' + parent.kind)}</span>
              </div>
            )}
            {m.kind !== 'text' && <FileView id={m.file_id} kind={m.kind} name={m.file_name} onOpen={onOpen} />}
            {m.text && <p>{m.text}</p>}
          </>
        )}
        <span className="msg-time">{fmtTime(m.created_at, lang)}</span>
        {reactions.length > 0 && (
          <div className="msg-reactions">
            {reactions.map(([e, ids]) => (
              <button key={e} onClick={() => onReact(e)} title={t('react')}>
                {e} {ids.length > 1 ? ids.length : ''}
              </button>
            ))}
          </div>
        )}
      </div>
      {!m.deleted && (
        <div className="msg-actions">
          {REACTIONS.map((e) => (
            <button key={e} onClick={() => onReact(e)} aria-label={`${t('react')} ${e}`}>
              {e}
            </button>
          ))}
          <IconButton icon="chat" size={14} label={t('reply')} onClick={onReply} />
          {mine && <IconButton icon="trash" size={14} label={t('delete')} onClick={onDelete} />}
        </div>
      )}
    </div>
  );
}

// A message thread: text, voice notes, photos, videos, files, replies, reactions.
export default function Chat({ thread, emptyText }) {
  const { t, lang } = useI18n();
  const user = useUser();
  const data = useData();
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(null);
  const listRef = useRef(null);
  const fileRef = useRef(null);
  const videoRef = useRef(null);

  const messages = useMemo(
    () => data.messages.filter((m) => m.thread === thread).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))),
    [data.messages, thread]
  );
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = (row) => {
    addRow('messages', { thread, sender_id: user.id, sender_name: user.name, kind: 'text', text: '', reactions: {}, reply_to: replyTo?.id || null, ...row });
    setReplyTo(null);
  };
  const sendText = (e) => {
    e?.preventDefault();
    if (!text.trim()) return;
    send({ text: text.trim() });
    setText('');
  };
  const sendBlob = async (blob, kind, name) => {
    if (blob.size > MAX_FILE) return notify('file_too_big', 'error');
    setBusy(true);
    try {
      const file_id = await putFile(blob);
      send({ kind, file_id, file_name: name || '', text: text.trim() });
      setText('');
    } catch (e) {
      console.error(e);
      notify('upload_failed', 'error');
    }
    setBusy(false);
  };
  const pick = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    for (const f of files) {
      if (f.type.startsWith('image/')) {
        try {
          await sendBlob(await dataURLToBlob(await resizeImage(f, 1600, 0.8)), 'image', f.name);
          continue;
        } catch {
          /* not a decodable image — send as a plain file */
        }
      }
      await sendBlob(f, f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : 'file', f.name);
    }
  };
  const rec = useRecorder((blob) => sendBlob(blob, 'audio', 'voice-note'));
  const react = (m, emoji) => {
    const ids = (m.reactions || {})[emoji] || [];
    const next = ids.includes(user.id) ? ids.filter((x) => x !== user.id) : [...ids, user.id];
    updateRow('messages', m.id, { reactions: { ...(m.reactions || {}), [emoji]: next } });
  };
  const remove = (m) => {
    if (!confirm(t('confirm_delete_message'))) return;
    if (m.file_id) deleteFile(m.file_id);
    updateRow('messages', m.id, { deleted: true, text: '', file_id: null });
  };

  let lastDay = '';
  return (
    <div className="chat">
      <div className="chat-list" ref={listRef} role="log" aria-live="polite">
        {messages.length === 0 && <p className="chat-empty">{emptyText || t('no_messages')}</p>}
        {messages.map((m) => {
          const day = toISO(new Date(m.created_at));
          const sep = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id} className="msg-wrap">
              {sep && <div className="chat-day">{fmtDate(day, lang, { weekday: 'short', day: 'numeric', month: 'short' })}</div>}
              <Bubble
                m={m}
                mine={m.sender_id === user.id}
                parent={m.reply_to ? messages.find((x) => x.id === m.reply_to) : null}
                onReply={() => setReplyTo(m)}
                onReact={(e) => react(m, e)}
                onDelete={() => remove(m)}
                onOpen={setPhoto}
              />
            </div>
          );
        })}
      </div>

      {replyTo && (
        <div className="chat-reply">
          <div className="msg-quote">
            <b>{replyTo.sender_name}</b>
            <span>{replyTo.text || t('kind_' + replyTo.kind)}</span>
          </div>
          <IconButton icon="x" size={14} label={t('cancel')} onClick={() => setReplyTo(null)} />
        </div>
      )}

      {rec.recording ? (
        <div className="chat-input recording">
          <span className="rec-dot" />
          <b>{rec.clock}</b>
          <span className="grow">{rec.label}</span>
          <button className="btn ghost small" onClick={() => rec.stop(false)}>{t('cancel')}</button>
          <button className="btn primary small" onClick={() => rec.stop(true)}>
            <Icon name="arrow" size={14} className="flip-rtl" />
            {t('send')}
          </button>
        </div>
      ) : (
        <form className="chat-input" onSubmit={sendText}>
          <IconButton type="button" icon="plus" label={t('attach_file')} onClick={() => fileRef.current.click()} disabled={busy} />
          <IconButton type="button" icon="camera" label={t('record_video')} onClick={() => videoRef.current.click()} disabled={busy} />
          <input ref={fileRef} type="file" multiple hidden onChange={pick} />
          <input ref={videoRef} type="file" accept="video/*" capture="environment" hidden onChange={pick} />
          <input
            className="grow"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={busy ? t('uploading') : t('type_message')}
            aria-label={t('type_message')}
            disabled={busy}
          />
          {text.trim() ? (
            <button className="send-btn" type="submit" aria-label={t('send')}>
              <Icon name="arrow" size={18} className="flip-rtl" />
            </button>
          ) : (
            <button className="send-btn" type="button" aria-label={t('record_voice')} title={t('record_voice')} onClick={rec.start} disabled={busy}>
              <Icon name="mic" size={18} />
            </button>
          )}
        </form>
      )}
      {photo && (
        <Modal title={t('photo')} onClose={() => setPhoto(null)} wide>
          <img className="photo-full" src={photo} alt="" />
        </Modal>
      )}
    </div>
  );
}

export function ChatModal({ thread, title, subtitle, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      {subtitle && <p className="chat-sub">{subtitle}</p>}
      <Chat thread={thread} />
    </Modal>
  );
}
