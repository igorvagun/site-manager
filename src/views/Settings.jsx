import { useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useStore, useUser, replaceAll, loadDemo, notify, removeRow, COLLECTIONS } from '../lib/store';
import { Card, Icon, IconButton, Segmented, PageHead } from '../components/ui';
import { downloadFile, todayISO } from '../lib/utils';
import { readPrefs, writePrefs } from '../components/Notifications';
import { homeStyle, setHomeStyle } from '../lib/prefs';
import { WALLPAPERS, ACCENTS } from '../lib/apps';

export default function Settings({ theme, setTheme }) {
  const { t, lang, setLang } = useI18n();
  const { data, mode, cloudErrors } = useStore();
  const user = useUser();
  const fileRef = useRef(null);
  const isManager = user?.role === 'manager';
  const [prefs, setPrefs] = useState(() => readPrefs(user.id));
  const toggle = (k) => {
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next);
    writePrefs(user.id, next);
  };
  const [home, setHome] = useState(() => homeStyle(user.id));
  const style = (patch) => {
    const next = { ...home, ...patch };
    setHome(next);
    setHomeStyle(user.id, next);
  };
  const notifKinds = user.role === 'worker' ? ['messages'] : ['shifts', 'tasks', 'messages'];

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
          <Card title={t('notifications')}>
            {notifKinds.map((k) => (
              <label className="setting switch-row" key={k}>
                <span>{t('notify_' + k)}</span>
                <input type="checkbox" role="switch" checked={!!prefs[k]} onChange={() => toggle(k)} />
              </label>
            ))}
          </Card>
          <Card title={t('appearance')}>
            <div className="setting">
              <span>{t('language')}</span>
              <Segmented value={lang} onChange={setLang} options={[{ value: 'he', label: 'עברית' }, { value: 'en', label: 'English' }, { value: 'ru', label: 'Русский' }]} />
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
            <div className="setting col">
              <span>{t('home_look')}</span>
              <div className="swatches">
                {WALLPAPERS.map((w) => (
                  <button key={w} className={`wall-swatch ${home.wallpaper === w ? 'on' : ''}`} data-wall={w} aria-pressed={home.wallpaper === w} onClick={() => style({ wallpaper: w })}>
                    <i />
                    <span>{t('wall_' + w)}</span>
                  </button>
                ))}
              </div>
              <div className="swatches">
                {ACCENTS.map((a) => (
                  <button key={a} className={`accent-swatch ${home.accent === a ? 'on' : ''}`} data-accent={a} aria-pressed={home.accent === a} aria-label={t('accent_' + a)} title={t('accent_' + a)} onClick={() => style({ accent: a })}>
                    {home.accent === a && <Icon name="check" size={18} />}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="stack">
        {isManager && (
          <Card title={t('my_templates')}>
            {(data.templates || []).length === 0 ? (
              <p className="muted">{t('no_templates')}</p>
            ) : (
              <ul className="list">
                {data.templates.map((x) => (
                  <li key={x.id} className="tpl-row">
                    <span className="grow">
                      <b>{x.name}</b>
                      <small>{x.steps.map((s) => s.name).join(' → ')}</small>
                    </span>
                    <span className="seg-count">{x.steps.length}</span>
                    <IconButton icon="trash" size={16} label={`${t('delete')}: ${x.name}`} onClick={() => removeRow('templates', x.id)} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        <Card title={t('data')}>
          <div className="setting">
            <span>
              <span className={`mode-dot ${mode}`} /> {t(mode === 'cloud' ? 'mode_cloud' : 'mode_local')}
            </span>
            <small>{t(mode === 'cloud' ? 'mode_cloud_hint' : 'mode_local_hint')}</small>
          </div>
          {cloudErrors.length > 0 && <p className="form-error">{t('cloud_missing_tables')}: {cloudErrors.join(', ')}</p>}
          <small className="muted">{t('backup_note')}</small>
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
      </div>
    </>
  );
}
