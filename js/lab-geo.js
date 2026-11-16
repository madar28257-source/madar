// ==========================================
// 📐 هندسة الشخصية والصب (رياضيات بس، بدون رسم)
// ==========================================
// الشخصية بتواجه +z، وذراعها اليمنى عند x = -SH_X. الدوران حول y بزاوية yaw.

export const G = {
  HIP_Y: 1.6, SH_Y: 3.2, SH_X: 0.95, ARM: 1.7,   // أبعاد الجسم
  GRIP_TO_MOUTH: 0.97,                           // من قبضة اليد لفم الزجاجة
  A_CARRY: -1.2, A_POUR: -2.6, TILT_POUR: 1.3,   // زاوية الذراع (حمل / صب) وميل الزجاجة
  RIM_Y: 4.58                                    // حافة الكأس
};

// موضع فم الزجاجة في العالم: S = {x,z} موضع الشخصية، a زاوية الذراع، tilt ميل الزجاجة
export function mouthWorld(S, yaw, a, tilt) {
  const hx = -G.SH_X, hy = G.SH_Y - G.ARM * Math.cos(a), hz = -G.ARM * Math.sin(a);
  const my = hy + Math.cos(tilt) * G.GRIP_TO_MOUTH, mz = hz + Math.sin(tilt) * G.GRIP_TO_MOUTH;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { x: S.x + hx * c + mz * s, y: my, z: S.z - hx * s + mz * c };
}

// مكان وقوف الشخصية عشان فم الزجاجة يبقى فوق محور الكأس بالظبط
export function pourStance(from, beaker = { x: 0, z: 0 }) {
  let fx = beaker.x - from.x, fz = beaker.z - from.z;
  const d = Math.hypot(fx, fz) || 1; fx /= d; fz /= d;
  const yaw = Math.atan2(fx, fz);
  const fwd = -G.ARM * Math.sin(G.A_POUR) + Math.sin(G.TILT_POUR) * G.GRIP_TO_MOUTH;   // المسافة الأمامية لفم الزجاجة
  const lx = Math.cos(yaw), lz = -Math.sin(yaw);                                          // المحور المحلي x في العالم
  return { S: { x: beaker.x - fx * fwd + G.SH_X * lx, z: beaker.z - fz * fwd + G.SH_X * lz }, yaw };
}
