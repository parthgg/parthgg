
// ================= Documentary: three chokepoints =================
// All times are on the voiceover timeline (seconds). Each shot is rendered over its own time range.
const HUD = SHOT === 'F1';   // transparent overlay for real footage, no globe
const easeInOut = x => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

// camera keys: [t, lat, lon, range km, tilt deg, heading deg]
const SHOTS = {
  W1: [[5.5, 18, 62, 11000, 0, 0], [9.5, 16, 70, 9600, 8, 0], [15.3, 14, 74, 9000, 12, 0]],
  H: [[14.8, 25.6, 56.8, 2600, 32, 0], [17.3, 26.4, 56.45, 620, 24, 0], [19.2, 26.5, 56.42, 360, 20, 0], [21.6, 26.6, 55.4, 950, 28, -4],
      [25.0, 26.9, 53.2, 1950, 22, -4], [30.0, 26.4, 54.4, 2050, 18, 0], [33.2, 25.6, 57.2, 2500, 20, 4], [35.7, 25.4, 57.6, 2650, 20, 4]],
  B: [[35.2, 13.6, 46.8, 2400, 28, 0], [38.0, 12.9, 44.1, 760, 25, 0], [39.8, 12.6, 43.42, 260, 16, 0], [42.4, 15.6, 40.8, 1500, 20, 0],
      [44.6, 20.6, 38.4, 3000, 14, 0], [46.8, 21.0, 38.6, 3300, 12, 0], [49.6, 17.2, 42.2, 2600, 18, 0], [53.1, 16.6, 42.6, 2450, 18, 0]],
  W2: [[52.6, -1, 29, 13600, 0, 0], [58.6, -3, 28, 14200, 0, 0]],
  M1: [[58.2, 2.2, 100.2, 3600, 50, 38], [60.5, 2.3, 101.4, 1500, 46, 40], [63.0, 1.55, 103.0, 430, 50, 44], [67.0, 1.3, 103.55, 250, 54, 48]],
  M2: [[70.7, 3.6, 101.2, 2300, 28, 36], [73.4, 6.0, 104.5, 3400, 20, 16], [75.2, 13.6, 110.0, 4900, 12, 4], [78.0, 15.0, 110.5, 5300, 10, 2]],
  W3: [[77.6, 17, 66, 10500, 8, 0], [89.8, 21, 70, 11500, 5, 0]],
  F1: [[0, 0, 0, 1000, 0, 0], [1, 0, 0, 1000, 0, 0]],
};
const KEYS = SHOTS[SHOT];
const ORANGE = '#ff9a1f', RED = '#ff4438', INK = 'rgba(9,17,27,0.86)', OUTLINE = 'rgba(8,16,26,0.92)';

