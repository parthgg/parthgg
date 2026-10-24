import * as THREE from 'three';

const q = new URLSearchParams(location.search);
const W = +(q.get('w') || 1080), H = +(q.get('h') || 1920), S = W / 1080;
const R = 6371, EXAG = 4.5;
const BASE = [44, 14, 68, 48], DETAIL = [54, 24, 59, 28];
const ACCENT = '#ff4b3a', ACCENT_RGB = '255,75,58';
const D2R = Math.PI / 180;

// ---------- geo helpers ----------
function ll(lat, lon, alt = 0) {
  const r = R + alt, la = lat * D2R, lo = lon * D2R;
  return new THREE.Vector3(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo));
}
function enu(lat, lon) {
  const la = lat * D2R, lo = lon * D2R;
  return {
    up: new THREE.Vector3(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)),
    east: new THREE.Vector3(Math.cos(lo), 0, -Math.sin(lo)),
    north: new THREE.Vector3(-Math.sin(la) * Math.sin(lo), Math.cos(la), -Math.sin(la) * Math.cos(lo)),
  };
}
const KM_LAT = 110.57;
const kmLon = lat => 111.32 * Math.cos(lat * D2R);
function distKm(a, b) { return Math.hypot((b[0] - a[0]) * KM_LAT, (b[1] - a[1]) * kmLon((a[0] + b[0]) / 2)); }
function resample(path, stepKm = 1.5) {
  const out = [path[0]], cum = [0];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], d = distKm(a, b), n = Math.max(1, Math.ceil(d / stepKm));
    for (let k = 1; k <= n; k++) {
      out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
      cum.push(cum[cum.length - 1] + d / n);
    }
  }
  return { pts: out, cum, len: cum[cum.length - 1] };
}
function along(rs, s) {
  s = Math.max(0, Math.min(rs.len, s));
  let lo = 0, hi = rs.cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (rs.cum[m] < s) lo = m; else hi = m; }
  const t = (s - rs.cum[lo]) / Math.max(1e-6, rs.cum[hi] - rs.cum[lo]);
  const a = rs.pts[lo], b = rs.pts[hi];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

// ---------- easing / timeline ----------
const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp01(x), 3);
const win = (t, a, b, fi = 0.5, fo = 0.5) => Math.min(smooth((t - a) / fi), 1 - smooth((t - (b - fo)) / fo));

// ---------- renderer ----------
const glc = document.getElementById('gl'), ovc = document.getElementById('ov');
for (const c of [glc, ovc]) { c.width = W; c.height = H; c.style.width = W + 'px'; c.style.height = H + 'px'; }
const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setClearColor(0x04070d, 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, W / H, 1, 60000);

const loader = new THREE.TextureLoader();
const loadTex = url => new Promise(res => loader.load(url, t => {
  t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; res(t);
}));

const hazeChunk = `
  uniform vec3 camPos; uniform vec3 hazeCol; uniform float hazeDist; uniform float hazeMax;
  vec3 applyHaze(vec3 c, vec3 wp) {
    float d = length(wp - camPos);
    float f = (1.0 - exp(-d / hazeDist)) * hazeMax;
    return mix(c, hazeCol, f);
  }`;
const hazeUniforms = {
  camPos: { value: new THREE.Vector3() }, hazeCol: { value: new THREE.Color(0.62, 0.72, 0.84) },
  hazeDist: { value: 3000 }, hazeMax: { value: 0.5 },
};

