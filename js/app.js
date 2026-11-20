import { GROUPS, EXERCISES, PEOPLE } from './exercises.js';
import * as store from './store.js';
import { sync, syncConfigured, createGist } from './sync.js';
import { lineChart } from './chart.js';

// ---------- helpers ----------
const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const toLocalInput = iso => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const monthKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const monthLabel = k => { const [y, m] = k.split('-'); return new Date(+y, +m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); };
const shiftMonth = (k, by) => { const [y, m] = k.split('-').map(Number); return monthKey(new Date(y, m - 1 + by, 1)); };
const fmtDateTime = iso => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtNum = n => (Math.round(n * 10) / 10).toLocaleString();
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const personOf = id => PEOPLE.find(p => p.id === id) || PEOPLE[0];
const groupOf = id => GROUPS.find(g => g.id === id) || { label: id, icon: '•' };

const allExercises = () => [...EXERCISES, ...store.customExercises()];
const exById = id => allExercises().find(e => e.id === id);

const TAGLINES = [
  'Every rep is a round. Win the round.',
  'Gloves on. Excuses off.',
  'Cue the montage.',
  'Stairs today. Summit tomorrow.',
  'Not the hardest hit — the most comebacks.',
  'Sweat now, shine later.',
  'One more round. Always one more round.',
];

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}

// ---------- state ----------
let view = 'plan';
let plan = loadPlan();
let historyFilter = 'all';
let stats = { exId: null, metric: 'top' };
let goalsMonth = monthKey(new Date());
let tagline = pick(TAGLINES);

function loadPlan() {
  try { return JSON.parse(localStorage.getItem('jandypump.plan')) || { groups: ['legs'], count: 6, items: [] }; }
  catch { return { groups: ['legs'], count: 6, items: [] }; }
}
const savePlan = () => localStorage.setItem('jandypump.plan', JSON.stringify(plan));

const person = () => store.prefs().person;

// ---------- data queries ----------
function lastPerformance(personId, exId, excludeSessionId) {
  for (const s of store.sessions()) {
    if (s.person !== personId || s.id === excludeSessionId) continue;
    const e = s.exercises.find(x => x.exId === exId);
    if (e && e.sets.length) return { session: s, ex: e };
  }
  return null;
}
const topSet = sets => sets.reduce((best, s) =>
  (!best || (+s.weight || 0) > (+best.weight || 0) || ((+s.weight || 0) === (+best.weight || 0) && (+s.reps || 0) > (+best.reps || 0))) ? s : best, null);
const setsVolume = sets => sets.reduce((v, s) => v + (+s.reps || 0) * (+s.weight || 0), 0);
const sessionVolume = s => s.exercises.reduce((v, e) => v + (e.unit === 'sec' ? 0 : setsVolume(e.sets)), 0);

function describeLast(personId, exId, excludeId) {
  const last = lastPerformance(personId, exId, excludeId);
  if (!last) return '';
  const t = topSet(last.ex.sets);
  const unit = last.ex.unit === 'sec' ? 's' : '';
  const w = +t.weight ? ` @ ${fmtNum(+t.weight)}kg` : '';
  return `Last: ${last.ex.sets.length}× ${t.reps || 0}${unit}${w}`;
}

// ---------- PLAN ----------
const PRESETS = [
  { label: 'Leg day', groups: ['legs', 'core'] },
  { label: 'Arms', groups: ['arms'] },
  { label: 'Back', groups: ['back'] },
  { label: 'Core', groups: ['core'] },
  { label: 'Upper body', groups: ['arms', 'back', 'chest', 'shoulders'] },
  { label: 'Full body', groups: ['legs', 'arms', 'back', 'core'] },
];

function randomise() {
  const N = plan.count;
  const kept = plan.items.filter(i => i.locked).slice(0, N);
  const used = new Set(kept.map(i => i.exId));
  const groups = plan.groups.length ? plan.groups : ['legs'];
  const pools = Object.fromEntries(groups.map(g => [g, shuffle(allExercises().filter(e => e.group === g && !used.has(e.id)))]));
  const items = [...kept];
  let gi = Math.floor(Math.random() * groups.length);
  let guard = 0;
  while (items.length < N && guard++ < 200) {
    const g = groups[gi++ % groups.length];
    const e = pools[g].shift();
    if (!e) { if (groups.every(x => !pools[x].length)) break; continue; }
    items.push({ exId: e.id, sets: e.sets, reps: e.reps, locked: false });
  }
  // Keep locked items where they were roughly, but group by muscle so flow is sensible
  const order = groups;
  plan.items = items.sort((a, b) => order.indexOf(exById(a.exId)?.group) - order.indexOf(exById(b.exId)?.group));
  tagline = pick(TAGLINES);
  savePlan();
}

function rerollItem(i) {
  const item = plan.items[i];
  const ex = exById(item.exId);
  const used = new Set(plan.items.map(x => x.exId));
  const options = allExercises().filter(e => e.group === ex?.group && !used.has(e.id));
  if (!options.length) return toast('No other exercises in that group!');
  const e = pick(options);
  plan.items[i] = { exId: e.id, sets: e.sets, reps: e.reps, locked: false };
  savePlan();
}

