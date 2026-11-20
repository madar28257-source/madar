// ==========================================
// 🔬 معمل مدار ثلاثي الأبعاد — تحكم لمس متعدد وحركة أقدام واقعية + تايكون
// ==========================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { REAGENTS, newState, add, reset, tick, view } from './lab-engine.js?v=4';
import { G, mouthWorld, pourStance } from './lab-geo.js';
import { createTycoonSystem } from './tycoon.js';

const $ = (id) => document.getElementById(id);
const S = newState();
const ctl = { heat: 0, light: 0 };

const BOTTLE = {
  hcl: 0xffe08a,
  naoh: 0x9fe6ff,
  phph: 0xff8cc6,
  na2co3: 0xd8e0ff,
  cuso4: 0x2f7dff,
  agno3: 0xe9e9ff,
  nacl: 0xf4f4f4,
  ki: 0xf5f0ff,
  pbno3: 0xf0f0ff,
};
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

let toastTimer;
function toast(msg) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.hidden = true;
  }, 2600);
}

// بناء واجهة المواد الكيميائية
const grid = $('reagents');
if (grid) {
  Object.entries(REAGENTS).forEach(([id, r]) => {
    const b = document.createElement('button');
    b.className = 'rg';
    b.type = 'button';
    b.style.setProperty('--c', hex(BOTTLE[id]));
    b.innerHTML = '<span class="dot"></span><b></b><small></small>';
    b.querySelector('b').textContent = r.f;
    b.querySelector('small').textContent = r.n;
    b.addEventListener('click', () => (api ? api.pour(id) : toast('المعمل لسه بيتجهز...')));
    grid.appendChild(b);
  });
}

$('btn-reset')?.addEventListener('click', () => {
  reset(S);
  toast('اتفرّغ الكأس 🧹');
});
$('heat')?.addEventListener('input', (e) => {
  ctl.heat = e.target.value / 100;
  if ($('v-heat')) $('v-heat').textContent = e.target.value + '٪';
});
$('light')?.addEventListener('input', (e) => {
  ctl.light = +e.target.value;
  if ($('v-light')) $('v-light').textContent = e.target.value + '°';
});

function hideLoader() {
  const loader = $('loading-screen');
  if (loader) {
    loader.classList.add('hidden');
    loader.style.display = 'none';
  }
}

let api = null;

function collectLimbRig(root) {
  const leftLegs = [];
  const rightLegs = [];
  const leftArms = [];
  const rightArms = [];
  const lowerLegs = [];

  root.traverse((obj) => {
    if (!obj.isBone && !obj.name) return;
    const name = (obj.name || '').toLowerCase();
    const isLeft = name.includes('left') || name.includes('_l') || name.includes('.l') || name.startsWith('l_');
    const isRight = name.includes('right') || name.includes('_r') || name.includes('.r') || name.startsWith('r_');

    if (name.includes('shin') || name.includes('calf') || name.includes('lowerleg') || name.includes('leg_lower')) {
      lowerLegs.push({ bone: obj, baseX: obj.rotation.x });
    } else if (name.includes('thigh') || name.includes('upleg') || name.includes('upperleg') || name.includes('leg')) {
      if (isLeft) leftLegs.push({ bone: obj, baseX: obj.rotation.x });
      else if (isRight) rightLegs.push({ bone: obj, baseX: obj.rotation.x });
    } else if (name.includes('arm') || name.includes('shoulder')) {
      if (isLeft) leftArms.push({ bone: obj, baseX: obj.rotation.x });
      else if (isRight) rightArms.push({ bone: obj, baseX: obj.rotation.x });
    }
  });

  return { leftLegs, rightLegs, leftArms, rightArms, lowerLegs };
}