// ---------- drawing primitives (clean infographic style) ----------
function label(str, x, y, { size = 32, weight = 700, color = '#fff', alpha = 1, align = 'center', spacing = 0, rot = 0, shadow = true } = {}) {
  if (alpha <= 0.003) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${size * S}px Inter`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.letterSpacing = `${spacing * S}px`;
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8 * S; ctx.shadowOffsetY = 2 * S; }
  ctx.fillStyle = color; ctx.fillText(str, 0, 0); ctx.restore();
}
function textW(str, size, weight = 700) { ctx.save(); ctx.font = `${weight} ${size * S}px Inter`; const w = ctx.measureText(str).width; ctx.restore(); return w; }
function routeStroke(drawPath, w, a, color = ORANGE, dash = null) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (dash) ctx.setLineDash(dash);
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 6 * S; ctx.shadowOffsetY = 2 * S;
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = w + 4 * S; drawPath(); ctx.stroke();
  ctx.shadowColor = 'transparent'; ctx.strokeStyle = color; ctx.lineWidth = w; drawPath(); ctx.stroke();
  ctx.restore();
}
function arrowHead(x, y, ang, size, a, color = ORANGE) {
  if (a <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = a;
  ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(-size * 0.75, -size * 0.75); ctx.lineTo(-size * 0.4, 0); ctx.lineTo(-size * 0.75, size * 0.75); ctx.closePath();
  ctx.lineJoin = 'round'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4 * S; ctx.stroke(); ctx.fillStyle = color; ctx.fill(); ctx.restore();
}
function pin(x, y, k, a, color = ORANGE) {
  if (a <= 0) return;
  const s = 26 * S * k;
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a;
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 10 * S; ctx.shadowOffsetY = 4 * S;
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(0, 0); ctx.bezierCurveTo(-s * 0.15, -s * 0.6, -s * 0.75, -s * 0.95, -s * 0.75, -s * 1.5);
  ctx.arc(0, -s * 1.5, s * 0.75, Math.PI, 0); ctx.bezierCurveTo(s * 0.75, -s * 0.95, s * 0.15, -s * 0.6, 0, 0); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.lineWidth = 2.5 * S; ctx.strokeStyle = OUTLINE; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -s * 1.5, s * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function card(x, y, w, h, a, accent = ORANGE) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 24 * S; ctx.shadowOffsetY = 8 * S;
  ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(x, y, w, h, 10 * S); ctx.fill(); ctx.shadowColor = 'transparent';
  if (accent) { ctx.fillStyle = accent; ctx.beginPath(); ctx.roundRect(x, y, 6 * S, h, [10 * S, 0, 0, 10 * S]); ctx.fill(); }
  ctx.restore();
}
function pill(str, x, y, a, { size = 22, align = 'left', color = '#fff' } = {}) {
  if (a <= 0) return;
  const w = textW(str, size) + 24 * S, h = (size + 16) * S, x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  card(x0, y - h / 2, w, h, a, null); label(str, x0 + 12 * S, y, { size, align: 'left', alpha: a, color, shadow: false });
}
// numbered chokepoint marker
function marker(n, lat, lon, a, { red = 0, name = null, side = 1, pulse = 0 } = {}) {
  const p = proj(lat, lon); if (!p.vis || a <= 0) return;
  const r = 20 * S;
  ctx.save(); ctx.globalAlpha = a;
  if (pulse > 0) { ctx.strokeStyle = `rgba(255,68,56,${0.8 * (1 - pulse)})`; ctx.lineWidth = 3 * S; ctx.beginPath(); ctx.arc(p.x, p.y, r * (1 + pulse * 2.2), 0, Math.PI * 2); ctx.stroke(); }
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 10 * S; ctx.shadowOffsetY = 3 * S;
  ctx.fillStyle = red > 0.5 ? RED : ORANGE; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.lineWidth = 3 * S; ctx.strokeStyle = OUTLINE; ctx.stroke(); ctx.restore();
  label(String(n), p.x, p.y + 1 * S, { size: 22, weight: 800, alpha: a, color: '#0b1520', shadow: false });
  if (name) pill(name, p.x + side * (r + 10 * S), p.y, a, { align: side > 0 ? 'left' : 'right' });
}
function chapter(num, title, a, slide) {
  if (a <= 0) return;
  const x = 110 * S + slide, y = H - 170 * S;
  label(num, x, y, { size: 26, weight: 800, align: 'left', alpha: a, color: ORANGE, spacing: 4 });
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = ORANGE; ctx.fillRect(x + 52 * S, y - 1.5 * S, 60 * S, 3 * S); ctx.restore();
  label(title, x, y + 54 * S, { size: 64, weight: 800, align: 'left', alpha: a, spacing: -1 });
}
// measurement across a strait: white line with end ticks + value
function measure(a_, b_, text, a, k) {
  if (a <= 0) return;
  const pa = proj(...a_), pb = proj(...b_), mx = pa.x + (pb.x - pa.x) * k, my = pa.y + (pb.y - pa.y) * k;
  const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x);
  routeStroke(() => { ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(mx, my); }, 3 * S, a, '#ffffff');
  for (const [p, on] of [[pa, true], [{ x: mx, y: my }, k > 0.98]]) if (on) {
    ctx.save(); ctx.globalAlpha = a; ctx.translate(p.x, p.y); ctx.rotate(ang + Math.PI / 2); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * S; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-12 * S, 0); ctx.lineTo(12 * S, 0); ctx.stroke(); ctx.restore();
  }
  if (k > 0.9) pill(text, (pa.x + pb.x) / 2 + 26 * S, (pa.y + pb.y) / 2, a * smooth((k - 0.9) / 0.1), { size: 30 });
}
function shipDot(lat, lon, dir, a, sz) {
  const p = proj(lat, lon); if (!p.vis || a <= 0) return;
  const q2 = proj(lat + dir[0] * 0.01, lon + dir[1] * 0.01), ang = Math.atan2(q2.y - p.y, q2.x - p.x);
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang); ctx.globalAlpha = a * 0.9;
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(-sz * 2.2, -sz * 0.12, sz * 2.2, sz * 0.24);
  ctx.fillStyle = '#f4f6f8'; ctx.beginPath(); ctx.ellipse(0, 0, sz / 2, sz * 0.18 + 0.6 * S, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
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
function drawRoute(rs, s, w, a, { head = true, color = ORANGE, dash = null, s0 = 0 } = {}) {
  if (s <= s0 || a <= 0) return;
  routeStroke(routePath(rs, s0, s), w, a, color, dash);
  if (!head) return;
  const e = proj(...along(rs, s)), b = proj(...along(rs, Math.max(0, s - rs.len * 0.01 - 5)));
  arrowHead(e.x, e.y, Math.atan2(e.y - b.y, e.x - b.x), w * 2.2, a, color);
}
function dim(a) { if (a > 0) { ctx.fillStyle = `rgba(6,12,20,${0.45 * a})`; ctx.fillRect(0, 0, W, H); } }
function bars(x, y, w, title, rows, unit, t0, a, src) {
  // rows: [name, value, colour]; animated from t0
  const h = 150 * S + rows.length * 76 * S;
  card(x, y, w, h, a);
  label(title, x + 44 * S, y + 52 * S, { size: 28, weight: 600, align: 'left', alpha: a, color: 'rgba(255,255,255,0.75)', shadow: false });
  const mx = Math.max(...rows.map(r => r[1])), bx = x + 44 * S, maxW = w - 88 * S - 170 * S;
  rows.forEach(([n, v, c], i) => {
    const k = easeOut((T - t0 - i * 0.2) / 0.9), yy = y + 118 * S + i * 76 * S;
    label(n, bx, yy, { size: 30, weight: 700, align: 'left', alpha: a, shadow: false });
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(bx + 170 * S, yy - 19 * S, Math.max(2, maxW * (v / mx) * k), 38 * S, 6 * S); ctx.fill(); ctx.restore();
    label(`${(v * k).toFixed(1)}${unit}`, bx + 170 * S + maxW * (v / mx) * k + 14 * S, yy, { size: 28, weight: 800, align: 'left', alpha: a * smooth((k - 0.2) / 0.3), shadow: false });
  });
  label(src, x + 44 * S, y + h - 30 * S, { size: 19, weight: 500, align: 'left', alpha: a * 0.6, shadow: false });
  return h;
}

// ---------- geography ----------
const HORMUZ = [26.55, 56.45], BAB = [12.58, 43.38], MALACCA = [1.17, 103.78];
const WORLD_MAIN = [[51.9, 3.8], [50.3, -0.6], [48.6, -6.0], [43.6, -10.2], [37.0, -9.6], [35.95, -5.6], [37.2, 0.5], [37.6, 11.0], [34.8, 20.0], [32.8, 28.5], [31.4, 32.3],
  [29.9, 32.55], [27.7, 33.85], [24.0, 36.3], [20.0, 38.6], [16.0, 41.0], [13.3, 42.8], [12.6, 43.35], [12.2, 45.5], [12.3, 48.0], [12.2, 51.6], [10.5, 56.0], [8.0, 63.0],
  [6.2, 73.0], [5.5, 80.6], [5.9, 88.0], [5.9, 94.5], [4.1, 99.3], [2.4, 101.45], [1.25, 103.6], [1.3, 104.4], [3.2, 105.6], [6.5, 107.6], [10.5, 110.0], [18.5, 112.6],
  [22.0, 114.5], [24.8, 119.4], [30.7, 122.95]];
const GULF_SPUR = [[26.7, 50.4], [26.6, 53.3], [26.4, 55.6], [26.6, 56.45], [25.4, 57.5], [22.9, 60.4], [17.0, 63.0], [10.0, 64.5], [6.6, 72.0]];
const CAPE = [[12.3, 48.0], [8.0, 53.0], [0.0, 55.5], [-12.0, 57.0], [-25.0, 49.5], [-33.5, 31.0], [-35.6, 19.5], [-31.0, 13.5], [-18.0, 8.0], [-5.0, 3.0], [4.0, -9.5],
  [13.0, -19.5], [24.0, -18.5], [33.0, -12.5], [37.0, -10.0], [43.6, -10.2], [48.6, -6.0], [50.3, -0.6], [51.9, 3.8]];
const SUEZ_EU = [[12.3, 48.0], [12.2, 45.5], [12.6, 43.35], [13.3, 42.8], [16.0, 41.0], [20.0, 38.6], [24.0, 36.3], [27.7, 33.85], [29.9, 32.55], [31.4, 32.3], [32.8, 28.5],
  [34.8, 20.0], [37.6, 11.0], [37.2, 0.5], [35.95, -5.6], [37.0, -9.6], [43.6, -10.2], [48.6, -6.0], [50.3, -0.6], [51.9, 3.8]];
const FIN_GULF = [[26.7, 50.4], [26.6, 53.3], [26.4, 55.6], [26.6, 56.45], [25.4, 57.5], [22.9, 60.4], [18.0, 61.5]];
const FIN_EAST = [[18.0, 61.5], [10.0, 66.0], [6.2, 73.0], [5.5, 80.6], [5.9, 88.0], [5.9, 94.5], [4.1, 99.3], [2.4, 101.45], [1.25, 103.6], [1.3, 104.4], [3.2, 105.6],
  [6.5, 107.6], [10.5, 110.0], [18.5, 112.6], [22.0, 114.5], [24.8, 119.4], [30.7, 122.95]];
const FIN_WEST = [[18.0, 61.5], [14.5, 54.0], [12.3, 48.0], [12.2, 45.5], [12.6, 43.35], [13.3, 42.8], [16.0, 41.0], [20.0, 38.6], [24.0, 36.3], [27.7, 33.85], [29.9, 32.55],
  [31.4, 32.3], [32.8, 28.5], [34.8, 20.0], [37.6, 11.0], [37.2, 0.5], [35.95, -5.6], [37.0, -9.6], [43.6, -10.2], [48.6, -6.0], [50.3, -0.6], [51.9, 3.8]];

let G = null, VO = null, T = 0, RT = {};
const word = (w, n = 0) => VO.words.filter(x => x.w.replace(/\(\d\)$/, '') === w)[n].s;
const lineStart = i => VO.lines[i].start;

async function init() {
  VO = await (await fetch('assets/vo.json')).json();
  for (const w of [500, 600, 700, 800]) await document.fonts.load(`${w} 40px Inter`);
  if (!HUD) {
    G = await build();
    RT.wMain = R_(WORLD_MAIN, 25); RT.gulf = R_(GULF_SPUR, 15); RT.cape = R_(CAPE, 25); RT.suezEu = R_(SUEZ_EU, 25);
    RT.finGulf = R_(FIN_GULF, 12); RT.finEast = R_(FIN_EAST, 25); RT.finWest = R_(FIN_WEST, 25);
    if (G.ov.main) RT.local = R_(G.ov.main, 4);
    if (G.ov.center) RT.hzOut = R_([[26.3, 53.0], [26.43, 55.0], [26.42, 55.6], [26.52, 55.9], [26.66, 56.2], [26.62, 56.45], [26.42, 56.66], [26.05, 56.85], [25.55, 57.2], [24.8, 58.0]], 4);
    if (G.ov.routes) RT.hzIn = G.ov.routes.slice(4).map(r => R_(r.slice().reverse().concat([[26.5, 55.6], [26.62, 56.2]]), 6));
    if (G.ov.branches) RT.malBr = G.ov.branches.map(b => R_(b, 6));
    if (SHOT === 'M1') {
      let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const rs = RT.local, iA = rs.pts.findIndex(p => p[1] > 97.4), iB = rs.pts.findIndex(p => p[1] > 105.4);
      RT.swarm = []; RT.swL = [rs.cum[iA], rs.cum[iB]];
      for (let i = 0; i < 140; i++) RT.swarm.push({ s: RT.swL[0] + rnd() * (RT.swL[1] - RT.swL[0]), v: (rnd() < 0.5 ? 1 : -1) * (4 + rnd() * 5), off: (rnd() - 0.5) * 2 * (6 + rnd() * 10) });
    }
  }
  window.__ready = true;
}

// ---------- shots ----------
function drawW1(t) {
  const aR = smooth((t - word('shipping')) / 0.4);
  drawRoute(RT.wMain, RT.wMain.len * easeInOut((t - word('shipping')) / 2.6), 4 * S, aR, { head: t < word('shipping') + 2.6 });
  drawRoute(RT.gulf, RT.gulf.len * easeOut((t - word('shipping') - 0.8) / 1.6), 3.5 * S, aR, { head: false });
  // the gaps light up, then become numbered chokepoints
  const g = word('narrow');
  [[HORMUZ, 'Strait of Hormuz', -1], [BAB, 'Bab el-Mandeb', -1], [MALACCA, 'Strait of Malacca', 1]].forEach(([p, n, side], i) => {
    const pp = proj(...p), ring = clamp01((t - g - i * 0.15) / 0.9);
    if (ring > 0 && ring < 1) { ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - ring)})`; ctx.lineWidth = 3 * S; ctx.beginPath(); ctx.arc(pp.x, pp.y, 20 * S + ring * 60 * S, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    const tn = word('three') + i * 0.35;
    marker(i + 1, ...p, smooth((t - tn) / 0.25), { name: n, side: i === 2 ? 1 : -1 });
  });
  // title
  const at = smooth((t - word('whole') + 0.2) / 0.5);
  label('Three straits', 110 * S, H * 0.14, { size: 76, weight: 800, align: 'left', alpha: at, spacing: -1 });
  label('that move the world', 110 * S, H * 0.14 + 70 * S, { size: 40, weight: 600, align: 'left', alpha: at, color: 'rgba(255,255,255,0.85)' });
  ctx.save(); ctx.globalAlpha = at; ctx.fillStyle = ORANGE; ctx.fillRect(110 * S, H * 0.14 - 62 * S, 90 * S, 6 * S); ctx.restore();
}

