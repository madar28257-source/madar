// ==========================================
// 🔬 معمل العلوم المتكاملة — منصة مدار (نظام الألعاب ثلاثي الأبعاد)
// ==========================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { REAGENTS, newState, add, reset, tick, view } from './lab-engine.js?v=4';
import { G, mouthWorld, pourStance } from './lab-geo.js';

const LAB_VERSION = 'v7-tpp-game';

const $ = (id) => document.getElementById(id);
const S = newState();
const ctl = { heat: 0, light: 0 };
const isMobile = () => innerWidth < 900;
const rnd = Math.random;
let api = null;

// لون كل زجاجة
const BOTTLE = { hcl: 0xffe08a, naoh: 0x9fe6ff, phph: 0xff8cc6, na2co3: 0xd8e0ff, cuso4: 0x2f7dff, agno3: 0xe9e9ff, nacl: 0xf4f4f4, ki: 0xf5f0ff, pbno3: 0xf0f0ff };
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

// بناء الواجهة
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

function hideLoader() {
  const loader = $('loading-screen');
  if (loader) { loader.classList.add('hidden'); loader.style.display = 'none'; }
}

// ---------- بدء المعمل ثلاثي الأبعاد والتحكم بنظام الألعاب ----------
function start3D() {
  const stage = $('stage');
  let renderer = null, lastErr = null;
  for (const opts of [{ antialias: true, powerPreference: 'high-performance' }, { antialias: false }]) {
    try { renderer = new THREE.WebGLRenderer(opts); break; } catch (e) { lastErr = e; }
  }
  if (!renderer) throw lastErr;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isMobile() ? 1.75 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = !isMobile();
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0c14);
  scene.fog = new THREE.Fog(0x0b0c14, 18, 36);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 80);

  // إضاءة المعمل
  scene.add(new THREE.HemisphereLight(0x9db4ff, 0x1a1a2e, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(-4, 9, 6); key.castShadow = !isMobile();
  scene.add(key);

  const glass = (op = 0.18) => new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: op, roughness: 0.04, clearcoat: 1 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa3b8, metalness: 0.9, roughness: 0.32 });
  const mesh = (geo, mat, x = 0, y = 0, z = 0, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };

  // الطاولة
  mesh(new THREE.BoxGeometry(16, 0.5, 9), new THREE.MeshStandardMaterial({ color: 0x1c2233, roughness: 0.28 }), 0, -0.25, 0.4);

  // الكأس والسائل
  const BEAKER_Y = 2.08;
  const prof = [[0, 0], [0.9, 0], [0.98, 0.07], [1, 0.2], [1, 2.42], [1.05, 2.5]].map((p) => new THREE.Vector2(p[0], p[1]));
  const beaker = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), glass(0.2)); beaker.position.y = BEAKER_Y; scene.add(beaker);
  const lg = new THREE.CylinderGeometry(0.93, 0.93, 1, 48); lg.translate(0, 0.5, 0);
  const liqMat = new THREE.MeshPhysicalMaterial({ color: 0xcfe3ff, transparent: true, opacity: 0.55, roughness: 0.08 });
  const liquid = new THREE.Mesh(lg, liqMat); liquid.position.y = BEAKER_Y + 0.08; liquid.visible = false; scene.add(liquid);
  const LH = 2.6; let level = 0, surface = BEAKER_Y + 0.08;

  // --- نظام الشخصية والأنالوج (Free Fire Style TPP) ---
  const playerState = { x: 0, z: 3.5, y: 0, angle: 0, speed: 0.07 };
  const playerGroup = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.4 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.6 });
  
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 1.2, 16), bodyMat);
  torso.position.y = 1.2; torso.castShadow = true; playerGroup.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), skinMat);
  head.position.y = 1.9; head.castShadow = true; playerGroup.add(head);
  scene.add(playerGroup);

  // ربط الأنالوج الافتراضي من الشاشة
  let moveDir = { x: 0, y: 0 };
  let isDraggingJoystick = false;
  const joyZone = $('joystick-zone'), joyKnob = $('joystick-knob');
  
  if (joyZone && joyKnob) {
    joyZone.addEventListener('pointerdown', (e) => { isDraggingJoystick = true; updateJoystick(e); });
    window.addEventListener('pointermove', (e) => { if (isDraggingJoystick) updateJoystick(e); });
    window.addEventListener('pointerup', () => { isDraggingJoystick = false; moveDir = { x: 0, y: 0 }; joyKnob.style.transform = `translate(0px, 0px)`; });
  }

  function updateJoystick(e) {
    const rect = joyZone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy), maxR = 40;
    if (dist > maxR) { dx = (dx / dist) * maxR; dy = (dy / dist) * maxR; }
    joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    moveDir = { x: dx / maxR, y: dy / maxR };
  }

  // رف الزجاجات
  mesh(new THREE.BoxGeometry(8.4, 0.12, 1.1), new THREE.MeshStandardMaterial({ color: 0x252c40 }), 0, 0.06, -2.9);
  const bottles = [];
  const label = (text) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const g = c.getContext('2d'); g.fillStyle = '#f8fafc'; g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#111827'; g.font = `700 48px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 66);
    return new THREE.CanvasTexture(c);
  };

  Object.keys(REAGENTS).forEach((id, i, arr) => {
    const g = new THREE.Group(); g.userData.id = id; g.scale.setScalar(0.88);
    const x = (i - (arr.length - 1) / 2) * 0.86;
    g.position.set(x, 0.12, -2.9 + Math.abs(x) * 0.04);
    mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.1, 24), glass(0.3), 0, 0.55, 0, g);
    mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.85, 24), new THREE.MeshPhysicalMaterial({ color: BOTTLE[id], transparent: true, opacity: 0.82 }), 0, 0.5, 0, g);
    mesh(new THREE.PlaneGeometry(0.66, 0.33), new THREE.MeshBasicMaterial({ map: label(REAGENTS[id].f) })).position.set(0, 0.55, 0.405);
    const mouth = new THREE.Object3D(); mouth.position.set(0, 1.78, 0); g.add(mouth);
    scene.add(g); bottles.push({ g, id, mouth, home: g.position.clone() });
  });

  // صب السائل رياضياً
  let pour = null;
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
  stream.visible = false; scene.add(stream);

  function startPour(id) {
    if (pour) return toast('استنى لحد ما الزجاجة تخلص 🙂');
    if (S.doses >= 6) return toast('الكأس ممتلئ، فرّغه الأول 🧹');
    pour = { b: bottles.find((b) => b.id === id), t: 0, added: false };
    stream.material.color.setHex(BOTTLE[id]);
  }

  function updatePour(dt) {
    if (!pour) return;
    pour.t += dt; const t = pour.t, b = pour.b;
    
    const progress = Math.min(1, t / 1.5);
    const a = G.A_CARRY + (G.A_POUR - G.A_CARRY) * progress;
    const tilt = G.TILT_POUR * progress;
    
    const stance = pourStance({ x: playerState.x, z: playerState.z }, { x: 0, z: 0 });
    const mw = mouthWorld(stance.S, stance.yaw, a, tilt);
    
    b.g.position.set(mw.x, mw.y - 1.2, mw.z);
    b.g.rotation.y = stance.yaw;
    b.g.rotation.z = tilt;

    const flowing = t > 0.6 && t < 1.8;
    if (flowing && !pour.added) { pour.added = true; add(S, b.id); }
    
    stream.visible = flowing;
    if (flowing) {
      const top = mw.y, len = Math.max(0.05, top - surface);
      stream.position.set(mw.x, surface + len / 2, mw.z); 
      stream.scale.set(1, len, 1);
    }
    
    if (t > 2.45) { 
      b.g.position.copy(b.home); 
      b.g.rotation.set(0, 0, 0); 
      stream.visible = false; 
      pour = null; 
    }
  }

  // التفاعل بالضغط على الزجاجات
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
  const dom = renderer.domElement;
  dom.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  dom.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), quick = performance.now() - down.t < 450; down = null;
    if (moved > 8 || !quick) return;
    const r = dom.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(bottles.map((b) => b.g), true)[0];
    if (hit) { let o = hit.object; while (o && !o.userData.id) o = o.parent; if (o) startPour(o.userData.id); }
  });

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage); resize();

  // الحلقة الأساسية للرسم وحركة اللاعب والكاميرا
  const clock = new THREE.Clock(); let hudT = 0, first = true;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    
    // تحريك الشخصية بالأنالوج
    if (moveDir.x !== 0 || moveDir.y !== 0) {
      playerState.x += moveDir.x * playerState.speed;
      playerState.z += moveDir.y * playerState.speed;
      playerGroup.position.set(playerState.x, 0, playerState.z);
      playerState.angle = Math.atan2(moveDir.x, moveDir.y);
      playerGroup.rotation.y = playerState.angle;
    }

    // منظور الكاميرا الثالث (TPP) خلف الشخصية مباشرة
    const camDistX = Math.sin(playerState.angle) * 4;
    const camDistZ = Math.cos(playerState.angle) * 4;
    camera.position.set(playerState.x - camDistX, 3.2, playerState.z - camDistZ);
    camera.lookAt(playerState.x, 1.5, playerState.z);

    updatePour(dt);
    tick(S, dt, ctl);
    const v = view(S);

    level += (v.level - level) * Math.min(1, dt * 3);
    liquid.visible = level > 0.005; liquid.scale.y = Math.max(0.001, level * LH); liqMat.color.setHex(v.color);
    surface = liquid.position.y + level * LH;

    renderer.render(scene, camera);
    if (first) { first = false; hideLoader(); }
    hudT += dt; if (hudT > 0.12) { hudT = 0; updateUI(v); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { pour: startPour };
}

if (typeof start3D === 'function') {
  try { api = start3D(); } catch (e) { console.error(e); hideLoader(); }
}
setTimeout(hideLoader, 10000);
import('./sidebar.js').catch(() => {});
