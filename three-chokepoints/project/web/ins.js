// Inserts inspired by the references: Vox-style paper-collage chapter openers, kinetic type,
// yellow callout tags, and a vintage archive collage. 2D canvas, times on the voiceover timeline.
const q = new URLSearchParams(location.search);
const W = +(q.get('w') || 1920), H = +(q.get('h') || 1080), S = Math.min(W, H) / 1080;
const SHOT = q.get('shot') || 'CH1';
const cv = document.getElementById('c'); cv.width = W; cv.height = H;
const ctx = cv.getContext('2d');
const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp01(x), 3);
const easeBack = x => { x = clamp01(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const INK = '#1f1d1a', RED = '#c8382e', TEAL = '#4f9d90', YELLOW = '#f2c230', CREAM = '#efe6cf';

let IMG = {}, VO = null;
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const word = (w, n = 0) => VO.words.filter(x => x.w.replace(/\(\d\)$/, '') === w)[n].s;

function text(str, x, y, { size = 60, weight = 800, color = INK, align = 'left', alpha = 1, font = 'Inter', spacing = 0, rot = 0, scale = 1, shadow = null } = {}) {
  if (alpha <= 0.003) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(scale, scale); ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${size * S}px ${font}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = `${spacing * S}px`;
  if (shadow) { ctx.shadowColor = shadow; ctx.shadowBlur = 12 * S; ctx.shadowOffsetY = 3 * S; }
  ctx.fillStyle = color; ctx.fillText(str, 0, 0); ctx.restore();
}
const tw = (str, size, weight = 800, font = 'Inter') => { ctx.save(); ctx.font = `${weight} ${size * S}px ${font}`; const w = ctx.measureText(str).width; ctx.restore(); return w; };
// a word that pops in (scale overshoot) at time t0
function pop(str, x, y, t, t0, opt = {}) {
  const k = easeBack((t - t0) / 0.32), a = smooth((t - t0) / 0.12);
  text(str, x, y, { ...opt, alpha: a * (opt.alpha ?? 1), scale: 0.6 + 0.4 * k });
}
// highlighted word: coloured block behind the text
function boxed(str, x, y, t, t0, { size = 70, bg = YELLOW, fg = INK, padX = 16, alpha = 1 } = {}) {
  const k = easeOut((t - t0) / 0.25); if (k <= 0) return;
  const w = tw(str, size) + padX * 2 * S, h = size * 1.16 * S;
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = bg; ctx.fillRect(x, y - h * 0.82, w * k, h); ctx.restore();
  if (k > 0.5) text(str, x + padX * S, y, { size, color: fg, alpha: alpha * smooth((k - 0.5) / 0.3) });
  return w;
}
// yellow callout tag with leader line (Vox)
function tag(str, x, y, tx, ty, t, t0, { size = 28 } = {}) {
  const k = easeOut((t - t0) / 0.35); if (k <= 0) return;
  ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5 * S; ctx.lineCap = 'round';
  const mx = x + (tx - x) * k, my = y + (ty - y) * k;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(mx, my); ctx.stroke();
  ctx.fillStyle = INK; if (k > 0.95) { ctx.beginPath(); ctx.arc(tx, ty, 5 * S, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  const w = tw(str, size, 700) + 24 * S, h = size * 1.5 * S, a = smooth((t - t0) / 0.15);
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = YELLOW; ctx.fillRect(x - w / 2, y - h / 2, w, h); ctx.restore();
  text(str, x, y + size * 0.36 * S, { size, weight: 700, align: 'center', alpha: a });
}
// image with drop shadow, rotation, slide-in
function place(img, cx, cy, w, rot, t, t0, { from = [0, 120], shadow = 0.35, alpha = 1 } = {}) {
  const k = easeOut((t - t0) / 0.6); if (k <= 0) return;
  const h = w * img.height / img.width, dx = from[0] * (1 - k) * S, dy = from[1] * (1 - k) * S;
  ctx.save(); ctx.globalAlpha = alpha * smooth((t - t0) / 0.2); ctx.translate(cx + dx, cy + dy); ctx.rotate(rot * Math.PI / 180);
  ctx.shadowColor = `rgba(0,0,0,${shadow})`; ctx.shadowBlur = 22 * S; ctx.shadowOffsetX = 6 * S; ctx.shadowOffsetY = 10 * S;
  ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
  return h;
}
function tape(cx, cy, w, rot, a = 1) {
  const img = IMG.tape, h = w * img.height / img.width;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.rotate(rot * Math.PI / 180); ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
}
function paper(img, t, t0, push = 0.04) {
  const k = clamp01((t - t0) / 3), s = 1 + push * k;
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.drawImage(img, -W / 2, -H / 2, W, H); ctx.restore();
}
function circle(cx, cy, r, color, t, t0) {
  const k = easeBack((t - t0) / 0.5); if (k <= 0) return;
  ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, r * k, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function caption(str, x, y, a, color = 'rgba(31,29,26,0.7)') { text(str, x, y, { size: 17, weight: 600, color, alpha: a }); }

// ---------- chapter openers (Vox-style paper collage) ----------
function chapter(t, o) {
  const t0 = o.t0;
  paper(IMG.cream, t, t0);
  circle(W * 0.68, H * 0.5, 330 * S, o.color, t, t0 + 0.05);
  place(IMG[o.img2], W * 0.86, H * 0.74, 400 * S, o.rot2, t, t0 + 0.35, { from: [160, 60] });
  place(IMG[o.img1], W * 0.66, H * 0.45, 640 * S, o.rot1, t, t0 + 0.15, { from: [0, 160] });
  // chapter number + kinetic lines
  const x = 110 * S;
  pop(o.num, x, H * 0.26, t, t0 + 0.1, { size: 120, weight: 800, color: o.numColor || o.color });
  text('CHAPTER', x + tw(o.num, 120) + 22 * S, H * 0.26 - 70 * S, { size: 22, weight: 700, spacing: 5, alpha: smooth((t - t0 - 0.2) / 0.3) });
  o.lines(t, x);
  if (o.tag) tag(o.tag[0], o.tag[1] * W, o.tag[2] * H, o.tag[3] * W, o.tag[4] * H, t, o.tag[5]);
  caption(o.cap, W - 110 * S - tw(o.cap, 17, 600), H - 46 * S, smooth((t - t0 - 0.6) / 0.4));
}
const CH = {
  CH1: () => ({
    t0: 15.0, num: '01', color: TEAL, img1: 'cut_hormuz', rot1: -4, img2: 'cut_hormuz2', rot2: 7,
    cap: 'Strait of Hormuz from Space Shuttle Columbia, 1982 · Iranian coast from the ISS, 2014 · NASA',
    tag: ['Iran  ⟷  Oman', 0.52, 0.17, 0.62, 0.3, 16.4],
    lines: (t, x) => {
      pop('STRAIT', x, H * 0.47, t, word('strait') - 0.05, { size: 108 });
      pop('OF', x, H * 0.6, t, word('of', 3) - 0.05, { size: 108 });
      pop('HORMUZ', x + tw('OF ', 108), H * 0.6, t, word('hormuz') - 0.05, { size: 108, color: RED });
      text('The only way out of the Persian Gulf', x, H * 0.69, { size: 30, weight: 600, alpha: smooth((t - 16.6) / 0.4) });
    },
  }),
  CH2: () => ({
    t0: 35.4, num: '02', color: RED, img1: 'cut_ship', rot1: 3, img2: 'cut_suez', rot2: -6,
    cap: 'Container ship, 1979 (CC0) · Suez Canal from the ISS, 2006 (NASA)',
    tag: ['Arabic for "Gate of Tears"', 0.2, 0.74, 0.2, 0.7, 38.3],
    lines: (t, x) => {
      const a1 = 1 - smooth((t - 37.6) / 0.25);
      pop('SAIL', x, H * 0.47, t, word('sail') - 0.05, { size: 96, alpha: a1 });
      pop('WEST', x + tw('SAIL ', 96), H * 0.47, t, word('west') - 0.05, { size: 96, color: RED, alpha: a1 });
      if (t < 37.85) boxed('the next bottleneck', x, H * 0.6, t, word('next') - 0.05, { size: 52, alpha: a1 });
      pop('BAB', x, H * 0.5, t, word('bab') - 0.05, { size: 120 });
      pop('EL-MANDEB', x, H * 0.63, t, word('mandeb') - 0.08, { size: 120, color: RED });
    },
  }),
  CH3: () => ({
    t0: 58.4, num: '03', color: YELLOW, numColor: '#b8860b', img1: 'cut_sing', rot1: -3, img2: 'cut_mal', rot2: 6,
    cap: 'Sumatra and Singapore from Space Shuttle Atlantis, 1991 · ship wakes in the Malacca Strait from the ISS, 2014 · NASA',
    tag: ['Ship wakes', 0.92, 0.47, 0.86, 0.62, 60.6],
    lines: (t, x) => {
      const a1 = 1 - smooth((t - 61.35) / 0.25);
      pop('SAIL', x, H * 0.47, t, word('sail', 1) - 0.05, { size: 96, alpha: a1 });
      pop('EAST', x + tw('SAIL ', 96), H * 0.47, t, word('east') - 0.05, { size: 96, color: '#b8860b', alpha: a1 });
      if (t < 61.6) boxed('the busiest of them all', x, H * 0.6, t, word('busiest', 1) - 0.05, { size: 52, alpha: a1 });
      pop('STRAIT OF', x, H * 0.5, t, word('strait', 1) - 0.05, { size: 108 });
      pop('MALACCA', x, H * 0.63, t, word('malacca') - 0.08, { size: 120, color: '#b8860b' });
    },
  }),
};

// ---------- vintage archive collage: the Red Sea attacks ----------
function attacks(t) {
  const t0 = 46.95;
  paper(IMG.dark, t, t0, 0.05);
  // faint chart lines / handwriting feel: thin ruled lines
  ctx.save(); ctx.globalAlpha = 0.07; ctx.strokeStyle = '#d9c9a0'; ctx.lineWidth = 1;
  for (let i = 0; i < 24; i++) { ctx.beginPath(); ctx.moveTo(0, H * 0.1 + i * 38 * S); ctx.lineTo(W, H * 0.1 + i * 38 * S + 30 * S); ctx.stroke(); }
  ctx.restore();
  const aT = smooth((t - t0 - 0.05) / 0.4);
  text('THE RED SEA', 110 * S, H * 0.17, { size: 64, weight: 700, font: 'Cinzel', color: '#d8b25a', alpha: aT, spacing: 4, shadow: 'rgba(0,0,0,0.6)' });
  text('Shipping under attack, 2023–2024', 112 * S, H * 0.17 + 46 * S, { size: 28, weight: 500, color: 'rgba(240,228,200,0.85)', alpha: aT });
  // taped print
  const h = place(IMG.vin_suez, W * 0.27, H * 0.6, 560 * S, -4, t, t0 + 0.1, { from: [-80, 40], shadow: 0.6 });
  if (h) { tape(W * 0.27 - 200 * S, H * 0.6 - h / 2 + 4 * S, 150 * S, -32, smooth((t - t0 - 0.4) / 0.2)); tape(W * 0.27 + 210 * S, H * 0.6 - h / 2 + 12 * S, 150 * S, 24, smooth((t - t0 - 0.45) / 0.2)); }
  caption('Suez Canal from the ISS, 2006 · NASA', W * 0.27 - 250 * S, H * 0.6 + 262 * S, smooth((t - t0 - 0.6) / 0.3), 'rgba(240,228,200,0.6)');
  // dispatch cards (typewriter)
  const cards = [
    ['NOV 2023', 'Houthi forces seize the cargo ship Galaxy Leader in the Red Sea.', t0 + 0.35],
    ['2023 – 2024', 'Missile and drone attacks on merchant ships near Bab el-Mandeb.', t0 + 1.25],
    ['MAR 2024', 'The bulk carrier Rubymar, hit in February, sinks.', t0 + 2.15],
  ];
  cards.forEach(([d, body, ts], i) => {
    const k = easeOut((t - ts) / 0.45); if (k <= 0) return;
    const cx = W * 0.6 + i * 30 * S, cy = H * 0.34 + i * 205 * S, w = 620 * S, hh = 160 * S, rot = [-2, 1.5, -1][i] * Math.PI / 180;
    ctx.save(); ctx.globalAlpha = smooth((t - ts) / 0.15); ctx.translate(cx + (1 - k) * 120 * S, cy); ctx.rotate(rot);
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18 * S; ctx.shadowOffsetY = 8 * S;
    ctx.fillStyle = '#ece2c8'; ctx.fillRect(0, 0, w, hh); ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(120,90,40,0.08)'; for (let j = 0; j < 5; j++) ctx.fillRect(0, 40 * S + j * 26 * S, w, 1 * S);
    ctx.font = `700 ${30 * S}px "Courier 10 Pitch", FreeMono, monospace`; ctx.fillStyle = '#9c2a20'; ctx.fillText(d, 26 * S, 50 * S);
    ctx.font = `500 ${25 * S}px "Courier 10 Pitch", FreeMono, monospace`; ctx.fillStyle = '#2a241c';
    // wrap body
    const words = body.split(' '); let line = '', yy = 92 * S;
    for (const wd of words) { const test = line ? line + ' ' + wd : wd; if (ctx.measureText(test).width > w - 52 * S) { ctx.fillText(line, 26 * S, yy); line = wd; yy += 32 * S; } else line = test; }
    ctx.fillText(line, 26 * S, yy);
    ctx.restore();
    tape(cx + (1 - k) * 120 * S + 40 * S, cy - 4 * S, 120 * S, -18 + i * 9, smooth((t - ts - 0.2) / 0.2));
  });
  // dust + flicker
  const r = Math.sin(t * 37.1) * 0.5 + 0.5;
  ctx.save(); ctx.fillStyle = `rgba(255,240,210,${0.025 * r})`; ctx.fillRect(0, 0, W, H);
  let s = Math.floor(t * 25) * 9301 + 49297; const rnd = () => (s = (s * 233280 + 49297) % 2147483647) / 2147483647;
  ctx.fillStyle = 'rgba(240,230,200,0.5)'; for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, rnd() * 1.6 * S + 0.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// ---------- kinetic type over the cold-open footage ----------
function kinetic(t) {
  const fade = 1 - smooth((t - 5.3) / 0.35);
  if (fade <= 0) return;
  const g = ctx.createLinearGradient(0, 0, W * 0.62, 0); g.addColorStop(0, `rgba(10,14,20,${0.62 * fade})`); g.addColorStop(1, 'rgba(10,14,20,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const x = 110 * S, o = { size: 74, color: '#fff', alpha: fade, shadow: 'rgba(0,0,0,0.5)' };
  pop('Almost everything', x, H * 0.36, t, word('everything') - 0.1, o);
  pop('you buy,', x, H * 0.36 + 88 * S, t, word('buy') - 0.1, o);
  pop('and the', x, H * 0.36 + 200 * S, t, word('oil') - 0.35, { ...o, size: 54 });
  boxed('OIL', x + tw('and the ', 54), H * 0.36 + 200 * S, t, word('oil') - 0.05, { size: 54, alpha: fade });
  pop('travels by', x, H * 0.36 + 300 * S, t, word('travels') - 0.1, o);
  boxed('SEA', x + tw('travels by ', 74), H * 0.36 + 300 * S, t, word('sea') - 0.05, { size: 74, alpha: fade });
}

// ---------- callout tags over the container-ship footage ----------
function tags(t) {
  tag('Gantry crane', W * 0.53, H * 0.36, W * 0.415, H * 0.5, t, 67.6);
  tag('Container stacks', W * 0.74, H * 0.56, W * 0.67, H * 0.74, t, 68.4);
}

(async () => {
  VO = await (await fetch('assets/vo.json')).json();
  const f = new FontFace('Cinzel', 'url(assets/ins/Cinzel.ttf)', { weight: '400 900' }); await f.load(); document.fonts.add(f);
  for (const w of [500, 600, 700, 800]) await document.fonts.load(`${w} 40px Inter`);
  await document.fonts.load('700 30px "Courier 10 Pitch"').catch(() => {});
  const names = { cream: 'paper_cream.jpg', dark: 'paper_dark.jpg', tape: 'tape.png', cut_hormuz: 'cut_hormuz.png', cut_hormuz2: 'cut_hormuz2.png', cut_ship: 'cut_ship.png',
    cut_suez: 'cut_suez.png', cut_sing: 'cut_sing.png', cut_mal: 'cut_mal.png', vin_suez: 'vin_suez.png' };
  for (const [k, v] of Object.entries(names)) IMG[k] = await loadImg('assets/ins/' + v);
  window.__ready = true;
})();
window.renderAt = function (t) {
  ctx.clearRect(0, 0, W, H);
  if (CH[SHOT]) chapter(t, CH[SHOT]());
  else if (SHOT === 'ATT') attacks(t);
  else if (SHOT === 'KIN') kinetic(t);
  else if (SHOT === 'TAG') tags(t);
  return true;
};
