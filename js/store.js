// Local-first data store. Everything lives in localStorage and is
// optionally synced to a private GitHub Gist (see sync.js).
//
// Every synced record has { id, updatedAt } and may carry deleted: true
// (a tombstone), so two phones can merge their data without conflicts.

const KEY = 'jandypump.data.v1';
const DRAFT_KEY = 'jandypump.draft.v1';
const PREFS_KEY = 'jandypump.prefs.v1';

const empty = () => ({ sessions: [], goals: [], customExercises: [] });
const COLLECTIONS = ['sessions', 'goals', 'customExercises'];

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.warn('save failed', e); }
}

let data = Object.assign(empty(), readJSON(KEY, {}));
const listeners = new Set();

export const onChange = fn => listeners.add(fn);
function emit() { listeners.forEach(fn => fn()); }

export function persist() { writeJSON(KEY, data); emit(); }

export function getRaw() { return data; }
export function replaceRaw(next) { data = Object.assign(empty(), next); persist(); }

const live = arr => arr.filter(r => !r.deleted);

export const sessions = () =>
  live(data.sessions).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
export const goals = () => live(data.goals);
export const customExercises = () => live(data.customExercises);

export function upsert(collection, record) {
  record.updatedAt = new Date().toISOString();
  const list = data[collection];
  const i = list.findIndex(r => r.id === record.id);
  if (i >= 0) list[i] = record; else list.push(record);
  persist();
  return record;
}

export function remove(collection, id) {
  const rec = data[collection].find(r => r.id === id);
  if (!rec) return;
  // Keep a tombstone so the deletion syncs to the other phone.
  Object.keys(rec).forEach(k => { if (!['id'].includes(k)) delete rec[k]; });
  rec.deleted = true;
  rec.updatedAt = new Date().toISOString();
  persist();
}

// Merge two datasets record-by-record; newest updatedAt wins.
export function merge(a, b) {
  const out = empty();
  for (const c of COLLECTIONS) {
    const map = new Map();
    for (const r of [...(a[c] || []), ...(b[c] || [])]) {
      const prev = map.get(r.id);
      if (!prev || (r.updatedAt || '') > (prev.updatedAt || '')) map.set(r.id, r);
    }
    out[c] = [...map.values()];
  }
  return out;
}

// In-progress session (device-local, not synced until finished)
export const getDraft = () => readJSON(DRAFT_KEY, null);
export const saveDraft = d => d ? writeJSON(DRAFT_KEY, d) : localStorage.removeItem(DRAFT_KEY);

// Preferences (device-local)
const defaultPrefs = { person: 'jazz', gistId: '', token: '', lastSync: '' };
export const prefs = () => Object.assign({}, defaultPrefs, readJSON(PREFS_KEY, {}));
export const setPrefs = patch => writeJSON(PREFS_KEY, Object.assign(prefs(), patch));
