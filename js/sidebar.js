// ==========================================
// 📱 الشريط العلوي + القائمة الجانبية — منصة مدار
// ==========================================
// يُحمَّل تلقائيًا من firebase.js في صفحات الطالب، فلا تحتاج لتعديل أي صفحة.
// - الشريط العلوي: زر القائمة ☰ على اليمين، واسم MADAR على الشمال.
// - القائمة: الروابط فوق، والحساب وتسجيل الخروج تحت خالص.
// - الشريط القديم (.navbar) يتخبّى بـ CSS فقط، فلا يتكسر أي كود في الصفحات.

import { auth, db } from "../firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

// الصفحات التي يظهر فيها الشريط (أضف أي صفحة هنا لو احتجت)
const PAGES = ["dashboard", "books", "evaluations", "profile", "subject", "teams", "tower", "lab", "planner", "schedule", "ranking"];

// الروابط اللي فوق.
const ITEMS = [
  { page: "dashboard",   href: "dashboard.html",   icon: "🏠", label: "الرئيسية" },
  { page: "books",       href: "books.html",       icon: "📚", label: "الكتب" },
  { page: "evaluations", href: "evaluations.html", icon: "📝", label: "التقييمات", key: "evaluations" },
  { page: "teams",       href: "teams.html",       icon: "🤝", label: "الفرق" },
  { page: "ranking",     href: "ranking.html",     icon: "🏆", label: "التصنيف" },
  { page: "schedule",    href: "schedule.html",    icon: "📅", label: "جدول الامتحانات" }
];

const CACHE = "madar_sidebar_user";
let closeDrawer = () => {};   // يُضبط داخل init
const current = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "");

if (PAGES.includes(current) && !document.getElementById("madar-bar")) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
}

function init() {
  injectStyles();

  const links = ITEMS.filter((i) => i.enabled !== false).map((i) =>
    `<a class="sb-link${i.page === current ? " active" : ""}" href="${i.href}"${i.key ? ` data-key="${i.key}"` : ""}>
       <span class="sb-ico">${i.icon}</span><span>${i.label}</span></a>`).join("");

  const bar = document.createElement("header");
  bar.id = "madar-bar";
  bar.innerHTML = `
    <button type="button" id="sb-open" class="sb-menu" aria-label="فتح القائمة" aria-controls="madar-drawer" aria-expanded="false">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
    </button>
    <a class="sb-logo" href="dashboard.html">🎓 MADAR</a>`;

  const overlay = document.createElement("div");
  overlay.id = "madar-overlay";

  const drawer = document.createElement("aside");
  drawer.id = "madar-drawer";
  drawer.setAttribute("aria-label", "القائمة الرئيسية");
  drawer.innerHTML = `
    <div class="sb-head"><span class="sb-logo">🎓 MADAR</span>
      <button type="button" id="sb-close" class="sb-menu" aria-label="إغلاق القائمة">✕</button></div>
    <nav class="sb-nav">${links}</nav>
    <div class="sb-bottom">
      <a class="sb-account" href="profile.html">
        <span class="sb-avatar" id="sb-avatar">م</span>
        <span class="sb-who"><b id="sb-name">حسابي</b><small>الحساب</small></span>
      </a>
      <button type="button" id="sb-logout" class="sb-logout"><span class="sb-ico">🚪</span><span>تسجيل الخروج</span></button>
    </div>`;

  const oldBar = document.querySelector(".navbar");
  if (oldBar) oldBar.before(bar); else document.body.prepend(bar);
  document.body.append(overlay, drawer);

  const openBtn = bar.querySelector("#sb-open");
  const open = () => { drawer.classList.add("open"); overlay.classList.add("show"); openBtn.setAttribute("aria-expanded", "true"); document.body.style.overflow = "hidden"; };
  const close = () => { drawer.classList.remove("open"); overlay.classList.remove("show"); openBtn.setAttribute("aria-expanded", "false"); document.body.style.overflow = ""; };
  closeDrawer = close;
  openBtn.addEventListener("click", open);
  drawer.querySelector("#sb-close").addEventListener("click", close);
  overlay.addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  drawer.querySelector("#sb-logout").addEventListener("click", logout);

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;   // الصفحات نفسها هي اللي تحوّل غير المسجّل لصفحة الدخول
    const cached = readCache(user.uid);
    if (cached) return show(cached);
    let info = { uid: user.uid, name: user.displayName || "حسابي", grade: "" };
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) info = { uid: user.uid, name: snap.data().name || info.name, grade: snap.data().gradeLevel || "" };
      sessionStorage.setItem(CACHE, JSON.stringify(info));   // قراءة واحدة فقط في الجلسة
    } catch (_) { /* نعرض الاسم المتاح */ }
    show(info);
  });

  function show(info) {
    drawer.querySelector("#sb-name").textContent = info.name;
    drawer.querySelector("#sb-avatar").textContent = (info.name || "م").trim().charAt(0) || "م";
    if (info.grade === "3-prep") drawer.querySelectorAll('[data-key="evaluations"]').forEach((a) => a.remove());   // نفس شرط الصفحة الرئيسية القديم
  }
}

