import { useMemo, useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { buildSeed } from './seed';
import { uid } from './utils';

// Collections shared by the whole account vs. rows that belong to one project.
export const GLOBAL = ['users', 'positions', 'projects', 'templates'];
export const SCOPED = [
  'tasks',
  'workers',
  'attendance',
  'logs',
  'expenses',
  'budget_lines',
  'change_orders',
  'issues',
  'safety',
  'materials',
  'drawings',
  'messages',
  'shifts',
  'todos',
  'contacts',
  'equipment',
];
export const COLLECTIONS = [...GLOBAL, ...SCOPED];

const LS_KEY = 'site-manager:data:v2';
const SESSION_KEY = 'site-manager:session';
const readSession = () => {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
};
const emptyData = () => Object.fromEntries(COLLECTIONS.map((c) => [c, []]));

let state = {
  data: emptyData(),
  loading: true,
  mode: supabase ? 'cloud' : 'local',
  cloudErrors: [],
  toasts: [],
  projectId: null,
  userId: readSession(),
};
const listeners = new Set();

function set(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function persist() {
  if (state.mode !== 'local') return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state.data));
  } catch (e) {
    notify('storage_full', 'error');
  }
}

// Snapshot of the data taken just before the current burst of changes, so a delete can be undone
// together with the clean-up edits that came with it.
let burstStart = null;
let lastChange = 0;
function setRows(name, fn) {
  const now = Date.now();
  if (now - lastChange > 300) burstStart = state.data;
  lastChange = now;
  set({ data: { ...state.data, [name]: fn(state.data[name] || []) } });
  persist();
}

export function notify(message, type = 'info', action = null) {
  const id = uid();
  set({ toasts: [...state.toasts.filter((t) => !action || !t.action), { id, message, type, action }] });
  setTimeout(() => dismissToast(id), action ? UNDO_MS : 3800);
}
export const dismissToast = (id) => set({ toasts: state.toasts.filter((t) => t.id !== id) });

export const UNDO_MS = 7000;
let undoTimer = null;
function offerUndo() {
  const snapshot = burstStart;
  clearTimeout(undoTimer);
  // One toast per burst, shown once the related deletes have all happened.
  undoTimer = setTimeout(() => {
    if (state.toasts.some((t) => t.action?.snapshot === snapshot)) return;
    notify('deleted', 'info', { label: 'undo', snapshot, run: () => restore(snapshot) });
  }, 60);
}

async function restore(snapshot) {
  if (!snapshot) return;
  const { cancelFileDeletes } = await import('./files');
  cancelFileDeletes();
  const now = state.data;
  if (remote()) {
    for (const name of COLLECTIONS) {
      const current = new Map((now[name] || []).map((r) => [r.id, r]));
      const missing = snapshot[name].filter((r) => !current.has(r.id));
      const changed = snapshot[name].filter((r) => current.has(r.id) && current.get(r.id) !== r);
      if (missing.length) await supabase.from(name).insert(missing);
      for (const r of changed) await supabase.from(name).update(r).eq('id', r.id);
    }
  }
  // Keep anything created after the snapshot; bring back what was removed or edited.
  const next = {};
  COLLECTIONS.forEach((name) => {
    const old = new Set(snapshot[name].map((r) => r.id));
    next[name] = [...snapshot[name], ...(now[name] || []).filter((r) => !old.has(r.id))];
  });
  set({ data: next });
  persist();
  notify('restored_item');
}

function useLocal(lang) {
  let data = null;
  try {
    data = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
  } catch {
    data = null;
  }
  if (!data || !Array.isArray(data.projects)) data = buildSeed(lang);
  set({ data: { ...emptyData(), ...data }, loading: false, mode: 'local' });
  persist();
}

let started = false;
export async function initStore(lang) {
  if (started) return;
  started = true;
  if (!supabase) return useLocal(lang);
  await restoreCloudSession();

  const results = await Promise.all(
    COLLECTIONS.map(async (name) => {
      try {
        const { data, error } = await supabase.from(name).select('*');
        return { name, data, error };
      } catch (error) {
        return { name, data: null, error };
      }
    })
  );
  const failed = results.filter((r) => r.error);
  if (failed.length === COLLECTIONS.length) {
    // Cloud is unreachable or not set up at all — keep the app usable.
    console.error('Supabase unavailable, falling back to local mode', failed[0].error);
    useLocal(lang);
    set({ cloudErrors: failed.map((f) => f.name) });
    notify('cloud_unavailable', 'error');
    return;
  }
  const data = emptyData();
  results.forEach((r) => {
    if (r.data) data[r.name] = r.data;
  });
  set({ data, loading: false, cloudErrors: failed.map((f) => f.name) });
  if (failed.length) notify('cloud_missing_tables', 'error');

  supabase
    .channel('site-manager')
    .on('postgres_changes', { event: '*', schema: 'public' }, (p) => {
      if (!COLLECTIONS.includes(p.table)) return;
      if (p.eventType === 'DELETE') {
        setRows(p.table, (rows) => rows.filter((r) => r.id !== p.old.id));
      } else {
        setRows(p.table, (rows) =>
          rows.some((r) => r.id === p.new.id)
            ? rows.map((r) => (r.id === p.new.id ? { ...r, ...p.new } : r))
            : [...rows, p.new]
        );
      }
    })
    .subscribe();
}

