// ==========================================
// 🤖 عميل Gemini المشترك — منصة مدار
// ==========================================
// يتعامل مع واجهة Gemini API الحالية (REST) ويدعم مفاتيح AQ. و AIza.
// يُستخدم من: ai-assistant.js (الشات) و planner.js (المخطط الذكي).

import { AI_API_KEY, AI_MODELS } from "./ai-config.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const TIMEOUT_MS = 45000;
const STORE_MODEL = "madar_ai_model";
const STORE_FOUND = "madar_ai_found";

// ---------- خطأ مخصّص برسالة عربية جاهزة للعرض ----------
export class AIError extends Error {
  constructor(message, info = {}) {
    super(message);
    this.name = "AIError";
    this.status = info.status || 0;
    this.code = info.code || "";          // رمز تقني صغير يظهر للتشخيص
    this.raw = info.raw || "";            // رسالة جوجل الأصلية
    this.modelLevel = !!info.modelLevel;  // المشكلة في النموذج نفسه؟ (فيمكن تجربة غيره)
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- فحص المفتاح ----------
function getKey() {
  const key = String(AI_API_KEY || "").trim();
  if (!key || /ضع|YOUR|PASTE/i.test(key)) {
    throw new AIError("لم يتم وضع مفتاح الذكاء الاصطناعي بعد. افتح الملف js/ai-config.js وضع المفتاح.", { code: "NO_KEY" });
  }
  if (!/^(AQ\.|AIza)[A-Za-z0-9_.\-]{20,}$/.test(key)) {
    throw new AIError("شكل المفتاح غير صحيح. تأكد أنك نسخته كاملًا (يبدأ بـ AQ. أو AIza) بدون مسافات أو علامات زائدة.", { code: "BAD_KEY_FORMAT" });
  }
  return key;
}

// ---------- قراءة خطأ جوجل وتحويله لرسالة عربية ----------
async function readError(res) {
  let body = {};
  try { body = await res.json(); } catch (_) { /* الرد ليس JSON */ }
  const e = body.error || {};
  const detail = Array.isArray(e.details) ? e.details.find((d) => d && d.reason) : null;
  return { status: res.status, apiStatus: e.status || "", message: e.message || "", reason: detail ? detail.reason : "" };
}

function toArabic({ status, apiStatus, message }) {
  const msg = String(message).toLowerCase();
  if (status === 400 && (msg.includes("api key not valid") || msg.includes("api key expired") || msg.includes("api_key_invalid"))) {
    return "مفتاح الذكاء الاصطناعي غير صحيح أو منتهي. أنشئ مفتاحًا جديدًا من Google AI Studio وضعه في js/ai-config.js.";
  }
  if (status === 400 && apiStatus === "FAILED_PRECONDITION") return "خدمة Gemini غير متاحة لهذا المفتاح في منطقتك الحالية.";
  if (status === 400) return "الخدمة لم تقبل الطلب. جرّب صياغة السؤال بشكل مختلف.";
  if (status === 401) return "جوجل رفضت المفتاح. تأكد أنه منسوخ كاملًا من Google AI Studio، أو أنشئ مفتاحًا جديدًا.";
  if (status === 403) return "جوجل رفضت الصلاحية. غالبًا المفتاح مقيّد بموقع آخر أو تم إيقافه تلقائيًا (يحدث لو ظهر المفتاح علنًا). أنشئ مفتاحًا جديدًا.";
  if (status === 404) return "النموذج المطلوب لم يعد متاحًا.";
  if (status === 429) return "وصلنا للحد المجاني للاستخدام حاليًا. انتظر دقيقة ثم حاول مرة أخرى.";
  if (status >= 500) return "خدمة الذكاء الاصطناعي مشغولة الآن. حاول بعد قليل.";
  return "حدث خطأ غير متوقع في الاتصال بالذكاء الاصطناعي.";
}

// ---------- استدعاء نموذج واحد ----------
async function callModel(model, key, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    if (!res.ok) {
      const info = await readError(res);
      // 401 يظهر أحيانًا مع النماذج المسحوبة (رسالة مضلّلة من جوجل)، لذلك نجرّب نموذجًا آخر قبل الاستسلام
      const modelLevel = [401, 404, 429].includes(info.status) || info.status >= 500 ||
        (info.status === 400 && /model/i.test(info.message) && !/api key/i.test(info.message));
      throw new AIError(toArabic(info), {
        status: info.status,
        code: `${info.status} ${info.reason || info.apiStatus}`.trim(),
        raw: info.message,
        modelLevel
      });
    }
    return await res.json();
  } catch (err) {
    if (err instanceof AIError) throw err;
    if (err && err.name === "AbortError") {
      throw new AIError("الرد تأخّر أكثر من اللازم. حاول مرة أخرى.", { code: "TIMEOUT", modelLevel: true });
    }
    throw new AIError("تعذّر الاتصال بالخدمة. تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى.", { code: "NETWORK" });
  } finally {
    clearTimeout(timer);
  }
}

// ---------- استخراج النص من الرد ----------
function extractText(data) {
  const cand = data && data.candidates && data.candidates[0];
  const parts = (cand && cand.content && cand.content.parts) || [];
  const text = parts.filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text).join("").trim();
  if (text) return text;

