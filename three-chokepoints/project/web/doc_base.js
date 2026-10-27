import * as THREE from 'three';

const q = new URLSearchParams(location.search);
const W = +(q.get('w') || 1080), H = +(q.get('h') || 1920), S = Math.min(W, H) / 1080, LAND = W > H;
const REGIONS = {
  world:  { dir: 'assets/world/',  base: [-20, -42, 125, 58], detail: [-20, -42, 125, 58], exag: 2.5 },
  hormuz: { dir: 'assets/hormuz/', base: [44, 14, 68, 48], detail: [54, 24, 59, 28], exag: 4.5 },
  bab:    { dir: 'assets/bab/',    base: [18, 2, 64, 38], detail: [42.65, 11.95, 44.15, 13.35], exag: 4.0 },
  mal:    { dir: 'assets/mal/',    base: [88, -10, 125, 33], detail: [98, -0.5, 105, 6.5], exag: 3.5 },
};
const REGION = REGIONS[q.get('region') || 'world'];
const R = 6371, EXAG = REGION.exag;
const BASE = REGION.base, DETAIL = REGION.detail;
const ACCENT = '#38c8ff', ACCENT_RGB = '56,200,255', GOLD_RGB = '255,196,64';
const D2R = Math.PI / 180;
const F = v => `(${Number(v).toFixed(4)})`; // GLSL-safe float literal (handles negatives)

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
const camera = new THREE.PerspectiveCamera(LAND ? 34 : 46, W / H, 1, 60000);

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
  camPos: { value: new THREE.Vector3() }, hazeCol: { value: new THREE.Color(0.55, 0.70, 0.86) },
  hazeDist: { value: 3000 }, hazeMax: { value: 0.5 },
};

async function build() {
  const [baseT, detT, globeT] = await Promise.all([REGION.dir + 'base.jpg', REGION.dir + (q.get('region') === 'world' ? 'base.jpg' : 'detail.jpg'), REGION.dir + 'globe.jpg'].map(loadTex));
  const ov = await (await fetch(REGION.dir + 'overlay.json')).json();

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
  const buf = await (await fetch(REGION.dir + 'grid.bin')).arrayBuffer();
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
        vec3 c = texture2D(baseTex, vec2((lon-${F(BASE[0])})/${F(BASE[2] - BASE[0])}, (lat-${F(BASE[1])})/${F(BASE[3] - BASE[1])})).rgb;
        float wd = clamp(min(min(lon-${F(DETAIL[0])}, ${F(DETAIL[2])}-lon), min(lat-${F(DETAIL[1])}, ${F(DETAIL[3])}-lat))/0.25, 0.0, 1.0);
        if (wd > 0.0) c = mix(c, texture2D(detTex, vec2((lon-${F(DETAIL[0])})/${F(DETAIL[2] - DETAIL[0])}, (lat-${F(DETAIL[1])})/${F(DETAIL[3] - DETAIL[1])})).rgb, wd);
        float we = clamp(min(min(lon-${F(BASE[0])}, ${F(BASE[2])}-lon), min(lat-${F(BASE[1])}, ${F(BASE[3])}-lat))/1.2, 0.0, 1.0);
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


const SHOT = q.get('shot') || 'W1';
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
