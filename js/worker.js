// ==========================================================
// 🛡️ وسيط مدار للذكاء الاصطناعي — Cloudflare Worker
// ==========================================================
// فكرته: الموقع يكلّم هذا الوسيط، والوسيط هو اللي يكلّم جوجل بالمفتاح.
// المفتاح يعيش هنا فقط (كـ Secret) ولا يظهر أبدًا في كود الموقع أو GitHub.
//
// الحماية المدمجة:
//   ✅ لا يعمل إلا لطالب مسجّل دخوله في Firebase (يتحقق من التوكن)
//   ✅ لا يقبل إلا طلبات من موقعك (ALLOWED_ORIGINS)
//   ✅ حد أقصى للطلبات لكل طالب في الدقيقة
//   ✅ يقبل نصوصًا فقط وبأحجام معقولة، ويمنع أي استخدام آخر للمفتاح
//
// الإعدادات: Settings ← Variables and Secrets
//   GEMINI_API_KEY       (Secret)  مفتاح Gemini  ← الوحيد المطلوب
//   FIREBASE_PROJECT_ID  (Text)    اختياري، الافتراضي: madar-a2fd7
//   ALLOWED_ORIGINS      (Text)    اختياري، عناوين مواقعك مفصولة بفاصلة

const DEFAULT_PROJECT_ID = "madar-a2fd7";
const DEFAULT_ORIGINS = ["https://madar28257-source.github.io"];

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const VERTEX_BASE = "https://aiplatform.googleapis.com/v1/publishers/google/models";
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

const MAX_BODY_BYTES = 200 * 1024;     // أقصى حجم للطلب
const MAX_CONTENTS = 40;               // أقصى عدد رسائل في المحادثة
const MAX_TEXT_CHARS = 60000;          // أقصى مجموع حروف في الطلب
const MAX_OUTPUT_TOKENS = 8192;
const UPSTREAM_TIMEOUT_MS = 40000;
const RATE_MAX = 20;                   // طلبات لكل طالب
const RATE_WINDOW_MS = 60 * 1000;      // في الدقيقة (تقريبي: لكل نسخة من الوسيط)

// ---------- أدوات الرد ----------
class HttpError extends Error {
  constructor(status, apiStatus, reason, message) {
    super(message);
    this.status = status; this.apiStatus = apiStatus; this.reason = reason;
  }
}

function json(status, obj, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra }
  });
}

// نفس شكل أخطاء جوجل حتى يفهمها عميل الموقع، وأسباب الوسيط تبدأ بـ PROXY_
function fail(e, extra) {
  return json(e.status, {
    error: {
      code: e.status,
      status: e.apiStatus,
      message: e.message,
      details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: e.reason }]
    }
  }, extra);
}

// ---------- CORS ----------
function allowedOrigins(env) {
  const list = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
  return list.length ? list : DEFAULT_ORIGINS;
}

function corsFor(origin, ok) {
  return {
    // للمواقع غير المسموحة نضع * فقط لكي يقرأ المتصفح رسالة الرفض الواضحة (الرفض نفسه يحدث هنا)
    "Access-Control-Allow-Origin": ok ? origin : "*",
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

// ---------- التحقق من توكن Firebase (RS256) ----------
const b64uBytes = (s) => {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};
const b64uJson = (s) => JSON.parse(new TextDecoder().decode(b64uBytes(s)));

let jwks = { keys: new Map(), exp: 0 };

async function publicKey(kid) {
  const now = Date.now();
  if (now > jwks.exp || !jwks.keys.has(kid)) {
    const res = await fetch(JWKS_URL, { cf: { cacheTtl: 300, cacheEverything: true } });
    if (!res.ok) throw new Error("jwks");
    const data = await res.json();
    const keys = new Map();
    for (const jwk of data.keys || []) {
      keys.set(jwk.kid, await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]));
    }
    jwks = { keys, exp: now + 10 * 60 * 1000 };
  }
  return jwks.keys.get(kid);
}

