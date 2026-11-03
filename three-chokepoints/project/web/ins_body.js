
// ================= 2D inserts v2: paper chapter openers, archive collage, overlays for footage/photos =================
const INK = '#1f1d1a', IRED = '#c8382e', TEAL = '#4f9d90', YELLOW = '#f2c230';
let IMG = {}, VO = null;
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const word = (w, n = 0) => VO.words.filter(x => x.w.replace(/\(\d\)$/, '') === w)[n].s;

// marker-pen highlight that wipes in behind a word
function highlight(x, y, w, size, t, t0, color = YELLOW) {
  const k = easeExpo((t - t0) / 0.45); if (k <= 0) return;
  ctx.save(); ctx.fillStyle = color; ctx.globalAlpha = 0.95; ctx.fillRect(x - 10 * S, y - size * S * 0.78, (w + 20 * S) * k, size * S * 0.95); ctx.restore();
}
function tag(str, x, y, tx, ty, t, t0, { size = 26 } = {}) {
  const k = easeExpo((t - t0) / 0.5); if (k <= 0) return;
  ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5 * S; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (tx - x) * k, y + (ty - y) * k); ctx.stroke();
  if (k > 0.95) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(tx, ty, 5 * S, 0, 7); ctx.fill(); }
  ctx.restore();
  const w = tw(str, size, 600, FS) + 28 * S, h = size * 1.6 * S, kw = easeExpo((t - t0) / 0.35);
  ctx.save(); ctx.fillStyle = YELLOW; ctx.fillRect(x - w / 2, y - h / 2, w * kw, h); ctx.beginPath(); ctx.rect(x - w / 2, y - h / 2, w * kw, h); ctx.clip();
  txt(str, x, y + size * 0.36 * S, { font: FS, size, weight: 600, align: 'center', color: INK, shadow: 0 }); ctx.restore();
}
function placeImg(img, cx, cy, w, rot, t, t0, { from = [0, 120], shadow = 0.35, alpha = 1 } = {}) {
  const k = easeExpo((t - t0) / 0.7); if (k <= 0) return;
  const h = w * img.height / img.width, dx = from[0] * (1 - k) * S, dy = from[1] * (1 - k) * S;
  ctx.save(); ctx.globalAlpha = alpha * smooth((t - t0) / 0.2); ctx.translate(cx + dx, cy + dy); ctx.rotate(rot * Math.PI / 180);
  ctx.shadowColor = `rgba(0,0,0,${shadow})`; ctx.shadowBlur = 24 * S; ctx.shadowOffsetX = 6 * S; ctx.shadowOffsetY = 12 * S;
  ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
  return h;
}
function tape(cx, cy, w, rot, a = 1) {
  const img = IMG.tape, h = w * img.height / img.width;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.rotate(rot * Math.PI / 180); ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
}
function paper(img, t, t0, push = 0.05) {
  const k = clamp01((t - t0) / 4), s = 1 + push * k;
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.drawImage(img, -W / 2, -H / 2, W, H); ctx.restore();
}
function disc(cx, cy, r, color, t, t0) {
  const k = easeExpo((t - t0) / 0.7); if (k <= 0) return;
  ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, r * k, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
const cap = (str, x, y, a, color = 'rgba(31,29,26,0.7)') => txt(str, x, y, { font: FM, size: 14, weight: 500, color, alpha: a, spacing: 1, shadow: 0 });

// ---------- chapter openers ----------
function chapter(t, o) {
  const t0 = o.t0, x = 110 * S, ink = { color: INK, shadow: 0 };
  paper(IMG.cream, t, t0);
  disc(W * 0.68, H * 0.5, 330 * S, o.color, t, t0 + 0.05);
  placeImg(IMG[o.img2], W * 0.86, H * 0.74, 400 * S, o.rot2, t, t0 + 0.35, { from: [160, 60] });
  placeImg(IMG[o.img1], W * 0.66, H * 0.45, 640 * S, o.rot1, t, t0 + 0.15, { from: [0, 160] });
  const kr = easeExpo((t - t0 - 0.1) / 0.6);
  ctx.save(); ctx.fillStyle = o.accent; ctx.fillRect(x, H * 0.2, 80 * S * kr, 6 * S); ctx.restore();
  txt(`CHAPTER ${o.num}`, x + 96 * S, H * 0.2 + 8 * S, { font: FM, size: 20, weight: 500, color: INK, alpha: smooth((t - t0 - 0.3) / 0.3), spacing: 5, shadow: 0 });
  o.lines(t, x, ink);
  if (o.tag) tag(o.tag[0], o.tag[1] * W, o.tag[2] * H, o.tag[3] * W, o.tag[4] * H, t, o.tag[5]);
  cap(o.cap, W - 110 * S - tw(o.cap, 14, 500, FM, 1), H - 46 * S, smooth((t - t0 - 0.6) / 0.4));
}
const CH = {
  CH1: () => ({
    t0: 15.0, num: '01', color: TEAL, accent: TEAL, img1: 'cut_hormuz', rot1: -4, img2: 'cut_hormuz2', rot2: 7,
    cap: 'STRAIT OF HORMUZ FROM SPACE SHUTTLE COLUMBIA, 1982 · IRANIAN COAST FROM THE ISS, 2014 · NASA',
    tag: ['Iran  ⟷  Oman', 0.52, 0.17, 0.62, 0.3, 16.4],
    lines: (t, x, ink) => {
      maskText('STRAIT OF', x - 4 * S, H * 0.42, 150, t, word('strait') - 0.1, 99, ink);
      maskText('HORMUZ', x - 4 * S, H * 0.42 + 140 * S, 150, t, word('hormuz') - 0.1, 99, { ...ink, color: IRED });
      maskText('The only way out of the Persian Gulf', x, H * 0.42 + 210 * S, 30, t, 16.5, 99, { ...ink, font: FS, weight: 500 });
    },
  }),
  CH2: () => ({
    t0: 35.4, num: '02', color: IRED, accent: IRED, img1: 'cut_ship', rot1: 3, img2: 'cut_suez', rot2: -6,
    cap: 'CONTAINER SHIP, 1979 (CC0) · SUEZ CANAL FROM THE ISS, 2006 (NASA)',
    tag: ['Arabic for "Gate of Tears"', 0.2, 0.8, 0.2, 0.76, 38.25],
    lines: (t, x, ink) => {
      const tOut = 37.75;
      maskText('SAIL WEST', x - 4 * S, H * 0.42, 130, t, word('sail') - 0.1, tOut, ink);
      if (t < tOut + 0.4) { const w = tw('the next bottleneck', 54, 700, FD); highlight(x, H * 0.42 + 90 * S, w, 54, t, word('next') - 0.1); maskText('the next bottleneck', x, H * 0.42 + 90 * S, 54, t, word('next') - 0.12, tOut, { ...ink, weight: 700 }); }
      maskText('BAB', x - 4 * S, H * 0.42, 150, t, word('bab') - 0.12, 99, ink);
      maskText('EL-MANDEB', x - 4 * S, H * 0.42 + 140 * S, 150, t, word('mandeb') - 0.12, 99, { ...ink, color: IRED });
    },
  }),
  CH3: () => ({
    t0: 58.4, num: '03', color: YELLOW, accent: '#b8860b', img1: 'cut_sing', rot1: -3, img2: 'cut_mal', rot2: 6,
    cap: 'SUMATRA AND SINGAPORE FROM SPACE SHUTTLE ATLANTIS, 1991 · SHIP WAKES IN THE MALACCA STRAIT FROM THE ISS, 2014 · NASA',
    tag: ['Ship wakes', 0.92, 0.47, 0.86, 0.62, 60.6],
    lines: (t, x, ink) => {
      const tOut = 61.45;
      maskText('SAIL EAST', x - 4 * S, H * 0.42, 130, t, word('sail', 1) - 0.1, tOut, ink);
      if (t < tOut + 0.4) { const w = tw('the busiest of them all', 54, 700, FD); highlight(x, H * 0.42 + 90 * S, w, 54, t, word('busiest', 1) - 0.1); maskText('the busiest of them all', x, H * 0.42 + 90 * S, 54, t, word('busiest', 1) - 0.12, tOut, { ...ink, weight: 700 }); }
      maskText('STRAIT OF', x - 4 * S, H * 0.42, 150, t, word('strait', 1) - 0.12, 99, ink);
      maskText('MALACCA', x - 4 * S, H * 0.42 + 140 * S, 150, t, word('malacca') - 0.12, 99, { ...ink, color: '#b8860b' });
    },
  }),
};

// ---------- archive collage: the Red Sea attacks ----------
function attacks(t) {
  const t0 = 47.05;
  paper(IMG.dark, t, t0, 0.05);
  ctx.save(); ctx.globalAlpha = 0.07; ctx.strokeStyle = '#d9c9a0'; ctx.lineWidth = 1;
  for (let i = 0; i < 24; i++) { ctx.beginPath(); ctx.moveTo(0, H * 0.1 + i * 38 * S); ctx.lineTo(W, H * 0.1 + i * 38 * S + 30 * S); ctx.stroke(); }
  ctx.restore();
  maskText('THE RED SEA', 110 * S, H * 0.17, 64, t, t0, 99, { font: 'Cinzel', weight: 700, color: '#d8b25a', spacing: 4 });
  maskText('Shipping under attack, 2023–2024', 112 * S, H * 0.17 + 48 * S, 28, t, t0 + 0.15, 99, { font: FS, weight: 500, color: 'rgba(240,228,200,0.88)' });
  const h = placeImg(IMG.vin_suez, W * 0.27, H * 0.6, 560 * S, -4, t, t0 + 0.1, { from: [-80, 40], shadow: 0.6 });
  if (h) { tape(W * 0.27 - 200 * S, H * 0.6 - h / 2 + 4 * S, 150 * S, -32, smooth((t - t0 - 0.4) / 0.2)); tape(W * 0.27 + 210 * S, H * 0.6 - h / 2 + 12 * S, 150 * S, 24, smooth((t - t0 - 0.45) / 0.2)); }
  cap('SUEZ CANAL FROM THE ISS, 2006 · NASA', W * 0.27 - 250 * S, H * 0.6 + 262 * S, smooth((t - t0 - 0.6) / 0.3), 'rgba(240,228,200,0.6)');
  const cards = [
    ['NOV 2023', 'Houthi forces seize the cargo ship Galaxy Leader in the Red Sea.', t0 + 0.3],
    ['2023 – 2024', 'Missile and drone attacks on merchant ships near Bab el-Mandeb.', t0 + 1.15],
    ['MAR 2024', 'The bulk carrier Rubymar, hit in February, sinks.', t0 + 2.0],
  ];
  cards.forEach(([d, body, ts], i) => {
    const k = easeExpo((t - ts) / 0.6); if (k <= 0) return;
    const cx = W * 0.6 + i * 30 * S, cy = H * 0.34 + i * 205 * S, w = 620 * S, hh = 160 * S, rot = [-2, 1.5, -1][i] * Math.PI / 180;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    ctx.beginPath(); ctx.rect(-20 * S, -20 * S, w + 60 * S, hh + 60 * S); ctx.clip();       // mask: card rises into place
    ctx.translate(0, (1 - k) * (hh + 40 * S));
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18 * S; ctx.shadowOffsetY = 8 * S;
    ctx.fillStyle = '#ece2c8'; ctx.fillRect(0, 0, w, hh); ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(120,90,40,0.08)'; for (let j = 0; j < 5; j++) ctx.fillRect(0, 40 * S + j * 26 * S, w, 1 * S);
    ctx.font = `700 ${30 * S}px "Courier 10 Pitch", FreeMono, monospace`; ctx.fillStyle = '#9c2a20'; ctx.fillText(d, 26 * S, 50 * S);
    ctx.font = `500 ${25 * S}px "Courier 10 Pitch", FreeMono, monospace`; ctx.fillStyle = '#2a241c';
    const nChars = Math.floor(Math.max(0, (t - ts - 0.25) / 0.012)); let shown = 0;
    const words = body.split(' '); let line = '', yy = 92 * S; const lines = [];
    for (const wd of words) { const test = line ? line + ' ' + wd : wd; if (ctx.measureText(test).width > w - 52 * S) { lines.push(line); line = wd; } else line = test; }
    lines.push(line);
    for (const ln of lines) { const n = Math.max(0, Math.min(ln.length, nChars - shown)); ctx.fillText(ln.slice(0, n), 26 * S, yy); shown += ln.length; yy += 32 * S; }
    ctx.restore();
    tape(cx + 40 * S, cy - 4 * S, 120 * S, -18 + i * 9, smooth((t - ts - 0.35) / 0.2));
  });
  const r = Math.sin(t * 37.1) * 0.5 + 0.5;
  ctx.save(); ctx.fillStyle = `rgba(255,240,210,${0.025 * r})`; ctx.fillRect(0, 0, W, H);
  let s = Math.floor(t * 25) * 9301 + 49297; const rnd = () => (s = (s * 233280 + 49297) % 2147483647) / 2147483647;
  ctx.fillStyle = 'rgba(240,230,200,0.5)'; for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, rnd() * 1.6 * S + 0.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// ---------- OV: overlays on footage, D2 slams and NASA photo shots (global timeline) ----------
function photo(img, t, t0, t1, { z0 = 1.04, z1 = 1.16, dx = -0.02, dy = 0.01, fx = 0.5, fy = 0.5 } = {}) {
  const u = clamp01((t - t0) / (t1 - t0)), z = z0 + (z1 - z0) * u;
  const sc = Math.max(W / img.width, H / img.height) * z, w = img.width * sc, h = img.height * sc;
  const x = W / 2 - w * fx + dx * u * W, y = H / 2 - h * fy + dy * u * H;
  ctx.save(); ctx.filter = 'contrast(1.12) saturate(1.05) brightness(0.96)'; ctx.drawImage(img, x, y, w, h); ctx.restore();
  vignette(0.55);
}
function slamBg(t, t0, a = 0.62) { ctx.fillStyle = `rgba(3,7,12,${a * smooth((t - t0) / 0.15)})`; ctx.fillRect(0, 0, W, H); vignette(0.6); }
function slamScale(t, t0, fn) {
  const k = easeExpo((t - t0) / 0.35), sc = 1.12 - 0.12 * k + 0.03 * clamp01((t - t0) / 3);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2); ctx.globalAlpha = smooth((t - t0) / 0.12); fn(); ctx.restore();
}
const FOOT = 'FOOTAGE: MIXKIT (FREE LICENSE)';
function overlay(t) {
  const x = 110 * S;
  // cold open
  if (t < 5.65) {
    sideShade(1, 'left', 0.62, 0.62);
    if (t < 1.9) maskLines([['ALMOST', 130, '#fff', word('almost') - 0.1], ['EVERYTHING', 130, '#fff', word('everything') - 0.1], ['YOU BUY', 130, AMBER, word('buy') - 0.15]], x, H * 0.18, t, 1.75, { lead: 0.95 });
    else if (t < 3.7) maskLines([['AND MOST OF', 120, '#fff', 1.95], ['THE OIL', 170, AMBER, word('oil') - 0.1], ['THAT POWERS IT', 64, '#fff', word('powers') - 0.15]], x, H * 0.2, t, 3.55, { lead: 0.95 });
    else maskLines([['TRAVELS', 170, '#fff', word('travels') - 0.1], ['BY SEA', 170, SEA, word('sea') - 0.1]], x, H * 0.25, t, 5.45, { lead: 0.95 });
    credit(FOOT);
  }
  // photo montage: "a handful of narrow gaps"
  else if (t >= 9.4 && t < 11.05) {
    const ph = t < 9.95 ? ['hormuz14', 9.4, 'STRAIT OF HORMUZ · ISS, 2014'] : t < 10.5 ? ['suez06', 9.95, 'SUEZ CANAL · ISS, 2006'] : ['mal1236', 10.5, 'MALACCA STRAIT · ISS, 2014'];
    photo(IMG[ph[0]], t, ph[1], ph[1] + 0.6, { z0: 1.08, z1: 1.2, dx: 0.03 });
    maskText('A HANDFUL OF', W / 2, H * 0.47, 80, t, 9.42, 99, { align: 'center' });
    maskText('NARROW GAPS', W / 2, H * 0.47 + 150 * S, 170, t, word('narrow') - 0.05, 99, { align: 'center', color: AMBER });
    txt(ph[2], 110 * S, H - 60 * S, { font: FM, size: 18, weight: 500, spacing: 3, color: '#e8edf2' });
    credit('PHOTOS: NASA EARTH OBSERVATORY / JSC (PUBLIC DOMAIN)');
  }
  // tanker → 20,000,000 slam
  else if (t >= 22.1 && t < 24.0) {
    sideShade(1, 'bottom', 0.6, 0.45);
    maskText('IN 2024', x, H - 150 * S, 110, t, 22.27, 99, {});
    credit(FOOT);
  } else if (t >= 24.0 && t < 27.4) {
    slamBg(t, 24.0);
    slamScale(t, 24.0, () => {
      odo('20,000,000', W / 2, H * 0.53, 230, (t - 24.0) / 1.3, { align: 'center', color: '#fff', shadow: 0.6 });
      maskText('BARRELS OF OIL A DAY THROUGH HORMUZ', W / 2, H * 0.53 + 90 * S, 34, t, 24.35, 99, { align: 'center', font: FS, weight: 600, color: AMBER, spacing: 4 });
    });
    txt('SOURCE: U.S. EIA · 2024', W / 2, H - 70 * S, { font: FM, size: 16, weight: 500, align: 'center', alpha: smooth((t - 24.6) / 0.4) * 0.7, spacing: 3 });
    credit(FOOT);
  }
  // "there is no other sea route"
  else if (t >= 30.5 && t < 32.8) {
    photo(IMG.hormuz82, t, 30.5, 32.8, { z0: 1.05, z1: 1.18, dx: 0.02, dy: -0.01 });
    sideShade(1, 'left', 0.55, 0.6);
    maskLines([['THERE IS', 96, '#fff', word('there', 0) - 0.1 > 30 ? word('there', 0) - 0.1 : 30.75], ['NO OTHER', 150, '#fff', word('no') - 0.1], ['SEA ROUTE', 150, AMBER, word('no') + 0.15]], x, H * 0.2, t, 99, { lead: 0.95 });
    txt('STRAIT OF HORMUZ FROM SPACE SHUTTLE COLUMBIA, 1982', x, H - 60 * S, { font: FM, size: 16, weight: 500, spacing: 2, color: '#e8edf2', alpha: 0.8 });
    credit('PHOTO: NASA JSC (PUBLIC DOMAIN)');
  }
  // Suez: shortest route Asia ⇄ Europe
  else if (t >= 44.1 && t < 47.15) {
    photo(IMG.suez06, t, 44.1, 47.15, { z0: 1.04, z1: 1.2, dx: -0.03, fy: 0.45 });
    sideShade(1, 'top', 0.6, 0.55);
    maskText('THE SHORTEST ROUTE', W / 2, H * 0.2, 96, t, 44.3, 99, { align: 'center' });
    maskText('ASIA', W / 2 - 60 * S, H * 0.2 + 150 * S, 150, t, word('asia') - 0.1, 99, { align: 'right', color: AMBER });
    maskText('⇄', W / 2, H * 0.2 + 135 * S, 90, t, word('asia') + 0.15, 99, { align: 'center', font: FS, weight: 500 });
    maskText('EUROPE', W / 2 + 60 * S, H * 0.2 + 150 * S, 150, t, word('europe') - 0.1, 99, { align: 'left', color: AMBER });
    txt('SUEZ CANAL, PORT SAID · ISS, 2006', x, H - 60 * S, { font: FM, size: 16, weight: 500, spacing: 2, color: '#e8edf2', alpha: 0.8 });
    credit('PHOTO: NASA JSC (PUBLIC DOMAIN)');
  }
  // −54% slam
  else if (t >= 50.2 && t < 52.9) {
    slamBg(t, 50.3, 0.66);
    const tH = word('half') - 0.2;
    slamScale(t, 50.3, () => {
      const v = 8.7 - 4.7 * easeInOut((t - 50.6) / 1.2);
      txt('OIL THROUGH BAB EL-MANDEB', W / 2, H * 0.27, { font: FM, size: 22, weight: 500, align: 'center', spacing: 5, color: '#dfe6ec', alpha: smooth((t - 50.4) / 0.3) });
      txt(`${v.toFixed(1)}M`, W / 2, H * 0.27 + 150 * S, { size: 140, weight: 800, align: 'center', color: t > 51.8 ? RED : '#fff', alpha: smooth((t - 50.4) / 0.2) });
      txt('BARRELS A DAY · 2023 → JAN–AUG 2024', W / 2, H * 0.27 + 200 * S, { font: FS, size: 24, weight: 600, align: 'center', spacing: 3, color: AMBER, alpha: smooth((t - 50.6) / 0.3) });
    });
    if (t > tH) {
      const k = easeExpo((t - tH) / 0.3);
      ctx.save(); ctx.translate(W / 2, H * 0.74); ctx.scale(1.25 - 0.25 * k, 1.25 - 0.25 * k); ctx.globalAlpha = smooth((t - tH) / 0.1);
      txt('−54%', 0, 0, { size: 230, weight: 800, align: 'center', color: RED, shadow: 0.6 }); ctx.restore();
    }
    txt('SOURCE: U.S. EIA (VORTEXA)', W / 2, H - 50 * S, { font: FM, size: 16, weight: 500, align: 'center', alpha: 0.65, spacing: 3 });
    credit(FOOT);
  }
  // 102,500+ ships over the container ship
  else if (t >= 66.7 && t < 69.65) {
    sideShade(1, 'left', 0.6, 0.6);
    const tc = word('hundred') - 0.3;
    odo('102,500+', x, H * 0.42, 190, (t - tc) / 1.3, { align: 'left', color: '#fff', shadow: 0.6 });
    maskText('SHIPS THROUGH MALACCA IN 2025', x + 4 * S, H * 0.42 + 64 * S, 30, t, tc + 0.3, 99, { font: FS, weight: 600, color: AMBER, spacing: 3 });
    txt('SOURCE: MARINE DEPARTMENT MALAYSIA', x + 4 * S, H * 0.42 + 110 * S, { font: FM, size: 15, weight: 500, alpha: smooth((t - tc - 0.6) / 0.3) * 0.7, spacing: 2 });
    credit(FOOT);
  } else if (t >= 69.6 && t < 71.15) {
    credit(FOOT);
  }
  // Malacca vs Hormuz slam
  else if (t >= 71.05 && t < 73.8) {
    slamBg(t, 71.1, 0.66);
    const tH = word('hormuz', 1) - 0.25;
    txt('OIL FLOW, BARRELS A DAY · H1 2025', W / 2, H * 0.24, { font: FM, size: 22, weight: 500, align: 'center', spacing: 5, color: '#dfe6ec', alpha: smooth((t - 71.2) / 0.3) });
    slamScale(t, 71.15, () => {
      odo('23.2M', W * 0.31, H * 0.56, 220, (t - 71.15) / 1.0, { align: 'center', color: AMBER, shadow: 0.6 });
      maskText('MALACCA', W * 0.31, H * 0.56 + 80 * S, 40, t, 71.4, 99, { align: 'center', font: FS, weight: 600, spacing: 6 });
    });
    if (t > tH) slamScale(t, tH, () => {
      odo('20.9M', W * 0.69, H * 0.56, 220, (t - tH) / 1.0, { align: 'center', color: '#fff', shadow: 0.6 });
      maskText('HORMUZ', W * 0.69, H * 0.56 + 80 * S, 40, t, tH + 0.2, 99, { align: 'center', font: FS, weight: 600, spacing: 6 });
    });
    ctx.save(); ctx.globalAlpha = smooth((t - tH) / 0.3) * 0.5; ctx.fillStyle = '#fff'; ctx.fillRect(W / 2 - 1 * S, H * 0.38, 2 * S, H * 0.3); ctx.restore();
    txt('SOURCE: U.S. EIA', W / 2, H - 50 * S, { font: FM, size: 16, weight: 500, align: 'center', alpha: 0.65, spacing: 3 });
    credit(FOOT);
  }
  // finale footage
  else if (t >= 82.0 && t < 84.55) {
    sideShade(1, 'bottom', 0.65, 0.5);
    if (t < 83.3) maskLines([['THE FACTORIES', 70, '#fff', 82.15], ['OF ASIA', 130, AMBER, word('asia', 1) - 0.1]], x, H * 0.58, t, 83.2, { lead: 0.95 });
    else maskLines([['THE MARKETS', 70, '#fff', 83.35], ['OF EUROPE', 130, AMBER, word('europe', 1) - 0.1]], x, H * 0.58, t, 99, { lead: 0.95 });
    credit(FOOT);
  }
}

(async () => {
  VO = await (await fetch('assets/vo.json')).json();
  await loadFonts();
  const f = new FontFace('Cinzel', 'url(assets/ins/Cinzel.ttf)', { weight: '400 900' }); await f.load(); document.fonts.add(f);
  await document.fonts.load('700 30px "Courier 10 Pitch"').catch(() => {});
  const names = { cream: 'ins/paper_cream.jpg', dark: 'ins/paper_dark.jpg', tape: 'ins/tape.png', cut_hormuz: 'ins/cut_hormuz.png', cut_hormuz2: 'ins/cut_hormuz2.png', cut_ship: 'ins/cut_ship.png',
    cut_suez: 'ins/cut_suez.png', cut_sing: 'ins/cut_sing.png', cut_mal: 'ins/cut_mal.png', vin_suez: 'ins/vin_suez.png',
    hormuz14: 'ph/hormuz14.jpg', hormuz82: 'ph/hormuz82.jpg', suez06: 'ph/suez06.jpg', mal1236: 'ph/mal1236.jpg' };
  for (const [k, v] of Object.entries(names)) IMG[k] = await loadImg('assets/' + v);
  window.__ready = true;
})();
window.renderAt = function (t) {
  ctx.clearRect(0, 0, W, H);
  if (CH[SHOT]) chapter(t, CH[SHOT]());
  else if (SHOT === 'ATT') attacks(t);
  else if (SHOT === 'OV') overlay(t);
  return true;
};
