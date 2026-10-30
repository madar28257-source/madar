import { auth, db } from "../firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";

// ⚠️ حط المفتاح بتاعك هنا (نفس المفتاح اللي فوق)
const GEMINI_API_KEY = "AQ.Ab8RN6Lt3Innae9OJGV7qGpBKOf9OeBd6NG18h-PstSZ8swl4g"; 

const generateBtn = document.getElementById('generate-btn');
const loadingDiv = document.getElementById('loading');
const resultDiv = document.getElementById('plan-result');

let studentName = "";
let studentResults = [];

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "index.html"; return; }
  studentName = user.displayName || "الطالب";

  try {
    const q = query(collection(db, "results"), where("studentId", "==", user.uid));
    const querySnapshot = await getDocs(q);
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      studentResults.push({
        subject: data.subject,
        score: data.score,
        totalMarks: data.totalMarks,
        percentage: data.percentage
      });
    });
  } catch (error) {
    console.error("Error fetching results:", error);
  }
});

generateBtn.addEventListener('click', async () => {
    if (studentResults.length === 0) {
        Swal.fire({ icon: 'info', title: 'لا يوجد درجات', text: 'لازم تحل امتحانات الأول عشان الذكاء الاصطناعي يقدر يحلل مستواك.', background: '#12121f', color: '#fff' });
        return;
    }

    generateBtn.style.display = 'none';
    loadingDiv.style.display = 'block';

    let resultsSummary = studentResults.map(r => `مادة ${r.subject}: جبت ${r.score} من ${r.totalMarks} (${r.percentage}%)`).join('\n');

    const prompt = `أنت مستشار تعليمي ذكي في منصة "مدار". الطالب اسمه ${studentName}.
هذه هي درجاته في الامتحانات السابقة:
${resultsSummary}

قم بإنشاء خطة مذاكرة أسبوعية مخصصة له بناءً على نقاط ضعفه وقوته.
القواعد:
1. ركز بشكل أكبر على المواد التي حصل فيها على أقل من 50%.
2. استخدم لغة عربية بسيطة ومحفزة (استخدم إيموجي).
3. قم بتقسيم الخطة على أيام الأسبوع (من السبت إلى الجمعة).
4. ضع نصائح سريعة لكل مادة.
اجعل الرد منسقاً بـ HTML (استخدم <h3> و <ul> و <li>) عشان يظهر بشكل جميل في المتصفح.`;

    try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let aiReply = response.text();
        
        if (aiReply) {
            aiReply = aiReply.replace(/```html/g, '').replace(/```/g, '');
            loadingDiv.style.display = 'none';
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = aiReply;
        } else {
            throw new Error("لم يتم استلام رد صحيح من الذكاء الاصطناعي.");
        }

    } catch (error) {
        console.error("AI Error:", error);
        loadingDiv.style.display = 'none';
        generateBtn.style.display = 'block';
        
        let errorMsg = "حدث خطأ أثناء توليد الخطة.";
        if(error.message.includes("API_KEY_INVALID")) errorMsg = "مفتاح الـ API غير صحيح.";
        if(error.message.includes("PERMISSION_DENIED")) errorMsg = "تأكد من تفعيل خدمة Gemini API في Google Cloud.";
        
        Swal.fire({ icon: 'error', title: 'خطأ', text: errorMsg, background: '#12121f', color: '#fff' });
    }
});