async function verifyFirebaseToken(token, projectId) {
  if (token.length > 4096) throw new Error("size");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("format");

  const header = b64uJson(parts[0]);
  const claims = b64uJson(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("alg");

  const key = await publicKey(header.kid);
  if (!key) throw new Error("kid");
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", key, b64uBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!valid) throw new Error("signature");

  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}`) throw new Error("claims");
  if (!(claims.exp > now) || !(claims.iat <= now + 300)) throw new Error("time");
  if (typeof claims.sub !== "string" || !claims.sub) throw new Error("sub");
  return claims.sub;
}

// ---------- حد الطلبات لكل طالب ----------
const hits = new Map();
function rateLimited(uid) {
  const now = Date.now();
  const recent = (hits.get(uid) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) { hits.set(uid, recent); return true; }
  recent.push(now);
  hits.set(uid, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > RATE_WINDOW_MS) hits.delete(k);
  }
  return false;
}

// ---------- تنظيف الطلب: نصوص فقط، وحقول معروفة فقط ----------
const bad = (message) => new HttpError(400, "INVALID_ARGUMENT", "PROXY_BAD_REQUEST", message);

function textParts(parts) {
  const texts = (Array.isArray(parts) ? parts : [])
    .map((p) => (p && typeof p.text === "string" ? p.text : ""))
    .filter(Boolean);
  return texts.map((text) => ({ text }));
}

function cleanPayload(p) {
  if (!p || typeof p !== "object" || !Array.isArray(p.contents)) throw bad("صيغة الطلب غير صحيحة.");
  if (!p.contents.length || p.contents.length > MAX_CONTENTS) throw bad("عدد الرسائل غير مقبول.");

  let chars = 0;
  const out = {
    contents: p.contents.map((c) => {
      const parts = textParts(c && c.parts);
      if (!parts.length) throw bad("رسالة فارغة.");
      parts.forEach((x) => { chars += x.text.length; });
      return { role: c && c.role === "model" ? "model" : "user", parts };
    })
  };

  if (p.systemInstruction) {
    const parts = textParts(p.systemInstruction.parts);
    parts.forEach((x) => { chars += x.text.length; });
    if (parts.length) out.systemInstruction = { parts };
  }
  if (chars > MAX_TEXT_CHARS) throw new HttpError(413, "INVALID_ARGUMENT", "PROXY_TOO_LARGE", "الطلب كبير جدًا.");

  const g = p.generationConfig && typeof p.generationConfig === "object" ? p.generationConfig : {};
  out.generationConfig = {};
  if (Number.isFinite(g.temperature)) out.generationConfig.temperature = Math.min(2, Math.max(0, g.temperature));
  out.generationConfig.maxOutputTokens = Math.min(MAX_OUTPUT_TOKENS, Math.max(1, Math.floor(g.maxOutputTokens) || 4096));
  const level = g.thinkingConfig && g.thinkingConfig.thinkingLevel;
  if (typeof level === "string" && /^[A-Za-z_]{3,12}$/.test(level)) out.generationConfig.thinkingConfig = { thinkingLevel: level };
  return out;
}

// ---------- الاتصال بجوجل ----------
async function upstream(url, init) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  } catch (_) {
    throw new HttpError(502, "UNAVAILABLE", "PROXY_UPSTREAM_FAILED", "تعذّر الوصول لخدمة جوجل.");
  }
}

async function generate(env, model, payload) {
  const key = env.GEMINI_API_KEY;
  const body = JSON.stringify(payload);
  const first = await upstream(`${GEMINI_BASE}/models/${model}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body
  });
  if (first.status !== 401 && first.status !== 403) return first;

  // ربما المفتاح من Google Cloud (Vertex Express): نجرّب خدمته قبل الاستسلام
  const second = await upstream(`${VERTEX_BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body
  });
  if (second.ok) return second;
  if (second.body) await second.body.cancel();
  return first;   // نُرجع خطأ Gemini لأنه الأوضح لمفاتيح AI Studio
}

async function listModels(env) {
  const res = await upstream(`${GEMINI_BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": env.GEMINI_API_KEY } });
  if (!res.ok) return res;
  const data = await res.json();
  const models = (data.models || []).map((m) => ({ name: m.name, supportedGenerationMethods: m.supportedGenerationMethods }));
  return json(200, { models });
}

// ==========================================================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const originOk = allowedOrigins(env).includes(origin);
    const cors = corsFor(origin, originOk);

    try {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

      // فحص سريع للتأكد أن الوسيط شغّال والمفتاح موجود (لا يكشف أي سر)
      if (request.method === "GET" && url.pathname === "/") {
        return json(200, { ok: true, service: "madar-ai-proxy", hasKey: !!env.GEMINI_API_KEY }, cors);
      }

      if (!originOk) {
        throw new HttpError(403, "PERMISSION_DENIED", "PROXY_ORIGIN_DENIED", "هذا الموقع غير مسموح له باستخدام الوسيط.");
      }

      // الدخول: لازم توكن Firebase صالح
      const bearer = (request.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
      if (!bearer) throw new HttpError(401, "UNAUTHENTICATED", "PROXY_AUTH_REQUIRED", "سجّل دخولك أولًا.");
      let uid;
      try {
        uid = await verifyFirebaseToken(bearer[1].trim(), env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID);
      } catch (_) {
        throw new HttpError(401, "UNAUTHENTICATED", "PROXY_TOKEN_INVALID", "جلسة الدخول غير صالحة أو منتهية.");
      }
      if (rateLimited(uid)) {
        return fail(new HttpError(429, "RESOURCE_EXHAUSTED", "PROXY_RATE_LIMITED", "كثرت الطلبات في وقت قصير."), { ...cors, "Retry-After": "30" });
      }
      if (!env.GEMINI_API_KEY) {
        throw new HttpError(500, "FAILED_PRECONDITION", "PROXY_NOT_CONFIGURED", "الوسيط غير مضبوط: المفتاح غير موجود.");
      }

      if (request.method === "GET" && url.pathname === "/models") {
        const res = await listModels(env);
        return new Response(res.body, { status: res.status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors } });
      }

      if (request.method === "POST" && url.pathname === "/generate") {
        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) throw new HttpError(413, "INVALID_ARGUMENT", "PROXY_TOO_LARGE", "الطلب كبير جدًا.");
        let data;
        try { data = JSON.parse(raw); } catch (_) { throw bad("الطلب ليس JSON صالحًا."); }
        if (!data || typeof data.model !== "string" || !/^gemini-[a-z0-9.\-]{1,40}$/.test(data.model)) throw bad("اسم النموذج غير مقبول.");

        const res = await generate(env, data.model, cleanPayload(data.payload));
        return new Response(res.body, { status: res.status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors } });
      }

      throw new HttpError(404, "NOT_FOUND", "PROXY_NOT_FOUND", "المسار غير موجود.");
    } catch (err) {
      if (err instanceof HttpError) return fail(err, cors);
      return fail(new HttpError(500, "INTERNAL", "PROXY_INTERNAL", "خطأ داخلي في الوسيط."), cors);
    }
  }
};
