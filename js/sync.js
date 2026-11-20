// Sync via a private (secret) GitHub Gist. No server needed.
// Both phones point at the same Gist ID with a token that has "gist" scope.

import { getRaw, replaceRaw, merge, prefs, setPrefs } from './store.js';

const FILE = 'jandypump-data.json';
const API = 'https://api.github.com/gists';

// Only headers GitHub's CORS policy allows from a browser (no custom X- headers).
const headers = token => ({
  'Accept': 'application/vnd.github+json',
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
});

const liveSessions = d => (d.sessions || []).filter(r => !r.deleted);

export const syncConfigured = () => { const p = prefs(); return !!(p.gistId && p.token); };

export async function createGist(token) {
  const res = await fetch(API, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      description: 'JandyPump workout data',
      public: false,
      files: { [FILE]: { content: JSON.stringify(getRaw()) } },
    }),
  });
  if (!res.ok) throw new Error(`GitHub said ${res.status}: ${(await res.json().catch(() => ({}))).message || ''}`);
  const gist = await res.json();
  setPrefs({ gistId: gist.id, token });
  return gist.id;
}

async function pull(p) {
  const res = await fetch(`${API}/${p.gistId}`, { headers: headers(p.token), cache: 'no-store' });
  if (res.status === 404) throw new Error('Gist not found: check the Gist ID matches on both phones');
  if (res.status === 401) throw new Error('GitHub token rejected: it may have expired or been mistyped');
  if (!res.ok) throw new Error(`Pull failed (${res.status})`);
  const gist = await res.json();
  const f = gist.files?.[FILE];
  if (!f) return {};
  let content = f.content;
  if (f.truncated) content = await (await fetch(f.raw_url, { cache: 'no-store' })).text();
  try { return JSON.parse(content || '{}'); } catch { return {}; }
}

async function push(p, payload) {
  const res = await fetch(`${API}/${p.gistId}`, {
    method: 'PATCH',
    headers: headers(p.token),
    body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(payload) } } }),
  });
  if (res.status === 403 || res.status === 404) throw new Error('Token can read but not write this gist: it needs Gists read & write, from the gist owner\'s account');
  if (!res.ok) throw new Error(`Push failed (${res.status})`);
}

let running = null;
export function sync() {
  if (!syncConfigured()) return Promise.resolve({ skipped: true });
  if (!navigator.onLine) return Promise.resolve({ offline: true });
  if (running) return running;
  running = (async () => {
    const p = prefs();
    const before = new Set(liveSessions(getRaw()).map(r => r.id));
    const remote = await pull(p);
    const merged = merge(getRaw(), remote);
    const pulled = liveSessions(merged).filter(r => !before.has(r.id)).length;
    const sig = d => JSON.stringify(['sessions', 'goals', 'customExercises'].map(c =>
      (d[c] || []).map(r => r.id + '@' + r.updatedAt).sort()));
    const changedRemote = sig(merged) !== sig(remote);
    replaceRaw(merged);
    if (changedRemote) await push(p, merged);
    setPrefs({ lastSync: new Date().toISOString(), lastError: '', cloudSessions: liveSessions(merged).length });
    return { ok: true, pulled, pushed: changedRemote };
  })().catch(err => {
    // fetch() throws a TypeError when the request never reached GitHub (offline, blocked, CORS)
    const msg = err instanceof TypeError ? 'Could not reach GitHub (no signal, or the request was blocked)' : err.message;
    setPrefs({ lastError: `${msg} · ${new Date().toLocaleString()}` });
    throw new Error(msg);
  }).finally(() => { running = null; });
  return running;
}
