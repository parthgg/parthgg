
// ================= Shorts hero renderer: 3D ships, light pillars, extruded type, tube arcs, bloom + grade =================
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// camera keys [t, lat, lon, range km, tilt, heading] on the Short's timeline
const SHOTS = {
  A: [[0.0, 20, 66, 15500, 0, 0], [2.4, 14, 70, 13000, 18, 0], [5.8, 4, 74, 14500, 36, 0]],
  B: [[5.6, 25.2, 58.4, 3600, 18, -4], [7.0, 26.1, 56.9, 900, 40, -12], [8.2, 26.45, 56.5, 260, 60, -20], [9.35, 26.55, 56.38, 95, 70, -28]],
  D: [[10.3, 26.15, 56.55, 640, 66, -28], [13.6, 25.9, 56.75, 1500, 62, -18], [17.1, 25.3, 57.1, 2700, 54, -8]],
  E: [[17.0, 13.6, 44.9, 950, 56, -42], [20.0, 12.95, 44.0, 600, 60, -30], [22.8, 12.75, 43.65, 440, 62, -22]],
  F: [[22.6, 2, 34, 13500, 0, 0], [27.0, -8, 30, 12800, 6, 0]],
  G: [[26.9, 2.3, 101.9, 700, 58, 40], [28.6, 1.45, 103.2, 200, 64, 48], [30.6, 1.22, 103.68, 70, 72, 56]],
  I: [[31.7, 2, 80, 11000, 42, 0], [34.3, 3, 80, 12000, 40, 0]],
  K: [[34.7, 9, 71, 8800, 36, 0], [38.7, 7, 70, 13500, 28, 0]],
  L: [[38.5, 14, 70, 15500, 0, 0], [41.6, 16, 70, 14200, 0, 0]],
};
const KEYS = SHOTS[SHOT];
let VO = null, G = null, FONT = null, composer = null, gradePass = null, bloomPass = null;
const word = (w, n = 0) => VO.words.filter(x => x.w.replace(/\(\d\)$/, '') === w)[n].s;
const AMB3 = new THREE.Color(1.0, 0.62, 0.18), SEA3 = new THREE.Color(0.45, 0.85, 1.0), RED3 = new THREE.Color(1.0, 0.18, 0.12), WHITE3 = new THREE.Color(1, 1, 1);
const easeInOut = x => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeExpo = x => { x = clamp01(x); return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); };
const halt = (t, tc, r = 3) => t < tc ? t : tc + (1 - Math.exp(-(t - tc) * r)) / r;

// ---------- geography ----------
const HORMUZ = [26.55, 56.45], BAB = [12.58, 43.38], MALACCA = [1.17, 103.78];
const GULF = [26.9, 50.6], SUEZ = [29.93, 32.55], ROTT = [51.9, 3.8], SHANGHAI = [30.7, 122.95], TOKYO = [35.4, 139.9], MUMBAI = [18.9, 72.8], CAPE = [-35.2, 19.5];
function smoothLL(pts, per = 10) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < per; k++) { const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))); }
  }
  out.push(pts[pts.length - 1]); return out;
}
const R_ = (pts, step = 6) => resample(smoothLL(pts), step);
const CAPE_ROUTE = [[12.3, 48.0], [8.0, 53.0], [0.0, 55.5], [-12.0, 57.0], [-25.0, 49.5], [-33.5, 31.0], [-35.6, 19.5], [-31.0, 13.5], [-18.0, 8.0], [-5.0, 3.0], [4.0, -9.5],
  [13.0, -19.5], [24.0, -18.5], [33.0, -12.5], [37.0, -10.0], [43.6, -10.2], [48.6, -6.0], [50.3, -0.6], [51.9, 3.8]];
const LANES = [
  [[51.9, 3.8], [48.6, -6.0], [43.6, -10.2], [37.0, -9.6], [35.95, -5.6], [37.6, 11.0], [34.8, 20.0], [31.4, 32.3], [27.7, 33.85], [20.0, 38.6], [13.3, 42.8], [12.2, 45.5], [12.2, 51.6], [8.0, 63.0], [5.5, 80.6], [5.9, 94.5], [2.4, 101.45], [1.3, 104.4], [6.5, 107.6], [18.5, 112.6], [24.8, 119.4], [30.7, 122.95]],
  [[29.3, 48.4], [26.7, 50.4], [26.4, 55.6], [26.6, 56.45], [25.4, 57.5], [22.9, 60.4], [17.0, 63.0], [10.0, 64.5], [6.6, 72.0]],
  [[1.3, 104.4], [-6.0, 111.0], [-8.4, 115.7], [-21.0, 112.5], [-31.5, 114.6]], [[22.0, 114.5], [29.0, 124.0], [33.8, 134.5]],
  [[24.7, 66.6], [18.9, 72.6], [10.0, 75.6], [5.6, 80.4]], [[12.0, 51.4], [0.0, 44.6], [-10.0, 41.0], [-25.5, 35.6]], [[5.9, 88.0], [21.0, 88.3]],
];

// ---------- materials ----------
const VS = `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0);
  #ifdef USE_INSTANCING
    w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  #endif
  vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`;