function drawH(t) {
  const ov = G.ov;
  const aCh = smooth((t - word('first') + 0.1) / 0.4) * (1 - smooth((t - 20.0) / 0.5));
  chapter('01', 'Strait of Hormuz', aCh, (1 - easeOut((t - word('first')) / 0.6)) * 30 * S);
  // 39 km
  const t39 = word('thirty'), aM = smooth((t - t39 + 0.2) / 0.3) * (1 - smooth((t - 20.6) / 0.5));
  measure(ov.gap.a, ov.gap.b, '39 km', aM, easeOut((t - t39 + 0.1) / 0.8));
  // the only way out: Gulf -> strait -> Gulf of Oman
  const tOut = word('only'), aO = smooth((t - tOut + 0.2) / 0.3);
  drawRoute(RT.hzOut, RT.hzOut.len * easeInOut((t - tOut + 0.2) / 1.6), 5 * S, aO * (t > 33.0 ? 0 : 1), { head: true });
  const aLbl = smooth((t - 20.6) / 0.5);
  for (const [s, la, lo] of [['Persian Gulf', 27.3, 51.2], ['Gulf of Oman', 24.6, 58.6], ['IRAN', 30.0, 55.5], ['SAUDI ARABIA', 24.5, 48.0], ['OMAN', 21.5, 57.0]]) {
    const p = proj(la, lo); if (p.vis) label(s, p.x, p.y, { size: s === s.toUpperCase() ? 24 : 28, weight: s === s.toUpperCase() ? 700 : 600, spacing: s === s.toUpperCase() ? 6 : 0, alpha: aLbl * (s === s.toUpperCase() ? 0.8 : 1) });
  }
  // tankers converging from Gulf ports
  const tIn = word('twenty', 2) - 0.3;
  (RT.hzIn || []).forEach((rs, i) => drawRoute(rs, rs.len * easeOut((t - tIn - i * 0.2) / 1.6), 3 * S, smooth((t - tIn) / 0.3) * (1 - smooth((t - 33.2) / 0.4)), { head: true }));
  // 20M b/d + share of world consumption
  const t20 = word('twenty', 2), aC = smooth((t - t20 + 0.15) / 0.3) * (1 - smooth((t - 30.6) / 0.4));
  const x = 110 * S, y = H * 0.14;
  card(x, y, 620 * S, 356 * S, aC);
  label('Oil through the strait, 2024', x + 44 * S, y + 52 * S, { size: 26, weight: 600, align: 'left', alpha: aC, color: 'rgba(255,255,255,0.75)', shadow: false });
  const k20 = easeOut((t - t20) / 0.9);
  label(`${(20 * k20).toFixed(0)}M`, x + 44 * S, y + 125 * S, { size: 96, weight: 800, align: 'left', alpha: aC, color: ORANGE, shadow: false });
  label('barrels of oil a day', x + 44 * S, y + 190 * S, { size: 32, weight: 600, align: 'left', alpha: aC, shadow: false });
  const tF = word('fifth'), aF = aC * smooth((t - tF + 0.2) / 0.3), kF = easeOut((t - tF + 0.2) / 0.8);
  const bx = x + 44 * S, bw = 620 * S - 88 * S;
  ctx.save(); ctx.globalAlpha = aF; ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.roundRect(bx, y + 232 * S, bw, 18 * S, 9 * S); ctx.fill();
  ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.roundRect(bx, y + 232 * S, bw * 0.2 * kF, 18 * S, 9 * S); ctx.fill(); ctx.restore();
  label('≈ 20% of world oil consumption', x + 44 * S, y + 282 * S, { size: 28, weight: 700, align: 'left', alpha: aF, shadow: false });
  label('Source: U.S. EIA', x + 44 * S, y + 328 * S, { size: 19, weight: 500, align: 'left', alpha: aC * 0.6, shadow: false });
  // no other route -> blocked
  const tNo = word('no'), aN = smooth((t - tNo + 0.1) / 0.3);
  const hp = proj(...HORMUZ);
  if (aN > 0) pill('The only sea route out', hp.x + 40 * S, hp.y - 70 * S, aN, { size: 26 });
  const tCl = word('closes'), kc = smooth((t - tCl + 0.1) / 0.25);
  if (t > 33.0) drawRoute(RT.hzOut, RT.hzOut.len * 0.62, 5 * S, 1, { head: false, color: kc > 0.5 ? RED : ORANGE });
  if (kc > 0) {
    const s = 26 * S * (0.6 + 0.4 * easeOut((t - tCl + 0.1) / 0.3));
    ctx.save(); ctx.globalAlpha = kc; ctx.lineCap = 'round';
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 14 * S; ctx.beginPath(); ctx.moveTo(hp.x - s, hp.y - s); ctx.lineTo(hp.x + s, hp.y + s); ctx.moveTo(hp.x + s, hp.y - s); ctx.lineTo(hp.x - s, hp.y + s); ctx.stroke();
    ctx.strokeStyle = RED; ctx.lineWidth = 8 * S; ctx.stroke(); ctx.restore();
  }
}

