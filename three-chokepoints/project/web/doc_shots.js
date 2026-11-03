
// ================= Documentary: three chokepoints (v2 — swarm / ribbons / arcs, no cards) =================
// All times are on the voiceover timeline (seconds). Each shot is rendered over its own time range.

// camera keys: [t, lat, lon, range km, tilt deg, heading deg]
const SHOTS = {
  W1: [[5.5, 18, 62, 11000, 0, 0], [9.5, 16, 70, 9600, 8, 0], [15.3, 14, 74, 9000, 12, 0]],
  H: [[17.0, 26.4, 56.45, 640, 24, 0], [19.2, 26.5, 56.42, 380, 20, 0], [21.6, 26.6, 55.4, 950, 28, -4],
      [25.0, 26.9, 53.2, 1950, 22, -4], [30.0, 26.4, 54.4, 2050, 18, 0], [33.2, 25.6, 57.2, 2500, 20, 4], [35.7, 25.4, 57.6, 2650, 20, 4]],
  B: [[38.0, 12.9, 44.1, 760, 25, 0], [39.8, 12.6, 43.42, 260, 16, 0], [42.4, 15.6, 40.8, 1500, 20, 0], [44.6, 20.6, 38.4, 3000, 14, 0]],
  W2: [[52.6, -1, 29, 13600, 0, 0], [58.6, -3, 28, 14200, 0, 0]],
  M1: [[62.0, 1.75, 102.6, 600, 50, 42], [63.0, 1.55, 103.0, 430, 50, 44], [67.0, 1.3, 103.55, 250, 54, 48]],
  M2: [[73.4, 6.0, 104.5, 3400, 20, 16], [75.2, 13.6, 110.0, 4900, 12, 4], [78.0, 15.0, 110.5, 5300, 10, 2]],
  W3: [[77.6, 17, 66, 10500, 8, 0], [89.8, 21, 70, 11500, 5, 0]],
};
const KEYS = SHOTS[SHOT];