function addLD(m) { addLogDepth(m); return m; }
function glowMat(frag, uniforms, { side = THREE.FrontSide, blending = THREE.AdditiveBlending } = {}) {
  return addLD(new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: frag, transparent: true, depthWrite: false, blending, side }));
}
const PILLAR_FS = `uniform vec3 col; uniform float inten; uniform float time; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  void main(){ float h = vUv.y; float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.6);
    float bands = 0.88 + 0.12 * sin(h * 24.0 - time * 5.0);
    float a = pow(1.0 - h, 1.3) * (0.18 + 0.9 * fr) * bands * smoothstep(0.0, 0.02, h);
    gl_FragColor = vec4(col * inten * a, a); }`;
const RING_FS = `uniform vec3 col; uniform float inten; uniform float time; uniform float pulse; varying vec2 vUv;
  void main(){ float r = length(vUv - 0.5) * 2.0; float a = (1.0 - r) * (0.35 + 0.65 * pow(0.5 + 0.5 * sin(r * 18.0 - time * 5.0), 3.0)) * pulse;
    gl_FragColor = vec4(col * inten * a, a); }`;
const TUBE_FS = `uniform vec3 col; uniform float inten; uniform float prog; uniform float time; uniform float flow; varying vec2 vUv;
  void main(){ float u = vUv.x; if (u > prog) discard;
    float head = smoothstep(prog - 0.06, prog, u) * (1.0 - step(0.999, prog));
    float pul = pow(0.5 + 0.5 * sin((u * 22.0 - time * 2.2) * 3.14159), 8.0) * flow;
    float a = 0.35 + 0.65 * pul + 2.5 * head;
    gl_FragColor = vec4(col * inten * a, 1.0); }`;
const WAKE_FS = `uniform float inten; varying vec2 vUv;
  void main(){ float u = vUv.x, v = abs(vUv.y - 0.5) * 2.0;
    float a = pow(1.0 - u, 1.8) * (0.25 + 0.75 * pow(v, 3.0)) * smoothstep(1.0, 0.85, v) * inten;
    gl_FragColor = vec4(vec3(0.92, 0.97, 1.0) * a, a); }`;

// ---------- objects ----------
function orientUp(obj, lat, lon, alt = 0) {
  const p = ll(lat, lon, alt); obj.position.copy(p); obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize());
}
function makePillar(lat, lon, radius, color) {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.6, 1, 48, 1, true).translate(0, 0.5, 0),
    glowMat(PILLAR_FS, { col: { value: color.clone() }, inten: { value: 2.2 }, time: { value: 0 } }, { side: THREE.DoubleSide }));
  const core = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.18, radius * 0.1, 1, 24, 1, true).translate(0, 0.5, 0),
    glowMat(PILLAR_FS, { col: { value: new THREE.Color(1, 0.95, 0.85) }, inten: { value: 2.6 }, time: { value: 0 } }, { side: THREE.DoubleSide }));
  const ringG = new THREE.RingGeometry(radius * 0.6, radius * 6, 96, 4); ringG.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringG, glowMat(RING_FS, { col: { value: color.clone() }, inten: { value: 1.6 }, time: { value: 0 }, pulse: { value: 1 } }, { side: THREE.DoubleSide }));
  ring.position.y = 0.3;
  g.add(outer, core, ring); orientUp(g, lat, lon, 0.2); scene.add(g);
  return {
    g, lat, lon, h: 0,
    set(h, k, col, t) {
      this.h = h; const vis = k > 0.001 && h > 0.01; g.visible = vis; if (!vis) return;
      outer.scale.set(1, h, 1); core.scale.set(1, h, 1); ring.scale.setScalar(0.4 + 0.6 * k);
      for (const m of [outer, ring]) { m.material.uniforms.col.value.copy(col); m.material.uniforms.time.value = t; }
      outer.material.uniforms.inten.value = 2.2 * k; core.material.uniforms.inten.value = 2.6 * k; core.material.uniforms.time.value = t; ring.material.uniforms.inten.value = 1.6 * k;
    },
  };
}
function makeShock(lat, lon, color) {
  const g = new THREE.RingGeometry(0.92, 1.0, 128, 1); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, glowMat(`uniform vec3 col; uniform float inten; varying vec2 vUv; void main(){ gl_FragColor = vec4(col * inten, 1.0); }`, { col: { value: color.clone() }, inten: { value: 0 } }, { side: THREE.DoubleSide }));
  orientUp(m, lat, lon, 0.5); scene.add(m); m.visible = false;
  return { m, set(r, a) { m.visible = a > 0.002; m.scale.setScalar(Math.max(0.01, r)); m.material.uniforms.inten.value = 3 * a; } };
}
function liftedPath(a, b, hk = 0.16, n = 96, lift = null) {
  const d = distKm(a, b), hh = lift ?? Math.min(1500, d * hk), pts = [];
  for (let i = 0; i <= n; i++) { const u = i / n; pts.push(ll(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, hh * Math.sin(Math.PI * u) + 3)); }
  return pts;
}
function makeTube(pts, radius, color, { inten = 2.4, flow = 1 } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(64, pts.length * 2), radius, 10, false),
    glowMat(TUBE_FS, { col: { value: color.clone() }, inten: { value: inten }, prog: { value: 0 }, time: { value: 0 }, flow: { value: flow } }));
  scene.add(m); m.visible = false;
  return { m, base: inten, set(p, t, col = null, k = 1) { m.visible = p > 0.001 && k > 0.001; const u = m.material.uniforms; u.prog.value = p; u.time.value = t; u.inten.value = this.base * k; if (col) u.col.value.copy(col); } };
}
const surfaceTube = (llPts, alt, radius, color, opts) => makeTube(R_(llPts, 40).pts.map(p => ll(p[0], p[1], alt)), radius, color, opts);