function renderPlan() {
  const p = person();
  const items = plan.items.map((it, i) => {
    const e = exById(it.exId);
    if (!e) return '';
    const last = describeLast(p, e.id);
    return `<li class="card plan-item ${it.locked ? 'locked' : ''}">
      <div class="round">R${i + 1}</div>
      <div class="pi-main">
        <div class="pi-name">${esc(e.name)}</div>
        <div class="pi-meta"><span class="tag tag-${e.group}">${groupOf(e.group).label}</span>
          <span class="rx">
            <input type="number" inputmode="numeric" min="1" max="20" value="${it.sets}" data-action="plan-sets" data-i="${i}" aria-label="sets"> ×
            <input type="number" inputmode="numeric" min="1" max="300" value="${it.reps}" data-action="plan-reps" data-i="${i}" aria-label="reps">${e.unit === 'sec' ? 's' : ''}
          </span></div>
        ${last ? `<div class="hint">${esc(last)}</div>` : ''}
      </div>
      <div class="pi-actions">
        <button class="mini" data-action="plan-lock" data-i="${i}" title="Lock">${it.locked ? '🔒' : '🔓'}</button>
        <button class="mini" data-action="plan-reroll" data-i="${i}" title="Swap">🎲</button>
        <button class="mini" data-action="plan-remove" data-i="${i}" title="Remove">✕</button>
      </div>
    </li>`;
  }).join('');

  app.innerHTML = `
    <section class="hero">
      <h2 class="chrome">Build the Montage</h2>
      <p class="tagline">${esc(tagline)}</p>
    </section>

    <section class="card">
      <h3>Focus</h3>
      <div class="chips">${GROUPS.map(g =>
        `<button class="chip ${plan.groups.includes(g.id) ? 'on' : ''}" data-action="plan-group" data-group="${g.id}">${g.icon} ${g.label}</button>`).join('')}</div>
      <div class="presets">${PRESETS.map((pr, i) =>
        `<button class="link" data-action="plan-preset" data-i="${i}">${pr.label}</button>`).join('')}</div>
      <div class="row between">
        <div class="stepper">
          <button data-action="plan-count" data-d="-1" aria-label="fewer">−</button>
          <span><b>${plan.count}</b> exercises</span>
          <button data-action="plan-count" data-d="1" aria-label="more">+</button>
        </div>
        <button class="btn btn-sun" data-action="plan-random">🎲 Randomise</button>
      </div>
    </section>

    ${plan.items.length ? `
      <ol class="plan-list">${items}</ol>
      <div class="row gap">
        <button class="btn btn-ghost" data-action="plan-add">＋ Add exercise</button>
        <button class="btn btn-ghost" data-action="plan-clear">Clear</button>
      </div>
      <button class="btn btn-big btn-neon" data-action="plan-start">▶ Start ${personOf(p).label}'s session</button>
    ` : `<p class="empty">Pick your focus and hit <b>Randomise</b> to generate a workout — or add exercises one by one.</p>
         <button class="btn btn-ghost" data-action="plan-add">＋ Add exercise</button>`}

    <details class="card library">
      <summary><h3>Exercise library <small>(${allExercises().length})</small></h3></summary>
      ${GROUPS.map(g => `
        <h4>${g.icon} ${g.label}</h4>
        <ul class="lib-list">${allExercises().filter(e => e.group === g.id).map(e =>
          `<li><span>${esc(e.name)} <small>${e.sets}×${e.reps}${e.unit === 'sec' ? 's' : ''}</small></span>
           ${e.custom ? `<button class="mini" data-action="custom-del" data-id="${e.id}" title="Delete">✕</button>` : ''}</li>`).join('')}</ul>`).join('')}
      <form class="custom-form" data-form="custom">
        <h4>Add your own</h4>
        <input name="name" placeholder="Exercise name" required maxlength="60">
        <div class="row gap">
          <select name="group">${GROUPS.map(g => `<option value="${g.id}">${g.label}</option>`).join('')}</select>
          <input name="sets" type="number" min="1" max="20" value="3" aria-label="sets">
          <input name="reps" type="number" min="1" max="300" value="10" aria-label="reps">
        </div>
        <label class="check"><input type="checkbox" name="timed"> Timed (seconds instead of reps)</label>
        <button class="btn btn-ghost" type="submit">Save exercise</button>
      </form>
    </details>`;
}

// ---------- LOG ----------
function newDraft(fromPlan) {
  const p = person();
  const draft = { id: store.uid(), person: p, startedAt: new Date().toISOString(), notes: '', exercises: [] };
  if (fromPlan) {
    draft.exercises = plan.items.map(it => {
      const e = exById(it.exId);
      if (!e) return null;
      const last = lastPerformance(p, e.id);
      const lastW = last ? (+topSet(last.ex.sets).weight || '') : '';
      return {
        exId: e.id, name: e.name, group: e.group, unit: e.unit || 'reps',
        sets: Array.from({ length: it.sets }, () => ({ reps: it.reps, weight: lastW, done: false })),
      };
    }).filter(Boolean);
  }
  store.saveDraft(draft);
  return draft;
}