function drawB(t) {
  const ov = G.ov, rs = RT.local;
  const aCh = smooth((t - word('sail') + 0.1) / 0.4) * (1 - smooth((t - 41.0) / 0.5));
  chapter('02', 'Bab el-Mandeb', aCh, (1 - easeOut((t - word('sail')) / 0.6)) * 30 * S);
  // route from the Gulf of Aden into the strait, then up the Red Sea to Suez
  const iSt = rs.pts.findIndex(p => p[1] < 43.4), sSt = rs.cum[iSt];
  let s = 0;
  if (t > 36.0) s = sSt * easeOut((t - 36.0) / 2.2);
  if (t > word('red') - 0.1) s = sSt + (rs.len - sSt) * easeInOut((t - word('red') + 0.1) / (word('canal') + 0.3 - word('red')));
  drawRoute(rs, s, 5 * S, smooth((t - 36.0) / 0.3), { head: s < rs.len - 1 });
  // 26 km
  const t26 = word('twenty', 3), aM = smooth((t - t26 + 0.2) / 0.3) * (1 - smooth((t - 41.6) / 0.5));
  measure(ov.gap.a, ov.gap.b, '26 km', aM, easeOut((t - t26 + 0.1) / 0.8));
  const aL = smooth((t - 41.6) / 0.5);
  const rp = proj(19.6, 38.85), rq = proj(17.0, 40.6);
  label('Red Sea', rp.x, rp.y, { size: 34, weight: 700, rot: Math.atan2(rq.y - rp.y, rq.x - rp.x), alpha: aL });
  const pa = proj(12.25, 48.3); label('Gulf of Aden', pa.x, pa.y + 34 * S, { size: 28, weight: 600, alpha: aL });
  const ps = proj(29.93, 32.55), aS = smooth((t - word('suez') + 0.1) / 0.3);
  if (aS > 0) { ctx.save(); ctx.globalAlpha = aS; ctx.fillStyle = '#fff'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4 * S; ctx.beginPath(); ctx.arc(ps.x, ps.y, 8 * S, 0, Math.PI * 2); ctx.stroke(); ctx.fill(); ctx.restore(); pill('Suez Canal', ps.x + 18 * S, ps.y, aS); }
  const aAs = smooth((t - word('asia') + 0.1) / 0.3) * (1 - smooth((t - 47.2) / 0.5)), aEu = smooth((t - word('europe') + 0.1) / 0.3) * (1 - smooth((t - 47.2) / 0.5));
  const pAs = proj(13.6, 54.5), pEu = proj(31.5, 30.0);
  label('to Asia  →', pAs.x, pAs.y, { size: 36, weight: 800, alpha: aAs, color: ORANGE });
  label('↑  to Europe', pEu.x - 40 * S, pEu.y, { size: 36, weight: 800, alpha: aEu, color: ORANGE });
  // attacks, then the collapse in flows
  const tAt = word('attack'), bp = proj(...BAB), aA = smooth((t - tAt + 0.1) / 0.3);
  if (aA > 0) {
    marker('!', ...BAB, aA, { red: 1, pulse: ((t - tAt) * 0.9) % 1 });
    pill('Attacks on shipping since Nov 2023', bp.x + 34 * S, bp.y - 4 * S, aA * smooth((t - tAt - 0.3) / 0.3), { size: 24 });
  }
  const tFl = word('oil', 3), aD = smooth((t - tFl + 0.3) / 0.3);
  if (aD > 0) {
    dim(aD * 0.6);
    bars(110 * S, H * 0.18, 700 * S, 'Oil through Bab el-Mandeb, million barrels a day',
      [['2023', 8.7, 'rgba(255,255,255,0.55)'], ['2024*', 4.0, RED]], '', tFl - 0.1, aD, '* January–August 2024 · Source: U.S. EIA (Vortexa data)');
    const aH = smooth((t - word('half') + 0.1) / 0.3);
    label('−54%', 110 * S + 700 * S - 44 * S, H * 0.18 + 52 * S, { size: 34, weight: 800, align: 'right', alpha: aH, color: RED, shadow: false });
  }
}

