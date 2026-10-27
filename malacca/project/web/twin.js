// "Digital twin" shots: procedural ships on a stylised ocean with HUD overlays.
// shot=C: ships in the strait with data tags; shot=D: gold oil-flow network.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const q = new URLSearchParams(location.search);
const W = +(q.get('w') || 1920), H = +(q.get('h') || 1080), S = Math.min(W, H) / 1080;
const SHOT = q.get('shot') || 'C';
const HUDONLY = q.get('hudonly') === '1';   // overlay only, for compositing over real footage
const T0 = SHOT === 'C' ? 5.95 : 9.35;   // where this shot starts on the voiceover timeline
const CYAN = '56,200,255', GOLD = '255,196,64';
const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp01(x), 3);
const easeInOut = x => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
let seed = SHOT === 'C' ? 21 : 77;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// ---------- renderer ----------
const glc = document.getElementById('gl'), ovc = document.getElementById('ov');
for (const c of [glc, ovc]) { c.width = W; c.height = H; c.style.width = W + 'px'; c.style.height = H + 'px'; }
const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 2, 30000);
const HORIZON = new THREE.Color(SHOT === 'C' ? 0x8fb4d2 : 0x1d3a58), ZENITH = new THREE.Color(SHOT === 'C' ? 0x2c5f8e : 0x07111f);
const SUN = new THREE.Vector3(-0.55, 0.42, -0.72).normalize();

scene.add(new THREE.HemisphereLight(0xbfd9f2, 0x0d2238, SHOT === 'C' ? 1.1 : 0.55));
const sunL = new THREE.DirectionalLight(0xfff1dc, SHOT === 'C' ? 2.6 : 1.1); sunL.position.copy(SUN).multiplyScalar(1000); scene.add(sunL);