// ---------- map primitives ----------
function smoothLL(pts, per = 10) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]); return out;
}
const R_ = (pts, step = 6) => resample(smoothLL(pts), step);
function routePath(rs, s0, s1) {
  return () => {
    ctx.beginPath(); let st = false;
    for (let i = 0; i < rs.pts.length; i++) {
      if (rs.cum[i] < s0 || rs.cum[i] > s1) continue;
      const p = proj(rs.pts[i][0], rs.pts[i][1]); st ? ctx.lineTo(p.x, p.y) : (ctx.moveTo(p.x, p.y), st = true);
    }
    const e = proj(...along(rs, s1)); if (st) ctx.lineTo(e.x, e.y);
  };
}
function offPt(rs, s, off) {
  const a = along(rs, Math.max(0, s - 0.5)), b = along(rs, Math.min(rs.len, s + 0.5)), c = along(rs, s);
  const dy = (b[0] - a[0]) * KM_LAT, dx = (b[1] - a[1]) * kmLon(c[0]), n = Math.hypot(dx, dy) || 1;
  return proj(c[0] + (dx / n) * off / KM_LAT, c[1] + (-dy / n) * off / kmLon(c[0]));
}
// R1: ship-traffic swarm
function makeSwarm(routes, n, { sigma = 40, speed = 60, amber = 0.3, seed = 7 } = {}) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const wt = r => r.rs.len * (r.w ?? 1), tot = routes.reduce((a, r) => a + wt(r), 0), P = [];
  for (let i = 0; i < n; i++) {
    let u = rnd() * tot, ri = 0; while (ri < routes.length - 1 && u > wt(routes[ri])) { u -= wt(routes[ri]); ri++; }
    const g = (rnd() + rnd() + rnd() - 1.5) / 0.5, R = routes[ri];
    P.push({ r: ri, s0: rnd() * R.rs.len, dir: R.oneWay ? 1 : (rnd() < 0.5 ? 1 : -1), v: speed * (R.speed ?? 1) * (0.7 + 0.6 * rnd()), off: g * sigma * (R.sig ?? 1), am: rnd() < (R.amber ?? amber) });
  }
  return { routes, P, sigma };
}
function drawSwarm(sw, tau, { alpha = 1, size = 2.2, red = 0, reveal = null, tail = 1, alphaR = null } = {}) {
  if (alpha <= 0) return;
  const groups = {};
  for (const q of sw.P) {
    const R = sw.routes[q.r], rs = R.rs, L = rs.len;
    let s = q.s0 + q.dir * q.v * tau; s = ((s % L) + L) % L;
    if (reveal && s > reveal(q.r)) continue;
    const edge = Math.min(L * 0.08, 500);
    let a = R.loop ? 1 : smooth(s / edge) * smooth((L - s) / edge);
    if (alphaR) a *= alphaR(q.r);
    if (a < 0.05) continue;
    const off = q.off + q.dir * (R.lane ?? sw.sigma * 0.7);
    const P0 = offPt(rs, s, off); if (!P0.vis) continue;
    const P1 = offPt(rs, Math.max(0, Math.min(L, s - q.dir * q.v * 0.12 * tail)), off);
    const c = red > 0.5 ? 'r' : q.am ? 'a' : 's', key = c + Math.round(a * 4);
    (groups[key] || (groups[key] = [])).push(P1.x, P1.y, P0.x, P0.y);
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (const [key, arr] of Object.entries(groups)) {
    const ab = (+key.slice(1) / 4) * alpha, rgb = key[0] === 'a' ? '255,176,60' : key[0] === 'r' ? '255,70,55' : '150,228,245';
    for (const [lw, aa, head] of [[size * 4.5 * S, 0.1, 0], [size * 0.8 * S, 0.4, 0], [size * 1.9 * S, 1.0, 1]]) {
      ctx.strokeStyle = `rgba(${rgb},${aa * ab})`; ctx.lineWidth = lw; ctx.beginPath();
      for (let i = 0; i < arr.length; i += 4) { if (head) { ctx.moveTo(arr[i + 2], arr[i + 3]); ctx.lineTo(arr[i + 2] + 0.01, arr[i + 3]); } else { ctx.moveTo(arr[i], arr[i + 1]); ctx.lineTo(arr[i + 2] + 0.01, arr[i + 3]); } }
      ctx.stroke();
    }
  }
  ctx.restore();
}
// R2: volume ribbon with flowing highlight
function ribbon(rs, s0, s1, w, t, a, { color = '255,176,60', flow = true } = {}) {
  if (a <= 0 || s1 <= s0) return; const path = routePath(rs, s0, s1);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalAlpha = a * 0.5; ctx.strokeStyle = 'rgba(4,9,16,1)'; ctx.lineWidth = w + 6 * S; path(); ctx.stroke();
  ctx.globalAlpha = a * 0.5; ctx.strokeStyle = `rgb(${color})`; ctx.lineWidth = w; path(); ctx.stroke();
  ctx.globalAlpha = a * 0.9; ctx.strokeStyle = `rgba(${color},1)`; ctx.lineWidth = Math.max(1.5 * S, w * 0.12); path(); ctx.stroke();
  ctx.globalAlpha = a; ctx.strokeStyle = 'rgba(255,246,228,0.95)'; ctx.lineWidth = Math.max(2.5 * S, w * 0.3);
  ctx.setLineDash([2 * S, 22 * S]); ctx.lineDashOffset = flow ? -t * 90 * S : 0; path(); ctx.stroke();
  ctx.restore();
}
// R5: lifted 3D arc with ground shadow and travelling pulses
const mixRGB = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',');
function arc3d(a, b, k, tp, { alpha = 1, red = 0, hk = 0.16 } = {}) {
  if (k <= 0 || alpha <= 0) return;
  const d = distKm(a, b), hh = Math.min(1500, d * hk), N = 72, pts = [], gp = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, la = a[0] + (b[0] - a[0]) * u, lo = a[1] + (b[1] - a[1]) * u;
    pts.push(proj(la, lo, hh * Math.sin(Math.PI * u))); gp.push(proj(la, lo, 0));
  }
  const m = Math.max(1, Math.round(N * clamp01(k))), col = mixRGB([255, 182, 64], [255, 70, 55], red);
  const line = arr => { ctx.beginPath(); arr.slice(0, m + 1).forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); };
  ctx.save(); ctx.lineCap = 'round';
  ctx.globalAlpha = alpha * 0.4; ctx.setLineDash([2 * S, 8 * S]); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5 * S; line(gp); ctx.setLineDash([]);
  ctx.globalCompositeOperation = 'lighter';
  for (const [lw, aa] of [[14 * S, 0.12], [6 * S, 0.25], [3.2 * S, 1.0]]) { ctx.globalAlpha = 1; ctx.strokeStyle = `rgba(${col},${aa * alpha})`; ctx.lineWidth = lw; line(pts); }
  const dots = k < 1 ? [k] : [0, 1, 2].map(j => ((tp * 0.4) + j / 3) % 1);
  for (const u of dots) {
    const p = pts[Math.round(u * N)];
    ctx.fillStyle = `rgba(${col},${0.25 * alpha})`; ctx.beginPath(); ctx.arc(p.x, p.y, 10 * S, 0, 7); ctx.fill();
    ctx.fillStyle = `rgba(255,250,235,${alpha})`; ctx.beginPath(); ctx.arc(p.x, p.y, 3.2 * S, 0, 7); ctx.fill();
  }
  ctx.restore();
}
// chokepoint marker: dot + ring + mono label
function marker(lat, lon, lbl, t, t0, { red = 0, side = 1 } = {}) {
  const a = smooth((t - t0) / 0.3); if (a <= 0) return; const p = proj(lat, lon); if (!p.vis) return;
  const col = red > 0.5 ? '255,74,61' : '255,180,58', k = easeExpo((t - t0) / 0.5);
  ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 8 * S;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, 5 * S, 0, 7); ctx.fill();
  ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = 2.5 * S; ctx.beginPath(); ctx.arc(p.x, p.y, 15 * S * k, 0, 7); ctx.stroke();
  const pr = ((t - t0) * 0.8) % 1; ctx.shadowBlur = 0;
  ctx.strokeStyle = `rgba(${col},${(red > 0.5 ? 0.95 : 0.55) * (1 - pr)})`; ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.arc(p.x, p.y, (15 + 50 * pr) * S, 0, 7); ctx.stroke();
  ctx.restore();
  if (lbl) maskText(lbl, p.x + side * 28 * S, p.y + 8 * S, 23, t, t0 + 0.12, 1e9, { font: FM, weight: 500, align: side > 0 ? 'left' : 'right', spacing: 2, color: red > 0.5 ? '#ff9a8f' : '#ffffff', shadow: 0.85 });
}
// D1: number pinned to the place it describes
function pinNum(lat, lon, big, sub, t, t0, t1, { dx = 160, dy = -150, size = 120, color = '#fff', subColor = AMBER, odoK = null } = {}) {
  const a = 1 - smooth((t - t1) / 0.35); if (t < t0 || a <= 0) return; const p = proj(lat, lon); if (!p.vis) return;
  const kd = easeOut((t - t0) / 0.3), sg = Math.sign(dx);
  ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 8 * S;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, 6 * S * kd, 0, 7); ctx.fill();
  const pr = ((t - t0) * 0.9) % 1; ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - pr)})`; ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.arc(p.x, p.y, (8 + 40 * pr) * S, 0, 7); ctx.stroke();
  const kl = easeInOut((t - t0 - 0.05) / 0.45), ex = p.x + dx * S, ey = p.y + dy * S, hx = ex + sg * 46 * S;
  ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.moveTo(p.x, p.y);
  if (kl < 0.7) { const u = kl / 0.7; ctx.lineTo(p.x + (ex - p.x) * u, p.y + (ey - p.y) * u); } else { ctx.lineTo(ex, ey); ctx.lineTo(ex + (hx - ex) * ((kl - 0.7) / 0.3), ey); }
  ctx.stroke(); ctx.restore();
  const al = sg > 0 ? 'left' : 'right', tx = hx + sg * 16 * S, by = ey + size * 0.34 * S;
  if (odoK !== null) odo(big, tx, by, size, odoK, { align: al, color, alpha: a, shadow: 0.7 });
  else maskText(big, tx, by, size, t, t0 + 0.3, t1, { align: al, color, weight: 800, shadow: 0.7 });
  maskText(sub, tx + sg * 3 * S, by + 44 * S, 24, t, t0 + 0.5, t1, { font: FS, weight: 600, color: subColor, align: al, spacing: 2, shadow: 0.85 });
}
function place(s, lat, lon, a, { size = 21, sea = false, rot = 0 } = {}) {
  const p = proj(lat, lon); if (!p.vis || a <= 0) return;
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(rot);
  txt(s, 0, 0, { font: FS, size, weight: sea ? 500 : 600, color: sea ? '#c4ecf5' : '#f3eee4', alpha: a * (sea ? 0.85 : 0.72), align: 'center', spacing: sea ? 4 : 8, base: 'middle', shadow: 0.8 });
  ctx.restore();
}
function measure(A, B, big, sub, t, t0, t1) {
  const a = 1 - smooth((t - t1) / 0.35); if (t < t0 || a <= 0) return;
  const k = easeInOut((t - t0) / 0.6), pa = proj(...A), pb = proj(...B), mx = pa.x + (pb.x - pa.x) * k, my = pa.y + (pb.y - pa.y) * k;
  const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x);
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 8 * S;
  ctx.lineWidth = 2.5 * S; ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(mx, my); ctx.stroke();
  for (const [p, on] of [[pa, true], [{ x: mx, y: my }, k > 0.98]]) if (on) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang + Math.PI / 2); ctx.beginPath(); ctx.moveTo(-11 * S, 0); ctx.lineTo(11 * S, 0); ctx.stroke(); ctx.restore();
  }
  ctx.restore();
  const x = Math.max(pa.x, pb.x) + 44 * S, y = (pa.y + pb.y) / 2;
  maskText(big, x, y + 22 * S, 96, t, t0 + 0.45, t1, { weight: 800, shadow: 0.75 });
  maskText(sub, x + 3 * S, y + 62 * S, 22, t, t0 + 0.6, t1, { font: FS, weight: 600, color: AMBER, spacing: 3, shadow: 0.85 });
}
const halt = (t, tc, r = 3.5) => t < tc ? t : tc + (1 - Math.exp(-(t - tc) * r)) / r;

// ---------- geography ----------
const HORMUZ = [26.55, 56.45], BAB = [12.58, 43.38], MALACCA = [1.17, 103.78];
const GULF = [26.7, 50.3], SUEZ = [29.93, 32.55], ROTT = [51.9, 3.8], SHANGHAI = [30.7, 122.95];
const WORLD_MAIN = [[51.9, 3.8], [50.3, -0.6], [48.6, -6.0], [43.6, -10.2], [37.0, -9.6], [35.95, -5.6], [37.2, 0.5], [37.6, 11.0], [34.8, 20.0], [32.8, 28.5], [31.4, 32.3],
  [29.9, 32.55], [27.7, 33.85], [24.0, 36.3], [20.0, 38.6], [16.0, 41.0], [13.3, 42.8], [12.6, 43.35], [12.2, 45.5], [12.3, 48.0], [12.2, 51.6], [10.5, 56.0], [8.0, 63.0],
  [6.2, 73.0], [5.5, 80.6], [5.9, 88.0], [5.9, 94.5], [4.1, 99.3], [2.4, 101.45], [1.25, 103.6], [1.3, 104.4], [3.2, 105.6], [6.5, 107.6], [10.5, 110.0], [18.5, 112.6],
  [22.0, 114.5], [24.8, 119.4], [30.7, 122.95]];
const GULF_SPUR = [[29.3, 48.4], [26.7, 50.4], [26.6, 53.3], [26.4, 55.6], [26.6, 56.45], [25.4, 57.5], [22.9, 60.4], [17.0, 63.0], [10.0, 64.5], [6.6, 72.0]];
const CAPE = [[12.3, 48.0], [8.0, 53.0], [0.0, 55.5], [-12.0, 57.0], [-25.0, 49.5], [-33.5, 31.0], [-35.6, 19.5], [-31.0, 13.5], [-18.0, 8.0], [-5.0, 3.0], [4.0, -9.5],
  [13.0, -19.5], [24.0, -18.5], [33.0, -12.5], [37.0, -10.0], [43.6, -10.2], [48.6, -6.0], [50.3, -0.6], [51.9, 3.8]];
const SUEZ_EU = [[12.3, 48.0], [12.2, 45.5], [12.6, 43.35], [13.3, 42.8], [16.0, 41.0], [20.0, 38.6], [24.0, 36.3], [27.7, 33.85], [29.9, 32.55], [31.4, 32.3], [32.8, 28.5],
  [34.8, 20.0], [37.6, 11.0], [37.2, 0.5], [35.95, -5.6], [37.0, -9.6], [43.6, -10.2], [48.6, -6.0], [50.3, -0.6], [51.9, 3.8]];
const EXTRA_LANES = [
  [[1.3, 104.4], [-3.0, 107.0], [-6.0, 111.0], [-8.4, 115.7], [-13.0, 119.0], [-21.0, 112.5], [-31.5, 114.6]],
  [[22.0, 114.5], [24.8, 119.4], [29.0, 124.0], [32.8, 129.0], [33.8, 134.5]],
  [[24.7, 66.6], [21.0, 68.8], [18.9, 72.6], [15.0, 73.3], [10.0, 75.6], [7.4, 77.3], [5.6, 80.4]],
  [[12.0, 51.4], [5.0, 49.3], [0.0, 44.6], [-4.2, 40.6], [-10.0, 41.0], [-15.5, 41.6], [-25.5, 35.6]],
  [[5.9, 88.0], [13.0, 86.2], [21.0, 88.3]],
  [[35.95, -5.6], [36.9, -12.0], [38.5, -30.0], [40.0, -50.0]],
];

let VO = null, G = null, T = 0, RT = {}, SW = {};
const word = (w, n = 0) => VO.words.filter(x => x.w.replace(/\(\d\)$/, '') === w)[n].s;

function worldSwarm(n) {
  return makeSwarm([
    { rs: RT.wMain, w: 1.0 }, { rs: RT.gulf, w: 1.7, oneWay: true, amber: 0.75 }, { rs: RT.cape, w: 0.35 },
    ...RT.extra.map(rs => ({ rs, w: 0.55 })),
  ], n, { sigma: 70, speed: 520, amber: 0.25, seed: 5 });
}

async function init() {
  VO = await (await fetch('assets/vo.json')).json();
  await loadFonts();
  G = await build();
  RT.wMain = R_(WORLD_MAIN, 25); RT.gulf = R_(GULF_SPUR, 15); RT.cape = R_(CAPE, 25); RT.suezEu = R_(SUEZ_EU, 25);
  RT.extra = EXTRA_LANES.map(l => R_(l, 25));
  const ov = G.ov;
  if (SHOT === 'W1' || SHOT === 'W3') SW.world = worldSwarm(SHOT === 'W1' ? 1700 : 1300);
  if (SHOT === 'W2') {
    SW.suez = makeSwarm([{ rs: RT.suezEu }], 260, { sigma: 30, speed: 420, amber: 0.3, seed: 3 });
    SW.cape = makeSwarm([{ rs: RT.cape, oneWay: true }], 520, { sigma: 55, speed: 900, amber: 0.6, seed: 9 });
    SW.bg = makeSwarm([{ rs: RT.wMain, w: 1 }, ...RT.extra.map(rs => ({ rs, w: 0.6 }))], 700, { sigma: 55, speed: 520, amber: 0.2, seed: 13 });
  }
  if (SHOT === 'H') {
    RT.hzOut = R_([[26.3, 53.0], [26.43, 55.0], [26.42, 55.6], [26.52, 55.9], [26.66, 56.2], [26.62, 56.45], [26.42, 56.66], [26.05, 56.85], [25.55, 57.2], [24.8, 58.0], [23.6, 59.6]], 3);
    RT.hzIn = ov.routes.slice(4).map(r => R_(r.slice().reverse().concat([[26.5, 55.6], [26.62, 56.2]]), 4));
    RT.hzSea = ov.routes.slice(0, 4).map(r => R_([[26.05, 56.85], ...r], 6));
    SW.h = makeSwarm([{ rs: RT.hzOut, w: 2.4, lane: 2.2 }, ...RT.hzIn.map(rs => ({ rs, w: 0.8, oneWay: true, lane: 0, amber: 0.6 })),
      ...RT.hzSea.map(rs => ({ rs, w: 0.5, lane: 3, sig: 2.5 }))], 900, { sigma: 2.4, speed: 9, amber: 0.45, seed: 21 });
  }
  if (SHOT === 'B') {
    RT.local = R_(ov.main, 4);
    SW.b = makeSwarm([{ rs: RT.local, lane: 3.5 }], 1300, { sigma: 4.5, speed: 16, amber: 0.35, seed: 31 });
  }
  if (SHOT === 'M1' || SHOT === 'M2') {
    RT.local = R_(ov.main, 4); RT.malBr = ov.branches.map(b => R_(b, 6));
    SW.m = makeSwarm([{ rs: RT.local, lane: 2.0 }, ...RT.malBr.map(rs => ({ rs, w: 0.8, sig: 4, lane: 6 }))], SHOT === 'M1' ? 1300 : 900,
      { sigma: SHOT === 'M1' ? 2.6 : 14, speed: SHOT === 'M1' ? 7 : 60, amber: 0.35, seed: 41 });
  }
  window.__ready = true;
}

// ---------- shots ----------
function drawW1(t) {
  const tS = word('shipping');
  drawSwarm(SW.world, t, { alpha: smooth((t - 5.6) / 0.8) * (0.65 + 0.35 * smooth((t - tS) / 0.5)), reveal: t < 9.5 ? (() => 1e9) : null });
  // the three chokepoints
  [[HORMUZ, 'HORMUZ', -1], [BAB, 'BAB EL-MANDEB', -1], [MALACCA, 'MALACCA', 1]].forEach(([p, n, side], i) =>
    marker(...p, `0${i + 1}  ${n}`, t, word('three') + i * 0.32, { side }));
  // title
  const tT = word('whole') - 0.25, aT = smooth((t - tT) / 0.4);
  sideShade(aT, 'bottom', 0.75, 0.55);
  maskLines([['THREE STRAITS', 124, '#ffffff', tT], ['THAT MOVE THE WORLD', 58, AMBER, tT + 0.12]], 110 * S, H * 0.6, t, 14.75, { lead: 1.0 });
  txt('A DOCUMENTARY IN 90 SECONDS', 113 * S, H * 0.6 + 238 * S, { font: FM, size: 18, weight: 500, alpha: smooth((t - tT - 0.5) / 0.4) * (1 - smooth((t - 14.75) / 0.3)), spacing: 4, color: '#cfd8e0' });
}

function drawH(t) {
  const ov = G.ov, tc = word('closes'), red = smooth((t - tc) / 0.25);
  const tau = halt(t, tc);
  drawSwarm(SW.h, tau, { alpha: 1, red, tail: t > tc ? Math.max(0.05, 1 - (t - tc) * 3) : 1 });
  const aL = t < 22.4 ? smooth((t - 17.6) / 0.6) : 1;
  for (const [s, la, lo, sea] of [['PERSIAN GULF', 27.0, 52.2, 1], ['GULF OF OMAN', 24.6, 58.6, 1], ['IRAN', 28.4, 55.4], ['OMAN', 23.0, 57.3], ['UAE', 24.2, 54.6], ['MUSANDAM', 26.05, 56.25]])
    place(s, la, lo, aL * (s === 'MUSANDAM' ? 1 - smooth((t - 21.0) / 0.5) : 1), { sea: !!sea, size: sea ? 22 : 20 });
  lowerThird('CHAPTER 01', 'STRAIT OF HORMUZ', '26°34′N  56°15′E   ·   IRAN / OMAN', t, 17.35, 21.5);
  measure(ov.gap.a, ov.gap.b, '39 KM', 'AT ITS NARROWEST', t, word('thirty') - 0.15, 21.4);
  // the only way out
  const tO = word('only') - 0.1;
  sideShade(smooth((t - tO) / 0.4) * (1 - smooth((t - 22.0) / 0.3)), 'top', 0.55, 0.45);
  maskLines([['THE ONLY WAY OUT', 92, '#ffffff', tO], ['OF THE PERSIAN GULF', 46, AMBER, tO + 0.12]], 110 * S, H * 0.06, t, 21.9);
  // volume ribbon + a fifth of world oil
  if (t > 27.0) {
    const kR = easeInOut((t - 27.3) / 1.0), col = mixRGB([255, 176, 60], [255, 70, 55], red);
    ribbon(RT.hzOut, 0, RT.hzOut.len * kR, 34 * S, tau, (t < 31 ? 1 : 0.85) * smooth((t - 27.3) / 0.3), { color: col, flow: t < tc + 0.3 });
    pinNum(...HORMUZ, '≈ 1/5', "OF THE WORLD'S OIL CONSUMPTION", t, word('fifth') - 0.45, 30.9, { dx: 150, dy: -190, size: 130 });
  }
  // closure
  if (t > 32.5) {
    sideShade(1, 'left', 0.6, 0.5);
    maskLines([['IF HORMUZ CLOSES,', 84, '#ffffff', 32.62], ['THE OIL IS STUCK', 84, RED, word('stuck') - 0.15]], 110 * S, H * 0.12, t, 99);
    const pa = proj(...ov.gap.a), pb = proj(...ov.gap.b), kb = easeExpo((t - tc + 0.05) / 0.35), cx = (pa.x + pb.x) / 2, cy = (pa.y + pb.y) / 2;
    if (kb > 0) {
      const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x), L = Math.hypot(pb.x - pa.x, pb.y - pa.y) * 0.75 + 30 * S;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 14 * S; ctx.beginPath(); ctx.moveTo(-L * kb, 0); ctx.lineTo(L * kb, 0); ctx.stroke();
      ctx.strokeStyle = RED; ctx.lineWidth = 8 * S; ctx.stroke(); ctx.restore();
      const pr = ((t - tc) * 0.9) % 1; ctx.save(); ctx.strokeStyle = `rgba(255,74,61,${0.9 * (1 - pr)})`; ctx.lineWidth = 3 * S; ctx.beginPath(); ctx.arc(cx, cy, (20 + 90 * pr) * S, 0, 7); ctx.stroke(); ctx.restore();
    }
  }
}

function drawB(t) {
  const ov = G.ov, rs = RT.local;
  drawSwarm(SW.b, t, { alpha: smooth((t - 38.85) / 0.5) });
  lowerThird('CHAPTER 02', 'BAB EL-MANDEB', '12°35′N  43°20′E   ·   YEMEN / DJIBOUTI', t, 38.85, 41.8);
  measure(ov.gap.a, ov.gap.b, '26 KM', 'AT ITS NARROWEST', t, word('twenty', 3) - 0.15, 41.6);
  const aL = smooth((t - 41.6) / 0.5);
  const rp = proj(19.6, 38.85), rq = proj(17.0, 40.6);
  place('RED SEA', 19.2, 39.2, aL, { sea: true, size: 30, rot: Math.atan2(rq.y - rp.y, rq.x - rp.x) });
  place('GULF OF ADEN', 12.1, 47.6, aL, { sea: true, size: 22 });
  for (const [s, la, lo] of [['YEMEN', 15.4, 45.0], ['ERITREA', 15.5, 38.4], ['SAUDI ARABIA', 22.5, 43.5], ['EGYPT', 25.5, 30.5], ['SUDAN', 18.5, 33.5]]) place(s, la, lo, aL);
  for (const [s, la, lo] of [['YEMEN', 13.2, 44.0], ['DJIBOUTI', 11.75, 42.9]]) place(s, la, lo, smooth((t - 38.9) / 0.5) * (1 - smooth((t - 41.0) / 0.4)));
  marker(...SUEZ, 'SUEZ CANAL', t, word('suez') - 0.1, { side: 1 });
}

function drawW2(t) {
  const tA = word('around'), tF = word('fifteen');
  drawSwarm(SW.bg, t, { alpha: 0.4 });
  drawSwarm(SW.suez, halt(t, 53.6, 1.2), { alpha: 1 - 0.8 * smooth((t - 53.3) / 1.0), red: smooth((t - 53.5) / 0.3), tail: 1 - smooth((t - 53.5) / 0.8) * 0.9 });
  marker(...BAB, 'BAB EL-MANDEB', t, 52.85, { red: 1, side: -1 });
  drawSwarm(SW.cape, t, { alpha: smooth((t - tA + 0.3) / 0.4), reveal: () => RT.cape.len * easeInOut((t - tA + 0.3) / 2.4) });
  for (const [s, la, lo, a0] of [['AFRICA', 5.0, 21.0, 52.9], ['EUROPE', 49.0, 9.0, 52.9], ['ATLANTIC OCEAN', 0, -18, 55.0], ['INDIAN OCEAN', -15, 70, 52.9]])
    place(s, la, lo, smooth((t - a0) / 0.5), { sea: s.includes('OCEAN'), size: s.includes('OCEAN') ? 22 : 24 });
  pinNum(-34.9, 19.8, '+15 DAYS', 'TO SAIL AROUND AFRICA', t, tF - 0.4, 99, { dx: 170, dy: -60, size: 110 });
}

function drawM1(t) {
  drawSwarm(SW.m, t, { alpha: smooth((t - 62.85) / 0.4) });
  const aL = smooth((t - 63.0) / 0.5) * (1 - smooth((t - 65.0) / 0.4));
  for (const [s, la, lo] of [['SUMATRA', 0.6, 102.6], ['MALAYSIA', 2.4, 103.0]]) place(s, la, lo, aL);
  place('SINGAPORE', 1.36, 103.82, smooth((t - word('singapore')) / 0.4), { size: 22 });
  lowerThird('CHAPTER 03', 'STRAIT OF MALACCA', '1°10′N  103°47′E   ·   SINGAPORE', t, 62.85, 65.0);
  pinNum(...MALACCA, '2.7 KM', 'PHILLIPS CHANNEL · NARROWEST POINT', t, word('three', 2) - 0.2, 99, { dx: -170, dy: -190, size: 120 });
}

function drawM2(t) {
  drawSwarm(SW.m, t, { alpha: 0.75 });
  const rs = RT.local, i0 = rs.pts.findIndex(p => p[1] > 103.3);
  ribbon(rs, rs.cum[Math.max(0, i0 - 20)], rs.len, 30 * S, t, smooth((t - 73.7) / 0.4));
  RT.malBr.forEach((b, i) => ribbon(b, 0, b.len * easeOut((t - 74.0 - i * 0.2) / 1.1), [26, 18][i] * S, t, smooth((t - 74.0) / 0.3)));
  const ports = [['GUANGZHOU', 21.6, 113.7, 74.8, 1], ['ZHANJIANG', 20.6, 110.9, 75.0, -1], ['NINGBO-ZHOUSHAN', 30.7, 122.95, 75.3, -1]];
  for (const [n, la, lo, at, side] of ports) marker(la, lo, n, t, at, { side });
  place('CHINA', 28.5, 112.0, smooth((t - word("china's") + 0.1) / 0.4), { size: 40 });
  place('SOUTH CHINA SEA', 13.5, 113.5, smooth((t - 73.8) / 0.5), { sea: true, size: 22 });
  const tE = word('eighty');
  pinNum(...MALACCA, '80%', "OF CHINA'S OIL IMPORTS PASS MALACCA", t, tE - 0.35, 99, { dx: -60, dy: -330, size: 150, odoK: (t - tE + 0.1) / 1.0 });
}

function drawW3(t) {
  const tB = word('block');
  drawSwarm(SW.world, halt(t, tB + 0.4, 2), { alpha: 0.45 * (1 - 0.4 * smooth((t - tB - 0.4) / 0.6)) });
  const blockT = i => tB + 0.35 + i * 0.25, redOf = i => smooth((t - blockT(i)) / 0.2);
  const tp = halt(t, tB + 0.4, 3);
  const arcs = [[GULF, HORMUZ, 80.3, 0.5, 0], [HORMUZ, MALACCA, 80.7, 1.0, 2], [MALACCA, SHANGHAI, 81.5, 0.7, 2], [HORMUZ, BAB, 82.3, 0.6, 1], [BAB, SUEZ, 82.8, 0.5, 1], [SUEZ, ROTT, 83.2, 0.7, 1]];
  for (const [a, b, t0, d, ci] of arcs) arc3d(a, b, easeInOut((t - t0) / d), tp, { red: Math.max(redOf(0) * (ci === 0 ? 1 : 0), redOf(ci)), alpha: 1 });
  [[HORMUZ, 'HORMUZ', 1], [BAB, 'BAB EL-MANDEB', -1], [MALACCA, 'MALACCA', 1]].forEach(([p, n, side], i) =>
    marker(...p, `0${i + 1}  ${n}`, t, 77.95 + i * 0.25, { side, red: redOf(i) }));
  for (const [s, p, at, side] of [['GULF OIL', GULF, word('gulf', 1), -1], ['ASIA', SHANGHAI, word('asia', 1), 1], ['EUROPE', ROTT, word('europe', 1), 1]]) {
    const pp = proj(...p); if (pp.vis) maskText(s, pp.x + side * 22 * S, pp.y + 8 * S, 26, t, at - 0.1, 85.8, { font: FM, weight: 500, spacing: 3, align: side > 0 ? 'left' : 'right', color: AMBER, shadow: 0.85 });
  }
  // closing title
  const tW = word('whole', 1) - 0.15, aT = smooth((t - tW) / 0.6);
  if (aT > 0) {
    ctx.fillStyle = `rgba(3,7,12,${0.6 * aT})`; ctx.fillRect(0, 0, W, H);
    maskText('THREE NARROW STRAITS.', W / 2, H * 0.47, 120, t, tW, 99, { align: 'center' });
    maskText('ONE GLOBAL ECONOMY.', W / 2, H * 0.47 + 118 * S, 120, t, word('feels') - 0.1, 99, { align: 'center', color: AMBER });
  }
  const fo = smooth((t - 88.7) / 0.9); if (fo > 0) { ctx.fillStyle = `rgba(0,0,0,${fo})`; ctx.fillRect(0, 0, W, H); }
}

const DRAW = { W1: drawW1, H: drawH, B: drawB, W2: drawW2, M1: drawM1, M2: drawM2, W3: drawW3 };
window.projRoutes = () => ({});
window.renderAt = function (t) {
  T = t;
  ctx.clearRect(0, 0, W, H);
  const cam = placeCamera(t);
  G.limb.material.uniforms.limbK.value = 0.35 + 0.65 * smooth((cam.alt - 300) / 1500);
  G.clouds.material.uniforms.cloudK.value = 0.85 * smooth((cam.alt - 1200) / 3500); G.clouds.visible = G.clouds.material.uniforms.cloudK.value > 0.01;
  renderer.render(scene, camera);
  vignette(0.5);
  if (q.get('clean') !== '1') DRAW[SHOT](t);
  if (q.get('clean') !== '1') credit('ELEVATION: COPERNICUS DEM / AWS TERRAIN TILES · NATURAL EARTH', 0.45);
  return true;
};
init();