function drawW2(t) {
  const tA = word('around'), bp = proj(...BAB);
  // the Suez route, now avoided
  drawRoute(RT.suezEu, RT.suezEu.len, 3.5 * S, smooth((t - 52.9) / 0.4) * 0.75, { head: false, color: 'rgba(200,210,220,0.9)', dash: [10 * S, 9 * S] });
  marker('!', ...BAB, smooth((t - 52.9) / 0.4), { red: 1 });
  // the detour around Africa
  drawRoute(RT.cape, RT.cape.len * easeInOut((t - tA + 0.1) / 2.6), 5 * S, smooth((t - tA + 0.1) / 0.3), { head: true });
  const pc = proj(-35.6, 19.5); pill('Cape of Good Hope', pc.x + 20 * S, pc.y + 30 * S, smooth((t - tA - 1.0) / 0.3));
  const tF = word('fifteen'), aF = smooth((t - tF + 0.2) / 0.3);
  const x = W - 110 * S - 520 * S, y = H * 0.36;
  card(x, y, 520 * S, 210 * S, aF);
  label(`+${Math.round(15 * easeOut((t - tF + 0.2) / 0.8))} days`, x + 44 * S, y + 86 * S, { size: 84, weight: 800, align: 'left', alpha: aF, color: ORANGE, shadow: false });
  label('Arabian Sea → Europe via the Cape', x + 44 * S, y + 150 * S, { size: 26, weight: 600, align: 'left', alpha: aF, shadow: false });
  label('Source: U.S. EIA', x + 44 * S, y + 186 * S, { size: 19, weight: 500, align: 'left', alpha: aF * 0.6, shadow: false });
  const pe = proj(51.9, 3.8); pill('Europe', pe.x + 16 * S, pe.y, smooth((t - 53.2) / 0.4));
}

