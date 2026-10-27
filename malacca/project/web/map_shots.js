
// ================= Malacca map shots =================
// Shot A: orbit -> dive into the strait (title, route, ship swarm, pin + radar at the Phillips Channel)
// Shot B: wide pull-back, oil routes to China, 80% stat
// [t, lat, lon, range km, tilt deg, heading deg]
const KEYS_A = [
  [0.0, 2.2, 100.2, 3600, 50, 38],
  [1.6, 2.3, 101.4, 1500, 46, 40],
  [3.2, 1.55, 103.0, 430, 50, 44],
  [6.2, 1.3, 103.55, 250, 54, 48],
];
const KEYS_B = [
  [0.0, 14.2, 110.2, 4900, 12, 4],
  [4.2, 15.0, 110.5, 5300, 10, 2],
];
const KEYS = SHOT === 'A' ? KEYS_A : KEYS_B;
const PIN = [1.17, 103.78];
const YEL = '255,214,64';

function tLabel(str, x, y, { size = 40, weight = 700, color = '#fff', alpha = 1, align = 'center', spacing = 2, rot = 0, glow = false } = {}) {
  if (alpha <= 0.003) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${size * S}px Rajdhani`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.letterSpacing = `${spacing * S}px`;
  ctx.shadowColor = glow ? `rgba(${ACCENT_RGB},0.8)` : 'rgba(0,0,0,0.7)'; ctx.shadowBlur = (glow ? 18 : 10) * S; ctx.shadowOffsetY = glow ? 0 : 2 * S;
  ctx.fillStyle = color; ctx.fillText(str, 0, 0); ctx.restore();
}
function lineGlow(drawPath, width, alpha, rgb) {
  if (alpha <= 0) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(${rgb},${alpha * 0.35})`; ctx.lineWidth = width * 4.5; ctx.filter = `blur(${5 * S}px)`; drawPath(); ctx.stroke(); ctx.filter = 'none';
  ctx.strokeStyle = `rgba(${rgb},${alpha})`; ctx.lineWidth = width * 1.3; drawPath(); ctx.stroke();
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.8})`; ctx.lineWidth = width * 0.45; drawPath(); ctx.stroke();
  ctx.restore();
}
function pin(x, y, k, a) {
  if (a <= 0) return;
  const s = 30 * S * k;
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a;
  ctx.shadowColor = `rgba(${ACCENT_RGB},0.9)`; ctx.shadowBlur = 20 * S;
  ctx.fillStyle = '#fff'; ctx.beginPath();
  ctx.moveTo(0, 0); ctx.bezierCurveTo(-s * 0.15, -s * 0.6, -s * 0.75, -s * 0.95, -s * 0.75, -s * 1.5);
  ctx.arc(0, -s * 1.5, s * 0.75, Math.PI, 0); ctx.bezierCurveTo(s * 0.75, -s * 0.95, s * 0.15, -s * 0.6, 0, 0); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.fillStyle = 'rgb(18,60,96)'; ctx.beginPath(); ctx.arc(0, -s * 1.5, s * 0.32, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function radar(x, y, r, t, a) {
  if (a <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.55); ctx.globalAlpha = a;
  ctx.strokeStyle = `rgba(${ACCENT_RGB},0.75)`; ctx.lineWidth = 2 * S;
  for (const k of [1, 0.66, 0.33]) { ctx.beginPath(); ctx.arc(0, 0, r * k, 0, Math.PI * 2); ctx.stroke(); }
  for (let i = 0; i < 72; i++) {
    const an = i / 72 * Math.PI * 2, l = i % 6 === 0 ? 0.08 : 0.035;
    ctx.beginPath(); ctx.moveTo(Math.cos(an) * r, Math.sin(an) * r); ctx.lineTo(Math.cos(an) * r * (1 + l), Math.sin(an) * r * (1 + l)); ctx.stroke();
  }
  const sw = t * 2.4;
  const g = ctx.createConicGradient(sw - 0.9, 0, 0);
  g.addColorStop(0, `rgba(${ACCENT_RGB},0)`); g.addColorStop(0.14, `rgba(${ACCENT_RGB},0.45)`); g.addColorStop(0.145, `rgba(${ACCENT_RGB},0)`); g.addColorStop(1, `rgba(${ACCENT_RGB},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function shipDot(lat, lon, dir, a, sz) {
  const p = proj(lat, lon); if (!p.vis || a <= 0) return;
  const q2 = proj(lat + dir[0] * 0.01, lon + dir[1] * 0.01), ang = Math.atan2(q2.y - p.y, q2.x - p.x);
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang); ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(-sz * 4, 0, 0, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.45)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -sz * 0.2); ctx.lineTo(-sz * 4, -sz * 0.5); ctx.lineTo(-sz * 4, sz * 0.5); ctx.lineTo(0, sz * 0.2); ctx.fill();
  ctx.fillStyle = 'rgba(240,244,248,0.95)'; ctx.beginPath(); ctx.ellipse(0, 0, sz / 2, sz * 0.17 + 0.7 * S, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

let G = null, VO = null, ROUTE = null, BR = [], SWARM = [];
const word = (w, n = 0) => VO.words.filter(x => x.w.replace(/\(\d\)$/, '') === w)[n].s;
async function init() {
  G = await build();
  VO = await (await fetch('assets/vo.json')).json();
  await document.fonts.load(`700 40px Rajdhani`); await document.fonts.load(`600 40px Rajdhani`);
  ROUTE = resample(G.ov.main, 4); BR = G.ov.branches.map(b => resample(b, 6));
  // ship swarm along the strait: both directions, spread across the lane
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

function drawA(t) {
  const tStrait = word('strait'), tNarrow = word('narrowest'), tThree = word('three');
  // ship swarm (fades in as we descend)
  const aSw = smooth((t - 1.2) / 0.8);
  for (const sh of SWARM) { const p = swarmPos(sh, t); shipDot(p.lat, p.lon, p.dir, aSw, Math.max(4.5 * S, Math.min(13 * S, 3.4 / camAt(t)[2] * 1000 * S))); }
  // yellow route drawing in from the Indian Ocean
  const sPin = ROUTE.cum[ROUTE.pts.findIndex(p => p[1] >= PIN[1])];
  const pr = easeOut((t - 0.9) / 2.4) * ROUTE.len;
  lineGlow(routePath(ROUTE, 0, Math.min(pr, ROUTE.len)), 2.6 * S, smooth((t - 0.9) / 0.4), YEL);
  // title + subtitle
  const aT = smooth((t - tStrait + 0.15) / 0.35) * (1 - smooth((t - 4.2) / 0.5));
  const spread = 14 * (1 - easeOut((t - tStrait + 0.15) / 0.9));
  tLabel('STRAIT OF MALACCA', W / 2, H * 0.15, { size: 104, weight: 700, alpha: aT, spacing: 6 + spread, glow: true });
  const sub = 'LINKING THE INDIAN OCEAN AND THE PACIFIC', n = Math.floor(clamp01((t - tStrait - 0.45) / 0.8) * sub.length);
  tLabel(sub.slice(0, n), W / 2, H * 0.15 + 70 * S, { size: 32, weight: 600, alpha: aT, spacing: 5, color: `rgb(${ACCENT_RGB})` });
  // pin + radar at the Phillips Channel
  const pp = proj(...PIN);
  radar(pp.x, pp.y, 230 * S, t, smooth((t - tNarrow + 0.1) / 0.5));
  // blue lines radiating to the approaches and ports
  const aR = smooth((t - tNarrow - 0.2) / 0.5);
  if (aR > 0) for (const [la, lo] of [[1.6, 102.6], [2.3, 101.5], [1.45, 104.9], [0.7, 104.5], [0.9, 103.2], [2.9, 104.6], [0.2, 103.9]]) {
    const q2 = proj(la, lo), k = easeOut((t - tNarrow - 0.2) / 0.9);
    lineGlow(() => { ctx.beginPath(); ctx.moveTo(pp.x, pp.y); ctx.lineTo(pp.x + (q2.x - pp.x) * k, pp.y + (q2.y - pp.y) * k); }, 1.6 * S, aR * 0.9, ACCENT_RGB);
  }
  const drop = easeOut((t - tNarrow + 0.05) / 0.35);
  pin(pp.x, pp.y - (1 - drop) * 60 * S, 1 + 0.15 * Math.sin(clamp01((t - tNarrow - 0.3) / 0.3) * Math.PI), smooth((t - tNarrow + 0.05) / 0.15));
  // callout: channel name + width
  const aC = smooth((t - tThree + 0.1) / 0.3);
  if (aC > 0) {
    const cx = pp.x + 150 * S, cy = pp.y - 150 * S, k = easeOut((t - tThree + 0.1) / 0.4);
    ctx.save(); ctx.globalAlpha = aC; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2 * S;
    ctx.beginPath(); ctx.moveTo(pp.x + 8 * S, pp.y - 60 * S); ctx.lineTo(cx, cy); ctx.lineTo(cx + 330 * S * k, cy); ctx.stroke();
    ctx.fillStyle = 'rgba(6,20,36,0.78)'; ctx.beginPath(); ctx.roundRect(cx, cy - 92 * S, 330 * S * k, 84 * S, 6 * S); ctx.fill();
    ctx.restore();
    tLabel('PHILLIPS CHANNEL', cx + 16 * S, cy - 70 * S, { size: 26, weight: 600, align: 'left', alpha: aC * smooth((k - 0.6) / 0.4), spacing: 4, color: `rgb(${ACCENT_RGB})` });
    tLabel('2.7 KM WIDE', cx + 16 * S, cy - 34 * S, { size: 50, weight: 700, align: 'left', alpha: aC * smooth((k - 0.6) / 0.4), spacing: 3 });
  }
  // labels for the land masses
  const aL = smooth((t - 1.8) / 0.6) * (1 - smooth((t - 3.6) / 0.5));
  for (const [s, la, lo] of [['SUMATRA', 0.2, 101.4], ['MALAYSIA', 3.9, 102.0], ['SINGAPORE', 1.52, 104.35]]) {
    const p = proj(la, lo); if (p.vis) tLabel(s, p.x, p.y, { size: 30, weight: 700, alpha: aL, spacing: 8 });
  }
}

function drawB(t) {
  const tEighty = word('eighty') - 12.542 + 0.0, tChina = word('china\'s') - 12.542;
  // routes: Malacca -> South China Sea -> Chinese ports, in gold
  const pr = easeOut((t - 0.1) / 1.6);
  lineGlow(routePath(ROUTE, 0, ROUTE.len * pr), 2.4 * S, smooth(t / 0.3), GOLD_RGB);
  BR.forEach((rs, i) => { const k = easeOut((t - 1.1 - i * 0.15) / 1.0); if (k > 0) lineGlow(routePath(rs, 0, rs.len * k), 2.2 * S, 1, GOLD_RGB); });
  // flowing pulses along the routes
  ctx.save(); ctx.fillStyle = 'rgba(255,236,170,0.95)'; ctx.shadowColor = `rgba(${GOLD_RGB},1)`; ctx.shadowBlur = 12 * S;
  for (const rs of [ROUTE, ...BR]) for (let s = (t * 900) % 450; s < rs.len * (rs === ROUTE ? pr : 1); s += 450) {
    const p = proj(...along(rs, s)); if (p.vis) { ctx.beginPath(); ctx.arc(p.x, p.y, 3.5 * S, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
  // ports
  const ports = [['GUANGZHOU', 21.6, 113.7, 1.3], ['ZHANJIANG', 20.6, 110.9, 1.5], ['NINGBO-ZHOUSHAN', 30.7, 122.95, 1.9]];
  for (const [n, la, lo, at] of ports) {
    const p = proj(la, lo), a = smooth((t - at) / 0.3); if (a <= 0) continue;
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.shadowColor = `rgba(${GOLD_RGB},1)`; ctx.shadowBlur = 14 * S;
    ctx.beginPath(); ctx.arc(p.x, p.y, 7 * S, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    tLabel(n, p.x + 16 * S, p.y, { size: 24, weight: 700, align: 'left', alpha: a, spacing: 3 });
  }
  const pc = proj(29.5, 112.0); tLabel('CHINA', pc.x, pc.y, { size: 46, weight: 700, alpha: smooth((t - tChina + 0.1) / 0.4), spacing: 14 });
  const pm = proj(...PIN); pin(pm.x, pm.y, 0.8, smooth(t / 0.3));
  // big stat in the empty ocean on the left
  const a8 = smooth((t - tEighty + 0.1) / 0.3), n8 = Math.round(80 * easeOut((t - tEighty + 0.1) / 0.8));
  const sx = W * 0.2, sy = H * 0.42;
  tLabel(`${n8}%`, sx, sy, { size: 200, weight: 700, alpha: a8, color: `rgb(${GOLD_RGB})`, spacing: 2 });
  tLabel("OF CHINA'S OIL IMPORTS", sx, sy + 118 * S, { size: 40, weight: 700, alpha: a8 * smooth((t - tEighty - 0.2) / 0.3), spacing: 6 });
  tLabel('PASS THROUGH MALACCA', sx, sy + 166 * S, { size: 30, weight: 600, alpha: a8 * smooth((t - tEighty - 0.4) / 0.3), spacing: 6, color: `rgb(${ACCENT_RGB})` });
}

window.renderAt = function (t) {
  const cam = placeCamera(t);
  G.limb.material.uniforms.limbK.value = 0.35 + 0.65 * smooth((cam.alt - 300) / 1500);
  renderer.render(scene, camera);
  ctx.clearRect(0, 0, W, H);
  if (SHOT === 'A') drawA(t); else drawB(t);
  // HUD frame: corner brackets + credits
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2 * S; const m = 34 * S, l = 46 * S;
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) { ctx.beginPath(); ctx.moveTo(x, y + sy * l); ctx.lineTo(x, y); ctx.lineTo(x + sx * l, y); ctx.stroke(); }
  ctx.restore();
  tLabel('Elevation: Copernicus DEM, AWS Terrain Tiles · Natural Earth', W - 56 * S, H - 46 * S, { size: 15, weight: 600, align: 'right', alpha: 0.5, spacing: 1 });
  return true;
};
init();
