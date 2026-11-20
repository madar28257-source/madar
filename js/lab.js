// ==========================================
// 🔬 معمل مدار ثلاثي الأبعاد — الإصدار الأرضي المنضبط (v10-Fixed)
// ==========================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { REAGENTS, newState, add, reset, tick, view } from './lab-engine.js?v=4';
import { G, mouthWorld, pourStance } from './lab-geo.js';

const $ = (id) => document.getElementById(id);
const S = newState();
const ctl = { heat: 0, light: 0 };

const BOTTLE = { hcl: 0xffe08a, naoh: 0x9fe6ff, phph: 0xff8cc6, na2co3: 0xd8e0ff, cuso4: 0x2f7dff, agno3: 0xe9e9ff, nacl: 0xf4f4f4, ki: 0xf5f0ff, pbno3: 0xf0f0ff };
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

// بناء واجهة المواد الكيميائية
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

let api = null;

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
  scene.background = new THREE.Color(0x0b0f19); // خلفية رمادي غامق فخم بدل السوداء القاتمة
  scene.fog = new THREE.FogExp2(0x0b0f19, 0.015);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);

  // إضاءة المعمل
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.8));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 12, 7);
  dirLight.castShadow = true;
  scene.add(dirLight);

  const renderScene = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.3, 0.4, 0.85);
  const composer = new EffectComposer(renderer);
  composer.addPass(renderScene);
  composer.addPass(bloomPass);

  const glassMat = (op = 0.2) => new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: op, roughness: 0.05, clearcoat: 1 });
  const mesh = (geo, mat, x = 0, y = 0, z = 0, parent = scene) => { 
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; 
  };

  // --- أرضية المعمل والطاولة ---
  // أرضية الغرفة
  mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 }), 0, 0, 0).rotation.x = -Math.PI / 2;
  // الطاولة الرئيسية في المنتصف
  mesh(new THREE.BoxGeometry(10, 0.4, 4), new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.4 }), 0, 0.9, -2);

  // الكأس والسائل فوق الطاولة
  const BEAKER_Y = 1.1;
  const prof = [[0, 0], [0.6, 0], [0.65, 0.05], [0.7, 1.5]].map((p) => new THREE.Vector2(p[0], p[1]));
  const beaker = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), glassMat(0.25));
  beaker.position.set(0, BEAKER_Y, -2);
  scene.add(beaker);

  const lg = new THREE.CylinderGeometry(0.65, 0.65, 1, 32); lg.translate(0, 0.5, 0);
  const liqMat = new THREE.MeshPhysicalMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.6, roughness: 0.1 });
  const liquid = new THREE.Mesh(lg, liqMat); liquid.position.set(0, BEAKER_Y, -2); liquid.visible = false; scene.add(liquid);
  let level = 0, surface = BEAKER_Y;

  // --- تحميل الشخصية الحقيقية (الولد الأنمي) ---
  const playerState = { x: 0, z: 2.0, angle: 0, speed: 0.06 };
  let characterModel = null, mixer = null;

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  gltfLoader.load('models/character.glb?v=2', (gltf) => {
    characterModel = gltf.scene;
    characterModel.scale.set(1, 1, 1);
    characterModel.position.set(playerState.x, 0, playerState.z);
    characterModel.traverse((child) => { if (child.isMesh) child.castShadow = true; });
    scene.add(characterModel);

    if (gltf.animations && gltf.animations.length) {
      mixer = new THREE.AnimationMixer(characterModel);
      mixer.clipAction(gltf.animations[0]).play();
    }
    hideLoader();
  }, (xhr) => {
    const h = ($('loading-screen') || document).querySelector('h2');
    if (h && xhr.total) h.textContent = 'جاري تحميل الشخصية ' + Math.round((xhr.loaded / xhr.total) * 100) + '٪';
  }, (err) => {
    console.error('خطأ في تحميل نموذج الشخصية:', err);
    hideLoader();
    toast('خطأ في تحميل ملف الشخصية character.glb');
  });

  // التحكم بالأنالوج
  let moveDir = { x: 0, y: 0 };
  let isDragging = false;
  const joyZone = $('joystick-zone'), joyKnob = $('joystick-knob');

  if (joyZone && joyKnob) {
    joyZone.addEventListener('pointerdown', (e) => { isDragging = true; moveJoystick(e); });
    window.addEventListener('pointermove', (e) => { if (isDragging) moveJoystick(e); });
    window.addEventListener('pointerup', () => { isDragging = false; moveDir = { x: 0, y: 0 }; joyKnob.style.transform = `translate(0px, 0px)`; });
  }

  function moveJoystick(e) {
    const rect = joyZone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy), maxR = 40;
    if (dist > maxR) { dx = (dx / dist) * maxR; dy = (dy / dist) * maxR; }
    joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    moveDir = { x: dx / maxR, y: dy / maxR };
  }

  // زجاجات المواد على الطاولة
  const bottles = [];
  Object.keys(REAGENTS).forEach((id, i, arr) => {
    const g = new THREE.Group(); g.userData.id = id;
    const x = (i - (arr.length - 1) / 2) * 0.7;
    g.position.set(x, BEAKER_Y, -2.8);
    mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.8, 16), glassMat(0.3), 0, 0.4, 0, g);
    mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.6, 16), new THREE.MeshStandardMaterial({ color: BOTTLE[id], roughness: 0.2 }), 0, 0.3, 0, g);
    scene.add(g); bottles.push({ g, id, home: g.position.clone() });
  });

  let pour = null;
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
  stream.visible = false; scene.add(stream);

  function startPour(id) {
    if (pour) return;
    pour = { b: bottles.find((b) => b.id === id), t: 0, added: false };
    stream.material.color.setHex(BOTTLE[id]);
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage); resize();

  const clock = new THREE.Clock(); let hudT = 0;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (mixer) mixer.update(dt);

    // حركة الشخصية بالأنالوج
    if (moveDir.x !== 0 || moveDir.y !== 0) {
      playerState.x += moveDir.x * playerState.speed;
      playerState.z += moveDir.y * playerState.speed;
      if (characterModel) {
        characterModel.position.set(playerState.x, 0, playerState.z);
        playerState.angle = Math.atan2(moveDir.x, moveDir.y);
        characterModel.rotation.y = playerState.angle;
      }
    }

    // الكاميرا ورا الشخصية مظبوطة على الأرض (مش طايرة)
    const targetCamX = playerState.x - Math.sin(playerState.angle) * 3.5;
    const targetCamZ = playerState.z - Math.cos(playerState.angle) * 3.5;
    camera.position.x += (targetCamX - camera.position.x) * 0.1;
    camera.position.z += (targetCamZ - camera.position.z) * 0.1;
    camera.position.y = 2.2; // ارتفاع مظبوط تماماً فوق الأرض
    camera.lookAt(playerState.x, 1.2, playerState.z);

    tick(S, dt, ctl);
    const v = view(S);
    level += (v.level - level) * 0.1;
    liquid.visible = level > 0.005; liquid.scale.y = Math.max(0.001, level * 1.5);
    liqMat.color.setHex(v.color);

    composer.render();
    hudT += dt; if (hudT > 0.15) { hudT = 0; $('hud-temp').textContent = Math.round(25 + ctl.heat * 50); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { pour: startPour };
}

try { api = start3D(); } catch (e) { console.error(e); hideLoader(); }
setTimeout(hideLoader, 5000);