function drawM1(t) {
  const rs = RT.local, aSw = smooth((t - 59.8) / 0.8);
  for (const sh of RT.swarm) {
    const [L0, L1] = RT.swL; let s = sh.s + sh.v * (t - 58); s = L0 + ((s - L0) % (L1 - L0) + (L1 - L0)) % (L1 - L0);
    const a = along(rs, s), b = along(rs, s + 2), dy = (b[0] - a[0]) * KM_LAT, dx = (b[1] - a[1]) * kmLon(a[0]), n = Math.hypot(dx, dy) || 1;
    const off = sh.off * Math.min(1, Math.abs(a[1] - 103.75) / 0.6 + 0.12);
    shipDot(a[0] + (dx / n) * off / KM_LAT, a[1] + (-dy / n) * off / kmLon(a[0]), [b[0] - a[0], b[1] - a[1]].map(v => v * Math.sign(sh.v)), aSw, Math.max(4 * S, Math.min(11 * S, 3.2 / camAt(t)[2] * 1000 * S)));
  }
  drawRoute(rs, easeOut((t - 59.0) / 2.6) * rs.len, 5 * S, smooth((t - 59.0) / 0.4));
  const aCh = smooth((t - word('sail', 1) + 0.1) / 0.4) * (1 - smooth((t - 63.4) / 0.5));
  chapter('03', 'Strait of Malacca', aCh, (1 - easeOut((t - word('sail', 1)) / 0.6)) * 30 * S);
  const aL = smooth((t - 60.6) / 0.6) * (1 - smooth((t - 63.0) / 0.5));
  for (const [s, la, lo] of [['SUMATRA', 0.2, 101.4], ['MALAYSIA', 3.9, 102.0]]) { const p = proj(la, lo); if (p.vis) label(s, p.x, p.y, { size: 24, weight: 700, alpha: aL * 0.9, spacing: 6 }); }
  const pp = proj(...MALACCA), tS = word('singapore');
  pin(pp.x, pp.y - (1 - easeOut((t - tS + 0.05) / 0.35)) * 50 * S, 1, smooth((t - tS + 0.05) / 0.15));
  const ps = proj(1.52, 104.35); label('SINGAPORE', ps.x, ps.y, { size: 24, weight: 700, alpha: smooth((t - tS) / 0.4) * 0.9, spacing: 6 });
  const tTh = word('three', 2), aC = smooth((t - tTh + 0.1) / 0.3);
  if (aC > 0) {
    const k = easeOut((t - tTh + 0.1) / 0.45), cx = pp.x + 120 * S, cy = pp.y - 210 * S, cw = 330 * S, ch = 104 * S;
    ctx.save(); ctx.globalAlpha = aC; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.moveTo(pp.x + 6 * S, pp.y - 50 * S); ctx.lineTo(cx, cy + ch); ctx.stroke(); ctx.restore();
    card(cx, cy, cw * k, ch, aC);
    const at = aC * smooth((k - 0.55) / 0.45);
    label('Phillips Channel', cx + 24 * S, cy + 30 * S, { size: 24, weight: 600, align: 'left', alpha: at, color: 'rgba(255,255,255,0.75)', shadow: false });
    label('2.7 km wide', cx + 24 * S, cy + 68 * S, { size: 46, weight: 800, align: 'left', alpha: at, shadow: false });
  }
}

