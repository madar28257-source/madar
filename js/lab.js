import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// إعداد المشهد الأساسي
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0a14, 0.02);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 25);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const pointLight = new THREE.PointLight(0x7c3aed, 2, 50);
pointLight.position.set(10, 10, 10);
scene.add(pointLight);
const pointLight2 = new THREE.PointLight(0x22d3ee, 2, 50);
pointLight2.position.set(-10, -10, -10);
scene.add(pointLight2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.5;
controls.enablePan = false;
controls.minDistance = 10;
controls.maxDistance = 50;

const urlParams = new URLSearchParams(window.location.search);
const subject = urlParams.get('subject') || 'science'; 

const labTitle = document.getElementById('lab-title');
const labDesc = document.getElementById('lab-desc');
const labFeatures = document.getElementById('lab-features');

let sceneObject = new THREE.Group();
let animationFunction = () => {}; 

function buildScienceLab() {
  labTitle.textContent = "الذرة (Atom) ⚛️";
  labDesc.textContent = "مجسم تفاعلي للنواة والإلكترونات.";
  labFeatures.innerHTML = `<li><span style="color: #ff4d4d;">🔴 بروتونات ونيوترونات:</span> توجد في النواة.</li><li><span style="color: #00d2ff;">🔵 الإلكترونات:</span> تدور حول النواة.</li>`;
  
  const nucleusGroup = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const geo = new THREE.SphereGeometry(0.6, 16, 16);
    const mat = new THREE.MeshStandardMaterial({ color: i%2===0 ? 0xff4d4d : 0x4d4dff });
    const sphere = new THREE.Mesh(geo, mat);
    sphere.position.set((Math.random()-0.5)*2, (Math.random()-0.5)*2, (Math.random()-0.5)*2);
    nucleusGroup.add(sphere);
  }
  sceneObject.add(nucleusGroup);

  const electrons = [];
  const colors = [0x00d2ff, 0x22c55e, 0xd946ef];
  for (let i = 0; i < 3; i++) {
    const r = 5 + (i * 2);
    const orbitGeo = new THREE.TorusGeometry(r, 0.05, 16, 100);
    const orbitMat = new THREE.MeshBasicMaterial({ color: colors[i], transparent: true, opacity: 0.3 });
    const orbit = new THREE.Mesh(orbitGeo, orbitMat);
    orbit.rotation.x = Math.PI / 2;
    orbit.rotation.y = i * Math.PI / 3;
    sceneObject.add(orbit);

    const eGeo = new THREE.SphereGeometry(0.4, 16, 16);
    const eMat = new THREE.MeshStandardMaterial({ color: colors[i], emissive: colors[i], emissiveIntensity: 1 });
    const e = new THREE.Mesh(eGeo, eMat);
    sceneObject.add(e);
    electrons.push({ mesh: e, radius: r, speed: 0.01 + (i*0.005), angle: Math.random()*Math.PI*2, rot: orbit.rotation.clone() });
  }

  animationFunction = (time) => {
    nucleusGroup.scale.setScalar(1 + Math.sin(time * 2) * 0.05);
    electrons.forEach(d => {
      d.angle += d.speed;
      const v = new THREE.Vector3(Math.cos(d.angle)*d.radius, 0, Math.sin(d.angle)*d.radius);
      v.applyEuler(d.rot);
      d.mesh.position.copy(v);
    });
  };
}

function buildMathLab() {
  labTitle.textContent = "المجسم الهندسي (Geometry) 📐";
  labDesc.textContent = "مجسم ثلاثي الأبعاد متشابك يمثل النسب الرياضية.";
  labFeatures.innerHTML = `<li><span style="color: #f59e0b;">✨ نقاط التقاء:</span> تمثل الزوايا الهندسية.</li><li><span style="color: #00d2ff;">🔷 الخطوط:</span> تمثل المستقيمات في الفضاء.</li>`;
  
  const geo = new THREE.TorusKnotGeometry(5, 1, 128, 16, 3, 4);
  const mat = new THREE.MeshStandardMaterial({ color: 0x7c3aed, wireframe: true, emissive: 0x22d3ee, emissiveIntensity: 0.5 });
  const mesh = new THREE.Mesh(geo, mat);
  sceneObject.add(mesh);
  
  const pointsGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(geo.attributes.position.array);
  pointsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pointsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 });
  const points = new THREE.Points(pointsGeo, pointsMat);
  sceneObject.add(points);

  animationFunction = (time) => {
    mesh.rotation.x = time * 0.2;
    mesh.rotation.y = time * 0.3;
    points.rotation.copy(mesh.rotation);
  };
}

