// Reel layer: captions, hook, illustrated inserts. Drawn on a transparent canvas and composited over the map render.
const q = new URLSearchParams(location.search);
const W = +(q.get('w') || 1080), H = +(q.get('h') || 1920), S = W / 1080;
const cv = document.getElementById('c');
cv.width = W; cv.height = H; cv.style.width = W + 'px'; cv.style.height = H + 'px';
const ctx = cv.getContext('2d');

const YELLOW = '#ffd23f', RED = '#ff3b30', INK = 'rgba(6,10,18,0.78)';
const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp01(x), 3);
const easeBack = x => { x = clamp01(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const win = (t, a, b, fi = 0.25, fo = 0.25) => Math.min(smooth((t - a) / fi), 1 - smooth((t - (b - fo)) / fo));

// ---------- captions ----------
// [word count, display text]. *word* = yellow, [word] = red pill
const CHUNKS = [
  [[3, 'THIS NARROW CHANNEL'], [3, 'MAY BE THE'], [2, '*MOST IMPORTANT*'], [3, 'STRETCH OF WATER'], [2, 'ON *EARTH*']],
  [[4, 'THE *STRAIT OF HORMUZ*'], [2, 'ONLY ABOUT'], [3, '[39 KM] WIDE'], [4, 'AT ITS *NARROWEST* POINT']],
  [[2, '*EVERY TANKER*'], [4, 'LEAVING THE *PERSIAN GULF*'], [3, 'HAS TO *SQUEEZE*'], [2, 'THROUGH HERE'], [2, 'WITH *IRAN*'], [3, 'ON ONE SIDE'], [2, 'AND *OMAN*'], [3, 'ON THE OTHER']],
  [[2, 'SHIPS FOLLOW'], [2, '*TWO LANES*'], [3, 'EACH ONLY ABOUT'], [3, '[2 MILES] WIDE'], [3, 'ONE WAY *IN*'], [3, 'ONE WAY *OUT*']],
  [[4, 'AND THROUGH THEM FLOWS'], [3, 'ROUGHLY [ONE FIFTH]'], [4, 'OF ALL THE *OIL*'], [3, 'THE WORLD USES'], [1, 'ABOUT'], [3, '[20 MILLION] BARRELS'], [3, '*EVERY SINGLE DAY*']],
];
let caps = [];
function buildCaptions(words) {
  for (let li = 0; li < CHUNKS.length; li++) {
    const lw = words.filter(w => w.line === li); let k = 0;
    for (const [n, txt] of CHUNKS[li]) {
      const ws = lw.slice(k, k + n); k += n;
      caps.push({ s: ws[0].s, e: ws[ws.length - 1].e, line: li, segs: parse(txt) });
    }
    if (k !== lw.length) console.log('chunk word mismatch on line', li, k, lw.length);
  }
  // each chunk lives until the next starts (or a short hold after the line ends)
  for (let i = 0; i < caps.length; i++) {
    const nx = caps[i + 1];
    caps[i].end = nx && nx.line === caps[i].line ? nx.s : caps[i].e + 0.35;
  }
}
function parse(txt) {
  const out = []; const re = /\*([^*]+)\*|\[([^\]]+)\]|([^*[]+)/g; let m;
  while ((m = re.exec(txt))) {
    if (m[1]) out.push({ t: m[1], k: 'y' }); else if (m[2]) out.push({ t: m[2], k: 'p' });
    else for (const w of m[3].trim().split(/\s+/)) if (w) out.push({ t: w, k: 'w' });
  }
  return out;
}
const CAP_Y = 0.655;
function drawCaption(t) {
  const c = caps.find(c => t >= c.s - 0.04 && t < c.end);
  if (!c) return;
  const age = t - (c.s - 0.04);
  const sc = 0.78 + 0.22 * easeBack(age / 0.22);
  const size = 78 * S, gap = 22 * S;
  ctx.save();
  ctx.font = `900 ${size}px Inter`; ctx.textBaseline = 'middle';
  ctx.letterSpacing = `${-1 * S}px`;
  const widths = c.segs.map(sg => ctx.measureText(sg.t).width + (sg.k === 'p' ? 36 * S : 0));
  // wrap to two lines if needed
  const maxW = 860 * S; let rows = [[]], rw = [0];
  c.segs.forEach((sg, i) => {
    const w = widths[i], r = rows.length - 1;
    if (rw[r] > 0 && rw[r] + gap + w > maxW) { rows.push([]); rw.push(0); }
    const rr = rows.length - 1; rows[rr].push(i); rw[rr] += (rw[rr] > 0 ? gap : 0) + w;
  });
  const lh = size * 1.12, y0 = H * CAP_Y - (rows.length - 1) * lh / 2;
  ctx.translate(W / 2, H * CAP_Y); ctx.scale(sc, sc); ctx.translate(-W / 2, -H * CAP_Y);
  ctx.globalAlpha = smooth(age / 0.08);
  rows.forEach((row, r) => {
    let x = W / 2 - rw[r] / 2; const y = y0 + r * lh;
    for (const i of row) {
      const sg = c.segs[i], w = widths[i];
      if (sg.k === 'p') {
        ctx.save(); ctx.fillStyle = RED; ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 18 * S; ctx.shadowOffsetY = 6 * S;
        ctx.beginPath(); ctx.roundRect(x, y - size * 0.62, w, size * 1.2, 16 * S); ctx.fill(); ctx.restore();
        ctx.fillStyle = '#fff'; ctx.fillText(sg.t, x + 18 * S, y + 2 * S);
      } else {
        ctx.lineJoin = 'round'; ctx.lineWidth = 13 * S; ctx.strokeStyle = 'rgba(0,0,0,0.92)';
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 14 * S; ctx.shadowOffsetY = 5 * S;
        ctx.strokeText(sg.t, x, y + 2 * S); ctx.shadowColor = 'transparent';
        ctx.fillStyle = sg.k === 'y' ? YELLOW : '#fff'; ctx.fillText(sg.t, x, y + 2 * S);
      }
      x += w + gap;
    }
  });
  ctx.restore();
}

// ---------- shared text helper ----------
function label(str, x, y, size, { color = '#fff', weight = 900, align = 'center', stroke = true, alpha = 1, spacing = 0 } = {}) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.font = `${weight} ${size * S}px Inter`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.letterSpacing = `${spacing * S}px`;
  if (stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.16 * S; ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 12 * S; ctx.strokeText(str, x, y); ctx.shadowColor = 'transparent'; }
  ctx.fillStyle = color; ctx.fillText(str, x, y); ctx.restore();
}
function card(x, y, w, h, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = INK; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 30 * S; ctx.shadowOffsetY = 10 * S;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 28 * S); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2 * S; ctx.stroke(); ctx.restore();
}

