// ==========================================
// 🏭 نظام التايكون الرئيسي — أدوار، آلات، تصادم، لافتات، لمبة، تصدير، وبالطو
// ==========================================

import * as THREE from 'three';
import { PARTS_DATA } from './tycoon-data.js';
import { createLeaderboard, formatMoney } from './leaderboard.js';

const FLOOR_HEIGHT = 3.0;
const BELT_BASE_X = 3.2;
const BELT_BASE_Z = -1.2;
const BELT_LENGTH = 5.4;
const BELT_HALF_LEN = BELT_LENGTH / 2;

function createMaterialGeometry(shape, scale = 1) {
  let geo;
  if (shape === 'cylinder') {
    geo = new THREE.CylinderGeometry(0.24, 0.24, 0.44, 18);
  } else if (shape === 'octa') {
    geo = new THREE.OctahedronGeometry(0.3, 0);
  } else {
    geo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
  }
  geo.scale(scale, scale, scale);
  return geo;
}

function makeTextSprite(text, bgColor = 'rgba(15, 23, 42, 0.88)', textColor = '#fef08a') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(12, 18, 488, 92, 22);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.font = 'bold 34px Tahoma, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 65);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.3, 0.58, 1);
  sprite.renderOrder = 20;
  return sprite;
}

export function createTycoonSystem({
  scene,
  getPlayerPos,
  onToast,
  onCoatChange,
  onPartChange,
}) {
  let partIndex = 0;
  let money = 0;
  let recentEarned = 0;
  let earnedTimer = 0;
  let incomePerSec = 0;
  let buyCooldown = 0;
  let coatToggleCooldown = 0;

  let coatOwned = false;
  let coatEquipped = false;
  let rebirthPortalActive = false;
  let rebirthTriggered = false;

  const stageEl = document.getElementById('stage') || document.body;

  const hudEl = document.createElement('div');
  hudEl.id = 'tycoon-hud';
  hudEl.style.cssText = `
    position: absolute;
    top: 52px;
    right: 16px;
    z-index: 35;
    pointer-events: none;
    display: flex;
    gap: 8px;
    align-items: center;
    background: rgba(15, 23, 42, 0.88);
    border: 1px solid rgba(250, 204, 21, 0.4);
    color: #fef08a;
    padding: 7px 12px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 0.82rem;
    backdrop-filter: blur(8px);
  `;
  hudEl.innerHTML = `
    <span id="tycoon-part-badge" style="color:#7dd3fc;">P1</span>
    <span>💰 <b id="tycoon-money">0$</b></span>
    <span style="color:#86efac;font-size:0.74rem;" id="tycoon-rate">(+0$/ث)</span>
  `;
  stageEl.appendChild(hudEl);

  const promptEl = document.createElement('div');
  promptEl.id = 'tycoon-pad-prompt';
  promptEl.style.cssText = `
    position: absolute;
    bottom: 72px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 36;
    background: rgba(15, 23, 42, 0.92);
    border: 1px solid rgba(74, 222, 128, 0.55);
    color: #f8fafc;
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 700;
    display: none;
    pointer-events: none;
    white-space: nowrap;
  `;
  stageEl.appendChild(promptEl);

  const moneyText = hudEl.querySelector('#tycoon-money');
  const rateText = hudEl.querySelector('#tycoon-rate');
  const partBadge = hudEl.querySelector('#tycoon-part-badge');

  const leaderboard = createLeaderboard({ playerName: 'محمد' });

  function getCurrentPart() {
    return PARTS_DATA[partIndex] || PARTS_DATA[0];
  }

  function refreshHud() {
    const part = getCurrentPart();
    if (partBadge) partBadge.textContent = `P${part.partNumber}`;
    if (moneyText) moneyText.textContent = formatMoney(money);
    if (rateText) rateText.textContent = `(+${formatMoney(incomePerSec)}/ث)`;
  }

  function showNeedMoney(cost, label) {
    if (buyCooldown > 0) return;
    buyCooldown = 1.4;
    onToast?.(`محتاج ${formatMoney(cost)} لـ ${label} (معاك ${formatMoney(money)})`);
  }

  function createBuyPad(pos, colorHex = 0x4ade80, labelText = '') {
    const group = new THREE.Group();
    group.position.copy(pos);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.58, 0.88, 32),
      new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    group.add(ring);

    const fill = new THREE.Mesh(
      new THREE.CircleGeometry(0.54, 32),
      new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
      })
    );
    fill.rotation.x = -Math.PI / 2;
    fill.position.y = 0.045;
    group.add(fill);

    if (labelText) {
      const sprite = makeTextSprite(labelText);
      sprite.position.set(0, 1.35, 0);
      group.add(sprite);
    }

    scene.add(group);
    return { group, ring };
  }

  const coatRedPadGroup = new THREE.Group();
  coatRedPadGroup.visible = false;
  const redSquare = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 1.35),
    new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    })
  );
  redSquare.rotation.x = -Math.PI / 2;
  redSquare.position.y = 0.04;
  const redBorder = new THREE.Mesh(
    new THREE.RingGeometry(0.76, 0.92, 4),
    new THREE.MeshBasicMaterial({ color: 0xf87171, side: THREE.DoubleSide })
  );
  redBorder.rotation.x = -Math.PI / 2;
  redBorder.rotation.z = Math.PI / 4;
  redBorder.position.y = 0.045;
  const coatPadLabel = makeTextSprite('بالطو المعمل (لبس/خلع)', 'rgba(127, 29, 29, 0.9)', '#fecaca');
  coatPadLabel.position.set(0, 1.3, 0);
  coatRedPadGroup.add(redSquare, redBorder, coatPadLabel);
  scene.add(coatRedPadGroup);

  function setCoatState(equipped) {
    if (!coatOwned) return;
    coatEquipped = Boolean(equipped);
    onCoatChange?.(coatEquipped);
  }

  const rebirthGroup = new THREE.Group();
  rebirthGroup.position.set(0, 0, 0);
  rebirthGroup.visible = false;

  const outerVortex = new THREE.Mesh(
    new THREE.TorusGeometry(2.1, 0.16, 16, 48),
    new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.65,
      roughness: 0.25,
    })
  );
  outerVortex.position.y = 2.1;
  rebirthGroup.add(outerVortex);

  const innerCore = new THREE.Mesh(
    new THREE.CylinderGeometry(1.65, 1.65, 0.08, 36),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    })
  );
  innerCore.rotation.x = Math.PI / 2;
  innerCore.position.y = 2.1;
  rebirthGroup.add(innerCore);
  scene.add(rebirthGroup);

  let worldGroup = new THREE.Group();
  scene.add(worldGroup);

  let floorRuntime = [];
  let activePad = null;
  let drops = [];
  let spawnTimer = 0;

  let roadMesh = null;
  let greeneryGroup = null;
  let exportTruck = null;
  let truckState = 'idle';
  let truckTimer = 0;
  let pendingExportValue = 0;

  function clearWorld() {
    for (const d of drops) {
      scene.remove(d.mesh);
    }
    drops = [];

    if (activePad?.group) {
      scene.remove(activePad.group);
      activePad = null;
    }

    promptEl.style.display = 'none';
    coatRedPadGroup.visible = false;
    rebirthPortalActive = false;
    rebirthTriggered = false;
    rebirthGroup.visible = false;

    scene.remove(worldGroup);
    worldGroup = new THREE.Group();
    scene.add(worldGroup);

    floorRuntime = [];
    roadMesh = null;
    greeneryGroup = null;
    exportTruck = null;
    truckState = 'idle';
    truckTimer = 0;
    pendingExportValue = 0;
  }

  function buildFloorStructure(floorData, floorIdx) {
    const yBase = floorIdx * FLOOR_HEIGHT;
    const fGroup = new THREE.Group();
    fGroup.position.set(0, yBase, 0);
    worldGroup.add(fGroup);

    const slabThickness = 0.36;
    const floorSlab = new THREE.Mesh(
      new THREE.BoxGeometry(11, slabThickness, 9),
      new THREE.MeshStandardMaterial({
        color: floorIdx % 2 === 0 ? 0xe2e8f0 : 0xcbd5e1,
        roughness: 0.72,
      })
    );
    floorSlab.position.set(0, -slabThickness / 2, 0);
    floorSlab.receiveShadow = true;
    fGroup.add(floorSlab);

    const beltX = BELT_BASE_X - (floorIdx % 2 === 0 ? 0 : 1.1);
    const beltGroup = new THREE.Group();
    beltGroup.position.set(beltX, 0.14, BELT_BASE_Z);
    fGroup.add(beltGroup);

    const beltBed = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.24, BELT_LENGTH),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 })
    );
    beltBed.castShadow = true;
    beltGroup.add(beltBed);

    const beltStripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.26, BELT_LENGTH - 0.2),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35 })
    );
    beltStripe.position.y = 0.01;
    beltGroup.add(beltStripe);

    const dropperMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.95, 0.85),
      new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.4 })
    );
    dropperMesh.position.set(beltX, 1.15, BELT_BASE_Z - BELT_HALF_LEN - 0.35);
    dropperMesh.castShadow = true;
    fGroup.add(dropperMesh);

    const collectorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.28, 0.95),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.4 })
    );
    collectorMesh.position.set(beltX, 0.14, BELT_BASE_Z + BELT_HALF_LEN + 0.55);
    fGroup.add(collectorMesh);

    const machineMeshes = [];
    const colliders = [];

    for (const m of floorData.machines) {
      const mGroup = new THREE.Group();
      const mz = BELT_BASE_Z + m.zOffset;
      mGroup.position.set(beltX, 0.14, mz);
      mGroup.visible = false;

      const arch = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 1.15, 0.42),
        new THREE.MeshStandardMaterial({ color: m.color, roughness: 0.35 })
      );
      arch.position.y = 0.65;
      arch.castShadow = true;
      mGroup.add(arch);

      const core = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.26, 0.48),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
      );
      core.position.y = 0.82;
      mGroup.add(core);

      const mLabel = makeTextSprite(`${m.name} (×${m.mult})`, 'rgba(15, 23, 42, 0.82)', '#e0f2fe');
      mLabel.position.set(0, 1.65, 0);
      mLabel.scale.set(2.0, 0.5, 1);
      mGroup.add(mLabel);

      fGroup.add(mGroup);

      const entry = {
        data: m,
        mesh: mGroup,
        unlocked: false,
        box: {
          minX: beltX - 0.68,
          maxX: beltX + 0.68,
          minZ: mz - 0.26,
          maxZ: mz + 0.26,
          yMin: yBase,
          yMax: yBase + 1.35,
          activeWhen: () => entry.unlocked,
        },
      };
      machineMeshes.push(entry);
      colliders.push(entry.box);
    }

    // شكل لمبة معمل حقيقية معلّقة
    const lightGroup = new THREE.Group();
    lightGroup.visible = false;

    const ceilingMount = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 0.08, 16),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.3 })
    );
    ceilingMount.position.set(0, 2.86, 0);

    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.42, 10),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 })
    );
    cord.position.set(0, 2.65, 0);

    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 0.28, 20, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0x64748b,
        metalness: 0.5,
        roughness: 0.35,
        side: THREE.DoubleSide,
      })
    );
    shade.position.set(0, 2.42, 0);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xfffbeb,
        emissive: 0xfef08a,
        emissiveIntensity: 0.55,
        roughness: 0.2,
      })
    );
    bulb.position.set(0, 2.34, 0);

    const pointLight = new THREE.PointLight(0xfffbeb, 1.2, 11);
    pointLight.position.set(0, 2.1, 0);
    lightGroup.add(ceilingMount, cord, shade, bulb, pointLight);
    fGroup.add(lightGroup);

    const cratesGroup = new THREE.Group();
    cratesGroup.visible = false;
    const crateColors = [0xd97706, 0x2563eb, 0x059669];
    for (let i = 0; i < 3; i++) {
      const cx = -4.2 + i * 0.9;
      const cz = -3.5;
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 0.75, 0.75),
        new THREE.MeshStandardMaterial({ color: crateColors[i % crateColors.length], roughness: 0.65 })
      );
      crate.position.set(cx, 0.375, cz);
      crate.castShadow = true;
      cratesGroup.add(crate);
      colliders.push({
        minX: cx - 0.4,
        maxX: cx + 0.4,
        minZ: cz - 0.4,
        maxZ: cz + 0.4,
        yMin: yBase,
        yMax: yBase + 0.8,
        activeWhen: () => cratesGroup.visible,
      });
    }
    fGroup.add(cratesGroup);

    const shapesGroup = new THREE.Group();
    shapesGroup.visible = false;
    const deco1 = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.5, 0),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 })
    );
    deco1.position.set(-4.2, 0.75, 3.1);
    const deco2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.13, 12, 24),
      new THREE.MeshStandardMaterial({ color: 0xdb2777, roughness: 0.3 })
    );
    deco2.position.set(-3.0, 0.7, 3.1);
    shapesGroup.add(deco1, deco2);
    fGroup.add(shapesGroup);

    const wallGroup = new THREE.Group();
    wallGroup.visible = false;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.6 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(11, 2.4, 0.22), wallMat);
    backWall.position.set(0, 1.2, -4.35);
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.4, 8.8), wallMat);
    leftWall.position.set(-5.35, 1.2, 0);
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.4, 8.8), wallMat);
    rightWall.position.set(5.35, 1.2, 0);
    wallGroup.add(backWall, leftWall, rightWall);
    fGroup.add(wallGroup);

    colliders.push(
      { minX: -5.5, maxX: 5.5, minZ: -4.5, maxZ: -4.2, yMin: yBase, yMax: yBase + 2.4, activeWhen: () => wallGroup.visible },
      { minX: -5.5, maxX: -5.2, minZ: -4.4, maxZ: 4.4, yMin: yBase, yMax: yBase + 2.4, activeWhen: () => wallGroup.visible },
      { minX: 5.2, maxX: 5.5, minZ: -4.4, maxZ: 4.4, yMin: yBase, yMax: yBase + 2.4, activeWhen: () => wallGroup.visible }
    );

    let coatStandGroup = null;
    let coatRedPadPos = null;
    if (floorData.hasLabCoat) {
      coatStandGroup = new THREE.Group();
      coatStandGroup.position.set(-2.5, 0, 1.2);
      coatStandGroup.visible = false;

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 1.8, 12),
        new THREE.MeshStandardMaterial({ color: 0x475569 })
      );
      pole.position.y = 0.9;
      const robe = new THREE.Mesh(
        new THREE.ConeGeometry(0.42, 1.15, 16),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 })
      );
      robe.position.y = 1.15;
      coatStandGroup.add(pole, robe);
      fGroup.add(coatStandGroup);

      coatRedPadPos = new THREE.Vector3(-2.5, yBase, 2.55);
    }

    let trophyMesh = null;
    if (floorData.hasTrophy) {
      trophyMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.7, 1),
        new THREE.MeshStandardMaterial({
          color: 0xeab308,
          roughness: 0.25,
        })
      );
      trophyMesh.position.set(0, 1.25, 2.4);
      trophyMesh.visible = false;
      fGroup.add(trophyMesh);
    }

    let stairsGroup = null;
    const stairPos = new THREE.Vector3(0, yBase, 3.4);
    if (floorIdx < 4) {
      stairsGroup = new THREE.Group();
      stairsGroup.position.set(0, 0, 3.4);
      stairsGroup.visible = false;
      const stepCount = 10;
      for (let s = 0; s < stepCount; s++) {
        const stepH = ((s + 1) / stepCount) * FLOOR_HEIGHT;
        const step = new THREE.Mesh(
          new THREE.BoxGeometry(2.1, stepH, 0.34),
          new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.55 })
        );
        step.position.set(0, stepH / 2, -s * 0.32);
        step.castShadow = true;
        step.receiveShadow = true;
        stairsGroup.add(step);
      }
      fGroup.add(stairsGroup);
    }

    const steps = [];
    let zCursor = -2.0;
    const nextPadPos = () => {
      const p = new THREE.Vector3(beltX - 1.55, yBase, zCursor);
      zCursor += 0.95;
      if (zCursor > 2.1) zCursor = -2.0;
      return p;
    };

    const fmtCost = (c) => (c <= 0 ? 'مجاني (0$)' : formatMoney(c));

    for (const mEntry of machineMeshes) {
      steps.push({
        label: mEntry.data.name,
        cost: mEntry.data.cost,
        padText: `${mEntry.data.name} — ${fmtCost(mEntry.data.cost)}`,
        pos: nextPadPos(),
        color: mEntry.data.color,
        onBuy: () => {
          mEntry.unlocked = true;
          mEntry.mesh.visible = true;
          onToast?.(`تم بناء ${mEntry.data.name} (×${mEntry.data.mult})`);
        },
      });
    }

    steps.push({
      label: 'لمبة المعمل',
      cost: floorData.extras.lightCost,
      padText: `لمبة المعمل — ${fmtCost(floorData.extras.lightCost)}`,
      pos: new THREE.Vector3(-1.8, yBase, -2.3),
      color: 0xeab308,
      onBuy: () => {
        lightGroup.visible = true;
        onToast?.('تم تركيب لمبة المعمل!');
      },
    });

    steps.push({
      label: 'صناديق المعمل',
      cost: floorData.extras.cratesCost,
      padText: `صناديق المعمل — ${fmtCost(floorData.extras.cratesCost)}`,
      pos: new THREE.Vector3(-3.2, yBase, -2.3),
      color: 0xf59e0b,
      onBuy: () => {
        cratesGroup.visible = true;
        onToast?.('تم إضافة صناديق التخزين!');
      },
    });

    steps.push({
      label: 'أشكال ومجسمات الدور',
      cost: floorData.extras.shapesCost,
      padText: `مجسمات الدور — ${fmtCost(floorData.extras.shapesCost)}`,
      pos: new THREE.Vector3(-3.5, yBase, 1.6),
      color: 0x0284c7,
      onBuy: () => {
        shapesGroup.visible = true;
        onToast?.('تم إضافة المجسمات المعملية!');
      },
    });

    steps.push({
      label: 'سور الدور',
      cost: floorData.extras.wallCost,
      padText: `سور الدور — ${fmtCost(floorData.extras.wallCost)}`,
      pos: new THREE.Vector3(-1.5, yBase, 1.6),
      color: 0x64748b,
      onBuy: () => {
        wallGroup.visible = true;
        onToast?.('تم بناء سور الدور!');
      },
    });

    if (floorData.hasLabCoat && coatStandGroup) {
      steps.push({
        label: 'بالطو المعمل الأبيض',
        cost: floorData.coatCost,
        padText: `بالطو المعمل — ${fmtCost(floorData.coatCost)}`,
        pos: new THREE.Vector3(-2.5, yBase, 0.1),
        color: 0x0ea5e9,
        onBuy: () => {
          coatStandGroup.visible = true;
          coatOwned = true;
          setCoatState(true);
          if (coatRedPadPos) {
            coatRedPadGroup.position.copy(coatRedPadPos);
            coatRedPadGroup.visible = true;
          }
          onToast?.('لبست البالطو الأبيض! اقف على المربع الأحمر لخلعه أو لبسه');
        },
      });
    }

    if (floorData.unlockExport) {
      steps.push({
        label: 'تمديد الشارع الخارجي',
        cost: floorData.roadCost,
        padText: `الشارع الخارجي — ${fmtCost(floorData.roadCost)}`,
        pos: new THREE.Vector3(0, yBase, -3.3),
        color: 0x475569,
        onBuy: () => {
          ensureRoadBuilt();
          onToast?.('تم بناء الشارع الخارجي للتصدير!');
        },
      });

      steps.push({
        label: 'الزرع والأشجار بالخارج',
        cost: floorData.greeneryCost,
        padText: `الزرع والأشجار — ${fmtCost(floorData.greeneryCost)}`,
        pos: new THREE.Vector3(1.6, yBase, -3.3),
        color: 0x16a34a,
        onBuy: () => {
          ensureGreeneryBuilt();
          onToast?.('تمت زراعة المساحة الخارجية والأشجار!');
        },
      });

      steps.push({
        label: 'عربية التصدير الكبيرة',
        cost: floorData.truckCost,
        padText: `عربية التصدير — ${fmtCost(floorData.truckCost)}`,
        pos: new THREE.Vector3(-1.6, yBase, -3.3),
        color: 0x0284c7,
        onBuy: () => {
          ensureRoadBuilt();
          ensureExportTruckBuilt();
          onToast?.('عربية التصدير جاهزة لتحميل الشحنات وتصديرها للخارج!');
        },
      });
    }

    if (floorData.hasTrophy && trophyMesh) {
      steps.push({
        label: 'درع قمة المصنع',
        cost: floorData.trophyCost,
        padText: `درع القمة — ${fmtCost(floorData.trophyCost)}`,
        pos: new THREE.Vector3(0, yBase, 1.3),
        color: 0xeab308,
        onBuy: () => {
          trophyMesh.visible = true;
          onToast?.('مبروك! قفلت الدور الخامس بنجاح!');
        },
      });
    }

    if (stairsGroup && floorData.extras.nextFloorCost > 0) {
      steps.push({
        label: `سلم الدور ${floorIdx + 2}`,
        cost: floorData.extras.nextFloorCost,
        padText: `سلم الدور ${floorIdx + 2} — ${fmtCost(floorData.extras.nextFloorCost)}`,
        pos: new THREE.Vector3(0, yBase, 2.0),
        color: 0x16a34a,
        onBuy: () => {
          stairsGroup.visible = true;
          activateFloor(floorIdx + 1);
          onToast?.(`تم فتح سلم الدور ${floorIdx + 2}!`);
        },
      });
    }

    return {
      floorIdx,
      yBase,
      beltX,
      beltGroup,
      machineMeshes,
      colliders,
      steps,
      stepIndex: 0,
      completed: false,
      stairPos,
      stairsReady: () => Boolean(stairsGroup?.visible),
    };
  }

  function ensureRoadBuilt() {
    if (roadMesh) return;
    roadMesh = new THREE.Mesh(
      new THREE.BoxGeometry(5.5, 0.1, 34),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 })
    );
    roadMesh.position.set(0, 0.03, -22);
    roadMesh.receiveShadow = true;
    worldGroup.add(roadMesh);
  }

  function ensureGreeneryBuilt() {
    if (greeneryGroup) return;
    greeneryGroup = new THREE.Group();
    const treeOffsets = [
      [-6.5, -10], [6.5, -10], [-7.5, -18], [7.5, -18], [-6.5, -26], [6.5, -26],
    ];
    for (const [tx, tz] of treeOffsets) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.3, 1.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 })
      );
      trunk.position.set(tx, 0.7, tz);
      trunk.castShadow = true;
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(1.2, 2.4, 10),
        new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 })
      );
      crown.position.set(tx, 2.3, tz);
      crown.castShadow = true;
      greeneryGroup.add(trunk, crown);
    }
    worldGroup.add(greeneryGroup);
  }

  function ensureExportTruckBuilt() {
    if (exportTruck) return;
    exportTruck = new THREE.Group();
    exportTruck.position.set(0, 0.12, -8);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 1.4, 3.8),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
    );
    body.position.y = 0.7;
    body.castShadow = true;
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 1.1, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35 })
    );
    cab.position.set(0, 0.55, -2.35);
    cab.castShadow = true;

    exportTruck.add(body, cab);
    worldGroup.add(exportTruck);
  }

  function setNextPadForFloor(fRuntime) {
    if (activePad?.group) {
      scene.remove(activePad.group);
      activePad = null;
    }

    if (fRuntime.stepIndex >= fRuntime.steps.length) {
      fRuntime.completed = true;
      checkAllFloorsCompleted();
      return;
    }

    const currentStep = fRuntime.steps[fRuntime.stepIndex];
    activePad = createBuyPad(currentStep.pos, currentStep.color, currentStep.padText);
  }

  function activateFloor(idx) {
    const fRuntime = floorRuntime[idx];
    if (!fRuntime) return;
    if (!activePad && !fRuntime.completed) {
      setNextPadForFloor(fRuntime);
    }
  }

  function checkAllFloorsCompleted() {
    const allDone = floorRuntime.every((f) => f.completed);
    if (allDone && !rebirthPortalActive) {
      rebirthPortalActive = true;
      rebirthGroup.visible = true;
      onToast?.('اكتمل بناء كل الأدوار! ادخل البوابة في المنتصف للانتقال للـ Part التالي');
    }
  }

  function loadPart(newPartIdx) {
    clearWorld();
    partIndex = Math.max(0, Math.min(PARTS_DATA.length - 1, newPartIdx));
    const partData = getCurrentPart();

    for (let i = 0; i < partData.floors.length; i++) {
      floorRuntime.push(buildFloorStructure(partData.floors[i], i));
    }
    activateFloor(0);
    refreshHud();
    onPartChange?.(partData);
  }

  function triggerRebirth() {
    if (rebirthTriggered) return;
    rebirthTriggered = true;

    if (partIndex < PARTS_DATA.length - 1) {
      const nextIdx = partIndex + 1;
      money = 0;
      recentEarned = 0;
      incomePerSec = 0;
      loadPart(nextIdx);
      onToast?.(`انتقلت إلى ${PARTS_DATA[nextIdx].name}! صعوبة ومواد جديدة`);
    } else {
      onToast?.('أنت الآن في قمة Part 3 — أنهيت كل المراحل بنجاح!');
      rebirthTriggered = false;
    }
  }

  function spawnDropOnFloor(fRuntime) {
    const partData = getCurrentPart();
    const floorData = partData.floors[fRuntime.floorIdx];
    if (!floorData || !floorData.materials.length) return;

    const unlockedMachines = fRuntime.machineMeshes.filter((m) => m.unlocked);
    const matPool = floorData.materials;
    const mat = matPool[Math.floor(Math.random() * matPool.length)];

    let mult = partData.moneyMultiplier || 1;
    for (const m of unlockedMachines) {
      mult *= m.data.mult;
    }

    const mesh = new THREE.Mesh(
      createMaterialGeometry(mat.shape, mat.scale),
      new THREE.MeshStandardMaterial({
        color: mat.color,
        roughness: 0.35,
        metalness: 0.15,
      })
    );
    mesh.castShadow = true;

    const startZ = BELT_BASE_Z - BELT_HALF_LEN + 0.35;
    mesh.position.set(fRuntime.beltX, fRuntime.yBase + 0.42, startZ);
    scene.add(mesh);

    drops.push({
      mesh,
      floorIdx: fRuntime.floorIdx,
      z: startZ,
      endZ: BELT_BASE_Z + BELT_HALF_LEN + 0.35,
      value: mat.baseValue * mult,
    });
  }

  function updateDropsAndExport(dt) {
    const partData = getCurrentPart();
    let totalRate = 0;

    for (const fRuntime of floorRuntime) {
      const unlockedCount = fRuntime.machineMeshes.filter((m) => m.unlocked).length;
      if (unlockedCount === 0) continue;

      const floorData = partData.floors[fRuntime.floorIdx];
      let mult = partData.moneyMultiplier || 1;
      for (const m of fRuntime.machineMeshes) {
        if (m.unlocked) mult *= m.data.mult;
      }
      const avgMat =
        floorData.materials.reduce((acc, item) => acc + item.baseValue, 0) /
        Math.max(1, floorData.materials.length);
      totalRate += (avgMat * mult) / Math.max(0.25, partData.spawnInterval);
    }

    incomePerSec = totalRate;

    spawnTimer += dt;
    if (spawnTimer >= partData.spawnInterval) {
      spawnTimer = 0;
      for (const fRuntime of floorRuntime) {
        const hasMachine = fRuntime.machineMeshes.some((m) => m.unlocked);
        if (hasMachine) {
          spawnDropOnFloor(fRuntime);
        }
      }
    }

    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.z += partData.beltSpeed * dt;
      d.mesh.position.z = d.z;
      d.mesh.rotation.y += 2.2 * dt;

      if (d.z >= d.endZ) {
        if (exportTruck && truckState === 'idle') {
          pendingExportValue += d.value;
          if (pendingExportValue >= 250 * partData.costMultiplier) {
            truckState = 'outbound';
            truckTimer = 0;
          } else {
            money += d.value;
            recentEarned += d.value;
          }
        } else {
          money += d.value;
          recentEarned += d.value;
        }

        scene.remove(d.mesh);
        drops.splice(i, 1);
      }
    }

    if (exportTruck && truckState !== 'idle') {
      if (truckState === 'outbound') {
        exportTruck.position.z -= 7.5 * dt;
        if (exportTruck.position.z <= -36) {
          exportTruck.visible = false;
          truckState = 'waiting';
          truckTimer = 3.5;
        }
      } else if (truckState === 'waiting') {
        truckTimer -= dt;
        if (truckTimer <= 0) {
          const payout = pendingExportValue * 1.35;
          pendingExportValue = 0;
          money += payout;
          recentEarned += payout;
          exportTruck.position.z = -36;
          exportTruck.visible = true;
          truckState = 'returning';
        }
      } else if (truckState === 'returning') {
        exportTruck.position.z += 8.5 * dt;
        if (exportTruck.position.z >= -8) {
          exportTruck.position.z = -8;
          truckState = 'idle';
        }
      }
    }

    earnedTimer += dt;
    if (earnedTimer >= 1) {
      earnedTimer = 0;
      recentEarned = 0;
    }
  }

  function updateInteractions(dt) {
    if (buyCooldown > 0) buyCooldown -= dt;
    if (coatToggleCooldown > 0) coatToggleCooldown -= dt;

    const pPos = getPlayerPos?.();
    if (!pPos) {
      promptEl.style.display = 'none';
      return;
    }

    let nearPrompt = '';

    for (const fRuntime of floorRuntime) {
      if (fRuntime.completed || fRuntime.stepIndex >= fRuntime.steps.length) continue;
      const step = fRuntime.steps[fRuntime.stepIndex];
      const dx = pPos.x - step.pos.x;
      const dz = pPos.z - step.pos.z;
      const dy = Math.abs(pPos.y - step.pos.y);
      const distSq = dx * dx + dz * dz;

      if (dy < 1.8 && distSq < 2.2 * 2.2) {
        nearPrompt = step.padText;
      }

      if (dy < 1.8 && distSq < 1.15 * 1.15) {
        if (money >= step.cost) {
          money -= step.cost;
          fRuntime.stepIndex += 1;
          step.onBuy();
          setNextPadForFloor(fRuntime);
          refreshHud();
        } else {
          showNeedMoney(step.cost, step.label);
        }
        break;
      }
    }

    if (coatOwned && coatRedPadGroup.visible && coatToggleCooldown <= 0) {
      const cx = coatRedPadGroup.position.x;
      const cy = coatRedPadGroup.position.y;
      const cz = coatRedPadGroup.position.z;
      const dx = pPos.x - cx;
      const dz = pPos.z - cz;
      const dy = Math.abs(pPos.y - cy);

      if (dy < 1.6 && dx * dx + dz * dz < 1.05 * 1.05) {
        coatToggleCooldown = 1.1;
        setCoatState(!coatEquipped);
        onToast?.(coatEquipped ? 'تم لبس البالطو الأبيض' : 'تم خلع البالطو الأبيض');
      }
    }

    if (rebirthPortalActive && !rebirthTriggered) {
      const dx = pPos.x - rebirthGroup.position.x;
      const dz = pPos.z - rebirthGroup.position.z;
      if (Math.abs(pPos.y) < 2.2 && dx * dx + dz * dz < 2.2 * 2.2) {
        triggerRebirth();
      }
    }

    if (nearPrompt) {
      promptEl.textContent = nearPrompt;
      promptEl.style.display = 'block';
    } else {
      promptEl.style.display = 'none';
    }
  }

  function resolveHorizontalCollisions(pos, radius = 0.35) {
    for (const fRuntime of floorRuntime) {
      for (const c of fRuntime.colliders) {
        if (!c.activeWhen()) continue;
        if (pos.y < c.yMin - 0.1 || pos.y > c.yMax) continue;

        const closestX = Math.max(c.minX, Math.min(pos.x, c.maxX));
        const closestZ = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
        const dx = pos.x - closestX;
        const dz = pos.z - closestZ;
        const distSq = dx * dx + dz * dz;

        if (distSq < radius * radius) {
          const dist = Math.sqrt(distSq) || 0.001;
          const overlap = radius - dist;
          pos.x += (dx / dist) * overlap;
          pos.z += (dz / dist) * overlap;
        }
      }
    }
  }

  function getGroundHeightAt(x, z, currentY = 0) {
    let bestY = 0;

    for (const fRuntime of floorRuntime) {
      const inSlabX = Math.abs(x) <= 5.5;
      const inSlabZ = Math.abs(z) <= 4.5;
      if (inSlabX && inSlabZ) {
        if (fRuntime.yBase === 0 || currentY >= fRuntime.yBase - 0.25) {
          bestY = Math.max(bestY, fRuntime.yBase);
        }
      }

      if (fRuntime.stairsReady()) {
        const sx = fRuntime.stairPos.x;
        const sz = fRuntime.stairPos.z;
        const stepCount = 10;
        const totalDepth = stepCount * 0.32;
        if (Math.abs(x - sx) <= 1.1 && z <= sz + 0.3 && z >= sz - totalDepth) {
          const progress = Math.max(0, Math.min(1, (sz - z) / totalDepth));
          const rampY = fRuntime.yBase + progress * FLOOR_HEIGHT;
          if (currentY + 1.5 >= rampY) {
            bestY = Math.max(bestY, rampY);
          }
        }
      }
    }

    return bestY;
  }

  function update(dt) {
    const safeDt = Math.min(0.05, dt || 0);
    updateDropsAndExport(safeDt);
    updateInteractions(safeDt);

    if (rebirthGroup.visible) {
      outerVortex.rotation.z += 1.6 * safeDt;
      outerVortex.rotation.x += 0.6 * safeDt;
      innerCore.rotation.z -= 2.4 * safeDt;
    }

    refreshHud();
    leaderboard.update(safeDt, money, getCurrentPart().partNumber);
  }

  function addMoney(amount) {
    money += Number(amount) || 0;
    refreshHud();
  }

  loadPart(0);

  return {
    update,
    getGroundHeightAt,
    resolveHorizontalCollisions,
    getMoney: () => money,
    getPartNumber: () => getCurrentPart().partNumber,
    hasLabCoat: () => coatEquipped,
    addMoney,
  };
}
