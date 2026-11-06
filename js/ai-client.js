// ==========================================
// 🤖 عميل Gemini المشترك — منصة مدار
// ==========================================
// يتعامل مع واجهة Gemini API الحالية (REST) ويدعم مفاتيح AQ. و AIza.
// يُستخدم من: ai-assistant.js (الشات) و planner.js (المخطط الذكي).

import * as CFG from "./ai-config.js?v=4";   // v=4 يجبر المتصفح على تحميل أحدث إعدادات

const AI_API_KEY = CFG.AI_API_KEY;
const AI_MODELS = Array.isArray(CFG.AI_MODELS) && CFG.AI_MODELS.length
  ? CFG.AI_MODELS
  : ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];

// 🛡️ الوسيط (Cloudflare Worker): لو رابطه موجود في ai-config.js يمر كل شيء عبره،
// والمفتاح يعيش عند Cloudflare فقط ولا يظهر في الموقع أو GitHub.
const PROXY_RAW = String(CFG.AI_PROXY_URL || "").trim().replace(/\/+$/, "");
const PROXY = PROXY_RAW && !/^https?:\/\//i.test(PROXY_RAW) ? `https://${PROXY_RAW}` : PROXY_RAW;
const USE_PROXY = /^https:\/\/[^\s/]+/i.test(PROXY);
const KEY_WHERE = USE_PROXY ? "في إعدادات الوسيط على Cloudflare (السر GEMINI_API_KEY)" : "في الملف js/ai-config.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const TIMEOUT_MS = 45000;
const STORE_MODEL = "madar_ai_model";
const STORE_FOUND = "madar_ai_found";
const STORE_BACKEND = "madar_ai_backend";

