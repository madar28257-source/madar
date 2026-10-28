// ==========================================
// 🤖 كود المساعد الذكي (Gemini API)
// ==========================================

// ⚠️ حط الـ API Key بتاعك هنا بين علامات التنصيص
const GEMINI_API_KEY = "AQ.Ab8RN6IYCsd6ZHhDgROYE0QSSXFtvNXtzQD-9KSAJnoCt0ZjwQ"; 
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const aiToggleBtn = document.getElementById('ai-toggle-btn');
const aiChatBox = document.getElementById('ai-chat-box');
const aiCloseBtn = document.getElementById('ai-close-btn');
const aiSendBtn = document.getElementById('ai-send-btn');
const aiInput = document.getElementById('ai-input');
const aiMessages = document.getElementById('ai-messages');

// فتح وقفل الشات
aiToggleBtn.addEventListener('click', () => { aiChatBox.classList.add('active'); });
aiCloseBtn.addEventListener('click', () => { aiChatBox.classList.remove('active'); });

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
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `أنت مساعد تعليمي ذكي لمنصة "مدار" التعليمية في مصر. أجب على السؤال التالي باللغة العربية بأسلوب مبسط ومشجع للطالب: ${text}` }]
        }]
      })
    });

    const data = await response.json();
    
    // إزالة رسالة التحميل
    document.getElementById(loadingMsgId).remove();

    if (data.candidates && data.candidates.length > 0) {
      const aiReply = data.candidates[0].content.parts[0].text;
      addMessage(aiReply, 'ai');
    } else {
      addMessage('عذراً يا بطل، حدث خطأ في الاتصال بالذكاء الاصطناعي.', 'ai');
    }

  } catch (error) {
    console.error("AI Error:", error);
    document.getElementById(loadingMsgId).remove();
    addMessage('عذراً، تأكد من اتصالك بالإنترنت وحاول مرة أخرى.', 'ai');
  }
}

// دالة إضافة الرسالة في الشات
function addMessage(text, sender, id = null) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `msg ${sender}`;
  if (id) msgDiv.id = id;
  
  // تنسيق النص (لو فيه أكواد أو نقاط)
  msgDiv.innerText = text; 
  
  aiMessages.appendChild(msgDiv);
  aiMessages.scrollTop = aiMessages.scrollHeight;
}

// ربط الزرار بزر Enter
aiSendBtn.addEventListener('click', sendMessage);
aiInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});