// ---------- illustrations ----------
// oil barrel, origin at centre, width w
function barrel(x, y, w, { fill = 1, dim = false, alpha = 1, rot = 0 } = {}) {
  const h = w * 1.38, rx = w / 2, ry = w * 0.16;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = alpha;
  const body = ctx.createLinearGradient(-rx, 0, rx, 0);
  if (dim) { body.addColorStop(0, '#2a3340'); body.addColorStop(0.35, '#566273'); body.addColorStop(1, '#1d242e'); }
  else { body.addColorStop(0, '#7a0f0b'); body.addColorStop(0.3, '#e0352b'); body.addColorStop(0.55, '#ff6a55'); body.addColorStop(1, '#5c0906'); }
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 16 * S; ctx.shadowOffsetY = 8 * S;
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.moveTo(-rx, -h / 2); ctx.lineTo(-rx, h / 2); ctx.ellipse(0, h / 2, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(rx, -h / 2);
  ctx.ellipse(0, -h / 2, rx, ry, 0, 0, Math.PI, false); ctx.fill(); ctx.shadowColor = 'transparent';
  // ribs
  ctx.strokeStyle = dim ? 'rgba(0,0,0,0.35)' : 'rgba(70,5,3,0.55)'; ctx.lineWidth = w * 0.045;
  for (const f of [-0.2, 0.2]) { ctx.beginPath(); ctx.ellipse(0, h * f, rx, ry, 0, 0, Math.PI); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = w * 0.02;
  for (const f of [-0.2, 0.2]) { ctx.beginPath(); ctx.ellipse(0, h * f - w * 0.03, rx * 0.98, ry, 0, 0.15, Math.PI - 0.15); ctx.stroke(); }
  // lid
  const lid = ctx.createLinearGradient(-rx, -h / 2, rx, -h / 2);
  lid.addColorStop(0, dim ? '#3b4654' : '#a3221a'); lid.addColorStop(1, dim ? '#6d7a8b' : '#ff7f6a');
  ctx.fillStyle = lid; ctx.beginPath(); ctx.ellipse(0, -h / 2, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = w * 0.03; ctx.beginPath(); ctx.ellipse(0, -h / 2, rx * 0.86, ry * 0.8, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(rx * 0.45, -h / 2, w * 0.07, w * 0.03, 0, 0, Math.PI * 2); ctx.fill();
  // oil drop logo
  if (!dim) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; const d = w * 0.13;
    ctx.beginPath(); ctx.moveTo(0, -d * 1.5); ctx.bezierCurveTo(d * 0.9, -d * 0.3, d, d * 0.2, 0, d); ctx.bezierCurveTo(-d, d * 0.2, -d * 0.9, -d * 0.3, 0, -d * 1.5); ctx.fill();
  }
  // fill level: grey barrels show nothing; red ones optionally fill from bottom
  ctx.restore();
}

// side-view crude tanker, origin at waterline centre, length L
function tanker(x, y, L, t) {
  const hH = L * 0.11;
  ctx.save(); ctx.translate(x, y + Math.sin(t * 2.2) * 3 * S); ctx.rotate(Math.sin(t * 1.7) * 0.012);
  // hull
  ctx.fillStyle = '#1e2733';
  ctx.beginPath(); ctx.moveTo(-L / 2, -hH); ctx.lineTo(L * 0.44, -hH); ctx.quadraticCurveTo(L * 0.52, -hH * 0.95, L / 2, -hH * 0.2);
  ctx.lineTo(L * 0.47, hH * 0.55); ctx.lineTo(-L * 0.46, hH * 0.55); ctx.quadraticCurveTo(-L / 2, hH * 0.3, -L / 2, -hH); ctx.fill();
  // red antifouling below the waterline
  ctx.fillStyle = '#c7322a';
  ctx.beginPath(); ctx.moveTo(-L * 0.485, hH * 0.1); ctx.lineTo(L * 0.488, hH * 0.1); ctx.lineTo(L * 0.47, hH * 0.55); ctx.lineTo(-L * 0.46, hH * 0.55); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(-L * 0.485, hH * 0.04, L * 0.97, hH * 0.07);
  // deck piping and manifold
  ctx.strokeStyle = '#7d8a99'; ctx.lineWidth = L * 0.006;
  ctx.beginPath(); ctx.moveTo(-L * 0.3, -hH * 1.12); ctx.lineTo(L * 0.42, -hH * 1.12); ctx.stroke();
  for (let i = 0; i < 9; i++) { const px = -L * 0.26 + i * L * 0.08; ctx.beginPath(); ctx.moveTo(px, -hH); ctx.lineTo(px, -hH * 1.12); ctx.stroke(); }
  ctx.fillStyle = '#c7322a'; ctx.fillRect(L * 0.02, -hH * 1.35, L * 0.03, hH * 0.35);
  // superstructure at the stern
  ctx.fillStyle = '#f2f4f7'; ctx.fillRect(-L * 0.47, -hH * 3.0, L * 0.13, hH * 2.0);
  ctx.fillRect(-L * 0.49, -hH * 3.0, L * 0.17, hH * 0.18);
  ctx.fillStyle = '#28323f';
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) ctx.fillRect(-L * 0.455 + c * L * 0.028, -hH * 2.65 + r * hH * 0.55, L * 0.018, hH * 0.22);
  // funnel
  ctx.fillStyle = '#28323f'; ctx.fillRect(-L * 0.45, -hH * 3.9, L * 0.05, hH * 0.9);
  ctx.fillStyle = RED; ctx.fillRect(-L * 0.45, -hH * 3.6, L * 0.05, hH * 0.25);
  // bow wave + wake
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(L * 0.47, hH * 0.15, L * 0.06, hH * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createLinearGradient(-L * 0.9, 0, -L * 0.46, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.5)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-L * 0.46, hH * 0.0); ctx.lineTo(-L * 0.9, hH * 0.35); ctx.lineTo(-L * 0.46, hH * 0.5); ctx.fill();
  ctx.restore();
}

// ---------- inserts ----------
function hook(t) {
  const a = win(t, 0.25, 5.7, 0.3, 0.45);
  if (a <= 0) return;
  const y = H * 0.105, k = easeBack((t - 0.25) / 0.35);
  ctx.save(); ctx.translate(W / 2, y); ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k); ctx.translate(-W / 2, -y);
  label('1 IN 5 BARRELS OF OIL', W / 2, y, 70, { color: YELLOW, alpha: a, spacing: -1 });
  label('PASS THROUGH THIS STRAIT ↓', W / 2, y + 74 * S, 40, { alpha: a * smooth((t - 0.6) / 0.3), weight: 800 });
  ctx.restore();
}

function tankerInsert(t) {
  const a = win(t, 12.25, 15.9, 0.25, 0.35);
  if (a <= 0) return;
  const slide = easeOut((t - 12.25) / 0.6), out = smooth((t - 15.55) / 0.35);
  const cx = W * 0.5 + (1 - slide) * -W * 0.8 + out * W * 0.9, cy = H * 0.5, w = 640 * S, h = 330 * S;
  card(cx - w / 2, cy - h / 2, w, h, a);
  ctx.save(); ctx.globalAlpha = a;
  ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 28 * S); ctx.clip();
  const sea = ctx.createLinearGradient(0, cy + 10 * S, 0, cy + h / 2); sea.addColorStop(0, '#17405f'); sea.addColorStop(1, '#0b2236');
  ctx.fillStyle = sea; ctx.fillRect(cx - w / 2, cy + 74 * S, w, h);
  tanker(cx + 30 * S, cy + 80 * S, 400 * S, t);
  ctx.restore();
  label('CRUDE OIL TANKER', cx, cy - h / 2 + 34 * S, 30, { alpha: a, weight: 800, spacing: 3 });
  label('up to 2,000,000 barrels each', cx, cy + h / 2 - 26 * S, 24, { alpha: a * 0.9, weight: 600, stroke: false, color: '#cfd8e3' });
}

