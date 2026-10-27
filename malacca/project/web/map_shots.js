
// ================= Malacca map shots =================
// Clean infographic style: solid outlined routes, arrowheads, flat cards. No glow, no HUD gimmicks.
// Shot A: orbit -> dive into the strait (title, route, ship traffic, pin + width callout)
// Shot E: dimmed drift over the strait with an oil-share data card
// Shot B: wide pull-back, route to China's ports, 80% card
// [t, lat, lon, range km, tilt deg, heading deg]
const KEYS_A = [
  [0.0, 2.2, 100.2, 3600, 50, 38],
  [1.6, 2.3, 101.4, 1500, 46, 40],
  [3.2, 1.55, 103.0, 430, 50, 44],
  [6.2, 1.3, 103.55, 250, 54, 48],
];
const KEYS_E = [
  [0.0, 3.6, 101.2, 2300, 28, 36],
  [3.3, 3.3, 101.6, 2050, 26, 38],
];
const KEYS_B = [
  [0.0, 14.2, 110.2, 4900, 12, 4],
  [4.2, 15.0, 110.5, 5300, 10, 2],
];
const KEYS = SHOT === 'A' ? KEYS_A : SHOT === 'E' ? KEYS_E : KEYS_B;
const T_SHOT = SHOT === 'A' ? 0 : SHOT === 'E' ? 9.25 : 12.25;   // shot start on the voiceover timeline
const PIN = [1.17, 103.78];
const ORANGE = '#ff9a1f', ORANGE_RGB = '255,154,31', INK = 'rgba(9,17,27,0.86)', OUTLINE = 'rgba(8,16,26,0.92)';

