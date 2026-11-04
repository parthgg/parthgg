
// ================= 15 s teaser compositor — 120 BPM, one beat = 0.5 s =================
const FPS = 25;
const easeInExpo = x => { x = clamp01(x); return x <= 0 ? 0 : Math.pow(2, 10 * x - 10); };
const easeIO = x => { x = clamp01(x); return x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2; };
const rand = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const fr = t => Math.floor(t * FPS + 0.5), pad = n => String(n).padStart(5, '0');

// ---------- image cache ----------
const CACHE = new Map();
function img(src) {
  if (!CACHE.has(src)) {
    CACHE.set(src, new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('load ' + src)); i.src = src; }));
    if (CACHE.size > 60) CACHE.delete(CACHE.keys().next().value);
  }
  return CACHE.get(src);
}
const tzFrame = (dir, t) => img(`tz/${dir}/f_${pad(fr(t))}.png`);
const glFrame = (clip, g) => img(`clips/${clip}/f_${pad(fr(g))}.png`);
const diveFrame = t => t < 1.2 ? tzFrame('DW', Math.max(0.3, t)) : t < 2.0 ? tzFrame('DW2', t) : tzFrame('DH', Math.min(3.04, t));

// ---------- canvases ----------
const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const OFF = mk(), OX = OFF.getContext('2d'), TMP = mk(), TX = TMP.getContext('2d'), CH = [mk(), mk(), mk()];
function drawCover(c, im, { s = 1, dx = 0, dy = 0, a = 1, cx = W / 2, cy = H / 2 } = {}) {
  const sc = Math.max(W / im.width, H / im.height) * s, w = im.width * sc, h = im.height * sc;
  c.save(); c.globalAlpha = a; c.drawImage(im, cx - w / 2 + dx, cy - h / 2 + dy, w, h); c.restore();
}
// chromatic aberration on the whole frame
function rgbSplit(px) {
  if (px < 0.5) return;
  TX.clearRect(0, 0, W, H); TX.drawImage(cv, 0, 0);
  const cols = ['#ff0000', '#00ff00', '#0000ff'], offs = [-px, 0, px];
  CH.forEach((c, i) => { const x = c.getContext('2d'); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, W, H); x.drawImage(TMP, 0, 0);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = cols[i]; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over'; });
  ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter';
  CH.forEach((c, i) => ctx.drawImage(c, offs[i], offs[i] * 0.3)); ctx.restore();
}
const hitK = (t, at, d = 0.18) => (t >= at && t < at + d) ? 1 - (t - at) / d : 0;
const HITS = [3.0, 5.0, 7.5, 8.5, 11.0, 12.5];
function flare(a, x = W * 0.5, y = H * 0.5, col = '255,180,58') {
  if (a <= 0) return; const g = ctx.createRadialGradient(x, y, 0, x, y, W * 0.7);
  g.addColorStop(0, `rgba(${col},${0.55 * a})`); g.addColorStop(0.4, `rgba(${col},${0.15 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
}
function sliceText(str, x, y, size, t, t0, { color = '#fff', slices = 5, align = 'center', font = FD, weight = 800, spacing = 0 } = {}) {
  // text built from horizontal slices that slide in from alternating sides
  const w = tw(str, size, weight, font, spacing), h = size * S, x0 = align === 'center' ? x - w / 2 : x, top = y - h * 0.8;
  for (let i = 0; i < slices; i++) {
    const k = easeExpo((t - t0 - i * 0.035) / 0.45); if (k <= 0) continue;
    const off = (1 - k) * (i % 2 ? 1 : -1) * W * 0.35, ys = top + (h * 0.85 / slices) * i - 2;
    ctx.save(); ctx.beginPath(); ctx.rect(x0 - 40, ys, w + 80, h * 0.85 / slices + 2.5); ctx.clip();
    txt(str, x + off, y, { size, color, align, font, weight, spacing, shadow: 0.5 }); ctx.restore();
  }
}
function outlineText(str, x, y, size, a, { color = '#fff', lw = 2 } = {}) {
  ctx.save(); ctx.globalAlpha = a; ctx.font = `800 ${size * S}px ${FD}`; ctx.textAlign = 'center'; ctx.lineWidth = lw * S; ctx.strokeStyle = color; ctx.strokeText(str, x, y); ctx.restore();
}

// ---------- intro: hairline → band reveal → text-mask zoom-through into the dive ----------
const TITLE = 'THREE STRAITS', TSIZE = 250;
let ZPT = null;
function findZoomPoint() {
  OX.clearRect(0, 0, W, H); OX.font = `800 ${TSIZE * S}px ${FD}`; OX.textAlign = 'center'; OX.fillStyle = '#fff'; OX.fillText(TITLE, W / 2, H / 2 + TSIZE * 0.35 * S);
  const d = OX.getImageData(0, 0, W, H).data, on = (x, y) => d[(Math.round(y) * W + Math.round(x)) * 4 + 3] > 200;
  let best = null, bd = 1e9; const r = 16;
  for (let y = H * 0.3; y < H * 0.7; y += 3) for (let x = W * 0.3; x < W * 0.7; x += 3) {
    if (!on(x, y)) continue;
    if (![[-r, -r], [r, -r], [-r, r], [r, r], [0, -r], [0, r], [-r, 0], [r, 0]].every(([a, b]) => on(x + a, y + b))) continue;
    const dd = Math.hypot(x - W / 2, y - H / 2); if (dd < bd) { bd = dd; best = [x, y]; }
  }
  ZPT = best || [W / 2, H / 2];
}
async function intro(t) {
  ctx.fillStyle = '#030609'; ctx.fillRect(0, 0, W, H);
  const ty = H / 2 + TSIZE * 0.35 * S;
  if (t < 1.0) {
    const kl = easeExpo(t / 0.4), band = easeExpo((t - 0.22) / 0.45) * TSIZE * 1.05 * S, lw = W * kl;
    ctx.save(); ctx.beginPath(); ctx.rect(0, H / 2 - band / 2, W, band); ctx.clip();
    const sc = 1 + 0.04 * clamp01(t / 1.0); ctx.translate(W / 2, H / 2); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2);
    txt(TITLE, W / 2, ty, { size: TSIZE, align: 'center', weight: 800, spacing: 30 * (1 - easeExpo((t - 0.25) / 0.6)), shadow: 0 });
    ctx.restore();
    ctx.fillStyle = AMBER; for (const sgn of [-1, 1]) ctx.fillRect(W / 2 - lw / 2, H / 2 + sgn * band / 2 - 1.5 * S, lw, 3 * S);
    txt('A FILM ABOUT THE SEA ROUTES THAT CARRY THE WORLD', W / 2, H / 2 + band / 2 + 60 * S, { font: FM, size: 18, weight: 500, align: 'center', spacing: 6, color: '#cfd8e0', alpha: smooth((t - 0.55) / 0.2), shadow: 0 });
    return;
  }
  // zoom-through: the dive plays inside the letters, which scale past the camera
  const u = clamp01((t - 1.0) / 0.42), s = Math.exp(easeInExpo(u) * Math.log(90)) * (1 + 0.04);
  const dive = await diveFrame(t);
  OX.clearRect(0, 0, W, H); OX.save(); OX.translate(ZPT[0], ZPT[1]); OX.scale(s, s); OX.translate(-ZPT[0], -ZPT[1]);
  OX.font = `800 ${TSIZE * S}px ${FD}`; OX.textAlign = 'center'; OX.fillStyle = '#fff'; OX.fillText(TITLE, W / 2, ty); OX.restore();
  OX.globalCompositeOperation = 'source-in'; drawCover(OX, dive, { s: 1.0 + 0.15 * (1 - u) }); OX.globalCompositeOperation = 'source-over';
  ctx.drawImage(OFF, 0, 0);
  if (u >= 1) { drawCover(ctx, dive); }
}

// ---------- 3.0 tanker + 20,000,000 ----------
async function tanker(t) {
  const im = await img(`tfoot/tank/${String(Math.min(45, fr(t - 3.0) + 1)).padStart(3, '0')}.jpg`);
  drawCover(ctx, im, { s: 1.06 + 0.06 * clamp01((t - 3.0) / 1.6) });
  ctx.fillStyle = 'rgba(3,7,12,0.45)'; ctx.fillRect(0, 0, W, H); vignette(0.7);
  odo('20,000,000', W / 2, H * 0.5, 250, (t - 3.02) / 0.9, { align: 'center', color: '#fff', shadow: 0.6 });
  const words = [['BARRELS', 3.5], ['OF OIL.', 3.75], ['EVERY', 4.0], ['DAY.', 4.25]];
  let x = W / 2 - (tw('BARRELS OF OIL. EVERY DAY.', 64, 800, FD, 6)) / 2;
  for (const [w, at] of words) { maskText(w, x, H * 0.5 + 110 * S, 64, t, at - 0.04, 99, { color: w === 'DAY.' ? AMBER : '#fff', spacing: 6 }); x += tw(w + ' ', 64, 800, FD, 6); }
  txt('THROUGH ONE 39 KM GAP · U.S. EIA, 2024', W / 2, H * 0.5 + 170 * S, { font: FM, size: 18, weight: 500, align: 'center', spacing: 5, alpha: smooth((t - 4.25) / 0.2), color: '#cfd8e0' });
}

// ---------- 4.6 bar curtain → 5.0 triptych → 6.5 middle panel expands ----------
const PANELS = [['H', '01 · HORMUZ', '39 KM', 5.25], ['B', '02 · BAB EL-MANDEB', '26 KM', 5.5], ['M', '03 · MALACCA', '2.7 KM', 5.75]];
async function triptych(t) {
  ctx.fillStyle = '#030609'; ctx.fillRect(0, 0, W, H);
  const gap = 6 * S, pw = (W - 2 * gap) / 3, kE = easeIO((t - 6.5) / 0.5);
  const ims = await Promise.all(PANELS.map(p => tzFrame(p[0], Math.min(p[0] === 'B' ? 8.48 : 6.98, t))));
  PANELS.forEach(([dir, lbl, num, at], i) => {
    let x = i * (pw + gap), w = pw;
    if (i === 1) { x = x * (1 - kE); w = pw + (W - pw) * kE; } else x += (i === 0 ? -1 : 1) * kE * (pw + gap) * 1.2;
    const top = 0;
    ctx.save(); ctx.beginPath(); ctx.rect(x, top, w, H - top); ctx.clip();
    drawCover(ctx, ims[i], { cx: x + w / 2, s: 1.0 + 0.04 * clamp01((t - 5) / 2) });
    const g = ctx.createLinearGradient(0, H, 0, H * 0.55); g.addColorStop(0, `rgba(3,7,12,${0.75 * (1 - kE * (i === 1))})`); g.addColorStop(1, 'rgba(3,7,12,0)'); ctx.fillStyle = g; ctx.fillRect(x, 0, w, H);
    const aL = 1 - smooth((t - 6.45) / 0.15);
    if (aL > 0) {
      ctx.globalAlpha = aL;
      txt(lbl, x + 40 * S, 80 * S, { font: FM, size: 18, weight: 500, spacing: 4, color: AMBER, alpha: smooth((t - 5.1 - i * 0.06) / 0.2) });
      maskText(num, x + 36 * S, H - 110 * S, 150, t, at - 0.04, 6.4, { color: '#fff' });
      txt('AT ITS NARROWEST', x + 40 * S, H - 66 * S, { font: FM, size: 16, weight: 500, spacing: 4, color: '#dfe6ec', alpha: smooth((t - at - 0.2) / 0.2) });
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  });
}
function curtain(t) {
  // three bars rise to cover the frame, then keep rising to reveal the triptych beneath
  const gap = 6 * S, pw = (W - 2 * gap) / 3, cols = [AMBER, '#f3eee4', AMBER];
  for (let i = 0; i < 3; i++) {
    const a = easeIO((t - 4.55 - i * 0.05) / 0.4), b = easeIO((t - 4.97 - i * 0.06) / 0.42);
    const yT = H * (1 - a), yB = H * (1 - b);
    if (yB - yT > 0.5) { ctx.fillStyle = cols[i]; ctx.fillRect(i * (pw + gap), yT, pw, yB - yT); }
  }
}

// ---------- 7.0 collapse: line chart over the Red Sea ----------
async function collapse(t) {
  drawCover(ctx, await tzFrame('B', Math.min(8.48, t)));
  ctx.fillStyle = `rgba(3,7,12,${0.5 * smooth((t - 7.0) / 0.3)})`; ctx.fillRect(0, 0, W, H); vignette(0.6);
  const x0 = 150 * S, x1 = W * 0.6, y87 = H * 0.36, y40 = H * 0.36 + (8.7 - 4.0) * 46 * S, xm = x0 + (x1 - x0) * 0.42, xd = x0 + (x1 - x0) * 0.58;
  maskText('RED SEA OIL FLOW', x0, H * 0.2, 64, t, 7.02, 99, {});
  txt('MILLION BARRELS A DAY · BAB EL-MANDEB', x0 + 2 * S, H * 0.2 + 40 * S, { font: FM, size: 17, weight: 500, spacing: 4, color: '#cfd8e0', alpha: smooth((t - 7.15) / 0.2) });
  // axis
  ctx.save(); ctx.globalAlpha = 0.4 * smooth((t - 7.0) / 0.2); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1 * S; ctx.setLineDash([2 * S, 6 * S]);
  for (const y of [y87, y40]) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); } ctx.restore();
  const k = clamp01((t - 7.05) / 0.75), pts = [[x0, y87], [xm, y87], [xd, y40], [x1, y40]], segs = [0.4, 0.13, 0.47];
  // progress along the polyline (time-warped so the drop lands on the 7.5 beat)
  const kk = t < 7.37 ? 0.4 * clamp01((t - 7.05) / 0.32) : t < 7.5 ? 0.4 + 0.13 * easeInExpo((t - 7.37) / 0.13) : 0.53 + 0.47 * easeExpo((t - 7.5) / 0.5);
  if (t > 7.05) {
    const path = []; let acc = 0;
    for (let i = 0; i < 3; i++) { const [a, b] = [pts[i], pts[i + 1]]; if (kk <= acc) break; const f = Math.min(1, (kk - acc) / segs[i]); path.push(a, [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); acc += segs[i]; }
    const red = t >= 7.5, col = red ? '255,74,61' : '255,255,255';
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.globalCompositeOperation = 'lighter';
    for (const [lw, a] of [[18 * S, 0.12], [7 * S, 0.3], [3.5 * S, 1]]) { ctx.strokeStyle = `rgba(${col},${a})`; ctx.lineWidth = lw; ctx.beginPath(); path.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke(); }
    const e = path[path.length - 1]; ctx.fillStyle = `rgb(${col})`; ctx.beginPath(); ctx.arc(e[0], e[1], 7 * S, 0, 7); ctx.fill(); ctx.restore();
  }
  txt('8.7M', x0, y87 - 22 * S, { font: FM, size: 22, weight: 500, spacing: 2, alpha: smooth((t - 7.1) / 0.2) });
  txt('2023', x0, y40 + 120 * S, { font: FM, size: 16, weight: 500, spacing: 3, alpha: 0.6 * smooth((t - 7.1) / 0.2) });
  txt('2024', x1, y40 + 120 * S, { font: FM, size: 16, weight: 500, spacing: 3, alpha: 0.6 * smooth((t - 7.6) / 0.2), align: 'right' });
  txt('4.0M', x1, y40 - 22 * S, { font: FM, size: 22, weight: 500, spacing: 2, color: '#ff8a80', alpha: smooth((t - 7.75) / 0.2), align: 'right' });
  if (t >= 7.5) {
    const k2 = easeExpo((t - 7.5) / 0.3); ctx.save(); ctx.translate(W * 0.8, H * 0.55); ctx.scale(1.5 - 0.5 * k2, 1.5 - 0.5 * k2); ctx.globalAlpha = smooth((t - 7.5) / 0.06);
    txt('−54%', 0, 0, { size: 300, weight: 800, align: 'center', color: RED, shadow: 0.6 }); ctx.restore();
    txt('AFTER ATTACKS ON SHIPPING', W * 0.8, H * 0.55 + 70 * S, { font: FM, size: 18, weight: 500, spacing: 4, align: 'center', alpha: smooth((t - 7.75) / 0.2) });
  }
}

// ---------- 8.5 detour (doc W2 frames, 1.5x) ----------
async function detour(t) {
  const g = 53.9 + (t - 8.5) * 1.5;
  drawCover(ctx, await glFrame('W2', g), { s: 1.12 - 0.08 * clamp01((t - 8.5) / 1.5) });
  sideShade(1, 'left', 0.55, 0.5);
  maskLines([['THE LONG WAY', 110, '#fff', 8.6], ['ROUND', 110, AMBER, 8.75]], 110 * S, H * 0.12, t, 99, { lead: 0.95 });
  odo('+15 DAYS', 114 * S, H * 0.12 + 330 * S, 96, (t - 9.15) / 0.7, { color: '#fff', align: 'left' });
  txt('VIA THE CAPE OF GOOD HOPE', 116 * S, H * 0.12 + 372 * S, { font: FM, size: 17, weight: 500, spacing: 4, color: '#cfd8e0', alpha: smooth((t - 9.4) / 0.2) });
}
// line wipe from collapse → detour
async function lineWipe(t, t0, d, drawA, drawB) {
  const k = easeIO((t - t0) / d), x = -W * 0.3 + k * W * 1.6, slope = 0.45 * W;
  await drawA(t);
  ctx.save(); ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(x + slope / 2, -10); ctx.lineTo(x - slope / 2, H + 10); ctx.lineTo(-10, H + 10); ctx.closePath(); ctx.clip();
  await drawB(t); ctx.restore();
  ctx.save(); ctx.strokeStyle = AMBER; ctx.lineWidth = 6 * S; ctx.shadowColor = AMBER; ctx.shadowBlur = 30 * S; ctx.beginPath(); ctx.moveTo(x + slope / 2, -10); ctx.lineTo(x - slope / 2, H + 10); ctx.stroke(); ctx.restore();
}

// ---------- 10.0 arcs → 11.0 blocked (doc W3 frames) ----------
async function finale(t) {
  if (t < 11.0) {
    const g = 80.3 + (t - 10.0) * 1.8, k = easeExpo((t - 10.0) / 0.35);
    const im = await glFrame('W3', g);
    ctx.save(); if (k < 1) ctx.filter = `blur(${(1 - k) * 10}px)`; drawCover(ctx, im, { s: 1.3 - 0.25 * k - 0.0 }); ctx.restore();
    txt('GULF  →  ASIA  ·  EUROPE', W / 2, H - 70 * S, { font: FM, size: 20, weight: 500, spacing: 6, align: 'center', alpha: smooth((t - 10.2) / 0.2) });
  } else {
    const g = 84.54 + (t - 11.0) * 1.0;
    drawCover(ctx, await glFrame('W3', g), { s: 1.05 + 0.08 * clamp01(t - 11.0) });
    ctx.fillStyle = `rgba(40,0,0,${0.25 * smooth((t - 11.35) / 0.3)})`; ctx.fillRect(0, 0, W, H);
    sideShade(1, 'top', 0.6, 0.45);
    maskText('BLOCK ANY ONE', W / 2, H * 0.2, 120, t, 11.02, 99, { align: 'center' });
    maskText('OF THEM', W / 2, H * 0.2 + 100 * S, 70, t, 11.3, 99, { align: 'center', color: RED });
  }
}

// ---------- 12.0 strobe montage ----------
const STROBE = [['tfoot/flash/0_1.jpg', 'tfoot/flash/0_2.jpg', 'TRADE'], ['assets/ph/hormuz14.jpg', null, 'OIL'], ['tfoot/flash/1_1.jpg', 'tfoot/flash/1_2.jpg', 'SEA'],
  ['assets/ph/suez06.jpg', null, 'RISK'], ['tfoot/flash/3_1.jpg', 'tfoot/flash/3_2.jpg', 'POWER'], ['assets/ph/mal1236.jpg', null, 'WORLD']];
async function strobe(t) {
  const n = fr(t) - fr(12.0), i = Math.min(5, Math.floor(n / 2)), sub = n % 2, [a, b, w] = STROBE[i];
  const im = await img(sub && b ? b : a);
  ctx.save(); ctx.filter = i % 2 ? 'grayscale(1) contrast(1.4)' : 'contrast(1.15) saturate(0.9)'; drawCover(ctx, im, { s: 1.15 + 0.1 * sub }); ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H);
  if (i % 2) outlineText(w, W / 2, H / 2 + 120 * S, 340, 1, { color: AMBER, lw: 3 }); else txt(w, W / 2, H / 2 + 120 * S, { size: 340, weight: 800, align: 'center', color: '#fff', shadow: 0.4 });
}

// ---------- 12.5 end card ----------
const NET = Array.from({ length: 260 }, (_, i) => ({ y: rand(i) * 1.2 - 0.1, ph: rand(i + 99), sp: 0.05 + rand(i + 7) * 0.12, amp: 0.02 + rand(i + 3) * 0.06, am: rand(i + 5) < 0.3 }));
function endCard(t) {
  ctx.fillStyle = '#04080d'; ctx.fillRect(0, 0, W, H);
  const a0 = smooth((t - 12.5) / 0.3);
  // dot grid
  ctx.save(); ctx.globalAlpha = 0.18 * a0; ctx.fillStyle = '#9fb3c4';
  for (let y = 30; y < H; y += 36 * S) for (let x = 30 + ((y / (36 * S)) % 2) * 18 * S; x < W; x += 36 * S) { ctx.beginPath(); ctx.arc(x, y, 1.2 * S, 0, 7); ctx.fill(); }
  ctx.restore();
  // flowing traffic streaks
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (const p of NET) {
    const u = (p.ph + t * p.sp) % 1, x = u * W * 1.2 - W * 0.1, y = (p.y + p.amp * Math.sin(u * 6.28 + p.ph * 6)) * H;
    const u2 = u - 0.012, x2 = u2 * W * 1.2 - W * 0.1, y2 = (p.y + p.amp * Math.sin(u2 * 6.28 + p.ph * 6)) * H;
    ctx.strokeStyle = p.am ? `rgba(255,180,58,${0.55 * a0})` : `rgba(150,228,245,${0.35 * a0})`; ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x, y); ctx.stroke();
  }
  ctx.restore();
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.5); g.addColorStop(0, 'rgba(4,8,13,0.85)'); g.addColorStop(1, 'rgba(4,8,13,0.2)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // three straits as a route glyph
  const cy = H * 0.38, xs = [W / 2 - 220 * S, W / 2, W / 2 + 220 * S], kl = easeIO((t - 12.55) / 0.9);
  ctx.save(); ctx.strokeStyle = AMBER; ctx.lineWidth = 2.5 * S; ctx.beginPath(); ctx.moveTo(xs[0] - 160 * S, cy);
  ctx.lineTo(xs[0] - 160 * S + (xs[2] + 160 * S - (xs[0] - 160 * S)) * kl, cy); ctx.stroke(); ctx.restore();
  xs.forEach((x, i) => {
    const k = easeExpo((t - 12.6 - i * 0.25) / 0.4); if (k <= 0) return;
    ctx.save(); ctx.fillStyle = '#04080d'; ctx.strokeStyle = AMBER; ctx.lineWidth = 2.5 * S; ctx.beginPath(); ctx.arc(x, cy, 14 * S * k, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, cy, 5 * S * k, 0, 7); ctx.fill(); ctx.restore();
    txt(['HORMUZ', 'BAB EL-MANDEB', 'MALACCA'][i], x, cy + 46 * S, { font: FM, size: 15, weight: 500, spacing: 4, align: 'center', alpha: smooth((t - 12.75 - i * 0.25) / 0.2), color: '#cfd8e0' });
  });
  // title: letters assemble from blur + tracking
  const title = 'THREE STRAITS', size = 190, sp = 6, tw0 = tw(title, size, 800, FD, sp);
  let x = W / 2 - tw0 / 2;
  [...title].forEach((ch, i) => {
    const k = easeExpo((t - 12.85 - i * 0.03) / 0.6), cw = tw(ch, size, 800, FD, sp);
    if (k > 0) { ctx.save(); ctx.filter = `blur(${(1 - k) * 14}px)`; txt(ch, x + (1 - k) * (i - 6) * 40 * S, H * 0.62 + (1 - k) * 30 * S, { size, weight: 800, spacing: sp, alpha: k, shadow: 0 }); ctx.restore(); }
    x += cw;
  });
  maskText('THAT MOVE THE WORLD', W / 2, H * 0.62 + 92 * S, 66, t, 13.35, 99, { align: 'center', color: AMBER, spacing: 10 });
  txt('A DOCUMENTARY IN 90 SECONDS  ·  WATCH THE FULL FILM', W / 2, H * 0.62 + 170 * S, { font: FM, size: 19, weight: 500, spacing: 6, align: 'center', alpha: smooth((t - 13.9) / 0.3), color: '#e8edf2', shadow: 0 });
  txt('MAPS: COPERNICUS DEM · NATURAL EARTH   PHOTOS: NASA   FOOTAGE: MIXKIT', W / 2, H - 40 * S, { font: FM, size: 12, weight: 500, spacing: 3, align: 'center', alpha: 0.5 * smooth((t - 14.0) / 0.3), color: '#cfd8e0', shadow: 0 });
}

// ---------- master timeline ----------
async function frame(t) {
  if (t < 3.0) await intro(t);
  else if (t < 5.0) await tanker(t);
  else if (t < 7.0) await triptych(t);
  else if (t < 8.42) await collapse(t);
  else if (t < 8.75) await lineWipe(t, 8.42, 0.33, collapse, detour);
  else if (t < 10.0) await detour(t);
  else if (t < 12.0) await finale(t);
  else if (t < 12.5) await strobe(t);
  else endCard(t);
  if (t > 4.5 && t < 5.6) curtain(t);
  // global finishing: shake, chromatic hits, flares, letterbox frame lines
  let hk = 0; for (const h of HITS) hk = Math.max(hk, hitK(t, h, h === 7.5 ? 0.3 : 0.2));
  if (hk > 0) {
    const big = (t >= 7.5 && t < 7.8) ? 2 : 1;
    TX.clearRect(0, 0, W, H); TX.drawImage(cv, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const n = fr(t), sx = (rand(n) - 0.5) * 30 * S * hk * big, sy = (rand(n + 3) - 0.5) * 22 * S * hk * big;
    ctx.save(); ctx.translate(W / 2 + sx, H / 2 + sy); ctx.scale(1 + 0.02 * hk, 1 + 0.02 * hk); ctx.drawImage(TMP, -W / 2, -H / 2); ctx.restore();
    rgbSplit(14 * S * hk * big);
    flare(hk * 0.8, W / 2, H / 2, t >= 7.5 && t < 7.8 ? '255,74,61' : '255,180,58');
  }
  if (t >= 11.0 && t < 11.08) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(0, 0, W, H); }
  const fo = smooth((t - 14.7) / 0.3); if (fo > 0) { ctx.fillStyle = `rgba(0,0,0,${fo})`; ctx.fillRect(0, 0, W, H); }
}

(async () => {
  await loadFonts();
  findZoomPoint();
  window.__ready = true;
})();
window.renderAt = async function (t) { ctx.clearRect(0, 0, W, H); await frame(t); return true; };