function drawM2(t) {
  const rs = RT.local;
  const tC = word('carrying'), aD = smooth((t - tC + 0.4) / 0.3) * (1 - smooth((t - 73.5) / 0.4));
  drawRoute(rs, rs.len, 4.5 * S, 1, { head: false });
  if (aD > 0) {
    dim(aD);
    bars(110 * S, H * 0.22, 760 * S, 'Oil through the strait, million barrels a day (H1 2025)',
      [['Malacca', 23.2, ORANGE], ['Hormuz', 20.9, 'rgba(255,255,255,0.55)']], '', tC + 0.2, aD, 'Source: U.S. EIA');
  }
  RT.malBr.forEach((b, i) => drawRoute(b, b.len * easeOut((t - 74.0 - i * 0.2) / 1.2), 4 * S, 1, { head: true }));
  const ports = [['Guangzhou', 21.6, 113.7, 74.8, -1], ['Zhanjiang', 20.6, 110.9, 75.0, -1], ['Ningbo-Zhoushan', 30.7, 122.95, 75.3, 1]];
  for (const [n, la, lo, at, side] of ports) {
    const p = proj(la, lo), a = smooth((t - at) / 0.3); if (a <= 0 || !p.vis) continue;
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4 * S; ctx.beginPath(); ctx.arc(p.x, p.y, 8 * S, 0, Math.PI * 2); ctx.stroke(); ctx.fill(); ctx.restore();
    pill(n, p.x + side * 18 * S, p.y, a, { align: side < 0 ? 'right' : 'left' });
  }
  const pc = proj(29.0, 111.0); label('CHINA', pc.x, pc.y, { size: 40, weight: 800, alpha: smooth((t - word("china's") + 0.1) / 0.4) * 0.9, spacing: 12 });
  const pm = proj(...MALACCA); pin(pm.x, pm.y, 0.85, 1);
  const tE = word('eighty'), a8 = smooth((t - tE + 0.1) / 0.3), n8 = Math.round(80 * easeOut((t - tE + 0.1) / 0.8));
  const x = 110 * S, y = H * 0.3, w = 560 * S, h = 270 * S;
  card(x, y, w, h, a8);
  label(`${n8}%`, x + 44 * S, y + 100 * S, { size: 130, weight: 800, align: 'left', alpha: a8, color: ORANGE, shadow: false });
  label("of China's oil imports", x + 44 * S, y + 190 * S, { size: 34, weight: 700, align: 'left', alpha: a8 * smooth((t - tE - 0.2) / 0.3), shadow: false });
  label('pass through Malacca', x + 44 * S, y + 232 * S, { size: 28, weight: 500, align: 'left', alpha: a8 * smooth((t - tE - 0.4) / 0.3), color: 'rgba(255,255,255,0.7)', shadow: false });
}