// 3D extruded type rising out of the sea
function makeText(str, size, { face = 0xffffff, side = 0xffb43a, depth = 0.22, emissive = 0x000000, eInt = 0 } = {}) {
  const group = new THREE.Group(), letters = [];
  const faceM = new THREE.MeshStandardMaterial({ color: new THREE.Color(face).multiplyScalar(0.85), metalness: 0.3, roughness: 0.55, envMapIntensity: 0.15, emissive, emissiveIntensity: eInt });
  const sideM = new THREE.MeshStandardMaterial({ color: new THREE.Color(side).multiplyScalar(0.7), metalness: 0.95, roughness: 0.3, envMapIntensity: 0.45 });
  let x = 0; const sc = size / FONT.data.resolution;
  for (const ch of str) {
    const gl = FONT.data.glyphs[ch] || FONT.data.glyphs['?'];
    if (ch !== ' ') {
      const geo = new TextGeometry(ch, { font: FONT, size, depth: size * depth, curveSegments: 5, bevelEnabled: true, bevelThickness: size * 0.03, bevelSize: size * 0.018, bevelSegments: 2 });
      const m = new THREE.Mesh(geo, [faceM, sideM]); m.position.x = x; const piv = new THREE.Group(); piv.add(m); letters.push(piv); group.add(piv);
    }
    x += gl.ha * sc;
  }
  letters.forEach(p => p.children[0].position.x -= x / 2);
  scene.add(group); group.visible = false;
  return { group, letters, faceM, sideM, size, width: x };
}
// place a text so it stands on (lat, lon, alt) and turns toward the camera; k animates letters up out of the surface
function placeText(T, lat, lon, alt, t, t0, t1 = 1e9, { lean = 0.45, stagger = 0.045, dur = 0.7, screen = false, dy = 0, dx = 0 } = {}) {
  const on = t >= t0 - 0.01 && t < t1 + 0.6; T.group.visible = on; if (!on) return;
  let P = ll(lat, lon, alt), x, y, z;
  if (screen) {
    x = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0); y = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1); z = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2);
    P = P.addScaledVector(y, dy);
  } else {
    const n = P.clone().normalize(), toCam = camera.position.clone().sub(P).normalize();
    const tang = toCam.clone().sub(n.clone().multiplyScalar(toCam.dot(n))).normalize();
    z = tang.clone().multiplyScalar(1 - lean).add(toCam.clone().multiplyScalar(lean)).normalize();
    y = n.clone().sub(z.clone().multiplyScalar(n.dot(z))).normalize(); x = new THREE.Vector3().crossVectors(y, z);
  }
  if (dx) P.addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), dx);
  T.group.position.copy(P); T.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  T.letters.forEach((L, i) => {
    const k = easeExpo((t - t0 - i * stagger) / dur), ko = easeInOut((t - t1 - i * stagger * 0.5) / 0.45);
    L.position.y = (k - 1) * T.size * 1.35 - ko * T.size * 1.4; L.rotation.x = (1 - k) * 0.5;
    L.visible = k > 0.001;
  });
}

