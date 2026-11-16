import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useStore, addRow, updateRow, replaceAll, loadDemo, notify, COLLECTIONS } from '../lib/store';
import { Card, Icon, Field, Segmented, PageHead } from '../components/ui';
import { downloadFile, todayISO } from '../lib/utils';

export default function Settings({ theme, setTheme }) {
  const { t, lang, setLang } = useI18n();
  const { data, mode, cloudErrors } = useStore();
  const project = data.project[0];
  const [form, setForm] = useState(project || { name: '', address: '', client: '', manager: '', start_date: '', end_date: '', currency: '₪' });
  const fileRef = useRef(null);
  useEffect(() => {
    if (project) setForm(project);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const fields = [
    { key: 'name', label: t('project_name') },
    { key: 'address', label: t('address') },
    { key: 'client', label: t('client'), half: true },
    { key: 'manager', label: t('site_manager'), half: true },
    { key: 'start_date', label: t('start'), type: 'date', half: true },
    { key: 'end_date', label: t('handover'), type: 'date', half: true },
    { key: 'currency', label: t('currency'), type: 'select', half: true, options: ['₪', '$', '€', '£'].map((c) => ({ value: c, label: c })) },
  ];
  const save = (e) => {
    e.preventDefault();
    if (form.start_date && form.end_date && form.end_date < form.start_date) return notify('date_order', 'error');
    const row = { ...form, start_date: form.start_date || null, end_date: form.end_date || null };
    project ? updateRow('project', project.id, row) : addRow('project', row);
    notify('saved');
  };
  const restore = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      if (!json || !COLLECTIONS.some((c) => Array.isArray(json[c]))) throw new Error('bad file');
      if (!confirm(t('confirm_restore'))) return;
      await replaceAll(json);
      notify('restored');
    } catch {
      notify('bad_backup', 'error');
    }
  };

  return (
    <>
      <PageHead title={t('nav_settings')} subtitle={t('settings_sub')} />
      <div className="grid two-col">
        <Card title={t('project_details')}>
          <form onSubmit={save}>
            <div className="form-grid">
              {fields.map((f) => (
                <Field key={f.key} field={f} value={form[f.key]} onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))} />
              ))}
            </div>
            <div className="modal-foot">
              <span className="spacer" />
              <button className="btn primary" type="submit">{t('save')}</button>
            </div>
          </form>
        </Card>

        <div className="stack">
          <Card title={t('appearance')}>
            <div className="setting">
              <span>{t('language')}</span>
              <Segmented value={lang} onChange={setLang} options={[{ value: 'he', label: 'עברית' }, { value: 'en', label: 'English' }]} />
            </div>
            <div className="setting">
              <span>{t('theme')}</span>
              <Segmented
                value={theme}
                onChange={setTheme}
                options={[
                  { value: 'auto', label: t('theme_auto') },
                  { value: 'light', label: t('theme_light'), icon: 'sun' },
                  { value: 'dark', label: t('theme_dark'), icon: 'moon' },
                ]}
              />
            </div>
          </Card>

          <Card title={t('data')}>
            <div className="setting">
              <span>
                <span className={`mode-dot ${mode}`} /> {t(mode === 'cloud' ? 'mode_cloud' : 'mode_local')}
              </span>
              <small>{t(mode === 'cloud' ? 'mode_cloud_hint' : 'mode_local_hint')}</small>
            </div>
            {cloudErrors.length > 0 && <p className="form-error">{t('cloud_missing_tables')}: {cloudErrors.join(', ')}</p>}
            <div className="btn-row">
              <button className="btn" onClick={() => downloadFile(`site-manager-backup-${todayISO()}.json`, JSON.stringify(data, null, 2), 'application/json')}>
                <Icon name="download" size={16} />
                {t('backup')}
              </button>
              <button className="btn" onClick={() => fileRef.current.click()}>
                <Icon name="upload" size={16} />
                {t('restore')}
              </button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={restore} />
              <button
                className="btn danger"
                onClick={async () => {
                  if (!confirm(t('confirm_demo'))) return;
                  await loadDemo(lang);
                  notify('demo_loaded');
                }}
              >
                <Icon name="box" size={16} />
                {t('load_demo')}
              </button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