// sky dome
scene.add(new THREE.Mesh(new THREE.SphereGeometry(20000, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: { hz: { value: HORIZON }, zn: { value: ZENITH } },
  vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform vec3 hz, zn; varying vec3 vD; void main(){ float h = clamp(vD.y*3.0, 0.0, 1.0); gl_FragColor = vec4(mix(hz, zn, pow(h, 0.6)), 1.0); }`,
})));

// ocean: analytic ripples for glints, Fresnel sky reflection, fog, optional glowing grid
const oceanU = {
  time: { value: 0 }, sunDir: { value: SUN }, camPos: { value: new THREE.Vector3() },
  deep: { value: new THREE.Color(SHOT === 'C' ? 0x0b3352 : 0x061626) }, sky: { value: HORIZON }, zn: { value: ZENITH },
  gridCol: { value: new THREE.Color(SHOT === 'C' ? 0x38c8ff : 0xffc440) }, gridA: { value: SHOT === 'C' ? 0.10 : 0.55 }, gridStep: { value: SHOT === 'C' ? 120 : 160 },
  fogD: { value: SHOT === 'C' ? 5200 : 4200 },
};
const ocean = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000, 1, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
  uniforms: oceanU,
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `
    uniform float time, gridA, gridStep, fogD; uniform vec3 sunDir, camPos, deep, sky, zn, gridCol; varying vec3 vW;
    vec2 wave(vec2 p, vec2 d, float k, float sp, float a){ float ph = dot(p,d)*k + time*sp; return d * (a*k*cos(ph)); }
    void main(){
      vec2 p = vW.xz; vec2 g = vec2(0.0);
      g += wave(p, normalize(vec2(1.0,0.3)), 0.09, 1.3, 0.55);
      g += wave(p, normalize(vec2(0.6,-1.0)), 0.16, 1.9, 0.30);
      g += wave(p, normalize(vec2(-0.8,0.5)), 0.31, 2.6, 0.13);
      g += wave(p, normalize(vec2(0.2,1.0)), 0.53, 3.4, 0.07);
      g += wave(p, normalize(vec2(-1.0,-0.2)), 0.97, 4.1, 0.035);
      vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
      vec3 v = normalize(camPos - vW);
      float fr = 0.02 + 0.98*pow(1.0 - max(dot(n, v), 0.0), 5.0);
      vec3 r = reflect(-v, n);
      vec3 skyc = mix(sky, zn, clamp(r.y*2.5, 0.0, 1.0));
      vec3 c = mix(deep, skyc, fr);
      float spec = pow(max(dot(r, sunDir), 0.0), 220.0);
      c += vec3(1.0,0.95,0.85) * spec * 2.4;
      // glowing grid
      vec2 gc = abs(fract(p/gridStep - 0.5) - 0.5) / fwidth(p/gridStep);
      float line = 1.0 - min(min(gc.x, gc.y), 1.0);
      float dist = length(vW - camPos);
      c += gridCol * line * gridA * exp(-dist/2500.0);
      float f = 1.0 - exp(-dist/fogD);
      c = mix(c, sky, clamp(f*1.05, 0.0, 1.0));
      gl_FragColor = vec4(c, 1.0);
    }`,
}));
scene.add(ocean);

// ---------- procedural ships ----------
const BOX = new THREE.BoxGeometry(1, 1, 1);
const PALETTE = [0xb43a2c, 0x2f5f9e, 0xd8d8d2, 0xd77a28, 0x3f7d4a, 0x7a7f86, 0x7d2430, 0x1f8ea0, 0xc9a43a].map(c => new THREE.Color(c));
function hullShape(L, B) {
  const s = new THREE.Shape(), h = B / 2;
  s.moveTo(-L / 2, -h * 0.92); s.lineTo(L * 0.28, -h); s.bezierCurveTo(L * 0.42, -h, L * 0.49, -h * 0.45, L / 2, 0);
  s.bezierCurveTo(L * 0.49, h * 0.45, L * 0.42, h, L * 0.28, h); s.lineTo(-L / 2, h * 0.92); s.closePath(); return s;
}
function makeShip(type, L) {
  const B = L * (type === 'container' ? 0.15 : 0.18), grp = new THREE.Group();
  const ext = (sh, d) => new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false, curveSegments: 16 }).rotateX(-Math.PI / 2);
  const hull = new THREE.Mesh(ext(hullShape(L, B), 13), new THREE.MeshStandardMaterial({ color: type === 'tanker' ? 0x22303e : 0x1a2636, roughness: 0.55, metalness: 0.2 }));
  hull.position.y = -4; grp.add(hull);
  const boot = new THREE.Mesh(ext(hullShape(L * 1.003, B * 1.02), 2.2), new THREE.MeshStandardMaterial({ color: 0x8e2a22, roughness: 0.6 }));
  boot.position.y = -4; grp.add(boot);
  const deck = new THREE.Mesh(ext(hullShape(L * 0.985, B * 0.96), 0.6), new THREE.MeshStandardMaterial({ color: type === 'tanker' ? 0x6b2f27 : 0x39424d, roughness: 0.8 }));
  deck.position.y = 9; grp.add(deck);
  if (type === 'container') {
    const bays = Math.floor((L * 0.66) / 13.2), rows = Math.floor(B * 0.9 / 2.5), n = bays * rows * 7;
    const im = new THREE.InstancedMesh(BOX, new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.1 }), n);
    const m = new THREE.Matrix4(); let k = 0;
    for (let b = 0; b < bays; b++) for (let r = 0; r < rows; r++) {
      const tiers = 3 + Math.floor(rnd() * 5);
      for (let tr = 0; tr < tiers; tr++) {
        m.makeScale(12.0, 2.5, 2.35); m.setPosition(-L * 0.24 + b * 13.2 - L * 0.04, 10.9 + tr * 2.6, (r - (rows - 1) / 2) * 2.5);
        im.setMatrixAt(k, m); im.setColorAt(k, PALETTE[Math.floor(rnd() * PALETTE.length)].clone().multiplyScalar(0.8 + rnd() * 0.3)); k++;
      }
    }
    im.count = k; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; grp.add(im);
  } else {
    // tanker deck: pipelines + manifold
    const pm = new THREE.MeshStandardMaterial({ color: 0x9aa4ad, roughness: 0.5, metalness: 0.5 });
    for (const z of [-B * 0.12, 0, B * 0.12]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, L * 0.7, 6).rotateZ(Math.PI / 2), pm); p.position.set(L * 0.05, 10.4, z); grp.add(p); }
    const man = new THREE.Mesh(BOX, pm); man.scale.set(4, 3, B * 0.7); man.position.set(L * 0.02, 11, 0); grp.add(man);
  }
  // superstructure aft
  const sm = new THREE.MeshStandardMaterial({ color: 0xeef1f4, roughness: 0.5 });
  const blk = new THREE.Mesh(BOX, sm); blk.scale.set(L * 0.07, 24, B * 0.86); blk.position.set(-L * 0.41, 21, 0); grp.add(blk);
  const wing = new THREE.Mesh(BOX, sm); wing.scale.set(L * 0.05, 2, B * 1.05); wing.position.set(-L * 0.405, 33.5, 0); grp.add(wing);
  const win = new THREE.Mesh(BOX, new THREE.MeshStandardMaterial({ color: 0x1b2633, roughness: 0.2, metalness: 0.6 }));
  win.scale.set(L * 0.072, 1.6, B * 0.87); win.position.set(-L * 0.41, 31, 0); grp.add(win);
  const fun = new THREE.Mesh(BOX, new THREE.MeshStandardMaterial({ color: 0x1d2b3c })); fun.scale.set(L * 0.035, 12, B * 0.25); fun.position.set(-L * 0.455, 38, 0); grp.add(fun);
  const band = new THREE.Mesh(BOX, new THREE.MeshStandardMaterial({ color: 0xc23a2e })); band.scale.set(L * 0.036, 2.5, B * 0.255); band.position.set(-L * 0.455, 41, 0); grp.add(band);
  // foam wake + bow wave
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(L * 1.7, B * 2.4, 1, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { time: oceanU.time, Lh: { value: L } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float time; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        float x = 1.0 - vUv.x;                      // 0 at the stern, 1 at the far end
        float spread = 0.1 + x*0.38;               // V-shaped wake widens behind the ship
        float d = abs(vUv.y - 0.5) / spread;
        float core = smoothstep(1.0, 0.2, d) * (1.0 - x);
        float edge = smoothstep(0.25, 0.0, abs(d - 0.9)) * (1.0 - x) * 0.7;
        float foam = n(vec2(vUv.x*60.0 + time*3.0, vUv.y*25.0)) * 0.6 + n(vec2(vUv.x*140.0 + time*5.0, vUv.y*60.0)) * 0.4;
        float a = clamp((core*0.8 + edge*0.8) * smoothstep(0.35, 0.9, foam), 0.0, 1.0) * (1.0 - x*0.7);
        gl_FragColor = vec4(vec3(0.93,0.96,1.0), a*0.6);
      }`,
  }));
  wake.position.set(-L * 1.33, 0.4, 0); grp.add(wake);
  grp.userData = { L, B, type };
  return grp;
}