function start3D() {
  const stage = $('stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.touchAction = 'none';
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f19);
  scene.fog = new THREE.FogExp2(0x0b0f19, 0.014);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 140);

  // إضاءة المعمل
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.85));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.25);
  dirLight.position.set(5, 12, 7);
  dirLight.castShadow = true;
  scene.add(dirLight);

  const renderScene = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.3,
    0.4,
    0.85
  );
  const composer = new EffectComposer(renderer);
  composer.addPass(renderScene);
  composer.addPass(bloomPass);

  const glassMat = (op = 0.2) =>
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: op,
      roughness: 0.05,
      clearcoat: 1,
    });

  const mesh = (geo, mat, x = 0, y = 0, z = 0, parent = scene) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // --- أرضية المعمل والطاولة ---
  mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 }),
    0,
    0,
    0
  ).rotation.x = -Math.PI / 2;

  mesh(
    new THREE.BoxGeometry(10, 0.4, 4),
    new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.4 }),
    0,
    0.9,
    -2
  );

  // الكأس والسائل فوق الطاولة
  const BEAKER_Y = 1.1;
  const prof = [
    [0, 0],
    [0.6, 0],
    [0.65, 0.05],
    [0.7, 1.5],
  ].map((p) => new THREE.Vector2(p[0], p[1]));
  const beaker = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), glassMat(0.25));
  beaker.position.set(0, BEAKER_Y, -2);
  scene.add(beaker);

  const lg = new THREE.CylinderGeometry(0.65, 0.65, 1, 32);
  lg.translate(0, 0.5, 0);
  const liqMat = new THREE.MeshPhysicalMaterial({
    color: 0x3b82f6,
    transparent: true,
    opacity: 0.6,
    roughness: 0.1,
  });
  const liquid = new THREE.Mesh(lg, liqMat);
  liquid.position.set(0, BEAKER_Y, -2);
  liquid.visible = false;
  scene.add(liquid);
  let level = 0;

  // --- تحميل الشخصية الحقيقية (الولد الأنمي) + البالطو الأبيض ---
  const playerState = { x: 0, y: 0, z: 2.0, angle: Math.PI, speed: 4.5 };
  let characterModel = null;
  let mixer = null;
  let walkAction = null;
  let idleAction = null;
  let limbRig = null;
  let walkPhase = 0;
  let coatEquipped = false;

  const labCoatMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.48, 0.96, 18),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42 })
  );
  labCoatMesh.position.set(0, 0.85, 0);
  labCoatMesh.visible = false;
  scene.add(labCoatMesh);

  function syncCoatVisual() {
    labCoatMesh.visible = Boolean(coatEquipped);
    if (characterModel && labCoatMesh.parent !== characterModel) {
      characterModel.add(labCoatMesh);
      labCoatMesh.position.set(0, 0.85, 0);
    } else if (!characterModel && labCoatMesh.parent !== scene) {
      scene.add(labCoatMesh);
      labCoatMesh.position.set(playerState.x, playerState.y + 0.85, playerState.z);
    }
  }

  // تشغيل نظام التايكون وربطه بالمعمل
  const tycoon = createTycoonSystem({
    scene,
    getPlayerPos: () =>
      characterModel ? characterModel.position : new THREE.Vector3(playerState.x, playerState.y, playerState.z),
    onToast: (msg) => toast(msg),
    onCoatChange: (equipped) => {
      coatEquipped = Boolean(equipped);
      syncCoatVisual();
    },
    onPartChange: (partData) => {
      toast(`المرحلة الحالية: ${partData.name}`);
    },
  });

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  gltfLoader.load(
    'models/character.glb?v=2',
    (gltf) => {
      characterModel = gltf.scene;
      characterModel.scale.set(1, 1, 1);
      characterModel.position.set(playerState.x, playerState.y, playerState.z);
      characterModel.rotation.y = playerState.angle;
      characterModel.traverse((child) => {
        if (child.isMesh) child.castShadow = true;
      });
      scene.add(characterModel);
      syncCoatVisual();
      limbRig = collectLimbRig(characterModel);

      if (gltf.animations && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(characterModel);
        const clips = gltf.animations;
        const walkClip = clips.find((c) => /walk|run|move|locomotion/i.test(c.name));
        const idleClip = clips.find((c) => /idle|stand|breath/i.test(c.name));

        if (walkClip) {
          walkAction = mixer.clipAction(walkClip);
          walkAction.play();
          walkAction.setEffectiveWeight(0);
        }
        if (idleClip) {
          idleAction = mixer.clipAction(idleClip);
          idleAction.play();
          idleAction.setEffectiveWeight(1);
        } else if (!walkClip) {
          idleAction = mixer.clipAction(clips[0]);
          idleAction.play();
        }
      }
      hideLoader();
    },
    (xhr) => {
      const h = ($('loading-screen') || document).querySelector('h2');
      if (h && xhr.total) {
        h.textContent = 'جاري تحميل الشخصية ' + Math.round((xhr.loaded / xhr.total) * 100) + '٪';
      }
    },
    (err) => {
      console.error('خطأ في تحميل نموذج الشخصية:', err);
      hideLoader();
      toast('خطأ في تحميل ملف الشخصية character.glb');
    }
  );

  // --- تحكم لمس متعدد منفصل (أنالوج بصباع + كاميرا بصباع تاني) ---
  let moveDir = { x: 0, y: 0 };
  let joystickPointerId = null;
  const joyZone = $('joystick-zone');
  const joyKnob = $('joystick-knob');
  const maxR = 40;

  function resetJoystick() {
    joystickPointerId = null;
    moveDir = { x: 0, y: 0 };
    if (joyKnob) joyKnob.style.transform = 'translate(0px, 0px)';
  }

  function updateJoystickFromClient(clientX, clientY) {
    if (!joyZone || !joyKnob) return;
    const rect = joyZone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    moveDir = { x: dx / maxR, y: dy / maxR };
  }

  if (joyZone) {
    joyZone.style.touchAction = 'none';
    joyZone.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (joystickPointerId !== null) return;
      joystickPointerId = e.pointerId;
      joyZone.setPointerCapture?.(e.pointerId);
      updateJoystickFromClient(e.clientX, e.clientY);
    });
  }

  // دوران الكاميرا باللمس على الشاشة (بصابع منفصل عن الأنالوج)
  let cameraPointerId = null;
  let lastCamX = 0;
  let lastCamY = 0;
  let camYaw = 0;
  let camPitch = 0.28;

  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (e.pointerId === joystickPointerId) return;
    if (cameraPointerId !== null) return;
    cameraPointerId = e.pointerId;
    lastCamX = e.clientX;
    lastCamY = e.clientY;
  });

  window.addEventListener('pointermove', (e) => {
    if (e.pointerId === joystickPointerId) {
      updateJoystickFromClient(e.clientX, e.clientY);
    }
    if (e.pointerId === cameraPointerId) {
      const dx = e.clientX - lastCamX;
      const dy = e.clientY - lastCamY;
      lastCamX = e.clientX;
      lastCamY = e.clientY;
      camYaw -= dx * 0.0065;
      camPitch = THREE.MathUtils.clamp(camPitch + dy * 0.004, -0.1, 0.85);
    }
  });

  function releasePointer(e) {
    if (e.pointerId === joystickPointerId) {
      resetJoystick();
    }
    if (e.pointerId === cameraPointerId) {
      cameraPointerId = null;
    }
  }

  window.addEventListener('pointerup', releasePointer);
  window.addEventListener('pointercancel', releasePointer);

  // زجاجات المواد على الطاولة
  const bottles = [];
  Object.keys(REAGENTS).forEach((id, i, arr) => {
    const g = new THREE.Group();
    g.userData.id = id;
    const x = (i - (arr.length - 1) / 2) * 0.7;
    g.position.set(x, BEAKER_Y, -2.8);
    mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.8, 16), glassMat(0.3), 0, 0.4, 0, g);
    mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.6, 16),
      new THREE.MeshStandardMaterial({ color: BOTTLE[id], roughness: 0.2 }),
      0,
      0.3,
      0,
      g
    );
    scene.add(g);
    bottles.push({ g, id, home: g.position.clone() });
  });

  let pour = null;
  const stream = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 1, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })
  );
  stream.visible = false;
  scene.add(stream);

  function startPour(id) {
    if (pour) return;
    pour = { b: bottles.find((b) => b.id === id), t: 0, added: false };
    stream.material.color.setHex(BOTTLE[id]);
  }

  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  function updateLimbWalk(dt, moveAmount) {
    if (!limbRig) return;
    const isMoving = moveAmount > 0.04;
    if (isMoving) {
      walkPhase += dt * (8 + moveAmount * 6);
    } else {
      walkPhase += (0 - walkPhase) * Math.min(1, dt * 10);
    }

    const swing = isMoving ? Math.sin(walkPhase) * 0.65 * moveAmount : 0;
    const kneeSwing = isMoving ? Math.max(0, -Math.cos(walkPhase)) * 0.55 * moveAmount : 0;

    for (const item of limbRig.leftLegs) {
      item.bone.rotation.x += (item.baseX + swing - item.bone.rotation.x) * Math.min(1, dt * 16);
    }
    for (const item of limbRig.rightLegs) {
      item.bone.rotation.x += (item.baseX - swing - item.bone.rotation.x) * Math.min(1, dt * 16);
    }
    for (const item of limbRig.lowerLegs) {
      item.bone.rotation.x += (item.baseX + kneeSwing - item.bone.rotation.x) * Math.min(1, dt * 16);
    }
    for (const item of limbRig.leftArms) {
      item.bone.rotation.x += (item.baseX - swing * 0.55 - item.bone.rotation.x) * Math.min(1, dt * 14);
    }
    for (const item of limbRig.rightArms) {
      item.bone.rotation.x += (item.baseX + swing * 0.55 - item.bone.rotation.x) * Math.min(1, dt * 14);
    }
  }

  const clock = new THREE.Clock();
  let hudT = 0;

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    const stickMag = Math.min(1, Math.hypot(moveDir.x, moveDir.y));
    const isMoving = stickMag > 0.05;

    // حركة الشخصية بالنسبة لاتجاه الكاميرا
    if (isMoving) {
      const forwardInput = -moveDir.y;
      const rightInput = moveDir.x;

      const worldDx = -Math.sin(camYaw) * forwardInput + Math.cos(camYaw) * rightInput;
      const worldDz = -Math.cos(camYaw) * forwardInput - Math.sin(camYaw) * rightInput;

      playerState.x = THREE.MathUtils.clamp(playerState.x + worldDx * playerState.speed * dt, -14, 14);
      playerState.z = THREE.MathUtils.clamp(playerState.z + worldDz * playerState.speed * dt, -14, 14);

      const targetAngle = Math.atan2(worldDx, worldDz);
      let diff = targetAngle - playerState.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      playerState.angle += diff * Math.min(1, dt * 14);
    }

    // ارتفاع الأدوار والسلالم من نظام التايكون
    const floorHeightY = tycoon.getGroundHeightAt(playerState.x, playerState.z, playerState.y);
    if (playerState.y < floorHeightY) {
      playerState.y = floorHeightY;
    } else if (playerState.y > floorHeightY) {
      playerState.y = Math.max(floorHeightY, playerState.y - 14 * dt);
    }

    if (characterModel) {
      characterModel.position.set(playerState.x, playerState.y, playerState.z);
      characterModel.rotation.y = playerState.angle;
    } else if (coatEquipped) {
      labCoatMesh.position.set(playerState.x, playerState.y + 0.85, playerState.z);
    }

    // تحديث أنيميشن الموديل وحركة الرجلين
    if (mixer) {
      if (walkAction && idleAction) {
        const targetWalkWeight = isMoving ? stickMag : 0;
        const currentWalkWeight = walkAction.getEffectiveWeight();
        const nextWalkWeight = currentWalkWeight + (targetWalkWeight - currentWalkWeight) * Math.min(1, dt * 12);
        walkAction.setEffectiveWeight(nextWalkWeight);
        idleAction.setEffectiveWeight(1 - nextWalkWeight);
        walkAction.timeScale = 0.8 + stickMag * 0.7;
      }
      mixer.update(dt);
    }
    updateLimbWalk(dt, isMoving ? stickMag : 0);

    // تحديث التايكون والتصنيف والآلات والبوابات
    tycoon.update(dt);

    // حركة الصب في الكأس
    if (pour) {
      pour.t += dt;
      const b = pour.b;
      if (pour.t < 0.45) {
        const p = pour.t / 0.45;
        b.g.position.lerpVectors(b.home, new THREE.Vector3(0.75, BEAKER_Y + 1.35, -2), p);
        b.g.rotation.z = p * 1.1;
      } else if (pour.t < 1.15) {
        if (!pour.added) {
          add(S, b.id);
          pour.added = true;
          toast(`تم إضافة ${REAGENTS[b.id].n}`);
        }
        stream.visible = true;
        stream.position.set(0.55, BEAKER_Y + 0.65, -2);
        stream.scale.y = 1.3;
      } else if (pour.t < 1.6) {
        stream.visible = false;
        const p = (pour.t - 1.15) / 0.45;
        b.g.position.lerpVectors(new THREE.Vector3(0.75, BEAKER_Y + 1.35, -2), b.home, p);
        b.g.rotation.z = (1 - p) * 1.1;
      } else {
        b.g.position.copy(b.home);
        b.g.rotation.z = 0;
        stream.visible = false;
        pour = null;
      }
    }

    // الكاميرا ورا الشخصية بناءً على زاوية السحب وارتفاع الدور
    const dist = 3.6;
    const targetCamX = playerState.x + Math.sin(camYaw) * dist;
    const targetCamZ = playerState.z + Math.cos(camYaw) * dist;
    const targetCamY = Math.max(0.8, playerState.y + 1.4 + Math.sin(camPitch) * dist);

    camera.position.x += (targetCamX - camera.position.x) * Math.min(1, dt * 12);
    camera.position.z += (targetCamZ - camera.position.z) * Math.min(1, dt * 12);
    camera.position.y += (targetCamY - camera.position.y) * Math.min(1, dt * 12);
    camera.lookAt(playerState.x, playerState.y + 1.2, playerState.z);

    tick(S, dt, ctl);
    const v = view(S);
    level += (v.level - level) * Math.min(1, dt * 10);
    liquid.visible = level > 0.005;
    liquid.scale.y = Math.max(0.001, level * 1.5);
    liqMat.color.setHex(v.color);

    composer.render();
    hudT += dt;
    if (hudT > 0.15) {
      hudT = 0;
      if ($('hud-temp')) $('hud-temp').textContent = Math.round(25 + ctl.heat * 50);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { pour: startPour };
}

try {
  api = start3D();
} catch (e) {
  console.error(e);
  hideLoader();
}
setTimeout(hideLoader, 5000);
