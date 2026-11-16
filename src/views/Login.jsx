import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useStore, login, loginAs, DEMO_PASSWORD } from '../lib/store';
import { Icon } from '../components/ui';

export default function Login({ controls }) {
  const { t } = useI18n();
  const { data, mode } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const err = await login(email, password);
    setBusy(false);
    setError(err);
  };

  return (
    <div className="login">
      <div className="login-top">{controls}</div>
      <div className="glass login-card">
        <div className="brand-mark big">
          <Icon name="hardhat" size={34} />
        </div>
        <h1>Site Manager</h1>
        <p>{t('login_sub')}</p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="login-email">{t('email')}</label>
            <input id="login-email" type="email" autoComplete="username" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" required />
          </div>
          <div className="field">
            <label htmlFor="login-password">{t('password')}</label>
            <input id="login-password" type="password" autoComplete="current-password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && (
            <p className="form-error" role="alert">
              {t(error)}
            </p>
          )}
          <button className="btn primary wide" type="submit" disabled={busy}>
            {t('sign_in')}
          </button>
        </form>

        {mode === 'local' && (
          <div className="demo-accounts">
            <div className="divider">
              <span>{t('demo_accounts')}</span>
            </div>
            {data.users.map((u) => (
              <button key={u.id} className="demo-user" onClick={() => loginAs(u.id)}>
                <span className="avatar">{u.name.slice(0, 1)}</span>
                <span className="grow">
                  <b>{u.name}</b>
                  <small dir="ltr">{u.email}</small>
                </span>
                <span className="badge tone-blue">{t('role_' + u.role)}</span>
              </button>
            ))}
            <small className="demo-hint">
              {t('demo_hint')} <code>{DEMO_PASSWORD}</code>
            </small>
          </div>
        )}
      </div>
    </div>
  );
}
