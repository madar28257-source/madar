// ==========================================
// 🔬 معمل مدار ثلاثي الأبعاد — نهار وشمس وسحاب + تصادم + حركة مشي + تايكون
// ==========================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { createTycoonSystem } from './tycoon.js';

const $ = (id) => document.getElementById(id);
const ctl = { heat: 0, light: 0 };

// إزالة قايمة المواد الجانبية وأدوات الصب القديمة عشان الواجهة تبقى مخصصة للتايكون
const reagentsPanel = $('reagents')?.closest('aside, section, .panel, .sidebar, .drawer') || $('reagents')?.parentElement;
if (reagentsPanel && reagentsPanel.id !== 'stage') {
  reagentsPanel.style.display = 'none';
}
if ($('reagents')) $('reagents').style.display = 'none';
if ($('btn-reset')) $('btn-reset').style.display = 'none';

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

function collectLimbRig(root) {
  const leftLegs = [];
  const rightLegs = [];
  const leftArms = [];
  const rightArms = [];
  const lowerLegs = [];

  root.traverse((obj) => {
    if (!obj.isBone && !obj.name) return;
    const name = (obj.name || '').toLowerCase();
    const isLeft =
      name.includes('left') ||
      name.includes('_l') ||
      name.includes('.l') ||
      name.startsWith('l_') ||
      name.includes('lef');
    const isRight =
      name.includes('right') ||
      name.includes('_r') ||
      name.includes('.r') ||
      name.startsWith('r_') ||
      name.includes('rig');

    if (
      name.includes('shin') ||
      name.includes('calf') ||
      name.includes('lowerleg') ||
      name.includes('leg_lower') ||
      name.includes('foot') ||
      name.includes('toe')
    ) {
      lowerLegs.push({ bone: obj, baseX: obj.rotation.x });
    } else if (
      name.includes('thigh') ||
      name.includes('upleg') ||
      name.includes('upperleg') ||
      name.includes('hip') ||
      name.includes('leg')
    ) {
      if (isLeft) leftLegs.push({ bone: obj, baseX: obj.rotation.x });
      else if (isRight) rightLegs.push({ bone: obj, baseX: obj.rotation.x });
      else {
        if (obj.position.x < 0) leftLegs.push({ bone: obj, baseX: obj.rotation.x });
        else rightLegs.push({ bone: obj, baseX: obj.rotation.x });
      }
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
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.touchAction = 'none';
  stage.prepend(renderer.domElement);

  // سماء نهارية واضحة وأجواء صباحية
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7dd3fc);
  scene.fog = new THREE.FogExp2(0xbae6fd, 0.0045);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 240);

  // إضاءة الشمس والسماء
  const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x4ade80, 1.05);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.45);
  sunLight.position.set(16, 26, 14);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  scene.add(sunLight);

  // قرص الشمس في السماء
  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xfef08a })
  );
  sunDisc.position.set(28, 32, -45);
  scene.add(sunDisc);

  // سحاب متحرك في السماء
  const clouds = [];
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const cloudCoords = [
    [-16, 16, -24],
    [8, 18, -30],
    [22, 15, -18],
    [-24, 17, -8],
    [14, 19, -8],
  ];
  for (const [cx, cy, cz] of cloudCoords) {
    const cGroup = new THREE.Group();
    cGroup.position.set(cx, cy, cz);
    const puff1 = new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 12), cloudMat);
    const puff2 = new THREE.Mesh(new THREE.SphereGeometry(1.35, 12, 12), cloudMat);
    puff2.position.set(1.4, -0.2, 0.2);
    const puff3 = new THREE.Mesh(new THREE.SphereGeometry(1.25, 12, 12), cloudMat);
    puff3.position.set(-1.3, -0.25, 0.1);
    cGroup.add(puff1, puff2, puff3);
    scene.add(cGroup);
    clouds.push(cGroup);
  }

  const renderScene = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.1,
    0.35,
    0.92
  );
  const composer = new EffectComposer(renderer);
  composer.addPass(renderScene);
  composer.addPass(bloomPass);

  // أرضية نهارية خضراء واسعة + ساحة خرسانية للمعمل
  const grassGround = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.92 })
  );
  grassGround.rotation.x = -Math.PI / 2;
  grassGround.position.y = -0.02;
  grassGround.receiveShadow = true;
  scene.add(grassGround);

  const labYard = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.06, 14),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.8 })
  );
  labYard.position.set(0, -0.01, 0);
  labYard.receiveShadow = true;
  scene.add(labYard);

  // الشخصية + البالطو الأبيض
  const playerState = { x: 0, y: 0, z: 2.2, angle: Math.PI, speed: 4.6 };
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

  // تحكم لمس متعدد منفصل
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
      camPitch = THREE.MathUtils.clamp(camPitch + dy * 0.004, -0.05, 0.85);
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
    const isMoving = moveAmount > 0.04;
    if (isMoving) {
      walkPhase += dt * (9.5 + moveAmount * 6);
    } else {
      walkPhase += (0 - walkPhase) * Math.min(1, dt * 10);
    }

    const swing = isMoving ? Math.sin(walkPhase) * 0.72 * moveAmount : 0;
    const kneeSwing = isMoving ? Math.max(0, -Math.cos(walkPhase)) * 0.62 * moveAmount : 0;

    const hasBones =
      limbRig && (limbRig.leftLegs.length || limbRig.rightLegs.length || limbRig.lowerLegs.length);

    if (hasBones) {
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
  }

  const clock = new THREE.Clock();
  let hudT = 0;

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    const stickMag = Math.min(1, Math.hypot(moveDir.x, moveDir.y));
    const isMoving = stickMag > 0.05;

    for (const c of clouds) {
      c.position.x += 0.45 * dt;
      if (c.position.x > 36) c.position.x = -36;
    }

    if (isMoving) {
      const forwardInput = -moveDir.y;
      const rightInput = moveDir.x;

      const worldDx = -Math.sin(camYaw) * forwardInput + Math.cos(camYaw) * rightInput;
      const worldDz = -Math.cos(camYaw) * forwardInput - Math.sin(camYaw) * rightInput;

      playerState.x = THREE.MathUtils.clamp(playerState.x + worldDx * playerState.speed * dt, -26, 26);
      playerState.z = THREE.MathUtils.clamp(playerState.z + worldDz * playerState.speed * dt, -38, 18);

      tycoon.resolveHorizontalCollisions(playerState, 0.35);

      const targetAngle = Math.atan2(worldDx, worldDz);
      let diff = targetAngle - playerState.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      playerState.angle += diff * Math.min(1, dt * 14);
    }

    const floorHeightY = tycoon.getGroundHeightAt(playerState.x, playerState.z, playerState.y);
    if (playerState.y < floorHeightY) {
      playerState.y = floorHeightY;
    } else if (playerState.y > floorHeightY) {
      playerState.y = Math.max(floorHeightY, playerState.y - 14 * dt);
    }

    const stepBob = isMoving ? Math.abs(Math.sin(walkPhase)) * 0.045 * stickMag : 0;

    if (characterModel) {
      characterModel.position.set(playerState.x, playerState.y + stepBob, playerState.z);
      characterModel.rotation.y = playerState.angle;
    } else if (coatEquipped) {
      labCoatMesh.position.set(playerState.x, playerState.y + stepBob + 0.85, playerState.z);
    }

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

    tycoon.update(dt);

    const dist = 4.2;
    const targetCamX = playerState.x + Math.sin(camYaw) * dist;
    const targetCamZ = playerState.z + Math.cos(camYaw) * dist;
    const targetCamY = Math.max(1.0, playerState.y + 1.5 + Math.sin(camPitch) * dist);

    camera.position.x += (targetCamX - camera.position.x) * Math.min(1, dt * 12);
    camera.position.z += (targetCamZ - camera.position.z) * Math.min(1, dt * 12);
    camera.position.y += (targetCamY - camera.position.y) * Math.min(1, dt * 12);
    camera.lookAt(playerState.x, playerState.y + 1.25, playerState.z);

    composer.render();
    hudT += dt;
    if (hudT > 0.15) {
      hudT = 0;
      if ($('hud-temp')) $('hud-temp').textContent = Math.round(25 + ctl.heat * 50);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return {};
}

try {
  start3D();
} catch (e) {
  console.error(e);
  hideLoader();
}
setTimeout(hideLoader, 5000);