function addExerciseToDraft(e) {
  const d = store.getDraft();
  if (!d) return;
  const last = lastPerformance(d.person, e.id);
  const lastW = last ? (+topSet(last.ex.sets).weight || '') : '';
  d.exercises.push({
    exId: e.id, name: e.name, group: e.group, unit: e.unit || 'reps',
    sets: Array.from({ length: e.sets }, () => ({ reps: e.reps, weight: lastW, done: false })),
  });
  store.saveDraft(d);
}

function renderLog() {
  const d = store.getDraft();
  let html = '';
  if (d) {
    const pc = personOf(d.person);
    html += `<section class="card session" style="--who:${pc.color}">
      <div class="row between">
        <h2 class="chrome sm">${d.editing ? 'Edit session' : 'In the ring'}</h2>
        <span class="timer" id="timer"></span>
      </div>
      <div class="row gap wrap">
        <div class="seg">${PEOPLE.map(pp =>
          `<button class="${d.person === pp.id ? 'on' : ''}" style="--c:${pp.color}" data-action="draft-person" data-person="${pp.id}">${pp.label}</button>`).join('')}</div>
        <label class="field grow">Started
          <input type="datetime-local" value="${toLocalInput(d.startedAt)}" data-action="draft-start"></label>
      </div>
    </section>
    ${d.exercises.map((e, ei) => {
      const last = describeLast(d.person, e.exId, d.id);
      return `<section class="card ex-card" style="--who:${pc.color}">
        <div class="row between">
          <div><div class="round">ROUND ${ei + 1}</div>
            <div class="pi-name">${esc(e.name)}</div>
            ${last ? `<div class="hint">${esc(last)}</div>` : ''}</div>
          <button class="mini" data-action="ex-remove" data-ei="${ei}" title="Remove exercise">✕</button>
        </div>
        <table class="sets">
          <thead><tr><th>Set</th><th>${e.unit === 'sec' ? 'Secs' : 'Reps'}</th><th>kg</th><th></th><th></th></tr></thead>
          <tbody>${e.sets.map((s, si) => `<tr class="${s.done ? 'done' : ''}">
            <td>${si + 1}</td>
            <td><input type="number" inputmode="numeric" min="0" value="${esc(s.reps)}" data-action="set-reps" data-ei="${ei}" data-si="${si}" aria-label="reps"></td>
            <td><input type="number" inputmode="decimal" step="0.5" min="0" value="${esc(s.weight)}" placeholder="—" data-action="set-weight" data-ei="${ei}" data-si="${si}" aria-label="weight kg"></td>
            <td><button class="tick-btn ${s.done ? 'on' : ''}" data-action="set-done" data-ei="${ei}" data-si="${si}" aria-label="done">✓</button></td>
            <td><button class="mini ghosty" data-action="set-remove" data-ei="${ei}" data-si="${si}" aria-label="remove set">−</button></td>
          </tr>`).join('')}</tbody>
        </table>
        <button class="btn btn-ghost sm" data-action="set-add" data-ei="${ei}">＋ Set</button>
      </section>`;
    }).join('')}
    <button class="btn btn-ghost" data-action="draft-add-ex">＋ Add exercise</button>
    <label class="field">Notes<textarea rows="2" data-action="draft-notes" placeholder="How did it feel?">${esc(d.notes)}</textarea></label>
    <button class="btn btn-big btn-neon" data-action="draft-finish">🥊 Finish — ding ding!</button>
    <button class="btn btn-ghost danger" data-action="draft-discard">${d.editing ? 'Cancel edit' : 'Discard session'}</button>`;
  } else {
    html += `<section class="hero">
      <h2 class="chrome">Step into the ring</h2>
      <p class="tagline">Logging as <b style="color:${personOf(person()).color}">${personOf(person()).label}</b> — switch at the top.</p>
    </section>
    <div class="row gap">
      <button class="btn btn-neon grow" data-action="draft-new">▶ Empty session</button>
      <button class="btn btn-sun grow" data-action="nav" data-view="plan">🎲 Plan one</button>
    </div>`;
  }

  const list = store.sessions().filter(s => historyFilter === 'all' || s.person === historyFilter);
  html += `<h3 class="section-title">History</h3>
    <div class="seg small">${[{ id: 'all', label: 'Both', color: '#f9c80e' }, ...PEOPLE].map(pp =>
      `<button class="${historyFilter === pp.id ? 'on' : ''}" style="--c:${pp.color}" data-action="hist-filter" data-person="${pp.id}">${pp.label}</button>`).join('')}</div>
    ${list.length ? list.slice(0, 60).map(s => {
      const pc = personOf(s.person);
      const mins = s.endedAt ? Math.round((new Date(s.endedAt) - new Date(s.startedAt)) / 60000) : null;
      return `<article class="card hist" style="--who:${pc.color}">
        <div class="row between">
          <div><span class="badge" style="--c:${pc.color}">${pc.label}</span> <b>${esc(fmtDateTime(s.startedAt))}</b></div>
          <div class="row gap-s">
            <button class="mini" data-action="hist-edit" data-id="${s.id}" title="Edit">✎</button>
            <button class="mini" data-action="hist-del" data-id="${s.id}" title="Delete">✕</button>
          </div>
        </div>
        <ul class="hist-ex">${s.exercises.map(e => {
          const t = topSet(e.sets);
          return `<li>${esc(e.name)} <small>${e.sets.length}× ${t ? `${t.reps || 0}${e.unit === 'sec' ? 's' : ''}${+t.weight ? ' @ ' + fmtNum(+t.weight) + 'kg' : ''}` : ''}</small></li>`;
        }).join('')}</ul>
        <div class="hist-foot">${fmtNum(sessionVolume(s))} kg moved${mins && mins > 0 && mins < 600 ? ` · ${mins} min` : ''}${s.notes ? ` · “${esc(s.notes)}”` : ''}</div>
      </article>`;
    }).join('') : '<p class="empty">No sessions yet. The first bell is the hardest.</p>'}`;
  app.innerHTML = html;
  tickTimer();
}

