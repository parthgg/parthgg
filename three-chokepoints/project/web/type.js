
// ================= shared typography (cheat-sheet picks T1 / T4 / T5 / D1 / D2) =================
// expects ctx, W, H, S, clamp01, smooth, easeOut in scope
const AMBER = '#ffb43a', SEA = '#8fd8e8', RED = '#ff4a3d';
const FD = '"Barlow Condensed"', FS = '"IBM Plex Sans"', FM = '"IBM Plex Mono"';
const easeInOut = x => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeExpo = x => { x = clamp01(x); return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); };

async function loadFonts(base = 'assets/fonts/') {
  const list = [[FD, 'BarlowCondensed-ExtraBold.ttf', '800'], [FD, 'BarlowCondensed-Bold.ttf', '700'], [FD, 'BarlowCondensed-SemiBold.ttf', '600'],
    [FS, 'IBMPlexSans.ttf', '100 700'], [FM, 'IBMPlexMono-Medium.ttf', '500']];
  for (const [fam, file, wt] of list) { const f = new FontFace(fam.replace(/"/g, ''), `url(${base}${file})`, { weight: wt }); await f.load(); document.fonts.add(f); }
}
function txt(str, x, y, { font = FD, size = 40, weight = 700, color = '#fff', alpha = 1, align = 'left', spacing = 0, shadow = 0.55, base = 'alphabetic' } = {}) {
  if (alpha <= 0.003) return 0;
  ctx.save(); ctx.globalAlpha = alpha; ctx.font = `${weight} ${size * S}px ${font}`; ctx.textAlign = align; ctx.textBaseline = base; ctx.letterSpacing = `${spacing * S}px`;
  if (shadow) { ctx.shadowColor = `rgba(0,0,0,${shadow})`; ctx.shadowBlur = 16 * S; ctx.shadowOffsetY = 2 * S; }
  ctx.fillStyle = color; ctx.fillText(str, x, y); const w = ctx.measureText(str).width; ctx.restore(); return w;
}
function tw(str, size, weight = 700, font = FD, spacing = 0) {
  ctx.save(); ctx.font = `${weight} ${size * S}px ${font}`; ctx.letterSpacing = `${spacing * S}px`; const w = ctx.measureText(str).width; ctx.restore(); return w;
}
// T1: line rises out of a mask; leaves upward at tOut
function maskText(str, x, y, size, t, tIn, tOut = 1e9, o = {}) {
  const k = easeExpo((t - tIn) / 0.6), ko = easeInOut((t - tOut) / 0.4);
  if (k <= 0 || ko >= 1) return;
  const w = tw(str, size, o.weight || 800, o.font || FD, o.spacing || 0), h = size * S * 1.25;
  const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  ctx.save(); ctx.beginPath(); ctx.rect(x0 - 30 * S, y - size * S * 1.0, w + 60 * S, size * S * 1.3); ctx.clip();
  txt(str, x, y + (1 - k) * h - ko * h, { weight: 800, ...o, size });
  ctx.restore();
}
// several T1 lines with a stagger: lines = [[str, size, color, tIn]]
function maskLines(lines, x, y, t, tOut, o = {}) {
  let yy = y;
  for (const [s, size, color, tIn, extra] of lines) { yy += size * S * (o.lead || 1.0); maskText(s, x, yy, size, t, tIn, tOut, { ...o, color, ...(extra || {}) }); }
}
// T4: odometer, k = 0..1 progress
function odo(str, x, y, size, k, o = {}) {
  if (k <= 0) return;
  const font = o.font || FD, weight = o.weight || 800, total = tw(str, size, weight, font);
  let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
  const h = size * S * 1.05, nd = [...str].filter(c => /\d/.test(c)).length; let di = 0;
  for (const ch of str) {
    const cw = tw(ch, size, weight, font);
    if (/\d/.test(ch)) {
      const d = +ch, spins = 1 + ((nd - di) % 3), kk = easeOut(clamp01(k * 1.3 - (di / Math.max(1, nd)) * 0.3)), pos = (d + 10 * spins) * kk;
      const c0 = Math.floor(pos + 1e-6), f = pos - c0;
      ctx.save(); ctx.beginPath(); ctx.rect(cx - 6 * S, y - size * S * 0.95, cw + 12 * S, size * S * 1.2); ctx.clip();
      txt(String(c0 % 10), cx + cw / 2, y - f * h, { ...o, font, weight, size, align: 'center' });
      if (f > 0.001) txt(String((c0 + 1) % 10), cx + cw / 2, y + h - f * h, { ...o, font, weight, size, align: 'center' });
      ctx.restore(); di++;
    } else txt(ch, cx, y, { ...o, font, weight, size, align: 'left', alpha: (o.alpha ?? 1) * smooth(k * 4) });
    cx += cw;
  }
}
// T5: location lower-third
function lowerThird(eyebrow, name, coords, t, t0, t1) {
  const a = 1 - smooth((t - t1) / 0.4); if (t < t0 || a <= 0) return;
  const x = 110 * S, y = H - 120 * S;
  const g = ctx.createLinearGradient(0, H, 0, H - 380 * S); g.addColorStop(0, `rgba(3,7,12,${0.6 * a})`); g.addColorStop(1, 'rgba(3,7,12,0)');
  ctx.fillStyle = g; ctx.fillRect(0, H - 380 * S, W, 380 * S);
  const kr = easeExpo((t - t0) / 0.6);
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = AMBER; ctx.fillRect(x, y - 118 * S, 72 * S * kr, 4 * S); ctx.restore();
  txt(eyebrow, x + 88 * S, y - 109 * S, { font: FM, size: 19, weight: 500, color: AMBER, alpha: a * smooth((t - t0 - 0.25) / 0.3), spacing: 4 });
  maskText(name, x - 3 * S, y - 26 * S, 84, t, t0 + 0.12, t1, { weight: 800, spacing: 1 });
  const n = Math.floor(Math.max(0, (t - t0 - 0.55) / 0.028));
  txt(coords.slice(0, n), x, y + 22 * S, { font: FM, size: 22, weight: 500, color: '#dfe6ec', alpha: a, spacing: 1.5 });
}
// legibility gradient from the left / top (no boxes)
function sideShade(a, side = 'left', amt = 0.6, frac = 0.6) {
  if (a <= 0) return;
  const g = side === 'left' ? ctx.createLinearGradient(0, 0, W * frac, 0) : side === 'top' ? ctx.createLinearGradient(0, 0, 0, H * frac) : ctx.createLinearGradient(0, H, 0, H * (1 - frac));
  g.addColorStop(0, `rgba(3,7,12,${amt * a})`); g.addColorStop(1, 'rgba(3,7,12,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function vignette(amt = 0.55) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${amt})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function credit(str, a = 0.6) { txt(str, W - 40 * S, H - 30 * S, { font: FM, size: 13, weight: 500, align: 'right', alpha: a, color: '#e8edf2', spacing: 1, shadow: 0.8 }); }