// ships: instanced tanker models with foam wakes
function shipGeometry() {
  const s = new THREE.Shape(); s.moveTo(-0.5, -0.08); s.lineTo(0.34, -0.08); s.quadraticCurveTo(0.49, -0.07, 0.52, 0); s.quadraticCurveTo(0.49, 0.07, 0.34, 0.08); s.lineTo(-0.5, 0.08); s.closePath();
  const tint = (geo, c) => { const col = new THREE.Color(c), n = geo.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.toArray(a, i * 3); geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo; };
  const hull = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }); hull.rotateX(-Math.PI / 2);
  const deck = new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: false }); deck.rotateX(-Math.PI / 2); deck.scale(0.97, 1, 0.9); deck.translate(0.0, 0.05, 0);
  const house = new THREE.BoxGeometry(0.09, 0.11, 0.14).toNonIndexed().translate(-0.42, 0.105, 0);
  const funnel = new THREE.BoxGeometry(0.035, 0.07, 0.04).toNonIndexed().translate(-0.46, 0.19, 0);
  const pipe = new THREE.BoxGeometry(0.62, 0.012, 0.012).toNonIndexed().translate(0.02, 0.062, 0);
  const geos = [tint(hull.toNonIndexed(), 0x22262c), tint(deck.toNonIndexed(), 0x8a3d2c), tint(house, 0xf2f2ee), tint(funnel, 0xd8a03a), tint(pipe, 0xcfc6b0)];
  geos.forEach(g => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); });
  return mergeGeometries(geos);
}
function wakeGeometry() {
  const g = new THREE.BufferGeometry();
  const P = [-0.45, 0, -0.08, -0.45, 0, 0.08, -4.0, 0, -0.55, -4.0, 0, 0.55], UV = [0, 0, 0, 1, 1, 0, 1, 1];
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3)); g.setIndex([0, 2, 1, 1, 2, 3]); return g;
}
function makeFleet(routes, n, { len = 4, sigma = 2.5, speed = 8, seed = 7, center = null, radius = 1e9 } = {}) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  routes = routes.map(R => { const idx = R.rs.pts.map((p, i) => [i, center ? distKm(p, center) : 0]).filter(([, d]) => d < radius).map(([i]) => i);
    return idx.length > 2 ? { ...R, a: R.rs.cum[idx[0]], b: R.rs.cum[idx[idx.length - 1]] } : null; }).filter(Boolean);
  routes.forEach(R => { R.wlen = R.b - R.a; });
  const wt = r => r.wlen * (r.w ?? 1), tot = routes.reduce((a, r) => a + wt(r), 0), P = [];
  for (let i = 0; i < n; i++) {
    let u = rnd() * tot, ri = 0; while (ri < routes.length - 1 && u > wt(routes[ri])) { u -= wt(routes[ri]); ri++; }
    const R = routes[ri], g = (rnd() + rnd() + rnd() - 1.5) / 0.5, dir = R.oneWay ? 1 : (rnd() < 0.5 ? 1 : -1);
    P.push({ r: ri, s0: rnd() * R.wlen, dir, v: speed * (0.7 + 0.6 * rnd()), off: g * sigma + dir * (R.lane ?? sigma * 0.8), l: len * (0.7 + 0.5 * rnd()), red: 0 });
  }
  const ships = new THREE.InstancedMesh(shipGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.2, roughness: 0.55 }), n);
  const wakes = new THREE.InstancedMesh(wakeGeometry(), glowMat(WAKE_FS, { inten: { value: 0.9 } }), n);
  ships.frustumCulled = wakes.frustumCulled = false; scene.add(wakes, ships);
  const M = new THREE.Matrix4(), col = new THREE.Color();
  return {
    P, routes, ships, wakes,
    update(tau, { alpha = 1, redAt = null } = {}) {
      ships.visible = wakes.visible = alpha > 0.01; if (!ships.visible) return;
      wakes.material.uniforms.inten.value = 0.9 * alpha;
      P.forEach((q, i) => {
        const R = routes[q.r], rs = R.rs, L = rs.len, WL = R.wlen; let sw = q.s0 + q.dir * q.v * tau; sw = ((sw % WL) + WL) % WL; const sp = R.a + sw;
        const edge = Math.min(WL * 0.12, 25), fade = smooth(sw / edge) * smooth((WL - sw) / edge);
        const a = along(rs, Math.max(0, sp - 0.6)), b = along(rs, Math.min(L, sp + 0.6)), c = along(rs, sp);
        const dy = (b[0] - a[0]) * KM_LAT, dx = (b[1] - a[1]) * kmLon(c[0]), nn = Math.hypot(dx, dy) || 1;
        const la = c[0] + (dx / nn) * q.off / KM_LAT, lo = c[1] + (-dy / nn) * q.off / kmLon(c[0]);
        const p = ll(la, lo, 0.02), up = p.clone().normalize();
        const ahead = ll(la + (dy / nn) * 0.02 * q.dir, lo + (dx / nn) * 0.02 * q.dir / Math.cos(la * D2R), 0.02).sub(p);
        const f = ahead.sub(up.clone().multiplyScalar(ahead.dot(up))).normalize(), z = new THREE.Vector3().crossVectors(f, up);
        const sc = q.l * Math.max(0.001, fade * alpha);
        M.makeBasis(f.multiplyScalar(sc), up.multiplyScalar(sc), z.multiplyScalar(sc)).setPosition(p);
        ships.setMatrixAt(i, M); wakes.setMatrixAt(i, M);
        const red = redAt ? redAt(la, lo) : 0;
        col.setRGB(1, 1, 1).lerp(new THREE.Color(1.0, 0.35, 0.28), red); ships.setColorAt(i, col);
      });
      ships.instanceMatrix.needsUpdate = wakes.instanceMatrix.needsUpdate = true; if (ships.instanceColor) ships.instanceColor.needsUpdate = true;
    },
  };
}
// explosion: additive fireball sprites + shockwave ring
function radialTex(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([o, s]) => g.addColorStop(o, s)); x.fillStyle = g; x.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}
let FIRE_T = null, SMOKE_T = null;
function makeBlast(lat, lon, size) {
  FIRE_T ??= radialTex([[0, 'rgba(255,250,230,1)'], [0.18, 'rgba(255,200,90,0.95)'], [0.45, 'rgba(255,90,20,0.55)'], [1, 'rgba(120,20,0,0)']]);
  SMOKE_T ??= radialTex([[0, 'rgba(40,36,34,0.85)'], [0.6, 'rgba(30,28,28,0.45)'], [1, 'rgba(20,20,20,0)']]);
  const fire = new THREE.Sprite(new THREE.SpriteMaterial({ map: FIRE_T, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: 0xffffff }));
  const smoke = new THREE.Sprite(new THREE.SpriteMaterial({ map: SMOKE_T, depthWrite: false, transparent: true }));
  const shock = makeShock(lat, lon, new THREE.Color(1.0, 0.6, 0.3));
  const base = ll(lat, lon, 0), up = base.clone().normalize(); scene.add(smoke, fire); fire.visible = smoke.visible = false;
  return {
    set(t, t0) {
      const u = t - t0; const on = u >= 0 && u < 3.5; fire.visible = smoke.visible = on; if (!on) { shock.set(0, 0); return; }
      const kf = easeExpo(u / 0.35), ff = 1 - smooth((u - 0.25) / 1.4);
      fire.scale.setScalar(size * (0.4 + 1.3 * kf)); fire.position.copy(base).addScaledVector(up, size * (0.3 + 0.5 * kf)); fire.material.opacity = ff; fire.material.color.setScalar(1.6 * ff + 0.2);
      smoke.scale.setScalar(size * (0.8 + 1.6 * smooth(u / 3))); smoke.position.copy(base).addScaledVector(up, size * (0.6 + 1.6 * smooth(u / 3))); smoke.material.opacity = 0.85 * smooth(u / 0.4) * (1 - smooth((u - 2.2) / 1.2));
      shock.set(size * (0.3 + 4.5 * easeExpo(u / 1.2)), 1 - smooth(u / 1.1));
    },
  };
}

