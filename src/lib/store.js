import { useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { buildSeed } from './seed';
import { uid } from './utils';

export const COLLECTIONS = [
  'project',
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
];

const LS_KEY = 'site-manager:data:v1';
const emptyData = () => Object.fromEntries(COLLECTIONS.map((c) => [c, []]));

let state = {
  data: emptyData(),
  loading: true,
  mode: supabase ? 'cloud' : 'local',
  cloudErrors: [],
  toasts: [],
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

function setRows(name, fn) {
  set({ data: { ...state.data, [name]: fn(state.data[name] || []) } });
  persist();
}

export function notify(message, type = 'info') {
  const id = uid();
  set({ toasts: [...state.toasts, { id, message, type }] });
  setTimeout(() => set({ toasts: state.toasts.filter((t) => t.id !== id) }), 3800);
}

function useLocal(lang) {
  let data = null;
  try {
    data = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
  } catch {
    data = null;
  }
  if (!data || !Array.isArray(data.tasks)) data = buildSeed(lang);
  set({ data: { ...emptyData(), ...data }, loading: false, mode: 'local' });
  persist();
}

let started = false;
export async function initStore(lang) {
  if (started) return;
  started = true;
  if (!supabase) return useLocal(lang);

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

export async function removeRow(name, id) {
  const prev = (state.data[name] || []).find((r) => r.id === id);
  if (!prev) return;
  setRows(name, (rows) => rows.filter((r) => r.id !== id));
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
export function useData() {
  return useStore().data;
}
