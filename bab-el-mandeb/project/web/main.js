// Bab el-Mandeb: flat top-down map animation, 2D canvas.
const q = new URLSearchParams(location.search);
const W = +(q.get('w') || 1920), H = +(q.get('h') || 1080), S = Math.min(W, H) / 1080;
const cv = document.getElementById('c');
cv.width = W; cv.height = H;
const ctx = cv.getContext('2d');
const D2R = Math.PI / 180;

const LAYERS = [
  { name: 'wide', bb: [18.0, 2.0, 64.0, 38.0], feather: 0 },
  { name: 'mid', bb: [39.6, 9.2, 47.9, 16.3], feather: 0.06 },
  { name: 'close', bb: [42.65, 11.95, 44.15, 13.35], feather: 0.08 },
];
const CYAN = '#5fd8ff', RED = '#ff3b2f', NAVY = '#0d2240';

const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp01(x), 3);
const easeInOut = x => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeBack = x => { x = clamp01(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

// ---------- camera: centre + km per pixel ----------
// [t, lat, lon, km/px]. Close shot -> fast zoom out -> slow push on the wide view.
const KEYS = [
  [0.0, 12.585, 43.40, 0.040],
  [7.0, 12.585, 43.40, 0.033],
  [7.95, 20.6, 40.6, 2.30],
  [15.6, 20.4, 40.8, 2.12],
];
let cam = { lat: 0, lon: 0, kmpp: 1 };
function camAt(t) {
  let i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1][0]) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  let u = clamp01((t - a[0]) / (b[0] - a[0]));
  const zoomSeg = i === 1;
  u = zoomSeg ? easeInOut(u) : u;
  // zoom in log space; during the zoom, pan follows the zoom so the strait stays put until it's tiny
  const lk = Math.log(a[3]) + (Math.log(b[3]) - Math.log(a[3])) * u;
  const kmpp = Math.exp(lk);
  const pz = zoomSeg ? clamp01((lk - Math.log(a[3])) / (Math.log(b[3]) - Math.log(a[3]))) ** 2.2 : u;
  return { lat: a[1] + (b[1] - a[1]) * pz, lon: a[2] + (b[2] - a[2]) * pz, kmpp };
}
function proj(lat, lon) {
  const kx = 111.32 * Math.cos(cam.lat * D2R);
  return { x: W / 2 + (lon - cam.lon) * kx / cam.kmpp, y: H / 2 - (lat - cam.lat) * 110.57 / cam.kmpp };
}
const pxPerKm = () => 1 / cam.kmpp;

