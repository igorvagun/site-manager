import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { updateRow, deleteProject, notify } from '../lib/store';
import { ACCENTS, WALLPAPERS } from '../lib/apps';
import { nav } from '../lib/nav';
import { Card, Field, Icon, PageHead } from '../components/ui';
import { fmtDate } from '../lib/utils';

export default function ProjectSettings({ project }) {
  const { t, lang } = useI18n();
  const [form, setForm] = useState(project);
  useEffect(() => setForm(project), [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fields = [
    { key: 'name', label: t('project_name'), required: true },
    { key: 'address', label: t('address') },
    { key: 'client', label: t('client'), half: true },
    { key: 'manager', label: t('site_manager'), half: true },
    { key: 'start_date', label: t('start'), type: 'date', half: true },
    { key: 'end_date', label: t('handover'), type: 'date', half: true },
    { key: 'currency', label: t('currency'), type: 'select', half: true, options: ['₪', '$', '€', '£'].map((c) => ({ value: c, label: c })) },
  ];
  const save = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return notify('required_missing', 'error');
    if (form.start_date && form.end_date && form.end_date < form.start_date) return notify('date_order', 'error');
    const { name, address, client, manager, currency } = form;
    updateRow('projects', project.id, { name, address, client, manager, currency, start_date: form.start_date || null, end_date: form.end_date || null });
    notify('saved');
  };
  // Style changes apply immediately so the manager sees the result while choosing.
  const style = (patch) => updateRow('projects', project.id, patch);

  return (
    <>
      <PageHead title={t('nav_style')} subtitle={t('style_sub')} />
      <div className="grid two-col">
        <Card title={t('project_look')}>
          <div className="setting col">
            <span>{t('wallpaper')}</span>
            <div className="swatches">
              {WALLPAPERS.map((w) => (
                <button key={w} className={`wall-swatch ${project.wallpaper === w ? 'on' : ''}`} data-wall={w} aria-pressed={project.wallpaper === w} onClick={() => style({ wallpaper: w })}>
                  <i />
                  <span>{t('wall_' + w)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="setting col">
            <span>{t('accent_color')}</span>
            <div className="swatches">
              {ACCENTS.map((a) => (
                <button key={a} className={`accent-swatch ${project.accent === a ? 'on' : ''}`} data-accent={a} aria-pressed={project.accent === a} aria-label={t('accent_' + a)} title={t('accent_' + a)} onClick={() => style({ accent: a })}>
                  {project.accent === a && <Icon name="check" size={18} />}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card title={t('work_time')}>
          <div className="setting col">
            <span>{t('rest_days')}</span>
            <div className="chips">
              {[0, 1, 2, 3, 4, 5, 6].map((n) => {
                const rest = Array.isArray(project.rest_days) ? project.rest_days : [6];
                const on = rest.includes(n);
                return (
                  <button
                    key={n}
                    className={`chip ${on ? 'on' : ''}`}
                    aria-pressed={on}
                    onClick={() => {
                      const next = on ? rest.filter((x) => x !== n) : [...rest, n].sort();
                      if (next.length === 7) return notify('rest_all', 'error');
                      style({ rest_days: next });
                    }}
                  >
                    {fmtDate(`2023-01-0${n + 1}`, lang, { weekday: 'short' })}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="setting">
            <span>{t('shift_hours')}</span>
            <span className="time-range">
              <input type="time" aria-label={t('start')} value={project.shift_start || '07:00'} onChange={(e) => e.target.value && e.target.value < (project.shift_end || '16:00') && style({ shift_start: e.target.value })} />
              –
              <input type="time" aria-label={t('end')} value={project.shift_end || '16:00'} onChange={(e) => e.target.value && e.target.value > (project.shift_start || '07:00') && style({ shift_end: e.target.value })} />
            </span>
          </div>
          <small className="muted">{t('work_time_hint')}</small>
        </Card>

        <Card title={t('project_details')}>
          <form onSubmit={save}>
            <div className="form-grid">
              {fields.map((f) => (
                <Field key={f.key} field={f} value={form[f.key]} onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))} />
              ))}
            </div>
            <div className="modal-foot">
              <button
                type="button"
                className="btn danger"
                onClick={async () => {
                  if (!confirm(t('confirm_delete_project'))) return;
                  nav('');
                  await deleteProject(project.id);
                }}
              >
                <Icon name="trash" size={16} />
                {t('delete_project')}
              </button>
              <span className="spacer" />
              <button className="btn primary" type="submit">{t('save')}</button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