function fifthInsert(t) {
  const a = win(t, 28.25, 31.25, 0.25, 0.3);
  if (a <= 0) return;
  const cy = H * 0.5, w = 820 * S, h = 270 * S;
  card(W / 2 - w / 2, cy - h / 2, w, h, a);
  for (let i = 0; i < 5; i++) {
    const appear = easeBack((t - 28.3 - i * 0.07) / 0.3);
    const hot = i === 0 && t > 28.75;
    const x = W / 2 + (i - 2) * 140 * S, y = cy - 6 * S + (1 - appear) * 40 * S;
    barrel(x, y, 92 * S * (hot ? 1 + 0.08 * easeBack((t - 28.75) / 0.3) : 1), { dim: !hot, alpha: a * clamp01(appear * 1.5) });
  }
  label('1 OUT OF EVERY 5', W / 2, cy + h / 2 - 32 * S, 30, { alpha: a * smooth((t - 28.8) / 0.25), color: YELLOW, weight: 900, spacing: 2 });
}

function stackInsert(t) {
  const a = win(t, 31.25, 34.75, 0.2, 0.35);
  if (a <= 0) return;
  const cy = H * 0.49, w = 680 * S, h = 430 * S;
  card(W / 2 - w / 2, cy - h / 2, w, h, a);
  // pyramid 4-3-2-1 = 10 barrels, each = 2M barrels
  const rows = [4, 3, 2, 1], bw = 66 * S, step = bw * 1.2, rowH = bw * 1.3;
  let n = 0;
  rows.forEach((cnt, r) => {
    for (let i = 0; i < cnt; i++, n++) {
      const tt = (t - 31.28 - n * 0.09) / 0.25; if (tt <= 0) continue;
      const x = W / 2 + (i - (cnt - 1) / 2) * step, y = cy + 92 * S - r * rowH - (1 - easeBack(tt)) * 70 * S;
      barrel(x, y, bw, { alpha: a * clamp01(tt * 2) });
    }
  });
  label('EACH = 2 MILLION BARRELS', W / 2, cy + h / 2 - 30 * S, 24, { alpha: a * smooth((t - 32.4) / 0.3), weight: 800, spacing: 2, color: '#cfd8e3', stroke: false });
}

