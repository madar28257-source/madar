// ==========================================
// 🧠 المخطط الذكي — منصة مدار (Gemini)
// ==========================================
// المفتاح والنماذج في js/ai-config.js ، والاتصال في js/ai-client.js

import { auth, db } from "../firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { generate, safeHtml, AIError } from "./ai-client.js";

const generateBtn = document.getElementById("generate-btn");
const loadingDiv = document.getElementById("loading");
const resultDiv = document.getElementById("plan-result");

let studentName = "الطالب";
let studentResults = [];

// نستنى تحميل الدرجات قبل التوليد حتى لو ضغط الطالب الزر بسرعة
let resolveReady;
const resultsReady = new Promise((r) => { resolveReady = r; });

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "index.html"; return; }
  studentName = user.displayName || "الطالب";

  try {
    const q = query(collection(db, "results"), where("studentId", "==", user.uid));
    const snap = await getDocs(q);
    snap.forEach((d) => {
      const r = d.data();
      const total = Number(r.totalMarks) || 0;
      const pct = Number.isFinite(Number(r.percentage))
        ? Math.round(Number(r.percentage))
        : (total ? Math.round((Number(r.score) / total) * 100) : 0);
      studentResults.push({ subject: r.subject || "غير محدد", pct });
    });
  } catch (error) {
    console.error("Error fetching results:", error);
  }
  resolveReady();
});

// تلخيص الدرجات حسب المادة (أقصر وأوضح للذكاء الاصطناعي من سرد كل امتحان)
function summarize(results) {
  const bySubject = {};
  results.forEach((r) => { (bySubject[r.subject] = bySubject[r.subject] || []).push(r.pct); });
  return Object.entries(bySubject).map(([subject, arr]) => {
    const avg = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    return `- ${subject}: المتوسط ${avg}% في ${arr.length} امتحان`;
  }).join("\n");
}

function alertBox(options) {
  return Swal.fire({ background: "#12121f", color: "#fff", ...options });
}

generateBtn.addEventListener("click", async () => {
  generateBtn.style.display = "none";
  loadingDiv.style.display = "block";
  resultDiv.style.display = "none";

  await resultsReady;

  if (studentResults.length === 0) {
    loadingDiv.style.display = "none";
    generateBtn.style.display = "block";
    alertBox({ icon: "info", title: "لا يوجد درجات", text: "لازم تحل امتحانات الأول عشان الذكاء الاصطناعي يقدر يحلل مستواك." });
    return;
  }

  const prompt = `أنت مستشار تعليمي ذكي في منصة "مدار". الطالب اسمه ${studentName}.
هذه خلاصة درجاته في الامتحانات السابقة:
${summarize(studentResults)}

أنشئ له خطة مذاكرة أسبوعية مخصصة بناءً على نقاط ضعفه وقوته.
القواعد:
1. ركّز بشكل أكبر على المواد التي متوسطها أقل من 50%.
2. استخدم لغة عربية بسيطة ومحفزة مع بعض الإيموجي.
3. قسّم الخطة على أيام الأسبوع من السبت إلى الجمعة.
4. ضع نصيحة سريعة لكل مادة.
5. اجعل الرد HTML فقط وباستخدام هذه الوسوم فقط: <h3> و <h4> و <p> و <ul> و <li> و <strong>، بدون أي CSS أو سكربت أو علامات \`\`\`.`;

  try {
    const { text } = await generate({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      temperature: 0.7,
      maxOutputTokens: 8192,
      thinkingLevel: "low"
    });

    const html = safeHtml(text.replace(/```html/gi, "").replace(/```/g, ""));
    loadingDiv.style.display = "none";
    resultDiv.style.display = "block";
    resultDiv.innerHTML = html;   // آمن: تم تنظيفه ولا يحتوي إلا على وسوم التنسيق
  } catch (error) {
    console.error("AI Error:", error);
    loadingDiv.style.display = "none";
    generateBtn.style.display = "block";
    const isAI = error instanceof AIError;
    alertBox({
      icon: "error",
      title: "تعذّر توليد الخطة",
      text: isAI ? error.message : "حدث خطأ غير متوقع أثناء توليد الخطة.",
      footer: isAI && error.code ? `رمز الخطأ: ${error.code}` : undefined
    });
  }
});