const remote = () => state.mode === 'cloud' && supabase;

export async function addRow(name, row) {
  const full = { id: uid(), created_at: new Date().toISOString(), ...row };
  if (SCOPED.includes(name) && !full.project_id) full.project_id = state.projectId;
  setRows(name, (rows) => [...rows, full]);
  if (remote()) {
    const { error } = await supabase.from(name).insert(full);
    if (error) {
      console.error(error);
      setRows(name, (rows) => rows.filter((r) => r.id !== full.id));
      notify('save_failed', 'error');
      return null;
    }
  }
  return full;
}

export async function updateRow(name, id, patch) {
  const prev = (state.data[name] || []).find((r) => r.id === id);
  if (!prev) return;
  setRows(name, (rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  if (remote()) {
    const { error } = await supabase.from(name).update(patch).eq('id', id);
    if (error) {
      console.error(error);
      setRows(name, (rows) => rows.map((r) => (r.id === id ? prev : r)));
      notify('save_failed', 'error');
    }
  }
}

export async function removeRow(name, id, { silent = false } = {}) {
  const prev = (state.data[name] || []).find((r) => r.id === id);
  if (!prev) return;
  setRows(name, (rows) => rows.filter((r) => r.id !== id));
  if (!bulk && !silent) offerUndo();
  if (remote()) {
    const { error } = await supabase.from(name).delete().eq('id', id);
    if (error) {
      console.error(error);
      setRows(name, (rows) => [...rows, prev]);
      notify('save_failed', 'error');
    }
  }
}

// Replace everything (demo reset / backup restore).
let bulk = false; // demo reset / project delete are confirmed separately and are not undoable
export async function replaceAll(data) {
  const next = { ...emptyData() };
  COLLECTIONS.forEach((c) => {
    if (Array.isArray(data[c])) next[c] = data[c];
  });
  if (remote()) {
    for (const name of COLLECTIONS) {
      const ids = (state.data[name] || []).map((r) => r.id);
      if (ids.length) {
        const { error } = await supabase.from(name).delete().in('id', ids);
        if (error) return notify('save_failed', 'error');
      }
      if (next[name].length) {
        const { error } = await supabase.from(name).insert(next[name]);
        if (error) return notify('save_failed', 'error');
      }
    }
  }
  set({ data: next });
  persist();
  if (!next.users.some((u) => u.id === state.userId)) logout();
}

// ───── Session ─────
function setSession(userId) {
  try {
    if (userId) localStorage.setItem(SESSION_KEY, userId);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* private mode */
  }
  set({ userId: userId || null });
}

async function restoreCloudSession() {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data?.session) set({ userId: null });
  } catch {
    set({ userId: null });
  }
}

// Demo accounts all use this password in local mode; real auth goes through Supabase.
export const DEMO_PASSWORD = 'demo';

export async function login(email, password) {
  const user = state.data.users.find((u) => (u.email || '').toLowerCase() === String(email).trim().toLowerCase());
  if (remote()) {
    const { error } = await supabase.auth.signInWithPassword({ email: String(email).trim(), password });
    if (error) return 'login_bad';
    if (!user) return 'login_no_profile';
  } else if (!user || password !== DEMO_PASSWORD) {
    return 'login_bad';
  }
  setSession(user.id);
  return null;
}

export function loginAs(userId) {
  if (state.mode === 'local' && state.data.users.some((u) => u.id === userId)) setSession(userId);
}

export function logout() {
  if (remote()) supabase.auth.signOut().catch(() => {});
  setSession(null);
}

export function setProject(id) {
  if (state.projectId !== id) set({ projectId: id });
}

export async function deleteProject(id) {
  bulk = true;
  try {
    await removeProjectRows(id);
  } finally {
    bulk = false;
  }
}
async function removeProjectRows(id) {
  for (const name of SCOPED) {
    for (const r of state.data[name].filter((x) => x.project_id === id)) await removeRow(name, r.id);
  }
  await removeRow('projects', id);
}

export const loadDemo = (lang) => replaceAll(buildSeed(lang));
export const getState = () => state;

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export function useStore() {
  return useSyncExternalStore(subscribe, getState);
}
// Data as seen from inside the open project: scoped rows are filtered to it.
export function useData() {
  const { data, projectId } = useStore();
  return useMemo(() => {
    const out = {};
    GLOBAL.forEach((c) => (out[c] = data[c]));
    SCOPED.forEach((c) => (out[c] = data[c].filter((r) => r.project_id === projectId)));
    out.project = data.projects.filter((p) => p.id === projectId);
    return out;
  }, [data, projectId]);
}

export function useUser() {
  const { data, userId } = useStore();
  return data.users.find((u) => u.id === userId) || null;
}
