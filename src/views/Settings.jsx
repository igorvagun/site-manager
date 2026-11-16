import { useRef } from 'react';
import { useI18n } from '../lib/i18n';
import { useStore, useUser, replaceAll, loadDemo, notify, COLLECTIONS } from '../lib/store';
import { Card, Icon, Segmented, PageHead } from '../components/ui';
import { downloadFile, todayISO } from '../lib/utils';

export default function Settings({ theme, setTheme }) {
  const { t, lang, setLang } = useI18n();
  const { data, mode, cloudErrors } = useStore();
  const user = useUser();
  const fileRef = useRef(null);
  const isManager = user?.role === 'manager';

  const restore = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      if (!json || !Array.isArray(json.projects) || !Array.isArray(json.users)) throw new Error('bad file');
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
        <div className="stack">
          <Card title={t('account')}>
            <div className="setting">
              <span className="user-chip">
                <span className="avatar">{user.name.slice(0, 1)}</span>
                <span className="user-name">
                  <b>{user.name}</b>
                  <small dir="ltr">{user.email}</small>
                </span>
              </span>
              <span className="badge tone-blue">{t('role_' + user.role)}</span>
            </div>
          </Card>
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
        </div>

        <Card title={t('data')}>
          <div className="setting">
            <span>
              <span className={`mode-dot ${mode}`} /> {t(mode === 'cloud' ? 'mode_cloud' : 'mode_local')}
            </span>
            <small>{t(mode === 'cloud' ? 'mode_cloud_hint' : 'mode_local_hint')}</small>
          </div>
          {cloudErrors.length > 0 && <p className="form-error">{t('cloud_missing_tables')}: {cloudErrors.join(', ')}</p>}
          {isManager && (
            <div className="btn-row">
              <button className="btn" onClick={() => downloadFile(`site-manager-backup-${todayISO()}.json`, JSON.stringify(Object.fromEntries(COLLECTIONS.map((c) => [c, data[c]])), null, 2), 'application/json')}>
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
          )}
        </Card>
      </div>
    </>
  );
}
