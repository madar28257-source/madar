// ==========================================
// 🏆 قلب التصنيف — حساب نقاط الطالب وحفظ ملخصه
// ==========================================
// كل طالب له مستند واحد صغير: leaderboards/{الصف}/students/{uid}
// والتصنيف يقرأ أعلى 20 مستند فقط، فاستهلاك القراءات قليل جدًا.

import { auth, db } from "../firebase.js";
import { doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

// ⚙️ طريقة الحساب (غيّرها من هنا فقط)
export const WEIGHTS = { exams: 0.7, xp: 0.3 };   // 70٪ درجات الامتحانات + 30٪ الـ XP
export const XP_FULL = 3000;                      // الـ XP اللي يحصّل عنده الطالب الدرجة الكاملة في جزء الـ XP
const SYNC_EVERY_MS = 30 * 60 * 1000;             // لا نعيد الحساب أكثر من مرة كل 30 دقيقة (إلا بعد الامتحان)

// مفتاح إنجليزي ثابت لاسم المادة (لأن أسماء الحقول في Firestore لا تحب الرموز)
export function subjectKey(name) {
  let h = 2166136261;
  for (const ch of String(name)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return "s" + h.toString(36);
}

// الاسم الأول والثاني فقط (خصوصية)
export const shortName = (n) => String(n || "طالب").trim().split(/\s+/).slice(0, 2).join(" ");

const round1 = (x) => Math.round(x * 10) / 10;
const pct = (r) => Number.isFinite(Number(r.percentage)) ? Number(r.percentage)
  : (Number(r.totalMarks) ? (Number(r.score) / Number(r.totalMarks)) * 100 : 0);

// النقاط العامة من متوسط الدرجات والـ XP (النتيجة من 100)
export function globalScore(avg, xp) {
  const xpPart = Math.min(100, (Math.max(0, xp) / XP_FULL) * 100);
  return round1(WEIGHTS.exams * avg + WEIGHTS.xp * xpPart);
}

export function summarize(results, xp) {
  const subjects = {};
  let sum = 0;
  results.forEach((r) => {
    const p = pct(r), name = r.subject || "اختبار عام", k = subjectKey(name);
    const s = (subjects[k] = subjects[k] || { n: name, c: 0, t: 0 });
    s.c += 1; s.t += p; sum += p;
  });
  Object.values(subjects).forEach((s) => { s.a = round1(s.t / s.c); delete s.t; });
  const avg = results.length ? round1(sum / results.length) : 0;
  return { examCount: results.length, avg, xp, score: globalScore(avg, xp), subjects };
}

// يحسب ملخص الطالب ويحفظه. force=true بعد الامتحان مباشرة.
export async function syncMyLeaderboard(user, { force = false } = {}) {
  const cacheKey = "madar_lb_me";
  try {
    const c = JSON.parse(localStorage.getItem(cacheKey) || "null");
    if (!force && c && c.uid === user.uid && Date.now() - c.t < SYNC_EVERY_MS) return c.data;
  } catch (_) {}

  const snap = await getDoc(doc(db, "users", user.uid));
  const u = snap.exists() ? snap.data() : {};
  const grade = u.gradeLevel || "unknown";
  const rs = await getDocs(query(collection(db, "results"), where("studentId", "==", user.uid)));
  const sm = summarize(rs.docs.map((d) => d.data()), Number(u.xp) || 0);

  const data = { uid: user.uid, grade, ...sm };
  if (sm.examCount > 0) {   // نرتّب فقط من دخل امتحانًا واحدًا على الأقل
    await setDoc(doc(db, "leaderboards", grade, "students", user.uid), {
      name: shortName(u.name || user.displayName), ...sm, updatedAt: serverTimestamp()
    });
  }
  try { localStorage.setItem(cacheKey, JSON.stringify({ uid: user.uid, t: Date.now(), data })); } catch (_) {}
  return data;
}
