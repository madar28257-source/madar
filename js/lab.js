// ==========================================
// 🔬 معمل العلوم المتكاملة (Three.js) — منصة مدار
// ==========================================
// المنطق العلمي في lab-engine.js ، وهنا الرسم ثلاثي الأبعاد والتحكم.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { REAGENTS, newState, add, reset, tick, view } from './lab-engine.js';

const $ = (id) => document.getElementById(id);
const S = newState();
const ctl = { heat: 0, light: 0 };
const isMobile = () => innerWidth < 900;
const rnd = Math.random;
let api = null;   // يُملأ بعد تجهيز الـ3D

// لون كل زجاجة
const BOTTLE = { hcl: 0xffe08a, naoh: 0x9fe6ff, phph: 0xff8cc6, na2co3: 0xd8e0ff, cuso4: 0x2f7dff, agno3: 0xe9e9ff, nacl: 0xf4f4f4, ki: 0xf5f0ff, pbno3: 0xf0f0ff };
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

// ---------- رسائل صغيرة ----------
let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

// ---------- الواجهة ----------
const grid = $('reagents');
Object.entries(REAGENTS).forEach(([id, r]) => {
  const b = document.createElement('button');
  b.className = 'rg'; b.type = 'button'; b.style.setProperty('--c', hex(BOTTLE[id]));
  b.innerHTML = '<span class="dot"></span><b></b><small></small>';
  b.querySelector('b').textContent = r.f; b.querySelector('small').textContent = r.n;
  b.addEventListener('click', () => (api ? api.pour(id) : toast('المعمل لسه بيتجهز...')));
  grid.appendChild(b);
});

let activeTab = 'mix';
function openTab(name) {
  activeTab = name;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === name));
  document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('on', p.id === 'pane-' + name));
  $('panel').classList.remove('collapsed');
  if (name === 'res') $('dot').hidden = true;
}
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => openTab(t.dataset.tab)));
$('grab').addEventListener('click', () => $('panel').classList.toggle('collapsed'));
$('btn-reset').addEventListener('click', () => { reset(S); lastRx = null; renderResult(); toast('اتفرّغ الكأس 🧹'); });
$('heat').addEventListener('input', (e) => { ctl.heat = e.target.value / 100; $('v-heat').textContent = e.target.value + '٪'; });
$('light').addEventListener('input', (e) => { ctl.light = +e.target.value; $('v-light').textContent = e.target.value + '°'; api && api.lamp(ctl.light); });

const OBS = { heat: (rx) => (rx.heat < 0 ? '❄️ انخفاض حرارة' : '🔥 ارتفاع حرارة'), gas: () => '🫧 غاز', color: () => '🎨 تغيّر لون', precip: () => '⬇️ راسب', light: () => '💡 يتأثر بالضوء' };
let lastRx = null;
function renderResult() {
  const rx = S.rx;
  $('res-empty').hidden = !!rx; $('res-box').hidden = !rx;
  if (!rx) return;
  $('res-name').textContent = rx.name; $('res-eq').textContent = rx.eq; $('res-why').textContent = rx.why;
  const obs = $('res-obs'); obs.textContent = '';
  rx.obs.forEach((o) => { const s = document.createElement('span'); s.textContent = OBS[o](rx); obs.appendChild(s); });
  if (activeTab !== 'res') $('dot').hidden = false;
}
function updateUI(v) {
  $('hud-temp').textContent = Math.round(S.T);
  $('hud-rx').textContent = S.rx ? `⚗️ ${S.rx.name} — ${S.p < 1 ? Math.round(S.p * 100) + '٪' : 'اكتمل'}` : S.doses ? '⚗️ أضف مادة تانية' : '⚗️ اختر مادتين لتبدأ التجربة';
  $('g-prog').style.width = (S.rx ? S.p * 100 : 0) + '%';
  $('g-cell').style.width = v.cell * 100 + '%';
  $('g-cell-t').textContent = Math.round(S.Tcell) + '°م' + (S.damage > 0.3 ? ' — تلف دائم ☠️' : '');
  if ((S.rx && S.rx.id) !== (lastRx && lastRx.id)) { lastRx = S.rx; renderResult(); }
  let live = '';
  if (S.rx && S.rx.photo && S.dark > 0.15) live = '💡 الراسب بدأ يسوّد بتأثير الضوء';
  if (S.dissolved) live = '🔥 الحرارة عالية: الراسب ذاب';
  $('res-live').textContent = live;
}

