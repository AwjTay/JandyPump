// Tiny dependency-free SVG line chart with a neon look.
// series: [{ label, color, points: [{ x: Date, y: number }] }]

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

function niceStep(range, ticks) {
  const raw = range / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}

const fmtDate = d => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export function lineChart(container, series, { unit = '' } = {}) {
  container.innerHTML = '';
  const all = series.flatMap(s => s.points);
  if (!all.length) {
    container.innerHTML = '<p class="empty">No data yet — log a session and come back, champ.</p>';
    return;
  }
  const W = 360, H = 220, P = { l: 42, r: 12, t: 14, b: 30 };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' });

  const defs = el('defs');
  defs.innerHTML = `<filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  svg.appendChild(defs);

  let x0 = Math.min(...all.map(p => +p.x)), x1 = Math.max(...all.map(p => +p.x));
  if (x0 === x1) { x0 -= 86400000 * 3; x1 += 86400000 * 3; }
  let y1 = Math.max(...all.map(p => p.y));
  const step = niceStep(y1 || 1, 4);
  y1 = Math.ceil((y1 || 1) / step) * step;
  const y0 = 0;

  const sx = x => P.l + ((+x - x0) / (x1 - x0)) * (W - P.l - P.r);
  const sy = y => H - P.b - ((y - y0) / (y1 - y0)) * (H - P.t - P.b);

  // horizontal grid
  for (let v = y0; v <= y1 + 1e-9; v += step) {
    svg.appendChild(el('line', { x1: P.l, x2: W - P.r, y1: sy(v), y2: sy(v), class: 'grid' }));
    const t = el('text', { x: P.l - 6, y: sy(v) + 4, class: 'tick', 'text-anchor': 'end' });
    t.textContent = Math.round(v * 10) / 10;
    svg.appendChild(t);
  }
  // x ticks (up to 4)
  const xt = 4;
  for (let i = 0; i <= xt; i++) {
    const xv = x0 + ((x1 - x0) * i) / xt;
    const t = el('text', { x: sx(xv), y: H - 10, class: 'tick', 'text-anchor': i === 0 ? 'start' : i === xt ? 'end' : 'middle' });
    t.textContent = fmtDate(new Date(xv));
    svg.appendChild(t);
  }
  if (unit) {
    const u = el('text', { x: 4, y: P.t - 2, class: 'tick unit' });
    u.textContent = unit;
    svg.appendChild(u);
  }

  for (const s of series) {
    const pts = [...s.points].sort((a, b) => a.x - b.x);
    if (!pts.length) continue;
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
    svg.appendChild(el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2.5, filter: 'url(#glow)', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    for (const p of pts) {
      const c = el('circle', { cx: sx(p.x), cy: sy(p.y), r: 3.5, fill: '#12002b', stroke: s.color, 'stroke-width': 2 });
      const title = el('title');
      title.textContent = `${s.label} · ${fmtDate(p.x)} · ${p.y}${unit ? ' ' + unit : ''}`;
      c.appendChild(title);
      svg.appendChild(c);
    }
  }
  container.appendChild(svg);

  const legend = document.createElement('div');
  legend.className = 'legend';
  legend.innerHTML = series.map(s =>
    `<span><i style="background:${s.color};box-shadow:0 0 8px ${s.color}"></i>${s.label}${s.points.length ? '' : ' (no data)'}</span>`).join('');
  container.appendChild(legend);
}