// ---------- scene content per shot ----------
const ships = [];   // {grp, x0, z, v, dir, tag}
function addShip(type, L, x0, z, v, tag) {
  const g = makeShip(type, L); if (v < 0) g.rotation.y = Math.PI;
  scene.add(g); ships.push({ g, x0, z, v, tag }); return g;
}
const tubes = [];
function glowTube(points, radius, rgb, opts = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { prog: { value: 0 }, time: oceanU.time, col: { value: new THREE.Color(`rgb(${rgb})`) }, pulse: { value: opts.pulse || 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float prog, time, pulse; uniform vec3 col; varying vec2 vUv;
      void main(){ if (vUv.x > prog) discard;
        float p = pulse > 0.0 ? smoothstep(0.06, 0.0, abs(fract(vUv.x*3.0 - time*pulse) - 0.5) - 0.44) : 0.0;
        vec3 c = col*1.05 + vec3(1.0,0.9,0.6)*p*0.9; gl_FragColor = vec4(c, 0.8); }`,
  });
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 240, radius, 8, false), mat);
  scene.add(m); tubes.push({ m, ...opts }); return m;
}

if (SHOT === 'C') {
  addShip('container', 300, 0, 0, 12, ['CONTAINER SHIP', '14.2 KN', 'HDG 128°', 'DEST  SHANGHAI']);
  addShip('tanker', 250, 340, -230, 10, ['CRUDE TANKER', '12.8 KN', 'HDG 126°', 'DEST  NINGBO']);
  addShip('container', 260, 120, 260, -11, ['CONTAINER SHIP', '13.6 KN', 'HDG 308°', 'DEST  ROTTERDAM']);
  addShip('tanker', 230, -420, 420, -9, ['PRODUCT TANKER', '11.9 KN', 'HDG 306°', 'DEST  JEDDAH']);
  addShip('container', 280, 820, 120, 12, ['CONTAINER SHIP', '15.1 KN', 'HDG 127°', 'DEST  BUSAN']);
  for (let i = 0; i < 16; i++) {
    const far = 900 + rnd() * 3000, side = rnd() < 0.5 ? -1 : 1;
    addShip(rnd() < 0.5 ? 'container' : 'tanker', 180 + rnd() * 120, -1500 + rnd() * 5000, side * (300 + rnd() * 1400) - (far - 900) * 0.3, (rnd() < 0.5 ? 1 : -1) * (9 + rnd() * 4), null);
  }
  // traffic-separation lanes as faint glowing lines
  for (const z of [-160, 60]) glowTube([[-3000, 1.2, z], [0, 1.2, z], [6000, 1.2, z]], 0.55, CYAN, { start: 0.5, dur: 1.2 });
} else {
  // oil-flow network: barrel clusters and container stacks joined by gold lines
  const nodes = [[0, 0], [-650, -380], [-720, 360], [520, -480], [640, 420], [-160, 820], [180, -900], [1150, 40], [-1300, -60]];
  const bm = new THREE.MeshStandardMaterial({ color: 0x2b3440, metalness: 0.7, roughness: 0.35, emissive: 0x2a1a00 });
  const rim = new THREE.MeshBasicMaterial({ color: 0xffc440 });
  nodes.forEach(([x, z], i) => {
    const barrels = i % 3 !== 1;
    for (let k = 0; k < (barrels ? 5 : 4); k++) {
      const a = k / 5 * Math.PI * 2, r = k === 0 ? 0 : 26;
      if (barrels) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 48, 20), bm); b.position.set(x + Math.cos(a) * r * 1.45, 24, z + Math.sin(a) * r * 1.45); scene.add(b);
        for (const yy of [8, 24, 40]) { const rg = new THREE.Mesh(new THREE.TorusGeometry(16.3, 1.1, 6, 24).rotateX(Math.PI / 2), rim); rg.position.set(b.position.x, yy, b.position.z); scene.add(rg); }
      } else {
        const c = new THREE.Mesh(BOX, new THREE.MeshStandardMaterial({ color: PALETTE[k * 2 % PALETTE.length], roughness: 0.6 })); c.scale.set(36, 15, 15);
        c.position.set(x + (k % 2) * 40 - 20, 7.5 + Math.floor(k / 2) * 15.5, z); scene.add(c);
        scene.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(36, 15, 15)), new THREE.LineBasicMaterial({ color: 0xffc440 })).translateX(c.position.x).translateY(c.position.y).translateZ(c.position.z));
      }
    }
    // glowing base ring
    const ring = new THREE.Mesh(new THREE.RingGeometry(66, 73, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffc440, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    ring.position.set(x, 0.6, z); scene.add(ring);
  });
  const links = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 8], [2, 5], [3, 6], [4, 7], [2, 8], [3, 7], [1, 6], [4, 5]];
  links.forEach(([a, b], i) => {
    const [x0, z0] = nodes[a], [x1, z1] = nodes[b];
    const mx = (x0 + x1) / 2 + (z1 - z0) * 0.18, mz = (z0 + z1) / 2 - (x1 - x0) * 0.18;
    glowTube([[x0, 1.5, z0], [mx, 1.5, mz], [x1, 1.5, z1]], 3.2, GOLD, { start: 0.15 + i * 0.07, dur: 0.8, pulse: 0.8 });
  });
  addShip('tanker', 260, -900, -140, 14, null);
  addShip('tanker', 240, 900, 230, -13, null);
}

// ---------- post ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), SHOT === 'C' ? 0.45 : 0.55, 0.45, 0.86));
composer.addPass(new OutputPass());

// ---------- camera ----------
function placeCamera(t) {
  if (SHOT === 'C') {
    const hx = 12 * t;  // follow the hero ship
    const k = easeInOut(t / 3.6);
    camera.position.set(hx - 300 + 140 * k, 120 - 25 * k, 250 - 70 * k);
    camera.lookAt(hx + 40 + 30 * k, 12, 10);
  } else {
    const k = easeInOut(t / 3.2), an = -0.9 + 0.5 * k, r = 1450 - 250 * k;
    camera.position.set(Math.cos(an) * r, 600 - 120 * k, Math.sin(an) * r);
    camera.lookAt(0, 0, 0);
  }
  camera.updateMatrixWorld();
  oceanU.camPos.value.copy(camera.position);
}

// ---------- 2D overlay ----------
const ctx = ovc.getContext('2d');
function proj(v) { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H, ok: p.z < 1 && p.z > -1 }; }
function tLabel(str, x, y, { size = 40, weight = 700, color = '#fff', alpha = 1, align = 'center', spacing = 2, glow = null } = {}) {
  if (alpha <= 0.003) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.font = `${weight} ${size * S}px Rajdhani`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.letterSpacing = `${spacing * S}px`;
  ctx.shadowColor = glow ? `rgba(${glow},0.85)` : 'rgba(0,0,0,0.7)'; ctx.shadowBlur = (glow ? 18 : 10) * S;
  ctx.fillStyle = color; ctx.fillText(str, x, y); ctx.restore();
}
function glowLine(x0, y0, x1, y1, w, a, rgb) {
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(${rgb},${a * 0.35})`; ctx.lineWidth = w * 4; ctx.filter = `blur(${4 * S}px)`; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.filter = 'none';
  ctx.strokeStyle = `rgba(${rgb},${a})`; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore();
}
function tag(p, lines, a, dx, dy) {
  if (a <= 0 || !p.ok) return;
  const x = p.x + dx * S, y = p.y + dy * S, w = 230 * S, h = 112 * S;
  ctx.save(); ctx.globalAlpha = a;
  ctx.strokeStyle = `rgba(${CYAN},0.9)`; ctx.lineWidth = 1.6 * S; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(x, y + h); ctx.stroke();
  ctx.fillStyle = 'rgba(5,18,32,0.78)'; ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = `rgb(${CYAN})`; ctx.fillRect(x, y, w, 26 * S);
  ctx.beginPath(); ctx.arc(p.x, p.y, 5 * S, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.restore();
  tLabel(lines[0], x + 10 * S, y + 13 * S, { size: 20, weight: 700, color: '#04121f', align: 'left', alpha: a, spacing: 2 });
  tLabel(`SPD  ${lines[1]}`, x + 10 * S, y + 44 * S, { size: 22, weight: 600, align: 'left', alpha: a, spacing: 1 });
  tLabel(lines[2], x + 128 * S, y + 44 * S, { size: 22, weight: 600, align: 'left', alpha: a, spacing: 1 });
  tLabel(lines[3], x + 10 * S, y + 80 * S, { size: 24, weight: 700, align: 'left', alpha: a, spacing: 2, color: `rgb(${CYAN})` });
}

let VO = null;
const word = (w, n = 0) => VO.words.filter(x => x.w.replace(/\(\d\)$/, '') === w)[n].s - T0;
function drawOverlay(t) {
  ctx.clearRect(0, 0, W, H);
  if (SHOT === 'C') {
    const tagged = HUDONLY ? [] : ships.filter(s => s.tag);
    const pos = tagged.map(s => proj(s.g.position.clone().add(new THREE.Vector3(0, 30, 0))));
    // network lines between tagged ships
    const aN = smooth((t - 0.5) / 0.5);
    for (let i = 1; i < pos.length; i++) {
      const k = easeOut((t - 0.5 - i * 0.12) / 0.6);
      if (pos[0].ok && pos[i].ok && k > 0) glowLine(pos[0].x, pos[0].y, pos[0].x + (pos[i].x - pos[0].x) * k, pos[0].y + (pos[i].y - pos[0].y) * k, 2 * S, aN * 0.9, CYAN);
    }
    const offs = [[70, -230], [60, -200], [-300, -190], [-300, -170], [60, -180]];
    tagged.forEach((s, i) => tag(pos[i], s.tag, smooth((t - 0.35 - i * 0.18) / 0.3), ...offs[i]));
    // counter
    const tc = word('hundred') - 0.2, a = smooth((t - tc) / 0.3), n = Math.round(102500 * easeOut((t - tc) / 1.3));
    if (HUDONLY) {
      const x = 110 * S, y = H * 0.12, w = 590 * S, h = 190 * S;
      if (a > 0) {
        ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 24 * S; ctx.shadowOffsetY = 8 * S;
        ctx.fillStyle = 'rgba(9,17,27,0.86)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 10 * S); ctx.fill(); ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#ff9a1f'; ctx.beginPath(); ctx.roundRect(x, y, 6 * S, h, [10 * S, 0, 0, 10 * S]); ctx.fill();
        const f = (str, yy, size, weight, color) => { ctx.font = `${weight} ${size * S}px Inter`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(str, x + 44 * S, yy); };
        f(n.toLocaleString('en-US') + '+', y + 82 * S, 96, 800, '#ff9a1f');
        ctx.globalAlpha = a * smooth((t - tc - 0.3) / 0.3); f('ships passed through in 2025', y + 152 * S, 30, 600, '#fff');
        ctx.restore();
      }
    } else {
      tLabel(n.toLocaleString('en-US') + '+', 90 * S, H * 0.16, { size: 120, weight: 700, align: 'left', alpha: a, spacing: 2, glow: CYAN });
      tLabel('SHIPS THROUGH THE STRAIT IN 2025', 96 * S, H * 0.16 + 82 * S, { size: 32, weight: 700, align: 'left', alpha: a * smooth((t - tc - 0.3) / 0.3), spacing: 5, glow: '0,30,60' });
    }
  } else {
    const tt = word('third') - 0.15, a = smooth((t - tt) / 0.3);
    tLabel('≈ 29%', 90 * S, H * 0.17, { size: 130, weight: 700, align: 'left', alpha: a, color: `rgb(${GOLD})`, glow: GOLD, spacing: 2 });
    tLabel("OF THE WORLD'S SEABORNE OIL", 96 * S, H * 0.17 + 86 * S, { size: 32, weight: 700, align: 'left', alpha: a * smooth((t - tt - 0.25) / 0.3), spacing: 5 });
    const tb = word('seaborne') - 0.1, b = smooth((t - tb) / 0.3);
    tLabel('~23 MILLION BARRELS / DAY', 96 * S, H * 0.17 + 134 * S, { size: 32, weight: 600, align: 'left', alpha: b, spacing: 5, color: `rgb(${GOLD})` });
  }
  // HUD frame
  if (!HUDONLY) {
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2 * S; const m = 34 * S, l = 46 * S;
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) { ctx.beginPath(); ctx.moveTo(x, y + sy * l); ctx.lineTo(x, y); ctx.lineTo(x + sx * l, y); ctx.stroke(); }
  ctx.restore();
  }
  tLabel(HUDONLY ? 'Footage: Mixkit · Data: Marine Department Malaysia' : 'Illustrative 3D visualisation · Data: Marine Department Malaysia, EIA', W - 56 * S, H - 46 * S, { size: 15, weight: 600, align: 'right', alpha: 0.5, spacing: 1 });
}

window.renderAt = function (t) {
  oceanU.time.value = t;
  for (const s of ships) s.g.position.set(s.x0 + s.v * t, Math.sin(t * 1.3 + s.x0) * 0.3, s.z);
  for (const tb of tubes) tb.m.material.uniforms.prog.value = easeOut((t - tb.start) / tb.dur);
  placeCamera(t);
  if (!HUDONLY) composer.render();
  drawOverlay(t);
  return true;
};
(async () => {
  VO = await (await fetch('assets/vo.json')).json();
  await document.fonts.load('700 40px Rajdhani'); await document.fonts.load('600 40px Rajdhani');
  window.__ready = true;
})();
