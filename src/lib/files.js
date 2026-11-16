import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { getState } from './store';
import { uid } from './utils';

// Binary files (drawings, voice and video notes, receipt photos).
// Local mode keeps them in the browser's IndexedDB; cloud mode uses the Supabase Storage bucket "files".
const DB = 'site-manager-files';
const STORE = 'files';
const BUCKET = 'files';
const cloud = () => getState().mode === 'cloud' && supabase;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idb(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function putFile(blob) {
  const id = uid();
  if (cloud()) {
    const { error } = await supabase.storage.from(BUCKET).upload(id, blob, { contentType: blob.type || 'application/octet-stream' });
    if (error) throw error;
  } else {
    await idb('readwrite', (s) => s.put(blob, id));
  }
  return id;
}

export async function getFileBlob(id) {
  if (cloud()) {
    const { data, error } = await supabase.storage.from(BUCKET).download(id);
    if (error) throw error;
    return data;
  }
  return (await idb('readonly', (s) => s.get(id))) || null;
}

const urls = new Map();
export async function getFileURL(id) {
  if (!id) return null;
  if (urls.has(id)) return urls.get(id);
  const blob = await getFileBlob(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urls.set(id, url);
  return url;
}

// Deletion is delayed a few seconds so "Undo" can still bring the record back with its file.
const pending = new Map();
export function deleteFile(id) {
  if (!id || pending.has(id)) return;
  pending.set(id, setTimeout(() => {
    pending.delete(id);
    deleteFileNow(id);
  }, 9000));
}
export function cancelFileDeletes() {
  pending.forEach((timer) => clearTimeout(timer));
  pending.clear();
}

async function deleteFileNow(id) {
  if (urls.has(id)) {
    URL.revokeObjectURL(urls.get(id));
    urls.delete(id);
  }
  try {
    if (cloud()) await supabase.storage.from(BUCKET).remove([id]);
    else await idb('readwrite', (s) => s.delete(id));
  } catch (e) {
    console.error(e);
  }
}

// → { url, missing } ; url is null while loading.
export function useFileURL(id) {
  const [state, setState] = useState({ url: id ? urls.get(id) || null : null, missing: false });
  useEffect(() => {
    let live = true;
    if (!id) return setState({ url: null, missing: false });
    getFileURL(id)
      .then((url) => live && setState({ url, missing: !url }))
      .catch(() => live && setState({ url: null, missing: true }));
    return () => {
      live = false;
    };
  }, [id]);
  return state;
}

export const dataURLToBlob = (dataURL) => fetch(dataURL).then((r) => r.blob());
export const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