function drawW3(t) {
  const tG = word('gulf', 1), tA = word('asia', 1), tE = word('europe', 1), tB = word('block');
  drawRoute(RT.finGulf, RT.finGulf.len * easeOut((t - tG + 0.5) / 1.0), 5 * S, smooth((t - tG + 0.5) / 0.3), { head: t < tG + 0.5 });
  drawRoute(RT.finEast, RT.finEast.len * easeInOut((t - tG + 0.3) / (tA - tG + 0.6)), 5 * S, smooth((t - tG + 0.3) / 0.3));
  drawRoute(RT.finWest, RT.finWest.len * easeInOut((t - tA) / (tE - tA + 0.6)), 5 * S, smooth((t - tA) / 0.3));
  const pg = proj(27.3, 49.0); pill('Gulf oil', pg.x - 20 * S, pg.y - 36 * S, smooth((t - tG + 0.2) / 0.3), { align: 'right' });
  const pa = proj(30.7, 122.95); pill('Asia', pa.x + 18 * S, pa.y, smooth((t - tA + 0.1) / 0.3));
  const pe = proj(51.9, 3.8); pill('Europe', pe.x + 18 * S, pe.y, smooth((t - tE + 0.1) / 0.3));
  [[HORMUZ, -1], [BAB, -1], [MALACCA, 1]].forEach(([p, side], i) => {
    const tb = tB + 0.35 + i * 0.22, red = smooth((t - tb) / 0.2);
    marker(i + 1, ...p, smooth((t - 77.9 - i * 0.2) / 0.3), { red, pulse: t > tb ? ((t - tb) * 0.8) % 1 : 0 });
  });
  // closing title
  const aT = smooth((t - word('whole', 1) + 0.1) / 0.6);
  if (aT > 0) {
    ctx.fillStyle = `rgba(6,12,20,${0.55 * aT})`; ctx.fillRect(0, 0, W, H);
    label('Three narrow straits.', W / 2, H * 0.45, { size: 72, weight: 800, alpha: aT, spacing: -1 });
    label('One global economy.', W / 2, H * 0.45 + 84 * S, { size: 72, weight: 800, alpha: smooth((t - word('feels') + 0.1) / 0.5), color: ORANGE, spacing: -1 });
  }
  const fo = smooth((t - 88.7) / 0.9); if (fo > 0) { ctx.fillStyle = `rgba(0,0,0,${fo})`; ctx.fillRect(0, 0, W, H); }
}

function drawF1(t) {
  const tc = word('hundred') - 0.25, a = smooth((t - tc) / 0.3), n = Math.round(102500 * easeOut((t - tc) / 1.3));
  const x = 110 * S, y = H * 0.12, w = 590 * S, h = 190 * S;
  card(x, y, w, h, a);
  label(n.toLocaleString('en-US') + '+', x + 44 * S, y + 82 * S, { size: 96, weight: 800, align: 'left', alpha: a, color: ORANGE, shadow: false });
  label('ships passed through in 2025', x + 44 * S, y + 152 * S, { size: 30, weight: 600, align: 'left', alpha: a * smooth((t - tc - 0.3) / 0.3), shadow: false });
  label('Footage: Mixkit · Data: Marine Department Malaysia', W - 40 * S, H - 30 * S, { size: 14, weight: 500, align: 'right', alpha: 0.55 });
}

const DRAW = { W1: drawW1, H: drawH, B: drawB, W2: drawW2, M1: drawM1, M2: drawM2, W3: drawW3, F1: drawF1 };
window.renderAt = function (t) {
  T = t;
  ctx.clearRect(0, 0, W, H);
  if (!HUD) {
    const cam = placeCamera(t);
    G.limb.material.uniforms.limbK.value = 0.35 + 0.65 * smooth((cam.alt - 300) / 1500);
    renderer.render(scene, camera);
  }
  DRAW[SHOT](t);
  if (!HUD) label('Elevation: Copernicus DEM, AWS Terrain Tiles · Natural Earth', W - 40 * S, H - 30 * S, { size: 14, weight: 500, align: 'right', alpha: 0.5 });
  return true;
};
init();
