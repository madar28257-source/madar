// ==========================================
// 🤖 المساعد الذكي — منصة مدار (Gemini)
// ==========================================
// المفتاح والنماذج في js/ai-config.js ، والاتصال في js/ai-client.js

import { generate, AIError, renderRichText } from "./ai-client.js";

const SYSTEM_PROMPT = `أنت «مساعد مدار الذكي»، مساعد تعليمي لطلاب المدارس في مصر على منصة «مدار».
- أجب دائمًا بالعربية المبسطة وبأسلوب ودود ومشجع.
- ابدأ بالإجابة المباشرة، ثم اشرح خطوة بخطوة مع مثال قصير عند الحاجة.
- اجعل الرد منظمًا ومختصرًا (نحو 200 كلمة) إلا إذا طلب الطالب شرحًا أطول.
- في المسائل الحسابية اعرض خطوات الحل ثم الناتج النهائي.
- لا تكتب المعادلات بصيغة LaTeX، اكتبها كنص بسيط مثل: x^2 + 3x = 0.
- إذا كان السؤال خارج الدراسة والمذاكرة، اعتذر بلطف ووجّه الطالب لما يخص دراسته.
- لا تخترع معلومات؛ إذا لم تكن متأكدًا فقل ذلك صراحة واقترح مراجعة الكتاب المدرسي أو المعلم.`;

const MAX_HISTORY = 16;      // نحتفظ بآخر 16 رسالة كذاكرة للمحادثة
const MAX_INPUT = 1000;      // أقصى طول لسؤال الطالب

const toggleBtn = document.getElementById("ai-toggle-btn");
const chatBox = document.getElementById("ai-chat-box");
const closeBtn = document.getElementById("ai-close-btn");
const sendBtn = document.getElementById("ai-send-btn");
const input = document.getElementById("ai-input");
const messages = document.getElementById("ai-messages");

if (toggleBtn && chatBox && closeBtn && sendBtn && input && messages) {
  init();
}

function init() {
  injectStyles();
  input.maxLength = MAX_INPUT;

  const history = [];   // [{ role: "user" | "model", parts: [{ text }] }]
  let busy = false;

  const openChat = () => { chatBox.classList.add("active"); setTimeout(() => input.focus(), 50); };
  const closeChat = () => chatBox.classList.remove("active");

  toggleBtn.addEventListener("click", () => (chatBox.classList.contains("active") ? closeChat() : openChat()));
  closeBtn.addEventListener("click", closeChat);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeChat(); });

  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); send(); }
  });

  async function send() {
    const text = input.value.trim();
    if (!text || busy) return;

    busy = true;
    sendBtn.disabled = true;
    input.value = "";
    addMessage(text, "user");
    history.push({ role: "user", parts: [{ text }] });

    const typing = addTyping();
    try {
      const { text: reply } = await generate({
        system: SYSTEM_PROMPT,
        contents: history.slice(-MAX_HISTORY),
        maxOutputTokens: 4096,
        thinkingLevel: "low"
      });
      typing.remove();
      addMessage(reply, "ai", true);
      history.push({ role: "model", parts: [{ text: reply }] });
    } catch (err) {
      console.error("AI Error:", err);
      history.pop();   // نشيل سؤال الطالب من الذاكرة حتى لا تتلخبط المحادثة
      typing.remove();
      const msg = err instanceof AIError ? err.message : "حدث خطأ غير متوقع. حاول مرة أخرى.";
      addError(msg, err && (err.details || err.code));
    } finally {
      busy = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  function addMessage(text, sender, rich = false) {
    const div = document.createElement("div");
    div.className = `msg ${sender}`;
    if (rich) renderRichText(text, div);
    else div.textContent = text;
    messages.appendChild(div);
    scrollDown();
    return div;
  }

  function addTyping() {
    const div = document.createElement("div");
    div.className = "msg ai typing";
    div.setAttribute("aria-label", "جاري التفكير");
    div.innerHTML = "<span></span><span></span><span></span>";   // نص ثابت من الكود، بدون أي مدخلات
    messages.appendChild(div);
    scrollDown();
    return div;
  }

  function addError(message, code) {
    const div = document.createElement("div");
    div.className = "msg ai error";
    const p = document.createElement("p");
    p.textContent = message;
    div.appendChild(p);
    if (code) {
      const small = document.createElement("small");
      small.textContent = `تفاصيل: ${code}`;
      div.appendChild(small);
    }
    messages.appendChild(div);
    scrollDown();
  }

  function scrollDown() { messages.scrollTop = messages.scrollHeight; }
}

// تنسيقات خاصة بمحتوى الرد (لا تغيّر ستايل الصفحة الأصلي)
function injectStyles() {
  if (document.getElementById("ai-assistant-styles")) return;
  const style = document.createElement("style");
  style.id = "ai-assistant-styles";
  style.textContent = `
    .msg p { margin: 0 0 6px; } .msg p:last-child { margin-bottom: 0; }
    .msg h4 { margin: 4px 0 6px; font-size: 0.95rem; }
    .msg ul, .msg ol { margin: 4px 0 6px; padding: 0 18px 0 0; }
    .msg li { margin: 2px 0; }
    .msg code { background: rgba(255,255,255,0.14); padding: 1px 5px; border-radius: 4px; direction: ltr; unicode-bidi: embed; font-size: 0.85em; }
    .msg pre { background: rgba(0,0,0,0.35); padding: 8px 10px; border-radius: 8px; overflow-x: auto; direction: ltr; text-align: left; margin: 6px 0; }
    .msg pre code { background: none; padding: 0; }
    .msg.error { background: rgba(239,68,68,0.18); border: 1px solid rgba(239,68,68,0.35); }
    .msg.error small { display: block; margin-top: 6px; opacity: 0.6; font-size: 0.72rem; direction: ltr; text-align: left; }
    .msg.typing { display: flex; gap: 5px; align-items: center; padding: 14px 16px; }
    .msg.typing span { width: 7px; height: 7px; border-radius: 50%; background: #fff; opacity: 0.35; animation: aiDot 1.2s infinite ease-in-out; }
    .msg.typing span:nth-child(2) { animation-delay: 0.2s; }
    .msg.typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes aiDot { 0%, 80%, 100% { opacity: 0.3; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-4px); } }
    #ai-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  `;
  document.head.appendChild(style);
}
