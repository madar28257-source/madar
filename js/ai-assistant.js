// ==========================================
// 🤖 كود المساعد الذكي (باستخدام مكتبة Google الرسمية)
// ==========================================

import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";

// حط المفتاح بتاعك هنا (سواء AIza أو AQ)
const GEMINI_API_KEY = "ضع_المفتاح_بتاعك_هنا"; 

const aiToggleBtn = document.getElementById('ai-toggle-btn');
const aiChatBox = document.getElementById('ai-chat-box');
const aiCloseBtn = document.getElementById('ai-close-btn');
const aiSendBtn = document.getElementById('ai-send-btn');
const aiInput = document.getElementById('ai-input');
const aiMessages = document.getElementById('ai-messages');

// فتح وقفل الشات
if(aiToggleBtn) aiToggleBtn.addEventListener('click', () => { aiChatBox.classList.add('active'); });
if(aiCloseBtn) aiCloseBtn.addEventListener('click', () => { aiChatBox.classList.remove('active'); });

// إرسال الرسالة
async function sendMessage() {
  const text = aiInput.value.trim();
  if (!text) return;

  // إضافة رسالة الطالب
  addMessage(text, 'user');
  aiInput.value = '';
  
  // إضافة رسالة تحميل مؤقتة
  const loadingMsgId = 'loading-' + Date.now();
  addMessage('جاري التفكير... ⏳', 'ai', loadingMsgId);

  try {
    // تهيئة المكتبة بالمفتاح
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // إرسال الطلب
    const result = await model.generateContent(`أنت مساعد تعليمي ذكي لمنصة "مدار" التعليمية في مصر. أجب على السؤال التالي باللغة العربية بأسلوب مبسط ومشجع للطالب: ${text}`);
    const response = await result.response;
    const aiReply = response.text();
    
    // إزالة رسالة التحميل
    document.getElementById(loadingMsgId).remove();

    if (aiReply) {
      addMessage(aiReply, 'ai');
    } else {
      addMessage('عذراً يا بطل، لم أفهم إجابتك. حاول مرة أخرى.', 'ai');
    }

  } catch (error) {
    console.error("AI Error:", error);
    document.getElementById(loadingMsgId).remove();
    
    // عرض رسالة الخطأ الحقيقية عشان نعرف المشكلة
    let errorMsg = "حدث خطأ في الاتصال بالذكاء الاصطناعي.";
    if(error.message.includes("API_KEY_INVALID")) errorMsg = "مفتاح الـ API غير صحيح.";
    if(error.message.includes("PERMISSION_DENIED")) errorMsg = "المفتاح لا يملك صلاحية لاستخدام الخدمة، تأكد من تفعيلها في Google Cloud.";
    
    addMessage(`عذراً: ${errorMsg}`, 'ai');
  }
}

// دالة إضافة الرسالة في الشات
function addMessage(text, sender, id = null) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `msg ${sender}`;
  if (id) msgDiv.id = id;
  msgDiv.innerText = text; 
  aiMessages.appendChild(msgDiv);
  aiMessages.scrollTop = aiMessages.scrollHeight;
}

// ربط الزرار بزر Enter
if(aiSendBtn) aiSendBtn.addEventListener('click', sendMessage);
if(aiInput) aiInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});