function cta(t) {
  const a = win(t, 38.9, 41.6, 0.25, 0.2);
  if (a <= 0) return;
  const k = easeBack((t - 38.9) / 0.35), y = H * 0.655;
  ctx.save(); ctx.translate(W / 2, y); ctx.scale(0.7 + 0.3 * k, 0.7 + 0.3 * k); ctx.translate(-W / 2, -y); ctx.globalAlpha = a;
  ctx.fillStyle = RED; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20 * S; ctx.shadowOffsetY = 6 * S;
  ctx.beginPath(); ctx.roundRect(W / 2 - 330 * S, y - 52 * S, 660 * S, 104 * S, 52 * S); ctx.fill(); ctx.restore();
  label('FOLLOW FOR MORE MAPS', W / 2, y + 2 * S, 46, { alpha: a * smooth((t - 38.95) / 0.2), stroke: false, weight: 900 });
}

let ready = false;
(async () => {
  const words = await (await fetch('assets/words.json')).json();
  buildCaptions(words);
  await document.fonts.load(`900 40px Inter`); await document.fonts.load(`800 40px Inter`); await document.fonts.load(`600 40px Inter`);
  window.__ready = true;
})();

window.renderAt = function (t) {
  ctx.clearRect(0, 0, W, H);
  hook(t); tankerInsert(t); fifthInsert(t); stackInsert(t);
  drawCaption(t); cta(t);
  return true;
};