function label(str, x, y, { size = 32, weight = 700, color = '#fff', alpha = 1, align = 'center', spacing = 0, rot = 0, shadow = true } = {}) {
  if (alpha <= 0.003) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${size * S}px Inter`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.letterSpacing = `${spacing * S}px`;
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 8 * S; ctx.shadowOffsetY = 2 * S; }
  ctx.fillStyle = color; ctx.fillText(str, 0, 0); ctx.restore();
}
// solid route: soft shadow, dark outline, flat colour core
function routeStroke(drawPath, w, a, color = ORANGE) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 6 * S; ctx.shadowOffsetY = 2 * S;
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = w + 4 * S; drawPath(); ctx.stroke();
  ctx.shadowColor = 'transparent'; ctx.strokeStyle = color; ctx.lineWidth = w; drawPath(); ctx.stroke();
  ctx.restore();
}
function arrowHead(x, y, ang, size, a, color = ORANGE) {
  if (a <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = a;
  ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(-size * 0.75, -size * 0.75); ctx.lineTo(-size * 0.4, 0); ctx.lineTo(-size * 0.75, size * 0.75); ctx.closePath();
  ctx.lineJoin = 'round'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4 * S; ctx.stroke(); ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}
function pin(x, y, k, a) {
  if (a <= 0) return;
  const s = 26 * S * k;
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a;
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 10 * S; ctx.shadowOffsetY = 4 * S;
  ctx.fillStyle = ORANGE; ctx.beginPath();
  ctx.moveTo(0, 0); ctx.bezierCurveTo(-s * 0.15, -s * 0.6, -s * 0.75, -s * 0.95, -s * 0.75, -s * 1.5);
  ctx.arc(0, -s * 1.5, s * 0.75, Math.PI, 0); ctx.bezierCurveTo(s * 0.75, -s * 0.95, s * 0.15, -s * 0.6, 0, 0); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.lineWidth = 2.5 * S; ctx.strokeStyle = OUTLINE; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -s * 1.5, s * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function card(x, y, w, h, a, accent = ORANGE) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 24 * S; ctx.shadowOffsetY = 8 * S;
  ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(x, y, w, h, 10 * S); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.fillStyle = accent; ctx.beginPath(); ctx.roundRect(x, y, 6 * S, h, [10 * S, 0, 0, 10 * S]); ctx.fill();
  ctx.restore();
}
function shipDot(lat, lon, dir, a, sz) {
  const p = proj(lat, lon); if (!p.vis || a <= 0) return;
  const q2 = proj(lat + dir[0] * 0.01, lon + dir[1] * 0.01), ang = Math.atan2(q2.y - p.y, q2.x - p.x);
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang); ctx.globalAlpha = a * 0.9;
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(-sz * 2.2, -sz * 0.12, sz * 2.2, sz * 0.24);   // short wake
  ctx.fillStyle = '#f4f6f8'; ctx.beginPath(); ctx.ellipse(0, 0, sz / 2, sz * 0.18 + 0.6 * S, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Catmull-Rom smoothing of a lat/lon polyline, so routes read as drawn curves, not kinked segments
function smoothLL(pts, per = 12) {
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

let G = null, VO = null, ROUTE = null, BR = [], SWARM = [];
const word = (w, n = 0) => VO.words.filter(x => x.w.replace(/\(\d\)$/, '') === w)[n].s - T_SHOT;
async function init() {
  G = await build();
  VO = await (await fetch('assets/vo.json')).json();
  for (const w of [500, 600, 700, 800]) await document.fonts.load(`${w} 40px Inter`);
  ROUTE = resample(smoothLL(G.ov.main), 4); BR = G.ov.branches.map(b => resample(smoothLL(b), 6));
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const iA = ROUTE.pts.findIndex(p => p[1] > 97.4), iB = ROUTE.pts.findIndex(p => p[1] > 105.4);
  const s0 = ROUTE.cum[iA], s1 = ROUTE.cum[iB];
  for (let i = 0; i < 140; i++) SWARM.push({ s: s0 + rnd() * (s1 - s0), v: (rnd() < 0.5 ? 1 : -1) * (4 + rnd() * 5), off: (rnd() - 0.5) * 2 * (6 + rnd() * 10) });
  window.__ready = true;
}
function swarmPos(sh, t) {
  const L0 = ROUTE.cum[ROUTE.pts.findIndex(p => p[1] > 97.4)], L1 = ROUTE.cum[ROUTE.pts.findIndex(p => p[1] > 105.4)];
  let s = sh.s + sh.v * t; s = L0 + ((s - L0) % (L1 - L0) + (L1 - L0)) % (L1 - L0);
  const a = along(ROUTE, s), b = along(ROUTE, s + 2);
  const dy = (b[0] - a[0]) * KM_LAT, dx = (b[1] - a[1]) * kmLon(a[0]), n = Math.hypot(dx, dy) || 1;
  const off = sh.off * Math.min(1, Math.abs(a[1] - 103.75) / 0.6 + 0.12); // lanes squeeze together at the Phillips Channel
  return { lat: a[0] + (dx / n) * off / KM_LAT, lon: a[1] + (-dy / n) * off / kmLon(a[0]), dir: [b[0] - a[0], b[1] - a[1]].map(v => v * Math.sign(sh.v)) };
}
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
// draw a route up to arc-length s with an arrowhead at the leading end
function drawRoute(rs, s, w, a, head = true) {
  if (s <= 0 || a <= 0) return;
  routeStroke(routePath(rs, 0, s), w, a);
  if (!head) return;
  const e = proj(...along(rs, s)), b = proj(...along(rs, Math.max(0, s - 25)));
  arrowHead(e.x, e.y, Math.atan2(e.y - b.y, e.x - b.x), w * 2.2, a);
}

function drawA(t) {
  const tStrait = word('strait'), tNarrow = word('narrowest'), tThree = word('three');
  const aSw = smooth((t - 1.2) / 0.8);
  for (const sh of SWARM) { const p = swarmPos(sh, t); shipDot(p.lat, p.lon, p.dir, aSw, Math.max(4 * S, Math.min(11 * S, 3.2 / camAt(t)[2] * 1000 * S))); }
  // shipping route drawing in from the Indian Ocean
  drawRoute(ROUTE, easeOut((t - 0.9) / 2.6) * ROUTE.len, 5 * S, smooth((t - 0.9) / 0.4));
  // title: plain, bold, left-aligned with an accent rule
  const aT = smooth((t - tStrait + 0.15) / 0.35) * (1 - smooth((t - 4.2) / 0.5)), slide = (1 - easeOut((t - tStrait + 0.15) / 0.6)) * 30 * S;
  const tx = 110 * S, ty = H * 0.14;
  ctx.save(); ctx.globalAlpha = aT; ctx.fillStyle = ORANGE; ctx.fillRect(tx, ty - 58 * S, 90 * S * easeOut((t - tStrait) / 0.5), 6 * S); ctx.restore();
  label('Strait of Malacca', tx + slide, ty, { size: 84, weight: 800, align: 'left', alpha: aT, spacing: -1 });
  label('Between the Indian Ocean and the Pacific', tx + slide, ty + 64 * S, { size: 30, weight: 500, align: 'left', alpha: aT * smooth((t - tStrait - 0.3) / 0.4), color: 'rgba(255,255,255,0.85)' });
  // pin + callout at the Phillips Channel
  const pp = proj(...PIN);
  const drop = easeOut((t - tNarrow + 0.05) / 0.35);
  pin(pp.x, pp.y - (1 - drop) * 50 * S, 1, smooth((t - tNarrow + 0.05) / 0.15));
  const aC = smooth((t - tThree + 0.1) / 0.3);
  if (aC > 0) {
    const k = easeOut((t - tThree + 0.1) / 0.45), cx = pp.x + 120 * S, cy = pp.y - 210 * S, cw = 330 * S, ch = 104 * S;
    ctx.save(); ctx.globalAlpha = aC; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * S;
    ctx.beginPath(); ctx.moveTo(pp.x + 6 * S, pp.y - 50 * S); ctx.lineTo(cx, cy + ch); ctx.stroke(); ctx.restore();
    card(cx, cy, cw * k, ch, aC);
    const at = aC * smooth((k - 0.55) / 0.45);
    label('Phillips Channel', cx + 24 * S, cy + 30 * S, { size: 24, weight: 600, align: 'left', alpha: at, color: 'rgba(255,255,255,0.75)', shadow: false });
    label('2.7 km wide', cx + 24 * S, cy + 68 * S, { size: 46, weight: 800, align: 'left', alpha: at, shadow: false });
  }
  const aL = smooth((t - 1.8) / 0.6) * (1 - smooth((t - 3.6) / 0.5));
  for (const [s, la, lo] of [['SUMATRA', 0.2, 101.4], ['MALAYSIA', 3.9, 102.0], ['SINGAPORE', 1.52, 104.35]]) {
    const p = proj(la, lo); if (p.vis) label(s, p.x, p.y, { size: 24, weight: 700, alpha: aL * 0.9, spacing: 6 });
  }
}

function drawE(t) {
  // dim the map so the data reads, keep the route as context
  ctx.fillStyle = 'rgba(6,12,20,0.45)'; ctx.fillRect(0, 0, W, H);
  drawRoute(ROUTE, ROUTE.len, 4 * S, 0.8, false);
  const tThird = word('third'), tOil = word('seaborne');
  const x = 110 * S, y = H * 0.19, w = 760 * S, h = 590 * S;
  const aCard = smooth((t - tThird + 0.55) / 0.35);
  card(x, y, w, h, aCard);
  label('Oil through the strait', x + 44 * S, y + 60 * S, { size: 30, weight: 600, align: 'left', alpha: aCard, color: 'rgba(255,255,255,0.7)', shadow: false });
  // share of seaborne oil
  const aP = smooth((t - tThird + 0.1) / 0.3), pct = 29 * easeOut((t - tThird + 0.1) / 0.9);
  label(`${Math.round(pct)}%`, x + 44 * S, y + 145 * S, { size: 110, weight: 800, align: 'left', alpha: aP, color: ORANGE, shadow: false });
  label('of all oil shipped by sea', x + 44 * S, y + 222 * S, { size: 30, weight: 600, align: 'left', alpha: aP, shadow: false });
  const bx = x + 44 * S, by = y + 262 * S, bw = w - 88 * S;
  ctx.save(); ctx.globalAlpha = aP; ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.roundRect(bx, by, bw, 18 * S, 9 * S); ctx.fill();
  ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.roundRect(bx, by, bw * pct / 100, 18 * S, 9 * S); ctx.fill(); ctx.restore();
  // comparison with Hormuz, million barrels per day
  const aB = smooth((t - tOil + 0.2) / 0.3);
  label('Million barrels per day, first half of 2025', x + 44 * S, y + 336 * S, { size: 24, weight: 600, align: 'left', alpha: aB, color: 'rgba(255,255,255,0.65)', shadow: false });
  [['Malacca', 23.2, ORANGE, 0], ['Hormuz', 20.9, 'rgba(255,255,255,0.55)', 0.15]].forEach(([n, v, c, d], i) => {
    const k = easeOut((t - tOil + 0.2 - d) / 0.8), yy = y + 396 * S + i * 70 * S, maxW = bw - 150 * S;
    label(n, bx, yy, { size: 30, weight: 700, align: 'left', alpha: aB, shadow: false });
    ctx.save(); ctx.globalAlpha = aB; ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(bx + 150 * S, yy - 17 * S, maxW * (v / 23.2) * k, 34 * S, 6 * S); ctx.fill(); ctx.restore();
    label((v * k).toFixed(1), bx + 150 * S + maxW * (v / 23.2) * k - 14 * S, yy, { size: 26, weight: 800, align: 'right', alpha: aB * smooth((k - 0.3) / 0.3), color: i ? '#0b1520' : '#1a0d00', shadow: false });
  });
  label('Source: U.S. EIA', x + 44 * S, y + h - 36 * S, { size: 20, weight: 500, align: 'left', alpha: aCard * 0.6, shadow: false });
}

function drawB(t) {
  const tEighty = word('eighty'), tChina = word("china's");
  drawRoute(ROUTE, ROUTE.len * easeOut((t - 0.1) / 1.6), 5 * S, smooth(t / 0.3), t < 1.7);
  BR.forEach((rs, i) => drawRoute(rs, rs.len * easeOut((t - 1.1 - i * 0.15) / 1.0), 4 * S, 1, true));
  // ports: ringed markers with pill labels
  const ports = [['Guangzhou', 21.6, 113.7, 1.3, -1], ['Zhanjiang', 20.6, 110.9, 1.5, -1], ['Ningbo-Zhoushan', 30.7, 122.95, 1.9, 1]];
  for (const [n, la, lo, at, side] of ports) {
    const p = proj(la, lo), a = smooth((t - at) / 0.3); if (a <= 0) continue;
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4 * S;
    ctx.beginPath(); ctx.arc(p.x, p.y, 8 * S, 0, Math.PI * 2); ctx.stroke(); ctx.fill(); ctx.restore();
    ctx.save(); ctx.font = `700 ${22 * S}px Inter`; const tw = ctx.measureText(n).width; ctx.restore();
    const lx = side < 0 ? p.x - 18 * S - tw - 24 * S : p.x + 18 * S;
    card(lx, p.y - 19 * S, tw + 24 * S, 38 * S, a, 'rgba(0,0,0,0)');
    label(n, lx + 12 * S, p.y, { size: 22, weight: 700, align: 'left', alpha: a, shadow: false });
  }
  const pc = proj(29.0, 111.0); label('CHINA', pc.x, pc.y, { size: 40, weight: 800, alpha: smooth((t - tChina + 0.1) / 0.4) * 0.9, spacing: 12 });
  const pm = proj(...PIN); pin(pm.x, pm.y, 0.85, smooth(t / 0.3));
  // 80% card in the empty Bay of Bengal
  const a8 = smooth((t - tEighty + 0.1) / 0.3), n8 = Math.round(80 * easeOut((t - tEighty + 0.1) / 0.8));
  const x = 110 * S, y = H * 0.3, w = 560 * S, h = 270 * S;
  card(x, y, w, h, a8);
  label(`${n8}%`, x + 44 * S, y + 100 * S, { size: 130, weight: 800, align: 'left', alpha: a8, color: ORANGE, shadow: false });
  label("of China's oil imports", x + 44 * S, y + 190 * S, { size: 34, weight: 700, align: 'left', alpha: a8 * smooth((t - tEighty - 0.2) / 0.3), shadow: false });
  label('pass through Malacca', x + 44 * S, y + 232 * S, { size: 28, weight: 500, align: 'left', alpha: a8 * smooth((t - tEighty - 0.4) / 0.3), color: 'rgba(255,255,255,0.7)', shadow: false });
}

window.renderAt = function (t) {
  const cam = placeCamera(t);
  G.limb.material.uniforms.limbK.value = 0.35 + 0.65 * smooth((cam.alt - 300) / 1500);
  renderer.render(scene, camera);
  ctx.clearRect(0, 0, W, H);
  if (SHOT === 'A') drawA(t); else if (SHOT === 'E') drawE(t); else drawB(t);
  label('Elevation: Copernicus DEM, AWS Terrain Tiles · Natural Earth', W - 40 * S, H - 30 * S, { size: 14, weight: 500, align: 'right', alpha: 0.5 });
  return true;
};
init();