async function build() {
  const [baseT, detT, globeT] = await Promise.all(['assets/base.jpg', 'assets/detail.jpg', 'assets/globe.jpg'].map(loadTex));
  const ov = await (await fetch('assets/overlay.json')).json();

  // globe
  const globeMat = new THREE.ShaderMaterial({
    uniforms: { globeTex: { value: globeT }, ...hazeUniforms },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w;
      #include <logdepthbuf_vertex>
    }`.replace('#include <logdepthbuf_vertex>', '') ,
    fragmentShader: `uniform sampler2D globeTex; varying vec3 vW; ${hazeChunk}
      void main(){ vec3 n=normalize(vW); float lat=asin(n.y)*57.29578; float lon=atan(n.x,n.z)*57.29578;
        vec3 c=texture2D(globeTex, vec2((lon+180.0)/360.0, clamp((lat+85.0)/170.0,0.0,1.0))).rgb;
        gl_FragColor=vec4(applyHaze(c,vW),1.0); }`,
  });
  addLogDepth(globeMat);
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(R - 0.6, 256, 128), globeMat));

  // terrain patch
  const buf = await (await fetch('assets/grid.bin')).arrayBuffer();
  const [nlon, nlat] = new Int32Array(buf, 0, 2);
  const lons = new Float32Array(buf, 8, nlon), lats = new Float32Array(buf, 8 + nlon * 4, nlat);
  const hs = new Float32Array(buf, 8 + (nlon + nlat) * 4, nlon * nlat);
  const pos = new Float32Array(nlon * nlat * 3), llA = new Float32Array(nlon * nlat * 2);
  for (let j = 0; j < nlat; j++) for (let i = 0; i < nlon; i++) {
    const k = j * nlon + i, v = ll(lats[j], lons[i], hs[k] * EXAG / 1000);
    pos[k * 3] = v.x; pos[k * 3 + 1] = v.y; pos[k * 3 + 2] = v.z; llA[k * 2] = lons[i]; llA[k * 2 + 1] = lats[j];
  }
  const idx = new Uint32Array((nlon - 1) * (nlat - 1) * 6); let p = 0;
  for (let j = 0; j < nlat - 1; j++) for (let i = 0; i < nlon - 1; i++) {
    const a = j * nlon + i, b = a + 1, c = a + nlon, d = c + 1;
    idx[p++] = a; idx[p++] = c; idx[p++] = b; idx[p++] = b; idx[p++] = c; idx[p++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('ll', new THREE.BufferAttribute(llA, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const patchMat = new THREE.ShaderMaterial({
    uniforms: { baseTex: { value: baseT }, detTex: { value: detT }, globeTex: { value: globeT }, ...hazeUniforms },
    vertexShader: `attribute vec2 ll; varying vec2 vLL; varying vec3 vW;
      void main(){ vLL=ll; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform sampler2D baseTex, detTex, globeTex; varying vec2 vLL; varying vec3 vW; ${hazeChunk}
      void main(){
        float lon=vLL.x, lat=vLL.y;
        vec3 c = texture2D(baseTex, vec2((lon-${BASE[0]}.0)/${BASE[2] - BASE[0]}.0, (lat-${BASE[1]}.0)/${BASE[3] - BASE[1]}.0)).rgb;
        float wd = clamp(min(min(lon-${DETAIL[0]}.0, ${DETAIL[2]}.0-lon), min(lat-${DETAIL[1]}.0, ${DETAIL[3]}.0-lat))/0.25, 0.0, 1.0);
        if (wd > 0.0) c = mix(c, texture2D(detTex, vec2((lon-${DETAIL[0]}.0)/${DETAIL[2] - DETAIL[0]}.0, (lat-${DETAIL[1]}.0)/${DETAIL[3] - DETAIL[1]}.0)).rgb, wd);
        float we = clamp(min(min(lon-${BASE[0]}.0, ${BASE[2]}.0-lon), min(lat-${BASE[1]}.0, ${BASE[3]}.0-lat))/1.2, 0.0, 1.0);
        vec3 g = texture2D(globeTex, vec2((lon+180.0)/360.0, (lat+85.0)/170.0)).rgb;
        c = mix(g, c, smoothstep(0.0,1.0,we));
        gl_FragColor=vec4(applyHaze(c,vW),1.0); }`,
  });
  addLogDepth(patchMat);
  scene.add(new THREE.Mesh(geo, patchMat));

  // atmosphere: outer glow (back faces) + limb haze over the surface (front faces)
  const glow = new THREE.Mesh(new THREE.SphereGeometry(R + 160, 128, 64), new THREE.ShaderMaterial({
    uniforms: { camPos: hazeUniforms.camPos },
    vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 camPos; varying vec3 vW;
      void main(){ vec3 v=normalize(vW-camPos); vec3 n=normalize(vW);
        // distance of the view ray from the planet centre, relative to the surface
        float b = length(cross(camPos, v)); float h = (b - ${R}.0) / 160.0;
        float a = h < 0.0 ? 0.0 : exp(-h*3.2);
        gl_FragColor = vec4(vec3(0.38,0.62,1.0)*a*1.25, a); }`,
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  addLogDepth(glow.material); scene.add(glow);
  const limb = new THREE.Mesh(new THREE.SphereGeometry(R + 25, 128, 64), new THREE.ShaderMaterial({
    uniforms: { camPos: hazeUniforms.camPos, limbK: { value: 1 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 camPos; uniform float limbK; varying vec3 vW;
      void main(){ vec3 v=normalize(camPos-vW); vec3 n=normalize(vW); float r=1.0-max(dot(n,v),0.0);
        float a=pow(r,3.5)*0.85*limbK; gl_FragColor=vec4(vec3(0.55,0.72,0.95),a); }`,
    transparent: true, depthWrite: false,
  }));
  addLogDepth(limb.material); scene.add(limb);
  return { ov, limb };
}

function addLogDepth(mat) {
  mat.vertexShader = mat.vertexShader.replace('void main(){', '\n#include <common>\n#include <logdepthbuf_pars_vertex>\nvoid main(){')
    .replace(/}\s*$/, '\n#include <logdepthbuf_vertex>\n}');
  mat.fragmentShader = mat.fragmentShader.replace(/void main\(\)\{/, '\n#include <logdepthbuf_pars_fragment>\nvoid main(){\n#include <logdepthbuf_fragment>\n');
}

// ---------- camera path ----------
// [t, lat, lon, range km, tilt deg (0 = straight down), heading deg]
const KEYS = [
  [0.0, 25.9, 56.3, 3300, 44, 2],
  [5.0, 25.9, 56.3, 2300, 40, 1],
  [8.2, 26.35, 56.42, 520, 22, 0],
  [11.0, 26.4, 56.42, 300, 18, 0],
  [13.6, 26.05, 56.4, 330, 52, -8],
  [19.5, 26.15, 56.35, 290, 56, 4],
  [26.0, 26.2, 56.3, 330, 50, 8],
  [31.5, 26.6, 56.6, 2300, 20, 2],
  [36.0, 28.0, 56.4, 3700, 10, 0],
  [41.5, 28.3, 56.4, 3900, 8, 0],
];
function cr(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
function camAt(t) {
  let i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1][0]) i++;
  const k1 = KEYS[i], k2 = KEYS[i + 1], k0 = KEYS[Math.max(0, i - 1)], k3 = KEYS[Math.min(KEYS.length - 1, i + 2)];
  let u = clamp01((t - k1[0]) / (k2[0] - k1[0]));
  u = u * u * (3 - 2 * u) * 0.65 + u * 0.35; // gentle ease, keeps motion continuous
  const out = [];
  for (let j = 1; j <= 5; j++) {
    const f = j === 3 ? Math.log : x => x;
    const v = cr(f(k0[j]), f(k1[j]), f(k2[j]), f(k3[j]), u);
    out.push(j === 3 ? Math.exp(v) : v);
  }
  return out; // lat, lon, range, tilt, heading
}
function placeCamera(t) {
  const [lat, lon, range, tilt, head] = camAt(t);
  const T = ll(lat, lon, 0), f = enu(lat, lon);
  const h = head * D2R, ti = tilt * D2R;
  const fwd = f.north.clone().multiplyScalar(Math.cos(h)).add(f.east.clone().multiplyScalar(Math.sin(h)));
  const pos = T.clone().add(f.up.clone().multiplyScalar(range * Math.cos(ti))).add(fwd.clone().multiplyScalar(-range * Math.sin(ti)));
  camera.position.copy(pos);
  camera.up.copy(fwd.clone().multiplyScalar(Math.cos(ti)).add(f.up.clone().multiplyScalar(Math.sin(ti))));
  camera.lookAt(T);
  const alt = pos.length() - R;
  camera.near = Math.max(0.5, alt * 0.02); camera.far = alt + 2 * R; camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  hazeUniforms.camPos.value.copy(pos);
  hazeUniforms.hazeDist.value = Math.max(400, range * 2.2);
  hazeUniforms.hazeMax.value = 0.32 + 0.18 * smooth((tilt - 20) / 40);
  return { lat, lon, range, tilt, head, alt };
}

// ---------- overlay drawing ----------
const ctx = ovc.getContext('2d');
const tmpV = new THREE.Vector3();
function proj(lat, lon, alt = 0) {
  const p = ll(lat, lon, alt);
  const n = p.clone().normalize();
  const vis = n.dot(tmpV.copy(camera.position).sub(p)) > -R * 0.002;
  p.project(camera);
  return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H, vis: vis && p.z < 1 };
}
function glowStroke(drawPath, width, alpha, color = ACCENT_RGB) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(${color},${alpha * 0.35})`; ctx.lineWidth = width * 5; ctx.filter = `blur(${6 * S}px)`; drawPath(); ctx.stroke();
  ctx.filter = 'none';
  ctx.strokeStyle = `rgba(${color},${alpha * 0.9})`; ctx.lineWidth = width * 1.6; drawPath(); ctx.stroke();
  ctx.strokeStyle = `rgba(255,225,215,${alpha})`; ctx.lineWidth = width * 0.6; drawPath(); ctx.stroke();
  ctx.restore();
}
function pathOf(rs, s0, s1) {
  return () => {
    ctx.beginPath(); let started = false;
    for (let i = 0; i < rs.pts.length; i++) {
      if (rs.cum[i] < s0 || rs.cum[i] > s1) continue;
      const p = proj(rs.pts[i][0], rs.pts[i][1]);
      if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
    }
    const e = along(rs, s1), pe = proj(e[0], e[1]); if (started) ctx.lineTo(pe.x, pe.y);
  };
}
function text(str, x, y, { size = 30, weight = 600, alpha = 1, spacing = 0, italic = false, rot = 0, align = 'center', color = '255,255,255', shadow = true } = {}) {
  if (alpha <= 0.002) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size * S}px Inter`;
  ctx.letterSpacing = `${spacing * S}px`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (shadow) { ctx.shadowColor = `rgba(0,0,0,${0.55 * alpha})`; ctx.shadowBlur = 10 * S; ctx.shadowOffsetY = 2 * S; }
  ctx.fillStyle = `rgba(${color},${alpha})`; ctx.fillText(str, x === undefined ? 0 : 0, 0);
  ctx.restore();
}
function geoLabel(str, lat, lon, opts = {}) {
  const p = proj(lat, lon); if (!p.vis) return;
  let rot = 0;
  if (opts.bearing !== undefined) {
    const b = opts.bearing * D2R, q2 = proj(lat + Math.cos(b) * 0.2, lon + Math.sin(b) * 0.2 / Math.cos(lat * D2R));
    rot = Math.atan2(q2.y - p.y, q2.x - p.x);
  }
  text(str, p.x, p.y, { ...opts, rot });
}
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

function reticle(lat, lon, t, a) {
  if (a <= 0) return;
  const p = proj(lat, lon); const r = 34 * S * (1 + 0.06 * Math.sin(t * 5));
  ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = a;
  ctx.strokeStyle = '#ff8a2a'; ctx.shadowColor = '#ff8a2a'; ctx.shadowBlur = 14 * S; ctx.lineWidth = 3 * S;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2); ctx.stroke();
  for (let k = 0; k < 4; k++) { const an = k * Math.PI / 2 + t * 0.6; ctx.beginPath(); ctx.moveTo(Math.cos(an) * r * 0.75, Math.sin(an) * r * 0.75); ctx.lineTo(Math.cos(an) * r * 1.35, Math.sin(an) * r * 1.35); ctx.stroke(); }
  const pr = (t * 0.9) % 1; ctx.globalAlpha = a * (1 - pr); ctx.lineWidth = 2 * S;
  ctx.beginPath(); ctx.arc(0, 0, r * (1 + pr * 1.6), 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function chevrons(rs, t, alpha, speed, spacing) {
  if (alpha <= 0) return;
  ctx.save(); ctx.fillStyle = `rgba(255,120,100,${alpha})`; ctx.shadowColor = ACCENT; ctx.shadowBlur = 10 * S;
  for (let s = (t * speed) % spacing; s < rs.len; s += spacing) {
    const a = along(rs, s), b = along(rs, s + 0.8);
    const pa = proj(a[0], a[1]), pb = proj(b[0], b[1]); if (!pa.vis) continue;
    const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x), sc = Math.min(1.6, Math.max(0.5, Math.hypot(pb.x - pa.x, pb.y - pa.y) / (0.8 * 2.2)));
    const sz = 9 * S * sc;
    ctx.save(); ctx.translate(pa.x, pa.y); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(sz, 0); ctx.lineTo(-sz * 0.7, -sz * 0.75); ctx.lineTo(-sz * 0.25, 0); ctx.lineTo(-sz * 0.7, sz * 0.75); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function ship(lat, lon, headingLL, a) {
  const p = proj(lat, lon); if (!p.vis || a <= 0) return;
  const b = [lat + headingLL[0], lon + headingLL[1]], pb = proj(b[0], b[1]);
  const pxPerKm = Math.hypot(pb.x - p.x, pb.y - p.y) / distKm([lat, lon], b);
  const len = Math.max(3 * S, Math.min(15 * S, 1.3 * pxPerKm));
  const ang = Math.atan2(pb.y - p.y, pb.x - p.x);
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang); ctx.globalAlpha = a;
  const wl = len * 5; const g = ctx.createLinearGradient(-wl, 0, 0, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.55)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -len * 0.18); ctx.lineTo(-wl, -len * 0.7); ctx.lineTo(-wl, len * 0.7); ctx.lineTo(0, len * 0.18); ctx.fill();
  ctx.fillStyle = 'rgba(245,247,250,0.95)'; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 3 * S;
  ctx.beginPath(); ctx.ellipse(0, 0, len / 2, len * 0.16 + 0.6 * S, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function measure(gap, t, a) {
  if (a <= 0) return;
  const pa = proj(gap.a[0], gap.a[1]), pb = proj(gap.b[0], gap.b[1]);
  const k = easeOut((t - 8.4) / 1.2);
  const mx = pa.x + (pb.x - pa.x) * k, my = pa.y + (pb.y - pa.y) * k;
  const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x);
  ctx.save(); ctx.globalAlpha = a;
  glowStroke(() => { ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(mx, my); }, 2.4 * S, 1, '255,255,255');
  for (const [p, on] of [[pa, true], [{ x: mx, y: my }, k > 0.98]]) {
    if (!on) continue;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang + Math.PI / 2); ctx.strokeStyle = 'white'; ctx.lineWidth = 3 * S;
    ctx.beginPath(); ctx.moveTo(-14 * S, 0); ctx.lineTo(14 * S, 0); ctx.stroke(); ctx.restore();
  }
  const km = Math.round(39 * easeOut((t - 8.6) / 1.3));
  const cx = (pa.x + pb.x) / 2 + 120 * S, cy = (pa.y + pb.y) / 2;
  ctx.globalAlpha = a * smooth((t - 8.8) / 0.4);
  ctx.fillStyle = 'rgba(8,14,24,0.72)'; roundRect(cx - 95 * S, cy - 50 * S, 190 * S, 100 * S, 14 * S); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5 * S; ctx.stroke();
  ctx.restore();
  const ta = a * smooth((t - 8.8) / 0.4);
  text(`${km} km`, cx, cy - 10 * S, { size: 46, weight: 800, alpha: ta });
  text('AT ITS NARROWEST', cx, cy + 28 * S, { size: 15, weight: 600, alpha: ta * 0.8, spacing: 2 });
}

function statCard(t) {
  const a1 = win(t, 28.6, 35.0, 0.5, 0.6);
  if (a1 <= 0) return;
  const y = H * 0.17;
  const pct = Math.round(20 * easeOut((t - 28.7) / 1.2));
  text(`~${pct}%`, W / 2, y, { size: 120, weight: 800, alpha: a1, color: '255,255,255' });
  text("OF THE WORLD'S OIL", W / 2, y + 86 * S, { size: 28, weight: 700, alpha: a1, spacing: 5 });
  const a2 = win(t, 31.0, 35.0, 0.5, 0.6);
  const bar = 20 * easeOut((t - 31.0) / 1.4);
  ctx.save(); ctx.globalAlpha = a2;
  ctx.fillStyle = 'rgba(8,14,24,0.7)'; roundRect(W / 2 - 300 * S, y + 140 * S, 600 * S, 92 * S, 46 * S); ctx.fill();
  ctx.strokeStyle = `rgba(${ACCENT_RGB},0.9)`; ctx.lineWidth = 2.5 * S; ctx.stroke(); ctx.restore();
  text(`${bar.toFixed(1)}M barrels / day`, W / 2, y + 186 * S, { size: 40, weight: 700, alpha: a2 });
}

let G = null;
const routesRS = [], coastRS = {}, lanesRS = {}, shipList = [];
async function init() {
  G = await build();
  const ov = G.ov;
  for (const k of ['iran', 'oman']) coastRS[k] = resample(ov.coast[k], 1.0);
  for (const k of ['in', 'out']) lanesRS[k] = { mid: resample(ov.lanes[k].mid), edges: ov.lanes[k].edges.map(e => resample(e)) };
  for (const r of ov.routes) routesRS.push(resample(r, 8));
  // tankers on the lanes, plus a few loitering in the Gulf
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const k of ['in', 'out']) for (let i = 0; i < 9; i++) shipList.push({ rs: lanesRS[k].mid, s0: rnd() * lanesRS[k].mid.len, v: 2.2 + rnd() * 1.2, off: (rnd() - 0.5) * 2.4 });
  window.__ready = true;
}

function laneShipPos(sh, t) {
  const s = (sh.s0 + sh.v * t) % sh.rs.len;
  const a = along(sh.rs, s), b = along(sh.rs, s + 0.5);
  const dlat = b[0] - a[0], dlon = b[1] - a[1];
  // sideways jitter within the lane
  const nx = -dlat * KM_LAT, ny = dlon * kmLon(a[0]); const nn = Math.hypot(nx, ny) || 1;
  return { lat: a[0] + (ny / nn) * sh.off / KM_LAT * 0, lon: a[1], dir: [dlat, dlon] };
}

function drawOverlay(t, cam) {
  ctx.clearRect(0, 0, W, H);
  const ov = G.ov;
  // --- opening: wide labels + reticle
  const aWide = win(t, 0.7, 7.0, 0.8, 0.9);
  const big = { size: 30, weight: 700, spacing: 6 }, sea = { size: 22, weight: 500, italic: true, spacing: 3 };
  geoLabel('IRAN', 30.2, 55.2, { ...big, alpha: aWide });
  geoLabel('SAUDI ARABIA', 23.6, 47.5, { ...big, size: 24, alpha: aWide * 0.9 });
  geoLabel('UAE', 23.6, 54.2, { ...big, size: 24, alpha: aWide });
  geoLabel('OMAN', 21.6, 57.0, { ...big, size: 26, alpha: aWide });
  geoLabel('PERSIAN GULF', 27.0, 51.6, { ...sea, alpha: aWide, bearing: 125 });
  geoLabel('GULF OF OMAN', 24.4, 59.1, { ...sea, alpha: aWide, bearing: 120 });
  geoLabel('ARABIAN SEA', 18.8, 62.0, { ...sea, alpha: aWide });
  reticle(26.56, 56.42, t, win(t, 1.2, 8.6, 0.6, 0.8));
  // strait tag
  const aTag = win(t, 2.2, 11.5, 0.6, 0.8);
  if (aTag > 0) {
    const p = proj(26.56, 56.42), x = p.x - 54 * S, y = p.y - 70 * S;
    ctx.save(); ctx.globalAlpha = aTag; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.6 * S;
    ctx.beginPath(); ctx.moveTo(p.x - 26 * S, p.y - 26 * S); ctx.lineTo(x, y); ctx.lineTo(x - 30 * S, y); ctx.stroke(); ctx.restore();
    text('STRAIT OF HORMUZ', x - 38 * S, y, { size: 24, weight: 800, spacing: 3, alpha: aTag, align: 'right' });
  }
  // --- 39 km measurement
  measure(ov.gap, t, win(t, 8.4, 12.4, 0.3, 0.7));
  // --- close-up sea labels
  const aSea = win(t, 12.8, 27.5, 0.8, 1.0);
  geoLabel('Persian Gulf', 26.15, 55.35, { size: 30, weight: 600, alpha: aSea, bearing: 80 });
  geoLabel('Gulf of Oman', 25.35, 57.25, { size: 32, weight: 600, alpha: aSea, bearing: 140 });
  // --- coastlines glow
  for (const [k, t0, label, pos] of [['iran', 15.6, 'IRAN', [27.2, 56.15]], ['oman', 17.4, 'OMAN', [25.7, 56.12]]]) {
    const rs = coastRS[k]; const a = win(t, t0, 24.0, 0.2, 1.2) * (1 - 0.45 * smooth((t - 20) / 1.5));
    if (a <= 0) continue;
    const prog = easeOut((t - t0) / 1.5) * rs.len;
    glowStroke(pathOf(rs, 0, prog), 2.2 * S, a);
    const la = win(t, t0 + 0.3, 24.0, 0.5, 1.2);
    geoLabel(label, pos[0], pos[1], { size: 34, weight: 800, spacing: 8, alpha: la });
  }
  // --- shipping lanes
  const aLane = win(t, 20.2, 41.5, 0.3, 0.5);
  if (aLane > 0) {
    const prog = easeOut((t - 20.2) / 2.2);
    for (const k of ['in', 'out']) {
      for (const e of lanesRS[k].edges) glowStroke(pathOf(e, 0, prog * e.len), 1.6 * S, aLane * (1 - 0.5 * smooth((t - 29) / 2)));
      chevrons(lanesRS[k].mid, t, aLane * smooth((t - 21.2) / 0.8) * (1 - smooth((t - 29) / 2)), 9, 13);
    }
    const aIn = win(t, 23.4, 27.5, 0.4, 0.6), aOut = win(t, 24.6, 27.5, 0.4, 0.6);
    const pin = along(lanesRS.in.mid, 95), pout = along(lanesRS.out.mid, lanesRS.out.mid.len - 85);
    geoLabel('INBOUND', pin[0] + 0.12, pin[1] + 0.1, { size: 24, weight: 800, spacing: 4, alpha: aIn, color: '255,200,190', bearing: 140 });
    geoLabel('OUTBOUND', pout[0] - 0.12, pout[1] - 0.12, { size: 24, weight: 800, spacing: 4, alpha: aOut, color: '255,200,190', bearing: 140 });
  }
  // --- ships
  const aShip = smooth((t - 6.5) / 1.5) * (1 - smooth((t - 29.5) / 1.5));
  if (aShip > 0) for (const sh of shipList) { const p = laneShipPos(sh, t); ship(p.lat, p.lon, p.dir, aShip); }
  // --- global routes on pull-back
  const aR = win(t, 27.2, 41.5, 0.4, 0.4);
  if (aR > 0) routesRS.forEach((rs, i) => {
    const prog = easeOut((t - 27.4 - i * 0.18) / 2.6);
    glowStroke(pathOf(rs, 0, prog * rs.len), 1.7 * S, aR);
    chevrons(rs, t, aR * smooth((t - 29) / 1), 60, 160);
  });
  const aWide2 = win(t, 30.5, 41.5, 1.0, 0.4);
  geoLabel('Persian Gulf', 27.3, 51.2, { size: 20, weight: 600, alpha: aWide2, bearing: 125 });
  geoLabel('Gulf of Oman', 24.0, 59.6, { size: 20, weight: 600, alpha: aWide2, bearing: 120 });
  geoLabel('Caspian Sea', 41.3, 51.0, { size: 20, weight: 600, italic: true, alpha: aWide2 * 0.85 });
  geoLabel('IRAN', 32.3, 55.0, { size: 26, weight: 700, spacing: 6, alpha: aWide2 * 0.9 * smooth((t - 35.3) / 0.8) });
  const pS = proj(26.56, 56.42);
  if (aWide2 > 0) { ctx.save(); ctx.globalAlpha = aWide2; ctx.fillStyle = ACCENT; ctx.shadowColor = ACCENT; ctx.shadowBlur = 16 * S;
    ctx.beginPath(); ctx.arc(pS.x, pS.y, 6 * S * (1 + 0.2 * Math.sin(t * 6)), 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  statCard(t);
  // --- title
  const aT = smooth((t - 35.3) / 0.9);
  if (aT > 0) {
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.42);
    g.addColorStop(0, `rgba(4,8,14,${0.75 * aT})`); g.addColorStop(1, 'rgba(4,8,14,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.42);
    const y = H * 0.16 + (1 - easeOut((t - 35.3) / 1.0)) * 30 * S;
    text('Strait of Hormuz:', W / 2, y, { size: 82, weight: 800, alpha: aT });
    text('a narrow gateway with global impact', W / 2, y + 78 * S, { size: 36, weight: 500, alpha: smooth((t - 35.9) / 0.8) * 0.92 });
    text('Elevation: Copernicus DEM, AWS Terrain Tiles · Coastlines: Natural Earth', W / 2, H - 40 * S, { size: 15, weight: 500, alpha: aT * 0.6, shadow: false });
  }
}

window.renderAt = function (t) {
  const cam = placeCamera(t);
  G.limb.material.uniforms.limbK.value = 0.35 + 0.65 * smooth((cam.alt - 300) / 1500);
  renderer.render(scene, camera);
  drawOverlay(t, cam);
  return true;
};
init();