// ---------- post ----------
const GRADE = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, res: { value: new THREE.Vector2(W, H) }, ca: { value: 0.012 }, flash: { value: 0 }, fade: { value: 0 }, redwash: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, ca, flash, fade, redwash; uniform vec2 res; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){ vec2 d = vUv - 0.5; float r2 = dot(d, d);
      vec3 c = vec3(texture2D(tDiffuse, vUv - d * ca * (0.4 + r2 * 4.0)).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + d * ca * (0.4 + r2 * 4.0)).b);
      c = max(c, 0.0); c = c / (1.0 + 0.12 * c);
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(c * vec3(0.9, 1.0, 1.1), c * vec3(1.1, 1.0, 0.88), smoothstep(0.08, 0.75, l));
      c = (c - 0.5) * 1.1 + 0.5;
      c = mix(c, c * vec3(1.25, 0.55, 0.5), redwash);
      c *= 1.0 - 0.6 * smoothstep(0.12, 0.6, r2 * 2.0);
      c += (hash(vUv * res + fract(time) * 91.0) - 0.5) * 0.04;
      c = mix(c, vec3(1.0), flash); c *= 1.0 - fade;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0); }`,
};

// ---------- shots ----------
const S3 = {};   // per-shot objects
const lightRig = { sun: new THREE.DirectionalLight(0xfff2dd, 1.7), fill: new THREE.DirectionalLight(0x9fc4ff, 0.5), amb: new THREE.AmbientLight(0x6a7c90, 0.35) };
scene.add(lightRig.sun, lightRig.sun.target, lightRig.fill, lightRig.fill.target, lightRig.amb);
function aimLights(look) {
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const d = camera.position.distanceTo(look);
  lightRig.sun.position.copy(camera.position).addScaledVector(right, -0.8 * d).addScaledVector(up, 0.9 * d); lightRig.sun.target.position.copy(look);
  lightRig.fill.position.copy(camera.position).addScaledVector(right, 0.9 * d).addScaledVector(up, -0.2 * d); lightRig.fill.target.position.copy(look);
}
function worldArcs() {
  const arcs = [[GULF, HORMUZ, 0.3], [HORMUZ, MALACCA, 0.16], [MALACCA, SHANGHAI, 0.16], [SHANGHAI, TOKYO, 0.2], [HORMUZ, BAB, 0.16], [BAB, SUEZ, 0.16], [SUEZ, ROTT, 0.14], [HORMUZ, MUMBAI, 0.2], [MALACCA, [-31.9, 115.8], 0.14]];
  return arcs.map(([a, b, hk]) => ({ a, b, tube: makeTube(liftedPath(a, b, hk), 14, AMB3, { inten: 3.0 }) }));
}
const lanesTubes = () => LANES.map(l => surfaceTube(l, 6, 5, SEA3, { inten: 1.6, flow: 1 }));

async function init() {
  VO = await (await fetch('assets/short_vo.json')).json();
  const json = await new Promise((res, rej) => new TTFLoader().load('assets/fonts/BarlowCondensed-ExtraBold.ttf', res, undefined, rej));
  FONT = new Font(json);
  G = await build();
  if (G.clouds) {
    const cw = 2048, chh = 1024, c = document.createElement('canvas'); c.width = cw; c.height = chh; const x = c.getContext('2d'), img = x.createImageData(cw, chh);
    const h3 = (a, b, c2) => { let n = Math.sin(a * 127.1 + b * 311.7 + c2 * 74.7) * 43758.5453; return n - Math.floor(n); };
    const n3 = (px, py, pz) => { const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz); let fx = px - ix, fy = py - iy, fz = pz - iz; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
      const L = (a, b, k) => a + (b - a) * k;
      return L(L(L(h3(ix, iy, iz), h3(ix + 1, iy, iz), fx), L(h3(ix, iy + 1, iz), h3(ix + 1, iy + 1, iz), fx), fy), L(L(h3(ix, iy, iz + 1), h3(ix + 1, iy, iz + 1), fx), L(h3(ix, iy + 1, iz + 1), h3(ix + 1, iy + 1, iz + 1), fx), fy), fz); };
    const fbm = (px, py, pz, o) => { let a = 0.5, s2 = 0; for (let i = 0; i < o; i++) { s2 += a * n3(px, py, pz); px *= 2.03; py *= 2.03; pz *= 2.03; a *= 0.5; } return s2; };
    for (let j = 0; j < chh; j++) { const lat = (0.5 - (j + 0.5) / chh) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat), band = 0.6 - 0.1 * smooth((Math.abs(sl) - 0.05) / 0.3) + 0.06 * smooth((Math.abs(sl) - 0.45) / 0.35);
      for (let i = 0; i < cw; i++) { const lon = ((i + 0.5) / cw) * 2 * Math.PI - Math.PI, nx = cl * Math.sin(lon), ny = sl, nz = cl * Math.cos(lon);
        const wx = fbm(nx * 3, ny * 3, nz * 3, 3) * 1.84, wy = fbm(nx * 3 + 5.2, ny * 3 + 5.2, nz * 3 + 5.2, 3) * 1.84;
        const v = fbm(nx * 7 + wx, ny * 7 + wy, nz * 7, 5), a2 = smooth((v - band) / 0.16) * 0.62, k = (j * cw + i) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.round(a2 * 255); } }
    x.putImageData(img, 0, 0); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.NoColorSpace;
    G.clouds.material = addLD(new THREE.ShaderMaterial({ uniforms: { cloudK: { value: 1 }, camPos: { value: camera.position }, map: { value: tex } }, transparent: true, depthWrite: false,
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float cloudK; uniform vec3 camPos; uniform sampler2D map; varying vec3 vW;
        void main(){ vec3 n = normalize(vW); float lat = asin(n.y), lon = atan(n.x, n.z);
          float a = texture2D(map, vec2(lon / 6.2831853 + 0.5, 0.5 - lat / 3.14159265)).a * cloudK;
          vec3 v = normalize(camPos - vW); a *= smoothstep(0.0, 0.25, max(dot(n, v), 0.0));
          gl_FragColor = vec4(vec3(0.97, 0.98, 1.0), a); }` }));
  }
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 2 }));
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.85, 0.55, 0.96); composer.addPass(bloomPass);
  gradePass = new ShaderPass(GRADE); composer.addPass(gradePass);
  const ov = G.ov;
  if (['A', 'F', 'I', 'K', 'L'].includes(SHOT)) {
    S3.arcs = worldArcs(); S3.lanes = lanesTubes();
    S3.pil = [HORMUZ, BAB, MALACCA].map(p => makePillar(...p, 120, AMB3));
    S3.shock = [HORMUZ, BAB, MALACCA].map(p => makeShock(...p, RED3));
  }
  if (SHOT === 'B' || SHOT === 'D') {
    const hzOut = R_([[26.3, 53.0], [26.43, 55.0], [26.42, 55.6], [26.52, 55.9], [26.66, 56.2], [26.62, 56.45], [26.42, 56.66], [26.05, 56.85], [25.55, 57.2], [24.8, 58.0], [23.6, 59.6]], 2);
    const hzIn = ov.routes.slice(4).map(r => R_(r.slice().reverse().concat([[26.5, 55.6], [26.62, 56.2]]), 3));
    const hzSea = ov.routes.slice(0, 4).map(r => R_([[26.05, 56.85], ...r], 4));
    S3.fleet = makeFleet([{ rs: hzOut, w: 2.4, lane: 2.4 }, ...hzIn.map(rs => ({ rs, w: 0.7, oneWay: true, lane: 0 })), ...hzSea.map(rs => ({ rs, w: 0.4, lane: 3 }))], SHOT === 'B' ? 150 : 200, { len: SHOT === 'B' ? 2.6 : 4.5, sigma: 2.4, speed: 5, seed: 21, center: [26.5, 56.4], radius: SHOT === 'B' ? 110 : 260 });
    S3.gap = makeTube([ll(...ov.gap.a, 0.4), ll(...ov.gap.b, 0.4)], 0.12, WHITE3, { inten: 1.8, flow: 0 });
    if (SHOT === 'B') S3.t39 = makeText('39 KM', 8, { side: 0xffb43a });
    if (SHOT === 'D') {
      S3.pil = makePillar(...HORMUZ, 34, AMB3);
      S3.t20 = makeText('20M', 92); S3.tB = makeText('BARRELS A DAY', 25, { face: 0xffc66a, side: 0x8a5a20 });
      S3.t5 = makeText('1/5', 92); S3.tW = makeText("OF THE WORLD'S OIL", 25, { face: 0xffc66a, side: 0x8a5a20 });
    }
  }
  if (SHOT === 'E') {
    const rs = R_(ov.main, 3);
    S3.fleet = makeFleet([{ rs, lane: 3.5 }], 130, { len: 3.2, sigma: 4.0, speed: 7, seed: 31, center: BAB, radius: 170 });
    const tA = word('attack');
    S3.blasts = [[12.66, 43.33, tA - 0.05, 9], [12.9, 43.05, tA + 0.3, 7], [12.47, 43.66, tA + 0.6, 8]].map(([la, lo, t0, s]) => ({ b: makeBlast(la, lo, s), t0, la, lo }));
    S3.pil = makePillar(12.6, 43.6, 16, WHITE3);
    S3.t54 = makeText('−54%', 66, { face: 0xffffff, side: 0xff4a3d });
    S3.gap = makeTube([ll(...ov.gap.a, 0.4), ll(...ov.gap.b, 0.4)], 0.25, WHITE3, { inten: 1.8, flow: 0 });
  }
  if (SHOT === 'F') {
    S3.cape = makeTube(R_(CAPE_ROUTE, 30).pts.map(p => ll(p[0], p[1], 40)), 22, AMB3, { inten: 3.6 });
    S3.t15 = makeText('+15 DAYS', 700, { side: 0xffb43a });
  }
  if (SHOT === 'G') {
    const rs = R_(ov.main, 3);
    S3.fleet = makeFleet([{ rs, lane: 2.0 }], 170, { len: 1.8, sigma: 1.7, speed: 3, seed: 41, center: [1.2, 103.7], radius: 75 });
    S3.t27 = makeText('2.7 KM', 4.6);
  }
  if (SHOT === 'I') { S3.tM = makeText('23.2M', 520); S3.tH = makeText('20.9M', 520, { face: 0xdfe6ec, side: 0x7d8a96 }); S3.lM = makeText('MALACCA', 190, { face: 0xffc66a, side: 0x8a5a20 }); S3.lH = makeText('HORMUZ', 190, { face: 0xdfe6ec, side: 0x7d8a96 }); }
  if (SHOT === 'L') { S3.t1 = makeText('THREE', 860); S3.t2 = makeText('STRAITS', 860); S3.t3 = makeText('THAT MOVE THE WORLD', 290, { face: 0xffc66a, side: 0x8a5a20 }); }
  window.__ready = true;
}