let timerInt;
function tickTimer() {
  clearInterval(timerInt);
  const upd = () => {
    const t = document.getElementById('timer');
    const d = store.getDraft();
    if (!t || !d || d.editing) { if (t) t.textContent = ''; return; }
    const s = Math.max(0, Math.floor((Date.now() - new Date(d.startedAt)) / 1000));
    t.textContent = s > 6 * 3600 ? '' : `${Math.floor(s / 3600) ? Math.floor(s / 3600) + ':' : ''}${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  };
  upd();
  timerInt = setInterval(upd, 1000);
}

function finishDraft() {
  const d = store.getDraft();
  if (!d) return;
  d.exercises = d.exercises
    .map(e => ({ ...e, sets: e.sets.filter(s => +s.reps > 0 || +s.weight > 0).map(s => ({ reps: +s.reps || 0, weight: +s.weight || 0 })) }))
    .filter(e => e.sets.length);
  if (!d.exercises.length) return toast('Log at least one set first!');
  const rec = { id: d.id, person: d.person, startedAt: d.startedAt, endedAt: d.editing ? d.endedAt : new Date().toISOString(), notes: d.notes, exercises: d.exercises };
  store.upsert('sessions', rec);
  store.saveDraft(null);
  toast(d.editing ? 'Session updated' : `🔔 Ding ding! Great round, ${personOf(d.person).label}!`);
  queueSync();
}

// ---------- STATS ----------
function metricValue(e, metric) {
  if (!e.sets.length) return null;
  if (metric === 'top') return Math.max(...e.sets.map(s => +s.weight || 0));
  if (metric === 'reps') return Math.max(...e.sets.map(s => +s.reps || 0));
  if (metric === 'volume') return setsVolume(e.sets);
  return null;
}

function renderStats() {
  const all = store.sessions();
  const mk = monthKey(new Date());
  const cards = PEOPLE.map(pp => {
    const mine = all.filter(s => s.person === pp.id);
    const month = mine.filter(s => monthKey(new Date(s.startedAt)) === mk);
    return `<div class="card stat" style="--who:${pp.color}">
      <div class="stat-name">${pp.label}</div>
      <div class="stat-big">${month.length}</div><div class="stat-lbl">sessions this month</div>
      <div class="stat-mid">${fmtNum(month.reduce((v, s) => v + sessionVolume(s), 0))} kg</div><div class="stat-lbl">moved this month</div>
      <div class="stat-small">${mine[0] ? 'Last: ' + new Date(mine[0].startedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'No sessions yet'}</div>
    </div>`;
  }).join('');

  // exercises that have data
  const counts = new Map();
  for (const s of all) for (const e of s.exercises) counts.set(e.exId, { name: e.name, unit: e.unit, n: (counts.get(e.exId)?.n || 0) + 1 });
  const exList = [...counts.entries()].sort((a, b) => b[1].n - a[1].n);
  if (!stats.exId || !counts.has(stats.exId)) stats.exId = exList[0]?.[0] || null;
  const cur = counts.get(stats.exId);
  const timed = cur?.unit === 'sec';
  if (timed && stats.metric !== 'reps') stats.metric = 'reps';

  const metrics = timed ? [{ id: 'reps', label: 'Longest hold' }] :
    [{ id: 'top', label: 'Top weight' }, { id: 'reps', label: 'Best reps' }, { id: 'volume', label: 'Volume' }];

  app.innerHTML = `
    <section class="hero"><h2 class="chrome">Tale of the Tape</h2></section>
    <div class="stat-grid">${cards}</div>

    <section class="card">
      <h3>Lift progress</h3>
      ${exList.length ? `
        <select data-action="stats-ex" class="full">${exList.map(([id, v]) =>
          `<option value="${esc(id)}" ${id === stats.exId ? 'selected' : ''}>${esc(v.name)} (${v.n})</option>`).join('')}</select>
        <div class="seg small">${metrics.map(m =>
          `<button class="${stats.metric === m.id ? 'on' : ''}" style="--c:#f9c80e" data-action="stats-metric" data-m="${m.id}">${m.label}</button>`).join('')}</div>
        <div id="chart-ex" class="chart-wrap"></div>
        <div id="prs" class="prs"></div>
      ` : '<p class="empty">No lifts logged yet — your graphs will glow here.</p>'}
    </section>

    <section class="card">
      <h3>Sessions per week</h3>
      <div id="chart-freq" class="chart-wrap"></div>
    </section>`;

  if (exList.length) {
    const unit = stats.metric === 'reps' ? (timed ? 'sec' : 'reps') : 'kg';
    const series = PEOPLE.map(pp => ({
      label: pp.label, color: pp.color,
      points: all.filter(s => s.person === pp.id).flatMap(s => s.exercises.filter(e => e.exId === stats.exId)
        .map(e => ({ x: new Date(s.startedAt), y: metricValue(e, stats.metric) }))).filter(p => p.y !== null),
    }));
    lineChart($('#chart-ex'), series, { unit });
    $('#prs').innerHTML = series.map(s => {
      const best = s.points.reduce((b, p) => (!b || p.y > b.y ? p : b), null);
      return `<div style="--c:${s.color}"><span>${s.label} PB</span><b>${best ? fmtNum(best.y) + ' ' + unit : '—'}</b>${best ? `<small>${best.x.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</small>` : ''}</div>`;
    }).join('');
  }

  // weekly frequency, last 12 weeks
  const monday = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const start = monday(new Date()); start.setDate(start.getDate() - 7 * 11);
  const weeks = Array.from({ length: 12 }, (_, i) => { const w = new Date(start); w.setDate(w.getDate() + 7 * i); return w; });
  const freq = PEOPLE.map(pp => ({
    label: pp.label, color: pp.color,
    points: all.length ? weeks.map(w => ({ x: w, y: all.filter(s => s.person === pp.id && +monday(s.startedAt) === +w).length })) : [],
  }));
  lineChart($('#chart-freq'), freq, { unit: 'sessions' });
}

// ---------- GOALS ----------
const GOAL_TYPES = {
  sessions: { label: 'Sessions this month', needsEx: false, unit: 'sessions' },
  weight: { label: 'Lift a weight on…', needsEx: true, unit: 'kg' },
  reps: { label: 'Hit reps in one set on…', needsEx: true, unit: 'reps' },
  volume: { label: 'Total kg moved this month', needsEx: false, unit: 'kg' },
};

function goalProgress(g) {
  const inMonth = store.sessions().filter(s => s.person === g.person && monthKey(new Date(s.startedAt)) === g.month);
  switch (g.type) {
    case 'sessions': return inMonth.length;
    case 'volume': return inMonth.reduce((v, s) => v + sessionVolume(s), 0);
    case 'weight': return Math.max(0, ...inMonth.flatMap(s => s.exercises.filter(e => e.exId === g.exId).flatMap(e => e.sets.map(x => +x.weight || 0))));
    case 'reps': return Math.max(0, ...inMonth.flatMap(s => s.exercises.filter(e => e.exId === g.exId).flatMap(e => e.sets.map(x => +x.reps || 0))));
  }
  return 0;
}

function goalTitle(g) {
  const t = GOAL_TYPES[g.type];
  const exName = g.exId ? (exById(g.exId)?.name || g.exName || 'exercise') : '';
  if (g.type === 'sessions') return `${g.target} sessions`;
  if (g.type === 'volume') return `Move ${fmtNum(g.target)} kg`;
  if (g.type === 'weight') return `${exName}: ${fmtNum(g.target)} kg`;
  if (g.type === 'reps') return `${exName}: ${g.target} ${exById(g.exId)?.unit === 'sec' ? 'sec' : 'reps'}`;
  return t.label;
}

let goalForm = { type: 'sessions', exId: '' };

function renderGoals() {
  const gs = store.goals().filter(g => g.month === goalsMonth);
  const sorted = [...allExercises()].sort((a, b) => a.name.localeCompare(b.name));
  const isPast = goalsMonth < monthKey(new Date());
  app.innerHTML = `
    <section class="hero"><h2 class="chrome">Title Shot</h2><p class="tagline">Monthly goals — train for the belt.</p></section>
    <div class="month-nav">
      <button class="mini" data-action="goal-month" data-d="-1" aria-label="previous month">◀</button>
      <b>${monthLabel(goalsMonth)}</b>
      <button class="mini" data-action="goal-month" data-d="1" aria-label="next month">▶</button>
    </div>
    ${PEOPLE.map(pp => {
      const mine = gs.filter(g => g.person === pp.id);
      return `<section class="card goals" style="--who:${pp.color}">
        <h3 style="color:${pp.color}">${pp.label}'s goals</h3>
        ${mine.length ? mine.map(g => {
          const prog = goalProgress(g);
          const pct = Math.min(100, Math.round((prog / (g.target || 1)) * 100));
          const done = prog >= g.target;
          return `<div class="goal ${done ? 'won' : ''}">
            <div class="row between"><span>${esc(goalTitle(g))}</span>
              <span class="row gap-s">${done ? '<span class="belt">🏆 CHAMP</span>' : `<small>${fmtNum(prog)} / ${fmtNum(g.target)}</small>`}
              <button class="mini ghosty" data-action="goal-del" data-id="${g.id}" aria-label="delete goal">✕</button></span></div>
            <div class="bar"><i style="width:${pct}%"></i></div>
          </div>`;
        }).join('') : `<p class="empty sm">No goals set${isPast ? '' : ' — add one below'}.</p>`}
      </section>`;
    }).join('')}

    <form class="card" data-form="goal">
      <h3>New goal</h3>
      <div class="seg">${PEOPLE.map(pp =>
        `<label class="seg-radio" style="--c:${pp.color}"><input type="radio" name="person" value="${pp.id}" ${person() === pp.id ? 'checked' : ''}><span>${pp.label}</span></label>`).join('')}</div>
      <select name="type" data-action="goal-type" class="full">${Object.entries(GOAL_TYPES).map(([k, v]) =>
        `<option value="${k}" ${goalForm.type === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
      ${GOAL_TYPES[goalForm.type].needsEx ? `<select name="exId" class="full" required>${sorted.map(e =>
        `<option value="${e.id}" ${goalForm.exId === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select>` : ''}
      <label class="field">Target (${GOAL_TYPES[goalForm.type].unit})
        <input name="target" type="number" inputmode="decimal" min="1" step="any" required></label>
      <button class="btn btn-sun" type="submit">Set goal for ${monthLabel(goalsMonth)}</button>
    </form>
    <button class="btn btn-ghost" data-action="goal-copy">Copy last month's goals</button>`;
}

// ---------- SETTINGS ----------
function renderSettings() {
  const p = store.prefs();
  app.innerHTML = `
    <section class="hero"><h2 class="chrome">Corner Team</h2><p class="tagline">Settings & sync</p></section>
    <section class="card">
      <h3>Sync between phones</h3>
      <p class="muted">Data is stored on this phone and synced through a private GitHub Gist — no server needed.
      Create a token at <b>github.com → Settings → Developer settings → Personal access tokens</b>
      (fine-grained, <i>Gists: read & write</i> only — or classic with just the <code>gist</code> scope).
      Set up on one phone with <b>Create sync gist</b>, then enter the same token & Gist ID on the other.</p>
      <form data-form="sync">
        <label class="field">GitHub token<input name="token" type="password" autocomplete="off" value="${esc(p.token)}" placeholder="github_pat_…"></label>
        <label class="field">Gist ID<input name="gistId" autocomplete="off" value="${esc(p.gistId)}" placeholder="leave empty, then Create"></label>
        <div class="row gap wrap">
          <button class="btn btn-neon grow" type="submit">Save & sync</button>
          <button class="btn btn-sun grow" type="button" data-action="gist-create">Create sync gist</button>
        </div>
      </form>
      <div class="sync-status">
        <div><span>Gist</span><b>${p.gistId ? esc(p.gistId.slice(0, 8)) + '…' : 'not set'}</b></div>
        <div><span>This phone</span><b>${store.sessions().length} sessions</b></div>
        <div><span>In the cloud</span><b>${p.lastSync ? (p.cloudSessions ?? '?') + ' sessions' : '—'}</b></div>
        <div><span>Last synced</span><b>${p.lastSync ? esc(fmtDateTime(p.lastSync)) : 'never'}</b></div>
      </div>
      ${p.lastError ? `<p class="sync-error">⚠ ${esc(p.lastError)}</p>` : ''}
      <p class="muted sm">Both phones must show the <b>same Gist ID</b>. Only tap <b>Create sync gist</b> on one phone.</p>
    </section>
    <section class="card">
      <h3>Backup</h3>
      <div class="row gap wrap">
        <button class="btn btn-ghost grow" data-action="export">⬇ Export JSON</button>
        <label class="btn btn-ghost grow">⬆ Import JSON<input type="file" accept="application/json" data-action="import" hidden></label>
      </div>
    </section>
    <section class="card">
      <h3>Install on Android</h3>
      <p class="muted">Open this page in Chrome → ⋮ menu → <b>Add to Home screen / Install app</b>. It then runs full-screen and works offline at the gym.</p>
    </section>
    <section class="card">
      <h3>Danger zone</h3>
      <button class="btn btn-ghost danger" data-action="wipe">Clear data on this phone</button>
      <p class="muted sm">Only clears this device. If sync is on, data comes back on next sync.</p>
    </section>
    <p class="muted center sm">JandyPump v2 · ${store.sessions().length} sessions logged</p>`;
}

// ---------- exercise picker modal ----------
let pickerCb = null, pickerGroup = 'all', pickerQ = '';
function openPicker(cb) { pickerCb = cb; pickerQ = ''; renderPicker(); $('#modal').hidden = false; setTimeout(() => $('#picker-q')?.focus(), 50); }
function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; pickerCb = null; }
function renderPicker() {
  const q = pickerQ.toLowerCase();
  const list = allExercises().filter(e => (pickerGroup === 'all' || e.group === pickerGroup) && e.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
  const m = $('#modal');
  const listHtml = list.map(e => `<li><button data-action="pick" data-id="${e.id}">${esc(e.name)} <span class="tag tag-${e.group}">${groupOf(e.group).label}</span></button></li>`).join('') || '<p class="empty">Nothing found.</p>';
  if (m.querySelector('.picker')) { m.querySelector('.pick-list').innerHTML = listHtml; m.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.group === pickerGroup)); return; }
  m.innerHTML = `<div class="sheet picker">
    <div class="row between"><h3>Add exercise</h3><button class="mini" data-action="modal-close" aria-label="close">✕</button></div>
    <input id="picker-q" placeholder="Search…" data-action="picker-q" autocomplete="off">
    <div class="chips scroll">${[{ id: 'all', label: 'All', icon: '★' }, ...GROUPS].map(g =>
      `<button class="chip ${pickerGroup === g.id ? 'on' : ''}" data-action="picker-group" data-group="${g.id}">${g.label}</button>`).join('')}</div>
    <ul class="pick-list">${listHtml}</ul>
  </div>`;
}

// ---------- render / routing ----------
function render() {
  document.querySelectorAll('.who button').forEach(b => b.classList.toggle('on', b.dataset.person === person()));
  document.body.style.setProperty('--who', personOf(person()).color);
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.view === view));
  ({ plan: renderPlan, log: renderLog, stats: renderStats, goals: renderGoals, settings: renderSettings })[view]();
}
function go(v) { view = v; render(); window.scrollTo({ top: 0 }); }

// ---------- sync glue ----------
let syncTimer;
function queueSync() { clearTimeout(syncTimer); syncTimer = setTimeout(doSync, 1200); }
async function doSync(manual) {
  const btn = $('.sync-btn');
  if (!syncConfigured()) { if (manual) { toast('Set up sync in settings first'); go('settings'); } btn.dataset.state = 'off'; return; }
  btn.dataset.state = 'busy';
  try {
    const r = await sync();
    btn.dataset.state = r.offline ? 'off' : 'ok';
    if (manual) toast(r.offline ? 'Offline — will sync later'
      : r.pulled ? `Synced ✓ ${r.pulled} new session${r.pulled > 1 ? 's' : ''} from the other phone` : 'Synced ✓ All up to date');
    // Re-render with fresh data unless someone is mid-typing
    const typing = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    if (!typing) render();
  } catch (e) {
    btn.dataset.state = 'err';
    if (manual) toast(e.message);
    console.warn(e);
  }
}

// ---------- events ----------
document.addEventListener('click', e => {
  const t = e.target.closest('[data-action]');
  if (!t) { if (e.target === $('#modal')) closeModal(); return; }
  const a = t.dataset.action;
  const i = +t.dataset.i, ei = +t.dataset.ei, si = +t.dataset.si;
  const d = store.getDraft();

  switch (a) {
    case 'nav': return go(t.dataset.view);
    case 'person': store.setPrefs({ person: t.dataset.person }); return render();
    case 'sync': return doSync(true);

    case 'plan-group': {
      const g = t.dataset.group;
      plan.groups = plan.groups.includes(g) ? plan.groups.filter(x => x !== g) : [...plan.groups, g];
      savePlan(); return render();
    }
    case 'plan-preset': plan.groups = [...PRESETS[i].groups]; randomise(); return render();
    case 'plan-count': plan.count = Math.max(1, Math.min(12, plan.count + +t.dataset.d)); savePlan(); return render();
    case 'plan-random':
      if (!plan.groups.length) return toast('Pick at least one focus area');
      randomise(); return render();
    case 'plan-lock': plan.items[i].locked = !plan.items[i].locked; savePlan(); return render();
    case 'plan-reroll': rerollItem(i); return render();
    case 'plan-remove': plan.items.splice(i, 1); savePlan(); return render();
    case 'plan-clear': plan.items = []; savePlan(); return render();
    case 'plan-add': return openPicker(ex => { plan.items.push({ exId: ex.id, sets: ex.sets, reps: ex.reps, locked: true }); savePlan(); render(); });
    case 'plan-start':
      if (d && !confirm('You already have a session in progress. Replace it?')) return go('log');
      newDraft(true); return go('log');
    case 'custom-del': store.remove('customExercises', t.dataset.id); queueSync(); return render();

    case 'draft-new': newDraft(false); return render();
    case 'draft-person': d.person = t.dataset.person; store.saveDraft(d); return render();
    case 'draft-add-ex': return openPicker(ex => { addExerciseToDraft(ex); render(); setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50); });
    case 'draft-finish': finishDraft(); render(); return window.scrollTo({ top: 0, behavior: 'smooth' });
    case 'draft-discard':
      if (!d.editing && !confirm('Throw in the towel on this session?')) return;
      store.saveDraft(null); return render();
    case 'ex-remove': d.exercises.splice(ei, 1); store.saveDraft(d); return render();
    case 'set-add': {
      const sets = d.exercises[ei].sets;
      const last = sets[sets.length - 1] || { reps: 10, weight: '' };
      sets.push({ reps: last.reps, weight: last.weight, done: false });
      store.saveDraft(d); return render();
    }
    case 'set-remove': d.exercises[ei].sets.splice(si, 1); store.saveDraft(d); return render();
    case 'set-done': {
      const s = d.exercises[ei].sets[si];
      s.done = !s.done; store.saveDraft(d);
      t.classList.toggle('on', s.done); t.closest('tr').classList.toggle('done', s.done);
      if (s.done && navigator.vibrate) navigator.vibrate(40);
      return;
    }
    case 'hist-filter': historyFilter = t.dataset.person; return render();
    case 'hist-edit': {
      if (d && !confirm('Replace the session in progress with this one for editing?')) return;
      const s = store.sessions().find(x => x.id === t.dataset.id);
      store.saveDraft({ ...JSON.parse(JSON.stringify(s)), editing: true });
      render(); return window.scrollTo({ top: 0 });
    }
    case 'hist-del':
      if (!confirm('Delete this session for good?')) return;
      store.remove('sessions', t.dataset.id); queueSync(); return render();

    case 'stats-metric': stats.metric = t.dataset.m; return render();

    case 'goal-month': goalsMonth = shiftMonth(goalsMonth, +t.dataset.d); return render();
    case 'goal-del': store.remove('goals', t.dataset.id); queueSync(); return render();
    case 'goal-copy': {
      const prev = store.goals().filter(g => g.month === shiftMonth(goalsMonth, -1));
      if (!prev.length) return toast('No goals last month to copy');
      const existing = store.goals().filter(g => g.month === goalsMonth);
      let n = 0;
      for (const g of prev) {
        if (existing.some(x => x.person === g.person && x.type === g.type && x.exId === g.exId)) continue;
        store.upsert('goals', { id: store.uid(), person: g.person, type: g.type, exId: g.exId, target: g.target, month: goalsMonth }); n++;
      }
      toast(n ? `Copied ${n} goal${n > 1 ? 's' : ''}` : 'Already copied'); queueSync(); return render();
    }

    case 'gist-create': {
      const token = document.querySelector('[name=token]').value.trim();
      if (!token) return toast('Paste a GitHub token first');
      t.disabled = true;
      createGist(token).then(id => { toast('Sync gist created ✓'); render(); doSync(); console.log('gist', id); })
        .catch(err => toast(err.message)).finally(() => { t.disabled = false; });
      return;
    }
    case 'export': {
      const blob = new Blob([JSON.stringify(store.getRaw(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement('a'), { href: url, download: `jandypump-${new Date().toISOString().slice(0, 10)}.json` });
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return;
    }
    case 'wipe':
      if (!confirm('Clear all workout data on this phone?')) return;
      store.replaceRaw({}); store.saveDraft(null); toast('Cleared'); return render();

    case 'modal-close': return closeModal();
    case 'picker-group': pickerGroup = t.dataset.group; return renderPicker();
    case 'pick': { const ex = exById(t.dataset.id); const cb = pickerCb; closeModal(); return cb && cb(ex); }
  }
});

document.addEventListener('input', e => {
  const t = e.target, a = t.dataset?.action;
  if (!a) return;
  const d = store.getDraft();
  const i = +t.dataset.i, ei = +t.dataset.ei, si = +t.dataset.si;
  switch (a) {
    case 'set-reps': d.exercises[ei].sets[si].reps = t.value; return store.saveDraft(d);
    case 'set-weight': d.exercises[ei].sets[si].weight = t.value; return store.saveDraft(d);
    case 'draft-notes': d.notes = t.value; return store.saveDraft(d);
    case 'plan-sets': plan.items[i].sets = Math.max(1, +t.value || 1); return savePlan();
    case 'plan-reps': plan.items[i].reps = Math.max(1, +t.value || 1); return savePlan();
    case 'picker-q': pickerQ = t.value; return renderPicker();
  }
});

document.addEventListener('change', e => {
  const t = e.target, a = t.dataset?.action;
  const d = store.getDraft();
  switch (a) {
    case 'draft-start': if (t.value) { d.startedAt = new Date(t.value).toISOString(); store.saveDraft(d); tickTimer(); } return;
    case 'stats-ex': stats.exId = t.value; return render();
    case 'goal-type': goalForm.type = t.value; return render();
    case 'import': {
      const f = t.files[0]; if (!f) return;
      f.text().then(txt => { store.replaceRaw(store.merge(store.getRaw(), JSON.parse(txt))); toast('Imported & merged ✓'); queueSync(); render(); })
        .catch(() => toast('That file didn\'t look right'));
    }
  }
});

document.addEventListener('submit', e => {
  const f = e.target, kind = f.dataset.form;
  if (!kind) return;
  e.preventDefault();
  const v = Object.fromEntries(new FormData(f));
  if (kind === 'custom') {
    store.upsert('customExercises', {
      id: 'custom-' + store.uid(), custom: true, name: v.name.trim(), group: v.group,
      sets: +v.sets || 3, reps: +v.reps || 10, ...(v.timed ? { unit: 'sec' } : {}),
    });
    toast('Added to the library'); queueSync(); render();
    document.querySelector('.library')?.setAttribute('open', '');
  }
  if (kind === 'goal') {
    goalForm.exId = v.exId || '';
    store.upsert('goals', {
      id: store.uid(), person: v.person, type: v.type, exId: v.exId || null,
      exName: v.exId ? exById(v.exId)?.name : null, target: +v.target, month: goalsMonth,
    });
    toast('Goal locked in 🏆'); queueSync(); render();
  }
  if (kind === 'sync') {
    store.setPrefs({ token: v.token.trim(), gistId: v.gistId.trim() });
    doSync(true).then(() => view === 'settings' && render());
  }
});

window.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') doSync(); });
window.addEventListener('online', () => doSync());

// ---------- boot ----------
if (store.getDraft()) view = 'log';
render();
doSync();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW failed', err));
}
