// Sync via a private (secret) GitHub Gist. No server needed.
// Both phones point at the same Gist ID with a token that has "gist" scope.

import { getRaw, replaceRaw, merge, prefs, setPrefs } from './store.js';

const FILE = 'jandypump-data.json';
const API = 'https://api.github.com/gists';

const headers = token => ({
  'Accept': 'application/vnd.github+json',
  'Authorization': `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
  'Content-Type': 'application/json',
});

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
  if (!res.ok) throw new Error(`GitHub said ${res.status}: ${(await res.json()).message || ''}`);
  const gist = await res.json();
  setPrefs({ gistId: gist.id, token });
  return gist.id;
}

async function pull(p) {
  const res = await fetch(`${API}/${p.gistId}`, { headers: headers(p.token), cache: 'no-store' });
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
  if (!res.ok) throw new Error(`Push failed (${res.status})`);
}

let running = null;
export function sync() {
  if (!syncConfigured()) return Promise.resolve({ skipped: true });
  if (!navigator.onLine) return Promise.resolve({ offline: true });
  if (running) return running;
  running = (async () => {
    const p = prefs();
    const remote = await pull(p);
    const merged = merge(getRaw(), remote);
    const sig = d => JSON.stringify(['sessions', 'goals', 'customExercises'].map(c =>
      (d[c] || []).map(r => r.id + '@' + r.updatedAt).sort()));
    const changedRemote = sig(merged) !== sig(remote);
    replaceRaw(merged);
    if (changedRemote) await push(p, merged);
    setPrefs({ lastSync: new Date().toISOString() });
    return { ok: true };
  })().finally(() => { running = null; });
  return running;
}