function readCache(uid) {
  try { const c = JSON.parse(sessionStorage.getItem(CACHE) || "null"); return c && c.uid === uid ? c : null; } catch (_) { return null; }
}

async function logout() {
  closeDrawer();   // نقفل القائمة أولًا حتى تظهر رسالة التأكيد فوق الصفحة بدون تعارض
  const go = () => signOut(auth).then(() => { sessionStorage.removeItem(CACHE); location.href = "index.html"; });
  if (window.Swal) {
    const r = await window.Swal.fire({ title: "تسجيل الخروج", text: "هل أنت متأكد من الخروج؟", icon: "warning", showCancelButton: true,
      confirmButtonColor: "#ef4444", cancelButtonColor: "#2a2a3e", confirmButtonText: "نعم، خروج", cancelButtonText: "إلغاء", background: "#12121f", color: "#fff" });
    if (r.isConfirmed) go();
  } else if (confirm("هل أنت متأكد من الخروج؟")) go();
}

function injectStyles() {
  const s = document.createElement("style");
  s.id = "madar-sidebar-css";
  s.textContent = `
  .navbar { display: none !important; }
  #madar-bar { position: sticky; top: 0; z-index: 900; display: flex; align-items: center; gap: 12px; padding: 10px 16px;
    background: rgba(11,12,16,.78); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-bottom: 1px solid rgba(255,255,255,.08); direction: rtl; }
  #madar-bar .sb-logo { margin-inline-start: auto; }
  .sb-logo { font-weight: 900; font-size: 1.35rem; color: #fff; text-decoration: none; letter-spacing: .5px; }
  .sb-menu { width: 42px; height: 42px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.12); border-radius: 12px; background: rgba(255,255,255,.06); color: #fff; font-size: 1.1rem; cursor: pointer; font-family: inherit; }
  .sb-menu:hover { background: rgba(255,255,255,.12); }
  #madar-overlay { position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,.55); opacity: 0; pointer-events: none; transition: opacity .25s; }
  #madar-overlay.show { opacity: 1; pointer-events: auto; }
  #madar-drawer { position: fixed; top: 0; bottom: 0; right: 0; z-index: 10001; width: min(310px, 84vw); display: flex; flex-direction: column; direction: rtl;
    background: linear-gradient(180deg, rgba(25,27,44,.98), rgba(14,14,26,.99)); border-left: 1px solid rgba(255,255,255,.1); box-shadow: -10px 0 40px rgba(0,0,0,.5);
    transform: translateX(105%); transition: transform .28s ease; font-family: inherit; color: #fff; }
  #madar-drawer.open { transform: translateX(0); }
  .sb-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,.08); }
  .sb-nav { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 4px; }
  .sb-link, .sb-logout { display: flex; align-items: center; gap: 12px; padding: 13px 14px; border-radius: 12px; color: #d9dbe8; text-decoration: none; font-weight: 700; font-size: 1rem; border: 0; background: none; width: 100%; font-family: inherit; cursor: pointer; text-align: right; }
  .sb-link:hover { background: rgba(255,255,255,.07); color: #fff; }
  .sb-link.active { background: linear-gradient(90deg, rgba(245,158,11,.22), rgba(239,68,68,.12)); color: #fff; box-shadow: inset -3px 0 0 #f59e0b; }
  .sb-ico { width: 26px; text-align: center; font-size: 1.2rem; }
  .sb-bottom { padding: 12px; border-top: 1px solid rgba(255,255,255,.08); display: flex; flex-direction: column; gap: 6px; padding-bottom: max(12px, env(safe-area-inset-bottom)); }
  .sb-account { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; text-decoration: none; color: #fff; background: rgba(255,255,255,.05); }
  .sb-account:hover { background: rgba(255,255,255,.1); }
  .sb-avatar { width: 42px; height: 42px; flex: none; border-radius: 50%; display: grid; place-items: center; font-weight: 900; font-size: 1.1rem; background: linear-gradient(135deg, #7c3aed, #3b82f6); }
  .sb-who { display: flex; flex-direction: column; min-width: 0; }
  .sb-who b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .98rem; }
  .sb-who small { color: #9ca3af; font-size: .78rem; }
  .sb-logout { color: #f87171; }
  .sb-logout:hover { background: rgba(239,68,68,.14); }
  @media (prefers-reduced-motion: reduce) { #madar-drawer, #madar-overlay { transition: none; } }`;
  document.head.appendChild(s);
}
