import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useData, addRow, updateRow, removeRow } from '../lib/store';
import { useOptions, ATTENDANCE } from '../lib/constants';
import { Glass, Icon, IconButton, EntityForm, Empty, PageHead, SearchBox, Stat } from '../components/ui';
import { ChatModal } from '../components/Chat';
import { todayISO, addDays, fmtDate, fmtMoney, sum, exportCSV } from '../lib/utils';

export default function Team() {
  const { t, lang } = useI18n();
  const data = useData();
  const o = useOptions();
  const cur = data.project[0]?.currency || '₪';
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [chat, setChat] = useState(null);

  const workers = [...data.workers]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((w) => !q || `${w.name} ${w.role} ${w.company}`.toLowerCase().includes(q.toLowerCase()));
  const dayAtt = data.attendance.filter((a) => a.date === date);
  const rec = (w) => dayAtt.find((a) => a.worker_id === w.id);
  const present = dayAtt.filter((a) => a.status === 'present');
  const rate = (id) => data.workers.find((w) => w.id === id)?.daily_rate || 0;
  const dayCost = sum(present, (a) => rate(a.worker_id));
  const hours = sum(present, (a) => a.hours);
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(date, i - 6));

  const mark = (w, status) => {
    const r = rec(w);
    const patch = { status, hours: status === 'present' ? r?.hours || 9 : 0 };
    if (r) {
      if (r.status === status) removeRow('attendance', r.id);
      else updateRow('attendance', r.id, patch);
    } else addRow('attendance', { worker_id: w.id, date, ...patch });
  };
  const markAll = () =>
    data.workers
      .filter((w) => w.active !== false && !rec(w))
      .forEach((w) => addRow('attendance', { worker_id: w.id, date, status: 'present', hours: 9 }));

  const positionOptions = (current) => {
    const names = data.positions.map((p) => p.name);
    if (current && !names.includes(current)) names.push(current);
    return [{ value: '', label: '—' }, ...names.map((n) => ({ value: n, label: n }))];
  };
  const fields = [
    { key: 'name', label: t('full_name'), required: true },
    { key: 'role', label: t('position'), type: 'select', options: positionOptions(editing?.role), half: true },
    { key: 'company', label: t('company'), half: true },
    { key: 'phone', label: t('phone'), type: 'tel', half: true },
    { key: 'email', label: t('email'), type: 'email', half: true },
    { key: 'id_number', label: t('id_number'), half: true },
    { key: 'start_date', label: t('employment_start'), type: 'date', half: true },
    { key: 'hourly_rate', label: t('hourly_rate'), type: 'number', min: 0, half: true },
    { key: 'daily_rate', label: t('daily_rate'), type: 'number', min: 0, half: true },
    { key: 'emergency_contact', label: t('emergency_contact'), half: true },
    { key: 'active', label: t('status'), type: 'select', half: true, options: [{ value: 'yes', label: t('active') }, { value: 'no', label: t('inactive') }] },
    { key: 'notes', label: t('notes'), type: 'textarea' },
  ];
  const blankWorker = { name: '', role: '', company: '', phone: '', email: '', id_number: '', start_date: today, hourly_rate: '', daily_rate: '', emergency_contact: '', notes: '', active: 'yes' };

  return (
    <>
      <PageHead title={t('nav_team')} subtitle={t('team_sub')}>
        <button
          className="btn"
          onClick={() =>
            exportCSV(`attendance-${date}.csv`, data.workers, [
              { key: 'name', label: t('full_name') },
              { key: 'role', label: t('role') },
              { key: 'company', label: t('company') },
              { label: t('status'), get: (w) => (rec(w) ? t('att_' + rec(w).status) : '') },
              { label: t('hours'), get: (w) => rec(w)?.hours ?? '' },
              { key: 'daily_rate', label: t('daily_rate') },
            ])
          }
        >
          <Icon name="download" size={16} />
          CSV
        </button>
        <button className="btn primary" onClick={() => setEditing(blankWorker)}>
          <Icon name="plus" size={16} />
          {t('new_worker')}
        </button>
      </PageHead>

      <div className="grid stats four">
        <Stat icon="users" tone="green" label={t('present')} value={`${present.length}/${data.workers.filter((w) => w.active !== false).length}`} sub={fmtDate(date, lang, { weekday: 'long' })} />
        <Stat icon="clock" tone="blue" label={t('hours_logged')} value={hours} sub={t('hours')} />
        <Stat icon="wallet" tone="purple" label={t('labor_cost_day')} value={fmtMoney(dayCost, cur)} sub={t('by_daily_rate')} />
        <Stat icon="alert" tone="orange" label={t('absent_sick')} value={dayAtt.filter((a) => a.status === 'absent' || a.status === 'sick').length} sub={t('workers')} />
      </div>

      <Glass className="toolbar">
        <div className="date-nav">
          <IconButton icon="up" tone="rot-start" label={t('prev_day')} onClick={() => setDate(addDays(date, -1))} />
          <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label={t('date')} />
          <IconButton icon="up" tone="rot-end" label={t('next_day')} onClick={() => setDate(addDays(date, 1))} disabled={date >= today} />
          {date !== today && <button className="btn ghost" onClick={() => setDate(today)}>{t('today')}</button>}
        </div>
        <SearchBox value={q} onChange={setQ} placeholder={t('search_workers')} />
        <button className="btn" onClick={markAll}>
          <Icon name="check" size={16} />
          {t('mark_all_present')}
        </button>
      </Glass>

      {workers.length === 0 ? (
        <Glass><Empty icon="users" text={t('no_workers')} /></Glass>
      ) : (
        <div className="grid worker-grid">
          {workers.map((w) => {
            const r = rec(w);
            return (
              <Glass className={`worker ${w.active === false ? 'inactive' : ''}`} key={w.id}>
                <header>
                  <div className="avatar">{w.name.slice(0, 1)}</div>
                  <div className="worker-id">
                    <b>{w.name}</b>
                    <small>{[w.role, w.company].filter(Boolean).join(' · ')}</small>
                  </div>
                  <IconButton icon="chat" label={t('message')} onClick={() => setChat(w)} />
                  <IconButton icon="edit" label={t('edit')} onClick={() => setEditing({ ...blankWorker, ...w, start_date: w.start_date || '', active: w.active === false ? 'no' : 'yes' })} />
                </header>
                <div className="worker-meta">
                  <span>{fmtMoney(w.hourly_rate || 0, cur)}/{t('hr')} · {fmtMoney(w.daily_rate, cur)}/{t('day')}</span>
                  {w.phone && <a href={`tel:${w.phone}`} dir="ltr">{w.phone}</a>}
                  <div className="week-dots" title={t('last_7_days')}>
                    {last7.map((d) => {
                      const a = data.attendance.find((x) => x.worker_id === w.id && x.date === d);
                      return <i key={d} className={a ? `on tone-${ATTENDANCE[a.status]}` : ''} title={`${fmtDate(d, lang)}${a ? ' · ' + t('att_' + a.status) : ''}`} />;
                    })}
                  </div>
                </div>
                <div className="att-row" role="group" aria-label={t('attendance')}>
                  {o.attendance.map((s) => (
                    <button
                      key={s.value}
                      className={`att tone-${ATTENDANCE[s.value]} ${r?.status === s.value ? 'on' : ''}`}
                      aria-pressed={r?.status === s.value}
                      onClick={() => mark(w, s.value)}
                    >
                      {s.label}
                    </button>
                  ))}
                  {r?.status === 'present' && (
                    <label className="hours">
                      <input
                        type="number" min={0} max={24} step={0.5} value={r.hours}
                        aria-label={t('hours')}
                        onChange={(e) => updateRow('attendance', r.id, { hours: Math.min(24, Math.max(0, Number(e.target.value) || 0)) })}
                      />
                      {t('hrs')}
                    </label>
                  )}
                </div>
              </Glass>
            );
          })}
        </div>
      )}

      {chat && <ChatModal thread={'worker:' + chat.id} title={chat.name} subtitle={[chat.role, chat.company].filter(Boolean).join(' · ')} onClose={() => setChat(null)} />}
      {editing && (
        <EntityForm
          title={editing.id ? t('edit_worker') : t('new_worker')}
          fields={fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => {
            const row = { ...v, active: v.active !== 'no' };
            // Picking a position fills in its default hourly rate when none was typed.
            const pos = data.positions.find((p) => p.name === row.role);
            if (pos && !row.hourly_rate) row.hourly_rate = pos.hourly_rate;
            if (!row.daily_rate && row.hourly_rate) row.daily_rate = row.hourly_rate * 9;
            editing.id ? updateRow('workers', editing.id, row) : addRow('workers', row);
          }}
          onDelete={
            editing.id
              ? () => {
                  data.attendance.filter((a) => a.worker_id === editing.id).forEach((a) => removeRow('attendance', a.id));
                  removeRow('workers', editing.id);
                }
              : null
          }
        />
      )}
    </>
  );
}