  const blocked = data && data.promptFeedback && data.promptFeedback.blockReason;
  if (blocked || (cand && cand.finishReason === "SAFETY")) {
    throw new AIError("لا أستطيع الرد على هذا السؤال. جرّب صياغته بشكل مختلف.", { code: "BLOCKED" });
  }
  if (cand && cand.finishReason === "MAX_TOKENS") {
    throw new AIError("الرد كان طويلًا وتوقف قبل أن يكتمل. اسأل سؤالًا أقصر أو أكثر تحديدًا.", { code: "MAX_TOKENS" });
  }
  throw new AIError("لم يصل رد من الذكاء الاصطناعي. حاول مرة أخرى.", { code: "EMPTY" });
}

// ---------- ترتيب النماذج المرشّحة ----------
function savedModel() {
  try {
    const s = JSON.parse(sessionStorage.getItem(STORE_MODEL) || "null");
    if (s && s.m && Date.now() - s.t < 10 * 60 * 1000) return s.m;
  } catch (_) { /* التخزين غير متاح */ }
  return null;
}
function rememberModel(m) {
  try { sessionStorage.setItem(STORE_MODEL, JSON.stringify({ m, t: Date.now() })); } catch (_) {}
}

// اكتشاف أحدث نماذج flash المتاحة لهذا المفتاح (خطة طوارئ لو جوجل سحبت كل النماذج المعروفة)
function versionOf(name) {
  const m = name.match(/^gemini-(\d+)(?:\.(\d+))?/);
  return m ? Number(m[1]) * 1000 + Number(m[2] || 0) : 0;
}
async function discoverModels(key) {
  try {
    const c = JSON.parse(sessionStorage.getItem(STORE_FOUND) || "null");
    if (c && Date.now() - c.t < 60 * 60 * 1000) return c.list;
  } catch (_) {}
  try {
    const res = await fetch(`${BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": key } });
    if (!res.ok) return [];
    const data = await res.json();
    const list = (data.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => String(m.name || "").replace(/^models\//, ""))
      .filter((n) => /^gemini-\d+(\.\d+)?-flash(-lite)?$/.test(n))
      .sort((a, b) => versionOf(b) - versionOf(a) || (a.endsWith("-lite") ? 1 : 0) - (b.endsWith("-lite") ? 1 : 0));
    try { sessionStorage.setItem(STORE_FOUND, JSON.stringify({ t: Date.now(), list })); } catch (_) {}
    return list;
  } catch (_) {
    return [];
  }
}

// ==========================================
// الدالة الرئيسية: تُرجع { text, model }
// ==========================================
//  system          : تعليمات الشخصية (اختياري)
//  contents        : [{ role: "user" | "model", parts: [{ text }] }]
//  maxOutputTokens : يشمل رموز "التفكير" الداخلية، لذلك القيمة الافتراضية كبيرة
//  thinkingLevel   : "low" = أسرع (مناسب للمساعد). مرّر null لتعطيله.
export async function generate({ system = "", contents, temperature = 0.7, maxOutputTokens = 4096, thinkingLevel = "low" }) {
  const key = getKey();

  const body = { contents, generationConfig: { temperature, maxOutputTokens } };
  if (thinkingLevel) body.generationConfig.thinkingConfig = { thinkingLevel };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  const tried = new Set();

  // محاولة على نموذج واحد (مع إعادة عند الازدحام، وبدون thinking لو لم يدعمه)
  async function attempt(model) {
    tried.add(model);
    let payload = body;
    let waited = false;
    let dropped = false;
    for (;;) {
      try {
        const data = await callModel(model, key, payload);
        return { text: extractText(data), model };
      } catch (err) {
        if (!(err instanceof AIError)) throw err;
        if (err.status === 400 && /thinking/i.test(err.raw) && !dropped) {
          dropped = true;
          const cfg = { ...payload.generationConfig };
          delete cfg.thinkingConfig;
          payload = { ...payload, generationConfig: cfg };
          continue;
        }
        if ((err.status === 500 || err.status === 503) && !waited) {
          waited = true;
          await sleep(1500);
          continue;
        }
        throw err;
      }
    }
  }

  let lastErr = null;
  async function tryList(models) {
    for (const m of models) {
      if (tried.has(m)) continue;
      try {
        const r = await attempt(m);
        rememberModel(m);
        return r;
      } catch (err) {
        if (!(err instanceof AIError)) throw err;
        lastErr = err;
        if (!err.modelLevel) throw err;   // مشكلة في المفتاح أو الإنترنت: لا فائدة من تجربة نموذج آخر
      }
    }
    return null;
  }

  const first = savedModel();
  let result = await tryList([...(first ? [first] : []), ...AI_MODELS]);
  if (result) return result;

  // كل النماذج المعروفة فشلت: نكتشف المتاح لهذا المفتاح فعليًا
  if (lastErr && (lastErr.status === 404 || lastErr.status === 401)) {
    result = await tryList((await discoverModels(key)).slice(0, 4));
    if (result) return result;
  }
  throw lastErr || new AIError("تعذّر الحصول على رد من الذكاء الاصطناعي.", { code: "UNKNOWN" });
}

// ==========================================
// 🖼️ أدوات عرض آمنة (بدون innerHTML خام)
// ==========================================

// يحوّل نص الشات (**غامق**، `كود`، قوائم، عناوين) إلى عناصر DOM آمنة
export function renderRichText(text, container) {
  container.textContent = "";
  const addInline = (el, s) => {
    const re = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;
    let last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) el.appendChild(document.createTextNode(s.slice(last, m.index)));
      const tok = m[0];
      const node = document.createElement(tok.startsWith("**") ? "strong" : "code");
      node.textContent = tok.startsWith("**") ? tok.slice(2, -2) : tok.slice(1, -1);
      el.appendChild(node);
      last = m.index + tok.length;
    }
    if (last < s.length) el.appendChild(document.createTextNode(s.slice(last)));
  };
  const flushCode = (buf) => {
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = buf.join("\n");
    pre.appendChild(code);
    container.appendChild(pre);
  };

  let list = null, listType = "", inCode = false, codeBuf = [];
  for (const raw of String(text).replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (line.trim().startsWith("```")) {
      if (inCode) { flushCode(codeBuf); codeBuf = []; inCode = false; }
      else { list = null; inCode = true; }
      continue;
    }
    if (inCode) { codeBuf.push(raw); continue; }

    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      const type = ul ? "ul" : "ol";
      if (!list || listType !== type) {
        list = document.createElement(type);
        listType = type;
        container.appendChild(list);
      }
      const li = document.createElement("li");
      addInline(li, (ul || ol)[1]);
      list.appendChild(li);
      continue;
    }
    list = null;
    if (!line.trim()) continue;
    const h = line.match(/^#{1,4}\s+(.*)$/);
    const el = document.createElement(h ? "h4" : "p");
    addInline(el, h ? h[1] : line);
    container.appendChild(el);
  }
  if (inCode && codeBuf.length) flushCode(codeBuf);
}

// ينظّف HTML مولَّد من الذكاء الاصطناعي ويُبقي وسوم التنسيق فقط (بدون سكربتات أو خصائص)
const ALLOWED = new Set(["H2", "H3", "H4", "P", "UL", "OL", "LI", "STRONG", "B", "EM", "I", "BR", "HR", "SPAN", "DIV", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD"]);
const DROPPED = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "SVG", "MATH", "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT"]);

function cleanNode(node) {
  const out = document.createDocumentFragment();
  node.childNodes.forEach((ch) => {
    if (ch.nodeType === 3) {
      out.appendChild(document.createTextNode(ch.nodeValue));
    } else if (ch.nodeType === 1) {
      const tag = ch.tagName.toUpperCase();
      if (DROPPED.has(tag)) return;
      const inner = cleanNode(ch);
      if (ALLOWED.has(tag)) {
        const el = document.createElement(tag.toLowerCase());
        el.appendChild(inner);
        out.appendChild(el);
      } else {
        out.appendChild(inner);
      }
    }
  });
  return out;
}

export function safeHtml(html) {
  const doc = new DOMParser().parseFromString(String(html), "text/html");
  const box = document.createElement("div");
  box.appendChild(cleanNode(doc.body));
  return box.innerHTML;
}