function buildPhysicsLab() {
  labTitle.textContent = "البندول (Pendulum) ⏱️";
  labDesc.textContent = "محاكاة لحركة البندول وقوانين الجذب.";
  labFeatures.innerHTML = `<li><span style="color: #22c55e;">⚖️ نقطة التعليق:</span> النقطة الثابتة.</li><li><span style="color: #f59e0b;">⚡ كتلة البندول:</span> تتحرك بفعل الجاذبية.</li>`;

  const pivot = new THREE.Group();
  sceneObject.add(pivot);
  const rodGeo = new THREE.CylinderGeometry(0.1, 0.1, 10);
  rodGeo.translate(0, -5, 0);
  const rodMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.8 });
  const rod = new THREE.Mesh(rodGeo, rodMat);
  pivot.add(rod);

  const bobGeo = new THREE.SphereGeometry(1.5, 32, 32);
  const bobMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.5 });
  const bob = new THREE.Mesh(bobGeo, bobMat);
  bob.position.y = -10;
  pivot.add(bob);

  animationFunction = (time) => { pivot.rotation.z = Math.sin(time * 2) * 0.8; };
}

function buildGeographyLab() {
  labTitle.textContent = "الكرة الأرضية (Globe) 🌍";
  labDesc.textContent = "مجسم الكوكب وخطوط الطول والعرض.";
  labFeatures.innerHTML = `<li><span style="color: #22c55e;">🟢 خطوط العرض:</span> دوائر موازية لخط الاستواء.</li><li><span style="color: #00d2ff;">🔵 خطوط الطول:</span> دوائر تمر بالقطبين.</li>`;

  const geo = new THREE.SphereGeometry(7, 36, 18);
  const mat = new THREE.MeshBasicMaterial({ color: 0x00d2ff, wireframe: true, transparent: true, opacity: 0.6 });
  const globe = new THREE.Mesh(geo, mat);
  sceneObject.add(globe);

  const coreGeo = new THREE.SphereGeometry(6.9, 32, 16);
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x0a0a14, roughness: 0.8 });
  const core = new THREE.Mesh(coreGeo, coreMat);
  sceneObject.add(core);

  animationFunction = (time) => { globe.rotation.y = time * 0.1; };
}

function buildHistoryLab() {
  labTitle.textContent = "الهرم (Pyramid) 🏛️";
  labDesc.textContent = "مجسم هندسي يحاكي عظمة الحضارة المصرية القديمة.";
  labFeatures.innerHTML = `<li><span style="color: #f59e0b;">🔶 القاعدة:</span> مربعة الشكل.</li><li><span style="color: #22c55e;">🔺 الأوجه:</span> 4 مثلثات تلتقي في القمة.</li>`;

  const geo = new THREE.ConeGeometry(6, 8, 4);
  geo.rotateY(Math.PI / 4);
  const mat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, wireframe: false, flatShading: true });
  const pyramid = new THREE.Mesh(geo, mat);
  
  const edges = new THREE.EdgesGeometry(geo);
  const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 }));
  pyramid.add(line);
  sceneObject.add(pyramid);

  animationFunction = (time) => { pyramid.position.y = Math.sin(time * 2) * 0.5; };
}

switch (subject) {
  case 'الرياضيات': buildMathLab(); break;
  case 'الفيزياء': buildPhysicsLab(); break;
  case 'الجغرافيا': 
  case 'الدراسات الاجتماعية': buildGeographyLab(); break;
  case 'التاريخ': buildHistoryLab(); break;
  default: buildScienceLab(); break;
}

scene.add(sceneObject);

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();
  animationFunction(time);
  controls.update();
  renderer.render(scene, camera);
}

let isAutoRotating = true;
document.getElementById('toggle-rotation').addEventListener('click', (e) => {
  isAutoRotating = !isAutoRotating;
  controls.autoRotate = isAutoRotating;
  e.target.textContent = isAutoRotating ? 'إيقاف الدوران التلقائي' : 'تشغيل الدوران التلقائي';
});

// 🔥 السحر الجديد: فتح وقفل لوحة المعلومات
const infoPanel = document.getElementById('info-panel');
const infoHeader = document.getElementById('info-header');

// بنخليها مقفولة افتراضياً على الموبايل
if (window.innerWidth < 768) {
  infoPanel.classList.add('collapsed');
}

infoHeader.addEventListener('click', () => {
  infoPanel.classList.toggle('collapsed');
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

setTimeout(() => {
  const loader = document.getElementById('loading-screen');
  loader.style.opacity = '0';
  setTimeout(() => { loader.style.display = 'none'; }, 500);
  animate();
}, 1000);