// ---------- assets ----------
const loadImg = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
function feathered(img, f) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  if (f > 0) {
    g.globalCompositeOperation = 'destination-in';
    const m = document.createElement('canvas'); m.width = img.width; m.height = img.height;
    const mg = m.getContext('2d'); mg.fillStyle = '#000'; mg.fillRect(0, 0, m.width, m.height);
    mg.globalCompositeOperation = 'destination-in';
    const fx = img.width * f, fy = img.height * f;
    let gr = mg.createLinearGradient(0, 0, img.width, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(f, '#000'); gr.addColorStop(1 - f, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    mg.fillStyle = gr; mg.fillRect(0, 0, m.width, m.height);
    gr = mg.createLinearGradient(0, 0, 0, img.height);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(f, '#000'); gr.addColorStop(1 - f, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    mg.fillStyle = gr; mg.fillRect(0, 0, m.width, m.height);
    g.drawImage(m, 0, 0);
  }
  return c;
}
function tinted(img, color) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-in';
  g.fillStyle = color; g.fillRect(0, 0, c.width, c.height); return c;
}

let G = null;
async function init() {
  const [geo, vo] = await Promise.all([fetch('assets/geo.json').then(r => r.json()), fetch('assets/vo.json').then(r => r.json())]);
  const imgs = await Promise.all(LAYERS.map(l => loadImg(`assets/${l.name}.jpg`)));
  const layers = LAYERS.map((l, i) => ({ ...l, cv: feathered(imgs[i], l.feather) }));
  const [fr, fa] = await Promise.all([loadImg('assets/fill_redsea.png'), loadImg('assets/fill_aden.png')]);
  const fills = { red: tinted(fr, 'rgb(150,18,28)'), aden: tinted(fa, 'rgb(22,78,232)') };
  await document.fonts.load('800 40px Montserrat'); await document.fonts.load('700 40px Montserrat');
  const word = (w, n = 0) => vo.words.filter(x => x.w.replace(/\(\d\)$/, '') === w)[n].s;
  const T = {
    bab: word('mandeb') - 0.25, sixteen: word('sixteen'), ships: word('ships'), year: word('year'),
    aden: word('aden'), red: word('red'), suez: word('suez'), shortest: word('shortest'), asia: word('asia'), europe: word('europe'),
  };
  G = { layers, fills, geo, T, route: resample(geo.route, 6) };
  window.__ready = true;
}

function resample(path, stepKm) {
  const pts = [path[0]], cum = [0];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const d = Math.hypot((b[0] - a[0]) * 110.57, (b[1] - a[1]) * 111.32 * Math.cos(a[0] * D2R)), n = Math.max(1, Math.ceil(d / stepKm));
    for (let k = 1; k <= n; k++) { pts.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); cum.push(cum[cum.length - 1] + d / n); }
  }
  return { pts, cum, len: cum[cum.length - 1] };
}
function along(rs, s) {
  s = Math.max(0, Math.min(rs.len, s)); let i = 1; while (i < rs.cum.length - 1 && rs.cum[i] < s) i++;
  const u = (s - rs.cum[i - 1]) / Math.max(1e-6, rs.cum[i] - rs.cum[i - 1]), a = rs.pts[i - 1], b = rs.pts[i];
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}

