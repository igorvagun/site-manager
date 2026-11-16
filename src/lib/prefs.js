// Small per-user preferences kept in the browser.
const read = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    dispatchEvent(new Event('site-manager:prefs'));
  } catch {
    /* private mode */
  }
};

export const homeStyle = (uid) => ({ wallpaper: 'aurora', accent: 'blue', ...read(`site-manager:home-style:${uid}`, {}) });
export const setHomeStyle = (uid, style) => write(`site-manager:home-style:${uid}`, style);

// When each app was last opened, used for "new since you last looked" badges.
const openedKey = (uid, pid, app) => `site-manager:opened:${uid}:${pid}:${app}`;
export const lastOpened = (uid, pid, app) => read(openedKey(uid, pid, app), '');
export const markOpened = (uid, pid, app) => write(openedKey(uid, pid, app), new Date().toISOString());

// Apps a person chose to hide from their project desktops (still reachable through search).
export const hiddenApps = (uid) => read(`site-manager:hidden-apps:${uid}`, []);
export const setHiddenApps = (uid, ids) => write(`site-manager:hidden-apps:${uid}`, ids);

// The order a person arranged their project apps in (ids; anything not listed keeps its default place).
export const appOrder = (uid) => read(`site-manager:app-order:${uid}`, []);
export const setAppOrder = (uid, ids) => write(`site-manager:app-order:${uid}`, ids);
