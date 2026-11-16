// ==========================================
// 🔬 معمل مدار ثلاثي الأبعاد — الإصدار الاحترافي الحديث (v9-Next-Gen)
// ==========================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { REAGENTS, newState, add, reset, tick, view } from './lab-engine.js?v=4';
import { G, mouthWorld, pourStance } from './lab-geo.js';

const LAB_VERSION = 'v9-next-gen';
const $ = (id) => document.getElementById(id);
const S = newState();
const ctl = { heat: 0, light: 0 };
const isMobile = () => innerWidth < 900;
let api = null;

const BOTTLE = { hcl: 0xffe08a, naoh: 0x9fe6ff, phph: 0xff8cc6, na2co3: 0xd8e0ff, cuso4: 0x2f7dff, agno3: 0xe9e9ff, nacl: 0xf4f4f4, ki: 0xf5f0ff, pbno3: 0xf0f0ff };
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

// بناء واجهة المواد
const grid = $('reagents');
Object.entries(REAGENTS).forEach(([id, r]) => {
  const b = document.createElement('button');
  b.className = 'rg'; b.type = 'button'; b.style.setProperty('--c', hex(BOTTLE[id]));
  b.innerHTML = '<span class="dot"></span><b></b><small></small>';
  b.querySelector('b').textContent = r.f; b.querySelector('small').textContent = r.n;
  b.addEventListener('click', () => (api ? api.pour(id) : toast('المعمل لسه بيتجهز...')));
  grid.appendChild(b);
});

$('btn-reset').addEventListener('click', () => { reset(S); toast('اتفرّغ الكأس 🧹'); });
$('heat').addEventListener('input', (e) => { ctl.heat = e.target.value / 100; $('v-heat').textContent = e.target.value + '٪'; });
$('light').addEventListener('input', (e) => { ctl.light = +e.target.value; $('v-light').textContent = e.target.value + '°'; });

function hideLoader() {
  const loader = $('loading-screen');
  if (loader) { loader.classList.add('hidden'); loader.style.display = 'none'; }
}

function start3D() {
  const stage = $('stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06070b);
  scene.fog = new THREE.FogExp2(0x06070b, 0.025); // ضباب سينمائي حديث

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 80);

  // إضاءة احترافية
  scene.add(new THREE.HemisphereLight(0xb1e1ff, 0x1b1b2f, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(-5, 10, 6); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);

  // نظام معالجة الصور الحديث (Post-processing Bloom للوهج النيون)
  const renderScene = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.4, 0.4, 0.85);
  const composer = new EffectComposer(renderer);
  composer.addPass(renderScene);
  composer.addPass(bloomPass);

  const glass = (op = 0.18) => new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: op, roughness: 0.02, clearcoat: 1, reflectivity: 0.9 });
  const mesh = (geo, mat, x = 0, y = 0, z = 0, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };

  // الطاولة
  mesh(new THREE.BoxGeometry(16, 0.5, 9), new THREE.MeshStandardMaterial({ color: 0x131722, roughness: 0.3, metalness: 0.4 }), 0, -0.25, 0.4);

  // الكأس والسائل
  const BEAKER_Y = 2.08;
  const prof = [[0, 0], [0.9, 0], [0.98, 0.07], [1, 0.2], [1, 2.42], [1.05, 2.5]].map((p) => new THREE.Vector2(p[0], p[1]));
  const beaker = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), glass(0.2)); beaker.position.y = BEAKER_Y; scene.add(beaker);
  const lg = new THREE.CylinderGeometry(0.93, 0.93, 1, 48); lg.translate(0, 0.5, 0);
  const liqMat = new THREE.MeshPhysicalMaterial({ color: 0xcfe3ff, transparent: true, opacity: 0.6, roughness: 0.05, emissive: 0x112244, emissiveIntensity: 0.2 });
  const liquid = new THREE.Mesh(lg, liqMat); liquid.position.y = BEAKER_Y + 0.08; liquid.visible = false; scene.add(liquid);
  const LH = 2.6; let level = 0, surface = BEAKER_Y + 0.08;

  // --- التحميل الفائق للـ GLB باستخدام Draco Decoder (أداء صاروخي) ---
  const playerState = { x: 0, z: 3.5, angle: 0, speed: 0.08 };
  let characterModel = null, mixer = null;

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  gltfLoader.load('models/character.glb', (gltf) => {
    characterModel = gltf.scene;
    characterModel.scale.set(1.2, 1.2, 1.2);
    characterModel.position.set(playerState.x, 0, playerState.z);
    characterModel.traverse((child) => { if (child.isMesh) child.castShadow = true; });
    scene.add(characterModel);

    if (gltf.animations && gltf.animations.length) {
      mixer = new THREE.AnimationMixer(characterModel);
      mixer.clipAction(gltf.animations[0]).play();
    }
  }, undefined, (err) => {
    console.log('جاري تحميل النموذج بالـ Draco...', err);
  });

  // التحكم بالأنالوج
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
  mesh(new THREE.BoxGeometry(8.4, 0.12, 1.1), new THREE.MeshStandardMaterial({ color: 0x1f2433 }), 0, 0.06, -2.9);
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
    mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.85, 24), new THREE.MeshPhysicalMaterial({ color: BOTTLE[id], transparent: true, opacity: 0.85, emissive: BOTTLE[id], emissiveIntensity: 0.15 }), 0, 0.5, 0, g);
    mesh(new THREE.PlaneGeometry(0.66, 0.33), new THREE.MeshBasicMaterial({ map: label(REAGENTS[id].f) })).position.set(0, 0.55, 0.405);
    const mouth = new THREE.Object3D(); mouth.position.set(0, 1.78, 0); g.add(mouth);
    scene.add(g); bottles.push({ g, id, mouth, home: g.position.clone() });
  });

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

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  renderer.domElement.addEventListener('pointerup', (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(bottles.map((b) => b.g), true)[0];
    if (hit) { let o = hit.object; while (o && !o.userData.id) o = o.parent; if (o) startPour(o.userData.id); }
  });

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage); resize();

  const clock = new THREE.Clock(); let hudT = 0, first = true;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (mixer) mixer.update(dt);

    if (moveDir.x !== 0 || moveDir.y !== 0) {
      playerState.x += moveDir.x * playerState.speed;
      playerState.z += moveDir.y * playerState.speed;
      if (characterModel) {
        characterModel.position.set(playerState.x, 0, playerState.z);
        playerState.angle = Math.atan2(moveDir.x, moveDir.y);
        characterModel.rotation.y = playerState.angle;
      }
    }

    // كاميرا TPP سينمائية ناعمة
    const targetCamX = playerState.x - Math.sin(playerState.angle) * 4;
    const targetCamZ = playerState.z - Math.cos(playerState.angle) * 4;
    camera.position.x += (targetCamX - camera.position.x) * 0.1;
    camera.position.z += (targetCamZ - camera.position.z) * 0.1;
    camera.position.y = 3.2;
    camera.lookAt(playerState.x, 1.5, playerState.z);

    updatePour(dt);
    tick(S, dt, ctl);
    const v = view(S);

    level += (v.level - level) + Math.min(1, dt * 3);
    liquid.visible = level > 0.005; liquid.scale.y = Math.max(0.001, level * LH); liqMat.color.setHex(v.color);
    surface = liquid.position.y + level * LH;

    composer.render(); // استخدام محرك الـ Bloom الحديث بدل الـ render العادي
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