// ---------- drawing helpers ----------
function drawLayer(L, alpha = 1) {
  const [lo0, la0, lo1, la1] = L.bb, p0 = proj(la1, lo0), p1 = proj(la0, lo1);
  if (p1.x < 0 || p0.x > W || p1.y < 0 || p0.y > H) return;
  ctx.globalAlpha = alpha; ctx.drawImage(L.cv, p0.x, p0.y, p1.x - p0.x, p1.y - p0.y); ctx.globalAlpha = 1;
}
function drawFill(cvs, alpha) {
  if (alpha <= 0) return; drawLayer({ bb: LAYERS[0].bb, cv: cvs }, alpha);
}
function label(str, x, y, { size = 34, weight = 800, color = '#fff', rot = 0, align = 'center', alpha = 1, spacing = 0, shadow = true } = {}) {
  if (alpha <= 0.003) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${size * S}px Montserrat`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.letterSpacing = `${spacing * S}px`;
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 10 * S; ctx.shadowOffsetY = 3 * S; }
  ctx.fillStyle = color; ctx.fillText(str, 0, 0); ctx.restore();
}
function dot(x, y, r, alpha) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8 * S;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.fillStyle = '#e8eef6'; ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
// ship pictogram inside a white badge (original drawing)
function shipBadge(x, y, r, k) {
  if (k <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 12 * S; ctx.shadowOffsetY = 3 * S;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.strokeStyle = NAVY; ctx.lineWidth = r * 0.09; ctx.beginPath(); ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = NAVY; const u = r / 10;
  ctx.beginPath(); ctx.moveTo(-6 * u, 0.5 * u); ctx.lineTo(6 * u, 0.5 * u); ctx.lineTo(4.4 * u, 3.6 * u); ctx.lineTo(-4.6 * u, 3.6 * u); ctx.closePath(); ctx.fill();
  ctx.fillRect(-3.4 * u, -2.6 * u, 5.2 * u, 2.6 * u); ctx.fillRect(-1.6 * u, -5 * u, 1.8 * u, 2.6 * u);
  ctx.fillStyle = '#fff'; for (let i = 0; i < 3; i++) ctx.fillRect(-2.8 * u + i * 1.6 * u, -2 * u, 0.9 * u, 0.9 * u);
  ctx.strokeStyle = NAVY; ctx.lineWidth = 0.7 * u; ctx.beginPath();
  for (let i = -6; i <= 6; i += 0.5) ctx.lineTo(i * u, 5.2 * u + Math.sin(i * 1.6) * 0.5 * u); ctx.stroke();
  ctx.restore();
}
// top-down vessel along the route
function vessel(x, y, ang, len) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 10 * S;
  ctx.fillStyle = '#f4f6f9'; ctx.strokeStyle = NAVY; ctx.lineWidth = 2 * S;
  ctx.beginPath(); ctx.moveTo(len / 2, 0); ctx.quadraticCurveTo(len * 0.32, -len * 0.16, len * 0.1, -len * 0.16); ctx.lineTo(-len / 2, -len * 0.15);
  ctx.lineTo(-len / 2, len * 0.15); ctx.lineTo(len * 0.1, len * 0.16); ctx.quadraticCurveTo(len * 0.32, len * 0.16, len / 2, 0); ctx.fill(); ctx.stroke();
  ctx.shadowColor = 'transparent'; ctx.fillStyle = NAVY; ctx.fillRect(-len * 0.44, -len * 0.1, len * 0.14, len * 0.2);
  ctx.fillStyle = '#c9d3df'; for (let i = 0; i < 4; i++) ctx.fillRect(-len * 0.24 + i * len * 0.15, -len * 0.08, len * 0.11, len * 0.16);
  ctx.restore();
}

// ---------- scene ----------
function render(t) {
  cam = camAt(t);
  ctx.fillStyle = '#0b1a2c'; ctx.fillRect(0, 0, W, H);
  for (const L of G.layers) drawLayer(L);
  const { T, geo } = G;
  const wideA = smooth((t - 7.6) / 0.4);

  // --- close-up: measurement across the strait
  const closeA = 1 - smooth((t - 7.0) / 0.35);
  if (closeA > 0) {
    const a = proj(...geo.gap.a), b = proj(...geo.gap.b);
    const ext = 0.12, ax = a.x + (a.x - b.x) * ext, ay = a.y + (a.y - b.y) * ext, bx = b.x + (b.x - a.x) * ext, by = b.y + (b.y - a.y) * ext;
    const k = easeOut((t - 0.35) / 0.8), ex = bx + (ax - bx) * k, ey = by + (ay - by) * k;
    const ang = Math.atan2(ay - by, ax - bx);
    ctx.save(); ctx.globalAlpha = closeA; ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(95,216,255,0.35)'; ctx.lineWidth = 16 * S; ctx.filter = `blur(${6 * S}px)`;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke(); ctx.filter = 'none';
    ctx.setLineDash([26 * S, 14 * S]); ctx.lineDashOffset = -t * 30 * S;
    ctx.strokeStyle = CYAN; ctx.lineWidth = 7 * S; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#fff'; for (const [x, y, on] of [[bx, by, k > 0], [ax, ay, k > 0.97]]) if (on) { ctx.beginPath(); ctx.arc(x, y, 7 * S, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    // label above the line, number below it
    const mx = (ax + bx) / 2, my = (ay + by) / 2, nx = Math.sin(ang), ny = -Math.cos(ang);
    const rot = ang > Math.PI / 2 || ang < -Math.PI / 2 ? ang + Math.PI : ang;
    const la = smooth((t - T.bab) / 0.35) * closeA, sc = 0.85 + 0.15 * easeBack((t - T.bab) / 0.4);
    ctx.save(); ctx.translate(mx - nx * 46 * S, my - ny * 46 * S); ctx.scale(sc, sc);
    label('BAB EL-MANDEB', 0, 0, { size: 50, weight: 800, rot, alpha: la, spacing: 1 }); ctx.restore();
    const full = '16 MILES WIDE', n = Math.floor(clamp01((t - T.sixteen + 0.05) / 0.6) * full.length);
    label(full.slice(0, n), mx + nx * 50 * S, my + ny * 50 * S, { size: 44, weight: 800, color: RED, rot, alpha: closeA });
    if (n === full.length) label('(26 km)', mx + nx * 96 * S, my + ny * 96 * S, { size: 26, weight: 700, rot, alpha: closeA * smooth((t - T.sixteen - 0.7) / 0.3) });
    // ship badges popping in the approaches
    [[12.53, 43.58], [12.74, 43.235], [12.44, 43.47]].forEach(([la_, lo_], i) => {
      const p = proj(la_, lo_); shipBadge(p.x, p.y, 34 * S, easeBack((t - T.ships - 0.05 - i * 0.22) / 0.3) * closeA);
    });
  }

  // --- wide: seas, route, labels
  if (wideA > 0) {
    drawFill(G.fills.aden, 0.88 * wideA * smooth((t - T.aden + 0.25) / 0.45));
    drawFill(G.fills.red, 0.82 * wideA * smooth((t - T.red + 0.1) / 0.45));
    const rs = G.route;
    const iStrait = rs.pts.findIndex(p => p[1] < 43.4), sStrait = rs.cum[iStrait];
    // route: Gulf of Aden -> strait with "Gulf of Aden", then up the Red Sea to Suez
    let s1 = 0;
    if (t > T.aden - 0.1) s1 = sStrait * easeOut((t - T.aden + 0.1) / 0.7);
    if (t > T.red) s1 = sStrait + (rs.len - sStrait) * easeInOut((t - T.red) / (T.suez + 0.25 - T.red));
    if (s1 > 0) {
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = wideA;
      const path = () => { ctx.beginPath(); let st = false; for (let i = 0; i < rs.pts.length && rs.cum[i] <= s1; i++) { const p = proj(...rs.pts[i]); st ? ctx.lineTo(p.x, p.y) : (ctx.moveTo(p.x, p.y), st = true); } const e = proj(...along(rs, s1)); ctx.lineTo(e.x, e.y); };
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 10 * S; ctx.strokeStyle = '#fff'; ctx.lineWidth = 7 * S; path(); ctx.stroke(); ctx.restore();
    }
    const pA = proj(...rs.pts[0]), pS = proj(...rs.pts[rs.pts.length - 1]);
    const aA = wideA * smooth((t - T.aden + 0.1) / 0.3);
    dot(pA.x, pA.y, 11 * S, aA); label('Gulf of Aden', pA.x + 22 * S, pA.y - 2 * S, { size: 34, align: 'left', alpha: aA });
    const rp = proj(19.6, 38.85), rq = proj(17.0, 40.6);
    label('Red Sea', rp.x, rp.y, { size: 40, rot: Math.atan2(rq.y - rp.y, rq.x - rp.x), alpha: wideA * smooth((t - T.red - 0.1) / 0.35) });
    const aS = wideA * smooth((t - T.suez + 0.05) / 0.3);
    dot(pS.x, pS.y, 11 * S, aS); label('Suez Canal', pS.x + 22 * S, pS.y - 2 * S, { size: 34, align: 'left', alpha: aS });
    // the vessel makes the trip on "the shortest sea route"
    const vt = (t - T.shortest + 0.1) / 3.1;
    if (vt > 0 && vt < 1.15) {
      const s = rs.len * easeInOut(Math.min(1, vt)), p = along(rs, s), p2 = along(rs, s + 30);
      const a = proj(...p), b = proj(...p2);
      ctx.save(); ctx.globalAlpha = smooth(vt / 0.08) * (1 - smooth((vt - 1.0) / 0.15)); vessel(a.x, a.y, Math.atan2(b.y - a.y, b.x - a.x), 64 * S); ctx.restore();
    }
    // Asia / Europe call-outs
    const aAs = smooth((t - T.asia + 0.05) / 0.3), aEu = smooth((t - T.europe + 0.05) / 0.3);
    const asP = proj(13.4, 55.2), euP = proj(29.05, 27.2);
    label('ASIA  →', asP.x, asP.y, { size: 46, weight: 800, alpha: aAs, spacing: 4, color: '#ffd84a' });
    label('↑  EUROPE', euP.x, euP.y, { size: 46, weight: 800, alpha: aEu, spacing: 4, color: '#ffd84a' });
  }
  // subtle vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.38)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  label('Elevation: Copernicus DEM, AWS Terrain Tiles · Coastlines: Natural Earth', W - 18 * S, H - 16 * S, { size: 13, weight: 500, align: 'right', alpha: 0.55, shadow: false });
}

window.renderAt = t => { render(t); return true; };
init();
