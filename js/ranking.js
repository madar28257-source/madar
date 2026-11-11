// ==========================================
// 🏆 صفحة التصنيف
// ==========================================
import { auth, db } from "../firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { collection, query, orderBy, limit, where, getDocs, getCountFromServer }
  from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { syncMyLeaderboard, WEIGHTS, XP_FULL } from "./ranking-core.js";

const TOP = 20, CACHE_MS = 2 * 60 * 1000;
const $ = (id) => document.getElementById(id);
const medals = ["🥇", "🥈", "🥉"];
const fmt = (n) => Number(n).toLocaleString("ar-EG", { maximumFractionDigits: 1 });
let me = null, token = 0;

onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = "index.html"; return; }
  try { me = await syncMyLeaderboard(user); }
  catch (e) { console.error(e); return setState("تعذّر تحميل التصنيف. تأكد من الإنترنت وأعد المحاولة.", true); }
  if (!me.examCount) return setState("ابدأ بحل أول امتحان وسيظهر ترتيبك هنا 🚀");

  const sel = $("rk-select");
  Object.entries(me.subjects).sort((a, b) => a[1].n.localeCompare(b[1].n, "ar")).forEach(([k, s]) => {
    const o = document.createElement("option"); o.value = k; o.textContent = s.n; sel.appendChild(o);
  });
  sel.disabled = false;
  sel.addEventListener("change", () => load(sel.value));
  load("global");
});

function setState(text, isError = false) {
  const s = $("rk-state"); s.textContent = text; s.hidden = false; s.classList.toggle("err", isError);
  $("rk-list").hidden = true; $("rk-me").hidden = true;
}

async function load(mode) {
  const my = ++token;
  setState("جاري التحميل...");
  const isGlobal = mode === "global";
  const field = isGlobal ? "score" : `subjects.${mode}.a`;
  const myVal = isGlobal ? me.score : me.subjects[mode] && me.subjects[mode].a;
  const cacheKey = `madar_rk_${me.grade}_${mode}`;
  let data = null;
  try { const c = JSON.parse(sessionStorage.getItem(cacheKey) || "null"); if (c && Date.now() - c.t < CACHE_MS && c.v === myVal) data = c; } catch (_) {}

  if (!data) {
    try {
      const col = collection(db, "leaderboards", me.grade, "students");
      const snap = await getDocs(query(col, orderBy(field, "desc"), limit(TOP)));
      const rows = snap.docs.map((d) => ({ uid: d.id, name: d.data().name, value: isGlobal ? d.data().score : (d.data().subjects[mode] || {}).a }));
      let rank = rows.findIndex((r) => r.uid === me.uid) + 1;
      if (!rank && myVal != null) rank = (await getCountFromServer(query(col, where(field, ">", myVal)))).data().count + 1;   // ترتيبي لو برا العشرين الأوائل
      data = { t: Date.now(), v: myVal, rows, rank };
      try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch (_) {}
    } catch (e) { console.error(e); if (my === token) setState("تعذّر تحميل التصنيف. حاول مرة أخرى بعد قليل.", true); return; }
  }
  if (my !== token) return;   // اختار الطالب خيارًا آخر أثناء التحميل

  $("rk-state").hidden = true;
  $("rk-my-rank").textContent = data.rank ? `#${fmt(data.rank)}` : "—";
  $("rk-my-label").textContent = isGlobal ? "نقاطك" : "متوسطك في المادة";
  $("rk-my-value").textContent = myVal != null ? fmt(myVal) + (isGlobal ? "" : "٪") : "—";
  $("rk-me").hidden = false;

  const list = $("rk-list"); list.textContent = "";
  data.rows.forEach((r, i) => {
    const li = document.createElement("li");
    li.className = "rk-row" + (r.uid === me.uid ? " me" : "") + (i < 3 ? ` top${i + 1}` : "");
    const rk = document.createElement("span"); rk.className = "rk-pos"; rk.textContent = i < 3 ? medals[i] : fmt(i + 1);
    const nm = document.createElement("span"); nm.className = "rk-name"; nm.textContent = r.name || "طالب";
    if (r.uid === me.uid) { const b = document.createElement("em"); b.textContent = "أنت"; nm.appendChild(b); }
    const val = document.createElement("span"); val.className = "rk-val"; val.textContent = fmt(r.value) + (isGlobal ? "" : "٪");
    li.append(rk, nm, val); list.appendChild(li);
  });
  list.hidden = !data.rows.length;
  $("rk-note").textContent = isGlobal
    ? `النقاط = ${WEIGHTS.exams * 100}٪ من متوسط درجات كل الامتحانات + ${WEIGHTS.xp * 100}٪ من نقاط الخبرة (XP)، والـ XP يكمل عند ${fmt(XP_FULL)}.`
    : "الترتيب بمتوسط درجاتك في امتحانات هذه المادة.";
}