function drawShot(t) {
  const look = ll(...camAt(t).slice(0, 2), 0);
  let flash = 0, fade = 0, redwash = 0;
  if (SHOT === 'A') {
    const tTh = word('three');
    S3.lanes.forEach((L, i) => L.set(easeInOut((t - 0.1 - i * 0.12) / 2.2), t, null, 1));
    S3.arcs.forEach((A, i) => A.tube.set(easeInOut((t - 0.6 - i * 0.18) / 1.6), t));
    S3.pil.forEach((P, i) => { const t0 = tTh + i * 0.3, k = easeExpo((t - t0) / 0.8); P.set(3800 * k, smooth((t - t0) / 0.15), AMB3, t); });
    flash = [0, 1, 2].reduce((m, i) => Math.max(m, 0.35 * (1 - smooth((t - tTh - i * 0.3) / 0.12)) * (t >= tTh + i * 0.3 ? 1 : 0)), 0);
  }
  if (SHOT === 'B' || SHOT === 'D') {
    S3.fleet.update(t, { alpha: SHOT === 'B' ? smooth((t - 6.6) / 0.8) : 1 });
    if (SHOT === 'B') {
      const t3 = word('thirty') - 0.15;
      S3.gap.set(easeInOut((t - t3) / 0.6), t);
      placeText(S3.t39, 26.62, 56.42, 0, t, t3 + 0.2, 1e9, { lean: 0.55 });
    } else {
      S3.gap.set(1, t, null, 1 - smooth((t - 11.5) / 1.0));
      const t0 = 10.42, k = easeExpo((t - t0) / 1.4);
      S3.pil.set(1500 * k, smooth((t - t0) / 0.12), AMB3, t);
      flash = 0.5 * (1 - smooth((t - t0) / 0.15)) * (t >= t0 ? 1 : 0);
      const tf = word('fifth') - 0.2;
      const ca = camAt(t)[2], al = 0.12 * ca, sz = ca / 900;
      for (const T of [S3.t20, S3.tB, S3.t5, S3.tW]) T.group.scale.setScalar(sz);
      placeText(S3.t20, ...HORMUZ, al + 40 * sz, t, 10.65, tf, { lean: 0.9, dx: -100 * sz });
      placeText(S3.tB, ...HORMUZ, al - 25 * sz, t, 10.9, tf, { lean: 0.9, stagger: 0.02, dx: -100 * sz });
      placeText(S3.t5, ...HORMUZ, al + 40 * sz, t, tf + 0.25, 1e9, { lean: 0.9, dx: -100 * sz });
      placeText(S3.tW, ...HORMUZ, al - 25 * sz, t, tf + 0.45, 1e9, { lean: 0.9, stagger: 0.02, dx: -100 * sz });
    }
  }
  if (SHOT === 'E') {
    const tA = word('attack'), tH = word('half') - 0.2;
    const redAt = (la, lo) => S3.blasts.reduce((m, B) => Math.max(m, t > B.t0 ? smooth((t - B.t0) / 0.3) * (1 - smooth((distKm([la, lo], [B.la, B.lo]) - 22) / 25)) : 0), 0) * 0.6 + 0.4 * smooth((t - tH) / 0.3);
    S3.fleet.update(halt(t, tA + 0.4, 1.2), { redAt });
    S3.blasts.forEach(B => B.b.set(t, B.t0));
    S3.gap.set(easeInOut((t - 17.25) / 0.6), t, null, 1 - smooth((t - 18.8) / 0.4));
    const tO = word('oil', 2) - 0.1, h = t < tH ? 760 * easeExpo((t - tO) / 0.9) : 760 - 410 * easeExpo((t - tH) / 0.45);
    const colP = WHITE3.clone().lerp(RED3, smooth((t - tH) / 0.3));
    S3.pil.set(h, smooth((t - tO) / 0.15), colP, t);
    placeText(S3.t54, 12.6, 43.6, h + 18, t, tH + 0.12, 1e9, { lean: 0.8 });
    flash = S3.blasts.reduce((m, B) => Math.max(m, 0.45 * (t >= B.t0 ? 1 - smooth((t - B.t0) / 0.12) : 0)), 0);
    redwash = 0.25 * smooth((t - tA) / 0.3) * (1 - smooth((t - tA - 1.5) / 1.0)) + 0.18 * smooth((t - tH) / 0.3);
  }
  if (SHOT === 'F' || SHOT === 'K' || SHOT === 'I' || SHOT === 'L') {
    const base = SHOT === 'F' ? [0, 1, 1, 1, 1, 1, 1, 1, 1] : null;
    S3.lanes.forEach(L => L.set(1, t, null, SHOT === 'L' ? 0.6 : 1));
    S3.arcs.forEach((A, i) => A.tube.set(1, t, null, 1));
    S3.pil.forEach(P => P.set(0, 0, AMB3, t));
  }
  if (SHOT === 'F') {
    const tA = word('around'), tF = word('fifteen') - 0.2;
    S3.arcs.forEach((A, i) => { const suez = (A.a === BAB && A.b === SUEZ) || (A.a === SUEZ && A.b === ROTT); A.tube.set(1, t, suez ? RED3 : null, suez ? 0.45 : 0.55); });
    S3.pil[1].set(900, 0.8, RED3, t);
    S3.cape.set(easeInOut((t - tA + 0.3) / 2.2), t);
    placeText(S3.t15, -31.0, 24.0, 900, t, tF, 1e9, { screen: true });
  }
  if (SHOT === 'G') {
    S3.fleet.update(t + 30);
    placeText(S3.t27, 1.26, 103.7, 0, t, word('three', 1) - 0.1, 1e9, { lean: 0.6 });
  }
  if (SHOT === 'I') {
    const tO = word('oil', 3) - 0.25, tH = word('hormuz', 1) - 0.2;
    const kM = easeExpo((t - tO) / 1.0), kH = easeExpo((t - tH) / 1.0);
    S3.pil[2].set(2550 * kM, smooth((t - tO) / 0.12), AMB3, t);
    S3.pil[0].set(2300 * kH, smooth((t - tH) / 0.12), new THREE.Color(0.75, 0.85, 1.0), t);
    const [cla, clo] = camAt(t);
    placeText(S3.tM, cla, clo, 0, t, tO + 0.15, 1e9, { screen: true, dy: -300, dx: 1000 }); placeText(S3.lM, cla, clo, 0, t, tO + 0.35, 1e9, { screen: true, dy: -650, dx: 1000, stagger: 0.02 });
    placeText(S3.tH, cla, clo, 0, t, tH + 0.15, 1e9, { screen: true, dy: 3300, dx: -1100 }); placeText(S3.lH, cla, clo, 0, t, tH + 0.35, 1e9, { screen: true, dy: 2950, dx: -1100, stagger: 0.02 });
    flash = Math.max(t >= tO ? 0.3 * (1 - smooth((t - tO) / 0.12)) : 0, t >= tH ? 0.3 * (1 - smooth((t - tH) / 0.12)) : 0);
  }
  if (SHOT === 'K') {
    const tB = word('block'), tFe = word('feels');
    const reds = [tB + 0.12, word('any') + 0.05, word('one') + 0.08];
    S3.pil.forEach((P, i) => { const r = smooth((t - reds[i]) / 0.15); P.set(1700 + 300 * r, 1, AMB3.clone().lerp(RED3, r), t); S3.shock[i].set(80 + 2600 * easeExpo((t - reds[i]) / 1.6), t > reds[i] ? 1 - smooth((t - reds[i]) / 1.6) : 0); });
    const dead = smooth((t - tB - 0.6) / 1.0);
    S3.arcs.forEach(A => A.tube.set(1, halt(t, tB + 0.3), RED3.clone().lerp(new THREE.Color(0.4, 0.05, 0.05), dead), 1 - 0.6 * dead));
    S3.lanes.forEach(L => L.set(1, halt(t, tB + 0.3), null, 1 - 0.85 * dead));
    flash = reds.reduce((m, r) => Math.max(m, t >= r ? 0.4 * (1 - smooth((t - r) / 0.1)) : 0), 0) + (t >= tFe ? 0.25 * (1 - smooth((t - tFe) / 0.2)) : 0);
    redwash = 0.35 * smooth((t - tB) / 0.4);
    fade = smooth((t - 38.2) / 0.4);
  }
  if (SHOT === 'L') {
    S3.pil.forEach((P, i) => P.set(900, 0.7, RED3, t));
    S3.arcs.forEach(A => A.tube.set(1, t, null, 0.5));
    const c0 = camAt(t), lat = c0[0], lon = c0[1];
    placeText(S3.t1, lat, lon, 6200, t, 38.7, 1e9, { screen: true, dy: 600, stagger: 0.06, dur: 0.9 });
    placeText(S3.t2, lat, lon, 6200, t, 38.95, 1e9, { screen: true, dy: -420, stagger: 0.06, dur: 0.9 });
    placeText(S3.t3, lat, lon, 6200, t, 39.6, 1e9, { screen: true, dy: -950, stagger: 0.02, dur: 0.8 });
    fade = 1 - smooth((t - 38.55) / 0.5);
    // a light that sweeps across the metal faces
    lightRig.sun.intensity = 1.7 + 1.1 * Math.max(0, Math.sin((t - 39.2) * 1.4));
  }
  return { look, flash, fade, redwash };
}

window.renderAt = function (t) {
  const cam = placeCamera(t);
  G.limb.material.uniforms.limbK.value = 0.35 + 0.65 * smooth((cam.alt - 300) / 1500);
  G.clouds.material.uniforms.cloudK.value = 0.85 * smooth((cam.alt - 1200) / 3500); G.clouds.visible = G.clouds.material.uniforms.cloudK.value > 0.01;
  const fx = drawShot(t);
  aimLights(fx.look);
  const u = gradePass.uniforms; u.time.value = t; u.flash.value = fx.flash; u.fade.value = fx.fade; u.redwash.value = fx.redwash;
  bloomPass.strength = (SHOT === 'L' ? 0.45 : 0.85) + 0.6 * fx.flash;
  composer.render();
  return true;
};
init();