// ---------- المشهد ثلاثي الأبعاد ----------
function start3D() {
  const stage = $('stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isMobile() ? 1.75 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = !isMobile(); renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0c14);
  scene.fog = new THREE.Fog(0x0b0c14, 18, 36);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, enablePan: false, minDistance: 5, maxDistance: 22, minPolarAngle: 0.25, maxPolarAngle: Math.PI * 0.49 });

  // إضاءة
  scene.add(new THREE.HemisphereLight(0x9db4ff, 0x1a1a2e, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(-4, 9, 6); key.castShadow = !isMobile(); key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -6 }); key.shadow.camera.updateProjectionMatrix();
  scene.add(key);
  const flameLight = new THREE.PointLight(0xff9a3c, 0, 9, 2); flameLight.position.set(0, 1.6, 0); scene.add(flameLight);
  const spot = new THREE.SpotLight(0xfff1d0, 90, 22, 0.55, 0.6, 2); spot.target.position.set(0, 3.2, 0); scene.add(spot, spot.target);

  // خامات
  const glass = (op = 0.18) => new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: op, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.4 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa3b8, metalness: 0.9, roughness: 0.32 });
  const mesh = (geo, mat, x = 0, y = 0, z = 0, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };

  // الطاولة
  const bench = mesh(new THREE.BoxGeometry(16, 0.5, 9), new THREE.MeshStandardMaterial({ color: 0x1c2233, roughness: 0.28, metalness: 0.35 }), 0, -0.25, 0.4);
  bench.castShadow = false;

  // موقد بنسن + حامل ثلاثي
  mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.18, 32), metal, 0, 0.09, 0);
  mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.0, 20), metal, 0, 0.68, 0);
  mesh(new THREE.TorusGeometry(0.16, 0.04, 8, 20), new THREE.MeshStandardMaterial({ color: 0xc0841a, metalness: 0.8, roughness: 0.4 }), 0, 0.55, 0).rotation.x = Math.PI / 2;
  const TRI_Y = 2.0;
  for (let i = 0; i < 3; i++) { const a = (i * 2 * Math.PI) / 3 + 0.5; mesh(new THREE.CylinderGeometry(0.04, 0.04, TRI_Y, 8), metal, Math.cos(a) * 1.0, TRI_Y / 2, Math.sin(a) * 1.0); }
  mesh(new THREE.TorusGeometry(1.0, 0.05, 8, 48), metal, 0, TRI_Y, 0).rotation.x = Math.PI / 2;
  const gauze = mesh(new THREE.CircleGeometry(1.0, 32), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.6, roughness: 0.5, transparent: true, opacity: 0.55, side: THREE.DoubleSide }), 0, TRI_Y, 0);
  gauze.rotation.x = -Math.PI / 2; gauze.castShadow = false;

  // اللهب
  const flame = new THREE.Group(); flame.position.y = 1.18; scene.add(flame);
  const cone = (r, h, color, op) => { const g = new THREE.ConeGeometry(r, h, 24, 1, true); g.translate(0, h / 2, 0); return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); };
  const flameOut = cone(0.3, 0.9, 0xffa030, 0.55), flameIn = cone(0.15, 0.55, 0x4aa8ff, 0.85);
  flame.add(flameOut, flameIn); flame.visible = false;

  // الكأس والسائل
  const BEAKER_Y = 2.08;
  const prof = [[0, 0], [0.9, 0], [0.98, 0.07], [1, 0.2], [1, 2.42], [1.05, 2.5]].map((p) => new THREE.Vector2(p[0], p[1]));
  const beaker = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), glass(0.2)); beaker.position.y = BEAKER_Y; scene.add(beaker);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.04, 0.03, 8, 48), glass(0.5)); rim.rotation.x = Math.PI / 2; rim.position.y = BEAKER_Y + 2.5; scene.add(rim);
  const lg = new THREE.CylinderGeometry(0.93, 0.93, 1, 48); lg.translate(0, 0.5, 0);
  const liqMat = new THREE.MeshPhysicalMaterial({ color: 0xcfe3ff, transparent: true, opacity: 0.55, roughness: 0.08, clearcoat: 1, depthWrite: false });
  const liquid = new THREE.Mesh(lg, liqMat); liquid.position.y = BEAKER_Y + 0.08; liquid.visible = false; scene.add(liquid);
  const LH = 2.6; let level = 0, surface = BEAKER_Y + 0.08;

  // ملصق الزجاجة
  const label = (text) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const g = c.getContext('2d'); g.fillStyle = '#f8fafc'; g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#111827'; g.font = `700 ${text.length > 6 ? 40 : 56}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 66);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  // رف الزجاجات
  mesh(new THREE.BoxGeometry(8.4, 0.12, 1.1), new THREE.MeshStandardMaterial({ color: 0x252c40, roughness: 0.4, metalness: 0.3 }), 0, 0.06, -2.9);
  const bottles = [];
  Object.keys(REAGENTS).forEach((id, i, arr) => {
    const g = new THREE.Group(); g.userData.id = id; g.scale.setScalar(0.88);
    const x = (i - (arr.length - 1) / 2) * 0.86;
    g.position.set(x, 0.12, -2.9 + Math.abs(x) * 0.04);
    const body = mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.1, 24), glass(0.3), 0, 0.55, 0, g); body.castShadow = false;
    mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.85, 24), new THREE.MeshPhysicalMaterial({ color: BOTTLE[id], transparent: true, opacity: 0.82, roughness: 0.15, clearcoat: 1 }), 0, 0.5, 0, g);
    mesh(new THREE.CylinderGeometry(0.15, 0.4, 0.25, 24), glass(0.3), 0, 1.22, 0, g).castShadow = false;
    mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 16), glass(0.3), 0, 1.47, 0, g).castShadow = false;
    mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.14, 16), new THREE.MeshStandardMaterial({ color: 0x20242f, roughness: 0.5 }), 0, 1.68, 0, g);
    const lb = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.33), new THREE.MeshBasicMaterial({ map: label(REAGENTS[id].f) })); lb.position.set(0, 0.55, 0.405); g.add(lb);
    const mouth = new THREE.Object3D(); mouth.position.set(0, 1.78, 0); g.add(mouth);
    scene.add(g); bottles.push({ g, id, mouth, home: g.position.clone() });
  });

  // الخلية الحية
  const dish = new THREE.Group(); dish.position.set(3.3, 0, 2.4); scene.add(dish);
  mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.22, 48), glass(0.28), 0, 0.11, 0, dish).castShadow = false;
  mesh(new THREE.CylinderGeometry(1.12, 1.12, 0.12, 48), new THREE.MeshPhysicalMaterial({ color: 0x6fd0ff, transparent: true, opacity: 0.5, roughness: 0.1 }), 0, 0.1, 0, dish).castShadow = false;
  const cell = new THREE.Group(); cell.position.y = 0.5; dish.add(cell);
  const cellMat = new THREE.MeshPhysicalMaterial({ color: 0x7ee081, transparent: true, opacity: 0.82, roughness: 0.25, clearcoat: 0.8 });
  cell.add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 32, 24), cellMat));
  cell.add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), new THREE.MeshStandardMaterial({ color: 0x1f6f3a, roughness: 0.5 })));
  const orgs = new THREE.Group(); cell.add(orgs);
  for (let i = 0; i < 5; i++) { const o = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffe08a, roughness: 0.4 })); const a = (i / 5) * 6.28; o.position.set(Math.cos(a) * 0.29, (i % 2 ? 0.1 : -0.1), Math.sin(a) * 0.29); orgs.add(o); }
  const GREY = new THREE.Color(0xa9a39a), LIVE = new THREE.Color(0x7ee081);

  // الفقاعات
  const dummy = new THREE.Object3D();
  const NB = 140, bub = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, roughness: 0.05, clearcoat: 1 }), NB);
  bub.frustumCulled = false; bub.visible = false; scene.add(bub);
  const bd = Array.from({ length: NB }, () => ({ a: rnd() * 6.28, r: Math.sqrt(rnd()) * 0.78, y: rnd(), s: 0.5 + rnd() * 0.9 }));
  // الراسب
  const NP = 260, prc = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.06, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.15 }), NP);
  prc.frustumCulled = false; scene.add(prc);
  const pd = Array.from({ length: NP }, () => ({ a: rnd() * 6.28, r: Math.sqrt(rnd()) * 0.82, h: rnd() * 0.16, y: 0, on: false, rot: [rnd() * 3, rnd() * 3, rnd() * 3] }));
  // البخار
  const sc = document.createElement('canvas'); sc.width = sc.height = 64;
  const sg = sc.getContext('2d'), grad = sg.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,.85)'); grad.addColorStop(1, 'rgba(255,255,255,0)'); sg.fillStyle = grad; sg.fillRect(0, 0, 64, 64);
  const NV = 70, vpos = new Float32Array(NV * 3), vg = new THREE.BufferGeometry();
  vg.setAttribute('position', new THREE.BufferAttribute(vpos, 3));
  const vm = new THREE.PointsMaterial({ map: new THREE.CanvasTexture(sc), size: 1.0, transparent: true, opacity: 0, depthWrite: false });
  const vap = new THREE.Points(vg, vm); vap.frustumCulled = false; scene.add(vap);
  const vd = Array.from({ length: NV }, () => ({ a: rnd() * 6.28, r: rnd() * 0.7, h: rnd() * 3.2, s: 0.4 + rnd() * 0.6 }));

  // مصباح الضوء (زاوية الضوء)
  const lampG = new THREE.Group(); scene.add(lampG);
  const lh = new THREE.CylinderGeometry(0.45, 0.28, 0.6, 20); lh.rotateX(Math.PI / 2);
  lampG.add(new THREE.Mesh(lh, new THREE.MeshStandardMaterial({ color: 0x2b3042, metalness: 0.7, roughness: 0.4 })));
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), new THREE.MeshBasicMaterial({ color: 0xfff1d0 })); lens.position.z = 0.31; lampG.add(lens);
  function placeLamp(deg) {
    const a = (deg * Math.PI) / 180;
    lampG.position.set(-Math.sin(a) * 5.2, 3.3 + Math.cos(a) * 5.2, 0.01); spot.position.copy(lampG.position); lampG.lookAt(0, 3.2, 0);
  }
  placeLamp(0);

  // ---------- الصبّ ----------
  let pour = null;
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
  stream.visible = false; scene.add(stream);
  const POUR_POS = new THREE.Vector3(2.1, 5.6, 0), TILT = 1.9, v3 = new THREE.Vector3();
  const smooth = (x) => x * x * (3 - 2 * x);
  function startPour(id) {
    if (pour) return toast('استنى لحد ما الزجاجة تخلص 🙂');
    if (S.doses >= 6) return toast('الكأس ممتلئ، فرّغه الأول 🧹');
    pour = { b: bottles.find((b) => b.id === id), t: 0, added: false };
    stream.material.color.setHex(BOTTLE[id]);
  }
  function updatePour(dt) {
    if (!pour) return;
    pour.t += dt; const t = pour.t, b = pour.b;
    const k = smooth(Math.min(1, t / 0.7)) * (1 - smooth(Math.max(0, Math.min(1, (t - 1.9) / 0.5))));
    b.g.position.lerpVectors(b.home, POUR_POS, k); b.g.rotation.z = k * TILT;
    const flowing = t > 0.7 && t < 1.85;
    if (flowing && !pour.added) { pour.added = true; add(S, b.id); }
    stream.visible = flowing;
    if (flowing) {
      b.mouth.getWorldPosition(v3);
      const top = v3.y, len = Math.max(0.05, top - surface);
      stream.position.set(v3.x, surface + len / 2, v3.z); stream.scale.set(1, len, 1);
    }
    if (t > 2.45) { b.g.position.copy(b.home); b.g.rotation.z = 0; stream.visible = false; pour = null; }
  }

  // ---------- النقر على الزجاجات ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
  const dom = renderer.domElement;
  dom.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  dom.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), quick = performance.now() - down.t < 450; down = null;
    if (moved > 8 || !quick) return;   // سحب للدوران مش نقرة
    const r = dom.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(bottles.map((b) => b.g), true)[0];
    if (hit) { let o = hit.object; while (o && !o.userData.id) o = o.parent; if (o) startPour(o.userData.id); }
  });

  // ---------- الحجم والكاميرا ----------
  let portrait = null;
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const p = w / h < 0.95;
    if (p !== portrait) { portrait = p; controls.target.set(0, p ? 2.7 : 2.5, 0); camera.position.set(0, p ? 6.4 : 5.2, p ? 15.5 : 11.5); controls.update(); }
  }
  new ResizeObserver(resize).observe(stage); resize();

  // ---------- الحلقة ----------
  const clock = new THREE.Clock(); let time = 0, hudT = 0, first = true, cellPulse = 0;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1); time += dt;
    updatePour(dt);
    tick(S, dt, ctl);
    const v = view(S);

    level += (v.level - level) * Math.min(1, dt * 3);
    liquid.visible = level > 0.005; liquid.scale.y = Math.max(0.001, level * LH); liqMat.color.setHex(v.color);
    surface = liquid.position.y + level * LH;

    // اللهب والإضاءة
    const h = ctl.heat; flame.visible = h > 0.02;
    if (flame.visible) {
      const f = 0.25 + 0.75 * h, fl = 1 + 0.07 * Math.sin(time * 23) + 0.05 * Math.sin(time * 37);
      flameOut.scale.set(1, f * fl, 1); flameIn.scale.set(1, f * (1 + 0.05 * Math.sin(time * 31)), 1);
    }
    flameLight.intensity = h * 22 * (1 + 0.1 * Math.sin(time * 19));

    // الفقاعات
    const nb = Math.floor(v.gas * NB); bub.visible = nb > 0;
    if (nb > 0) {
      const bot = BEAKER_Y + 0.16, span = Math.max(0.1, surface - 0.06 - bot);
      for (let i = 0; i < NB; i++) {
        const d = bd[i];
        if (i < nb) { d.y += dt * d.s * (0.35 + v.gas * 0.9); if (d.y > 1) d.y = rnd() * 0.05; dummy.position.set(Math.cos(d.a + time * 0.7) * d.r, bot + d.y * span, Math.sin(d.a + time * 0.7) * d.r); dummy.scale.setScalar(0.6 + 0.6 * d.s); }
        else dummy.scale.setScalar(0);
        dummy.updateMatrix(); bub.setMatrixAt(i, dummy.matrix);
      }
      bub.instanceMatrix.needsUpdate = true;
    }

    // الراسب
    const np = Math.floor(v.precipAmt * NP); prc.material.color.setHex(v.precipColor);
    for (let i = 0; i < NP; i++) {
      const d = pd[i], rest = BEAKER_Y + 0.12 + d.h;
      if (i < np) { if (!d.on) { d.on = true; d.y = Math.max(rest, surface - rnd() * 0.4); } d.y = Math.max(rest, d.y - dt * 0.55); dummy.position.set(Math.cos(d.a) * d.r, d.y, Math.sin(d.a) * d.r); dummy.scale.setScalar(1); }
      else { d.on = false; dummy.scale.setScalar(0); }
      dummy.rotation.set(d.rot[0], d.rot[1], d.rot[2]); dummy.updateMatrix(); prc.setMatrixAt(i, dummy.matrix);
    }
    prc.instanceMatrix.needsUpdate = true;

    // البخار
    vap.visible = v.vapor > 0.02; vm.opacity = v.vapor * 0.55;
    if (vap.visible) {
      for (let i = 0; i < NV; i++) {
        const d = vd[i]; d.h += dt * d.s; if (d.h > 3.2) d.h = 0;
        vpos[i * 3] = Math.cos(d.a + d.h) * d.r * (1 + d.h * 0.25); vpos[i * 3 + 1] = surface + 0.1 + d.h; vpos[i * 3 + 2] = Math.sin(d.a + d.h) * d.r * (1 + d.h * 0.25);
      }
      vg.attributes.position.needsUpdate = true;
    }

    // الخلية الحية
    cellPulse += dt * (0.8 + 5 * v.cell);
    cell.scale.setScalar(1 + 0.07 * Math.sin(cellPulse)); orgs.rotation.y += dt * (0.2 + 2.2 * v.cell);
    cellMat.color.copy(LIVE).lerp(GREY, S.damage);

    controls.update(); renderer.render(scene, camera);
    if (first) { first = false; $('loading-screen').classList.add('done'); }
    hudT += dt; if (hudT > 0.12) { hudT = 0; updateUI(v); }
  }
  renderer.setAnimationLoop(frame);
  document.addEventListener('visibilitychange', () => { clock.getDelta(); renderer.setAnimationLoop(document.hidden ? null : frame); });
  return { pour: startPour, lamp: placeLamp };
}

try { api = start3D(); }
catch (e) { console.error(e); $('nogl').hidden = false; $('loading-screen').classList.add('done'); }
setTimeout(() => $('loading-screen').classList.add('done'), 15000);   // أمان: لا تعلق شاشة التحميل أبدًا

// القائمة الجانبية للمنصة (لأن الصفحة دي مابتحمّلش firebase.js بنفسها)
import('./sidebar.js').catch(() => {});