// الخدمتان اللتان يقبلان مفاتيح AQ. :
//  gemini = مفاتيح Google AI Studio (الأشهر)
//  vertex = مفاتيح Google Cloud / Vertex AI Express
const BACKENDS = {
  gemini: {
    url: (model) => `${BASE}/models/${encodeURIComponent(model)}:generateContent`,
    headers: (key) => ({ "x-goog-api-key": key })
  },
  vertex: {
    url: (model, key) => `https://aiplatform.googleapis.com/v1/publishers/google/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    headers: () => ({})
  }
};

// جزء بسيط من المفتاح للتأكد أن المفتاح الجديد هو الذي يُستخدم فعلًا
function keyHint(key) {
  return key && key.length > 14 ? `${key.slice(0, 6)}…${key.slice(-4)}` : "—";
}

// ---------- خطأ مخصّص برسالة عربية جاهزة للعرض ----------
export class AIError extends Error {
  constructor(message, info = {}) {
    super(message);
    this.name = "AIError";
    this.status = info.status || 0;
    this.code = info.code || "";          // رمز تقني صغير يظهر للتشخيص
    this.raw = info.raw || "";            // رسالة جوجل الأصلية
    this.modelLevel = !!info.modelLevel;  // المشكلة في النموذج نفسه؟ (فيمكن تجربة غيره)
    this.backend = info.backend || "";
    this.proxy = !!info.proxy;           // الخطأ صادر من الوسيط نفسه (لا فائدة من إعادة المحاولة)
    this.details = info.details || "";   // سطر صغير للتشخيص يظهر تحت الرسالة
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- فحص المفتاح ----------
function getKey() {
  const key = String(AI_API_KEY || "").trim();
  if (!key || /ضع|YOUR|PASTE/i.test(key)) {
    const why = !("AI_PROXY_URL" in CFG) ? "السطر AI_PROXY_URL غير موجود في الملف (نسخة قديمة من ai-config.js)"
      : !PROXY_RAW ? "AI_PROXY_URL فارغ"
      : `AI_PROXY_URL غير صالح: ${PROXY_RAW.slice(0, 24)}`;
    throw new AIError("الذكاء الاصطناعي غير مضبوط بعد. ضع رابط الوسيط في AI_PROXY_URL (يبدأ بـ https://) داخل الملف js/ai-config.js، وتأكد أنك رفعت الملف على GitHub وانتظرت دقيقة.",
      { code: "NO_CONFIG", details: `NO_CONFIG | ${why}` });
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
    return `مفتاح الذكاء الاصطناعي غير صحيح أو موقوف. أنشئ مفتاحًا جديدًا من Google AI Studio وضعه ${KEY_WHERE}.`;
  }
  if (status === 400 && apiStatus === "FAILED_PRECONDITION") return "خدمة Gemini غير متاحة لهذا المفتاح في منطقتك الحالية.";
  if (status === 400) return "الخدمة لم تقبل الطلب. جرّب صياغة السؤال بشكل مختلف.";
  if (status === 401) return USE_PROXY
    ? "جوجل رفضت المفتاح المحفوظ في الوسيط. أنشئ مفتاحًا جديدًا من Google AI Studio (aistudio.google.com/app/apikey) وحدّثه في إعدادات الوسيط على Cloudflare."
    : "جوجل رفضت المفتاح. تأكد أنه منسوخ كاملًا من Google AI Studio، أو أنشئ مفتاحًا جديدًا.";
  if (status === 403) return `جوجل رفضت الصلاحية. غالبًا المفتاح مقيّد بموقع آخر أو تم إيقافه تلقائيًا (يحدث لو ظهر المفتاح علنًا). أنشئ مفتاحًا جديدًا وضعه ${KEY_WHERE}.`;
  if (status === 404) return "النموذج المطلوب لم يعد متاحًا.";
  if (status === 429) return "وصلنا للحد المجاني للاستخدام حاليًا. انتظر دقيقة ثم حاول مرة أخرى.";
  if (status >= 500) return "خدمة الذكاء الاصطناعي مشغولة الآن. حاول بعد قليل.";
  return "حدث خطأ غير متوقع في الاتصال بالذكاء الاصطناعي.";
}

// رسائل أخطاء الوسيط نفسه (أسبابها تبدأ بـ PROXY_)
function proxyMessage(reason, fallback) {
  switch (reason) {
    case "PROXY_AUTH_REQUIRED":
    case "PROXY_TOKEN_INVALID": return "انتهت جلسة الدخول. سجّل الدخول من جديد ثم حاول مرة أخرى.";
    case "PROXY_ORIGIN_DENIED": return "عنوان موقعك غير مضاف في إعدادات الوسيط. أضفه في المتغير ALLOWED_ORIGINS على Cloudflare.";
    case "PROXY_RATE_LIMITED": return "كثرت الطلبات في وقت قصير. انتظر نصف دقيقة ثم حاول مرة أخرى.";
    case "PROXY_NOT_CONFIGURED": return "الوسيط لم يُضبط بعد: أضف السر GEMINI_API_KEY في إعداداته على Cloudflare.";
    case "PROXY_BAD_REQUEST":
    case "PROXY_TOO_LARGE": return "الطلب كبير أو غير صالح. اختصر سؤالك وحاول مرة أخرى.";
    case "PROXY_UPSTREAM_FAILED": return "تعذّر وصول الوسيط لخدمة جوجل. حاول بعد قليل.";
    default: return fallback || "حدث خطأ في الوسيط.";
  }
}

// توكن دخول الطالب في Firebase: الوسيط يتأكد منه قبل أي طلب
async function getIdToken(force = false) {
  let auth = null;
  try { ({ auth } = await import("../firebase.js")); } catch (_) { /* سنعرض رسالة مناسبة */ }
  if (!auth) throw new AIError("تعذّر تحميل نظام الدخول. أعد تحميل الصفحة.", { code: "proxy NO_AUTH_MODULE" });
  try { if (auth.authStateReady) await auth.authStateReady(); } catch (_) {}
  const user = auth.currentUser;
  if (!user) throw new AIError("سجّل دخولك أولًا لاستخدام الذكاء الاصطناعي.", { status: 401, code: "proxy NOT_SIGNED_IN" });
  return user.getIdToken(force);
}

// ---------- استدعاء نموذج واحد ----------
async function callModel(backend, model, key, body, freshToken = false) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let res;
    if (backend === "proxy") {
      const token = await getIdToken(freshToken);
      res = await fetch(`${PROXY}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ model, payload: body }),
        signal: ctrl.signal
      });
    } else {
      const be = BACKENDS[backend];
      res = await fetch(be.url(model, key), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...be.headers(key) },
        body: JSON.stringify(body),
        signal: ctrl.signal
      });
    }
    if (!res.ok) {
      const info = await readError(res);
      const fromProxy = backend === "proxy" && info.reason.startsWith("PROXY_");
      // التوكن انتهى للتو: نجرّب مرة واحدة بتوكن جديد
      if (fromProxy && info.reason === "PROXY_TOKEN_INVALID" && !freshToken) {
        return await callModel(backend, model, key, body, true);
      }
      // 401 يظهر أحيانًا مع النماذج المسحوبة (رسالة مضلّلة من جوجل)، لذلك نجرّب نموذجًا آخر قبل الاستسلام
      const modelLevel = fromProxy
        ? info.reason === "PROXY_UPSTREAM_FAILED"
        : ([401, 404, 429].includes(info.status) || info.status >= 500 ||
          (info.status === 400 && /model/i.test(info.message) && !/api key/i.test(info.message)));
      throw new AIError(fromProxy ? proxyMessage(info.reason, info.message) : toArabic(info), {
        status: info.status,
        code: `${backend} ${info.status} ${info.reason || info.apiStatus}`.trim(),
        raw: info.message,
        backend,
        proxy: fromProxy,
        modelLevel
      });
    }
    return await res.json();
  } catch (err) {
    if (err instanceof AIError) throw err;
    if (err && err.name === "AbortError") {
      throw new AIError("الرد تأخّر أكثر من اللازم. حاول مرة أخرى.", { code: `${backend} TIMEOUT`, backend, modelLevel: true });
    }
    throw new AIError(
      USE_PROXY
        ? "تعذّر الاتصال بالوسيط. تأكد من الإنترنت ومن رابط الوسيط في js/ai-config.js."
        : "تعذّر الاتصال بالخدمة. تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى.",
      { code: `${backend} NETWORK`, backend }
    );
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
    const res = USE_PROXY
      ? await fetch(`${PROXY}/models`, { headers: { Authorization: `Bearer ${await getIdToken()}` } })
      : await fetch(`${BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": key } });
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
  const key = USE_PROXY ? "" : getKey();

  const body = { contents, generationConfig: { temperature, maxOutputTokens } };
  if (thinkingLevel) body.generationConfig.thinkingConfig = { thinkingLevel };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  // تجربة كل النماذج على خدمة واحدة
  async function runBackend(backend) {
    const tried = new Set();

    // محاولة على نموذج واحد (مع إعادة عند الازدحام، وبدون thinking لو لم يدعمه)
    async function attempt(model) {
      tried.add(model);
      let payload = body;
      let waited = false;
      let dropped = false;
      for (;;) {
        try {
          const data = await callModel(backend, model, key, payload);
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
          if ((err.status === 500 || err.status === 503) && !waited && !err.proxy) {
            waited = true;
            await sleep(1500);
            continue;
          }
          throw err;
        }
      }
    }

    let lastErr = null;
    let upstreamFails = 0;
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
        if (err.proxy && ++upstreamFails >= 2) throw err;   // الوسيط لا يصل لجوجل: لا نُطيل الانتظار بتجربة كل النماذج
        }
      }
      return null;
    }

    const first = savedModel();
    const known = backend === "vertex" ? AI_MODELS.slice(0, 2) : AI_MODELS;
    let result = await tryList([...(first ? [first] : []), ...known]);
    if (result) return result;

    // (خدمة Gemini فقط) كل النماذج المعروفة فشلت: نكتشف المتاح لهذا المفتاح فعليًا
    if (backend !== "vertex" && lastErr && (lastErr.status === 404 || lastErr.status === 401)) {
      result = await tryList((await discoverModels(key)).slice(0, 4));
      if (result) return result;
    }
    throw lastErr || new AIError("تعذّر الحصول على رد من الذكاء الاصطناعي.", { code: `${backend} UNKNOWN`, backend });
  }

  // هل المفتاح نفسه مرفوض على هذه الخدمة؟ (إذن ربما هو من النوع الآخر)
  const keyRejected = (e) =>
    [401, 403, 404].includes(e.status) || (e.status === 400 && /api key/i.test(e.raw));

  let saved = "";
  try { saved = sessionStorage.getItem(STORE_BACKEND) || ""; } catch (_) {}
  const order = USE_PROXY ? ["proxy"] : (saved === "vertex" ? ["vertex", "gemini"] : ["gemini", "vertex"]);

  const failures = [];
  for (const backend of order) {
    try {
      const r = await runBackend(backend);
      try { sessionStorage.setItem(STORE_BACKEND, backend); } catch (_) {}
      return r;
    } catch (err) {
      if (!(err instanceof AIError)) throw err;
      failures.push(err);
      if (USE_PROXY) { err.details = (err.raw ? `${err.code} | ${err.raw}` : err.code).slice(0, 260); throw err; }   // وضع الوسيط: خدمة واحدة، فلا بديل نجرّبه
      // خدمة Vertex قد تكون محجوبة من المتصفح: لو الأولى رفضت المفتاح فلا نعرض "تأكد من الإنترنت"
      const unreachableAfterReject = failures.length > 1 && /NETWORK$/.test(err.code);
      if (!keyRejected(err) && !unreachableAfterReject) {
        // المفتاح مقبول لكن هناك مشكلة أخرى (ازدحام، حد مجاني، إنترنت): لا نجرّب الخدمة الأخرى
        err.details = `${err.code} | المفتاح: ${keyHint(key)}`;
        throw err;
      }
    }
  }

  // الخدمتان رفضتا المفتاح (أو إحداهما لا يمكن الوصول إليها من المتصفح)
  const primary = failures.find((e) => e.backend === "gemini") || failures[0];
  const hint = "جوجل رفضت المفتاح. تأكد أنه من Google AI Studio (aistudio.google.com/app/apikey) وليس من Google Cloud، ثم الصقه كاملًا في الملف js/ai-config.js.";
  const err = new AIError(
    // 403 = جوجل عرفت المفتاح لكنه ممنوع (مقيّد أو موقوف)، فنُبقي رسالتها الأدق ونضيف التلميح
    primary.status === 403 ? `${primary.message} وإن استمر الخطأ فتأكد أن المفتاح من Google AI Studio وليس من Google Cloud.` : hint,
    { status: primary.status, code: primary.code, raw: primary.raw, backend: primary.backend }
  );
  const lines = failures.map((e) => e.code + (e.raw ? ` (${e.raw.slice(0, 90)})` : ""));
  err.details = `${lines.join("  ||  ")} | المفتاح: ${keyHint(key)}`;
  throw err;
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
