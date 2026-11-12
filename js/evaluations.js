// ==========================================
// 📝 صفحة التقييمات (للطالب)
// ==========================================
// الأدمن بيضيف التقييمات من admin/admin-evaluations.html (js/admin-evaluations.js)،
// والطالب هنا بيشوف تقييمات صفّه ومجموعته.

import { auth, db } from "../firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs }
  from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const GROUP_KEY = "madar_eval_group";
let all = [];

// رابط الصورة: نقبل http/https فقط، ونحوّل روابط Google Drive لرابط صورة مباشر
function imageSrc(url) {
  const u = String(url || "").trim();
  if (!/^https?:\/\//i.test(u)) return "";
  const drive = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/);
  return drive ? `https://drive.google.com/thumbnail?id=${drive[1]}&sz=w1600` : u;
}

function setState(text, spinner = false) {
  const s = $("state");
  s.textContent = "";
  if (spinner) { const sp = document.createElement("div"); sp.className = "spinner"; s.appendChild(sp); }
  s.appendChild(document.createTextNode(text));
  s.hidden = false;
  $("evaluations-grid").textContent = "";
}

const select = $("group-select");
try { const saved = localStorage.getItem(GROUP_KEY); if (saved && [...select.options].some((o) => o.value === saved)) select.value = saved; } catch (_) {}
select.addEventListener("change", () => { try { localStorage.setItem(GROUP_KEY, select.value); } catch (_) {} render(); });

onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = "index.html"; return; }
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    const grade = snap.exists() ? snap.data().gradeLevel : "";
    if (!grade || grade === "3-prep") return setState("لا توجد تقييمات متاحة لصفك الدراسي.");
    const res = await getDocs(query(collection(db, "evaluations"), where("gradeLevel", "==", grade)));
    all = res.docs.map((d) => d.data()).sort((a, b) => ((b.createdAt && b.createdAt.seconds) || 0) - ((a.createdAt && a.createdAt.seconds) || 0));
    render();
  } catch (e) {
    console.error(e);
    setState("تعذّر تحميل التقييمات. تأكد من الإنترنت وأعد المحاولة.");
  }
});

function render() {
  const list = all.filter((e) => e.group === select.value);
  const grid = $("evaluations-grid");
  grid.textContent = "";
  if (!list.length) return setState(`لا توجد تقييمات للمجموعة ${select.value} حتى الآن.`);
  $("state").hidden = true;

  list.forEach((e) => {
    const src = imageSrc(e.imageUrl);
    const card = document.createElement("article");
    card.className = "eval-card";

    const head = document.createElement("div");
    head.className = "eval-header";
    const subj = document.createElement("span"); subj.className = "subject-badge"; subj.textContent = e.subject || "";
    const grp = document.createElement("span"); grp.className = "group-badge"; grp.textContent = `المجموعة ${e.group}`;
    head.append(subj, grp);

    const title = document.createElement("h3");
    title.className = "eval-title"; title.textContent = e.title || "";

    const box = document.createElement("div");
    box.className = "eval-image-container";
    if (src) {
      const img = document.createElement("img");
      img.src = src; img.alt = e.title || "تقييم"; img.loading = "lazy";
      img.addEventListener("error", () => { box.textContent = "تعذّر تحميل الصورة"; box.style.cssText = "display:grid;place-items:center;color:#9ca3af"; });
      const ov = document.createElement("div"); ov.className = "image-overlay"; ov.textContent = "🔍 اضغط للتكبير";
      box.append(img, ov);
      box.addEventListener("click", () => {
        if (window.Swal) window.Swal.fire({ imageUrl: src, imageAlt: e.title, title: e.title, showConfirmButton: false, showCloseButton: true, width: "auto", background: "#12121f", color: "#fff" });
        else window.open(src, "_blank", "noopener");
      });
    } else {
      box.textContent = "لا توجد صورة"; box.style.cssText = "display:grid;place-items:center;color:#9ca3af;cursor:default";
    }
    card.append(head, title, box);
    grid.appendChild(card);
  });
}
