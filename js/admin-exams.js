import { auth, db } from "../firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

onAuthStateChanged(auth, (user) => {
  if (user) { document.getElementById("admin-name").textContent = user.displayName || "الأدمن"; } 
  else { window.location.href = "../index.html"; }
});

// السحر بتاع القوائم (السنة -> النظام -> المسار)
const gradeSelect = document.getElementById('exam-grade');
const systemGroup = document.getElementById('system-group');
const systemSelect = document.getElementById('exam-system');
const trackGroup = document.getElementById('track-group');
const trackSelect = document.getElementById('exam-track');

gradeSelect.addEventListener('change', (e) => {
  if (e.target.value === '2-sec') {
    systemGroup.classList.remove('hidden-field');
  } else {
    systemGroup.classList.add('hidden-field');
    trackGroup.classList.add('hidden-field');
  }
});

systemSelect.addEventListener('change', (e) => {
  if (e.target.value === 'baccalaureate') {
    trackGroup.classList.remove('hidden-field');
  } else {
    trackGroup.classList.add('hidden-field');
  }
});

let questionCount = 0;
const container = document.getElementById("questions-container");

// 🔥 دالة إضافة سؤال جديد (فيها اختيار النوع والصور)
function addQuestionBlock() {
  questionCount++;
  const qId = `q-${questionCount}`;
  const block = document.createElement("div");
  block.className = "question-block";
  block.id = qId;
  
  block.innerHTML = `
    <div class="q-header">
      <h4>السؤال رقم ${questionCount}</h4>
      <button class="btn-delete-q" onclick="deleteQuestion('${qId}')">حذف</button>
    </div>
    
    <div class="form-grid" style="margin-bottom: 15px;">
      <div class="input-group">
        <label>نوع السؤال</label>
        <select class="q-type" onchange="toggleQuestionType(this)">
          <option value="mcq">اختيار من متعدد</option>
          <option value="essay">سؤال مقالي</option>
        </select>
      </div>
      <div class="input-group">
        <label>رابط صورة (اختياري)</label>
        <input type="url" class="q-image" placeholder="الصق رابط الصورة هنا (رسمة/خريطة)">
      </div>
    </div>

    <div class="input-group" style="margin-bottom: 15px;">
      <label>نص السؤال</label>
      <input type="text" class="q-text-input" placeholder="اكتب السؤال هنا..." required>
    </div>

    <!-- قسم الاختيارات (بيختفي لو السؤال مقالي) -->
    <div class="mcq-section">
      <div class="options-grid">
        <div class="input-group"><label>الاختيار (A)</label><input type="text" class="q-opt1" required></div>
        <div class="input-group"><label>الاختيار (B)</label><input type="text" class="q-opt2" required></div>
        <div class="input-group"><label>الاختيار (C)</label><input type="text" class="q-opt3" required></div>
        <div class="input-group"><label>الاختيار (D)</label><input type="text" class="q-opt4" required></div>
      </div>
      <div class="input-group" style="margin-top: 15px;">
        <label style="color: #22c55e;">الإجابة الصحيحة</label>
        <select class="q-correct"><option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select>
      </div>
    </div>

    <div class="input-group" style="margin-top: 15px;">
      <label>الدرجة</label>
      <input type="number" class="q-points" value="1" min="1" required>
    </div>
  `;
  container.appendChild(block);
}

// دالة إخفاء/إظهار الاختيارات حسب النوع
window.toggleQuestionType = (selectEl) => {
    const block = selectEl.closest('.question-block');
    const mcqSection = block.querySelector('.mcq-section');
    if (selectEl.value === 'essay') {
        mcqSection.style.display = 'none';
        // نشيل شرط الـ required من الاختيارات عشان ميعطلش الحفظ
        block.querySelectorAll('.q-opt1, .q-opt2, .q-opt3, .q-opt4').forEach(input => input.required = false);
    } else {
        mcqSection.style.display = 'block';
        block.querySelectorAll('.q-opt1, .q-opt2, .q-opt3, .q-opt4').forEach(input => input.required = true);
    }
};

window.deleteQuestion = (id) => { const el = document.getElementById(id); if (el) el.remove(); };
addQuestionBlock();
document.getElementById("add-question-btn").addEventListener("click", addQuestionBlock);

// حفظ الامتحان
document.getElementById("save-exam-btn").addEventListener("click", async () => {
  const grade = gradeSelect.value;
  const system = grade === '2-sec' ? systemSelect.value : null;
  const track = (grade === '2-sec' && system === 'baccalaureate') ? trackSelect.value : null;
  const subject = document.getElementById("exam-subject").value.trim();
  const title = document.getElementById("exam-title").value.trim();
  const duration = parseInt(document.getElementById("exam-duration").value);

  if (!grade || !subject || !title) {
    Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'لازم تختار السنة وتكتب المادة والعنوان', background: '#12121f', color: '#fff' });
    return;
  }

  const questionBlocks = document.querySelectorAll(".question-block");
  const questions = [];
  let totalMarks = 0;
  let isValid = true;

  questionBlocks.forEach(block => {
    const type = block.querySelector(".q-type").value;
    const imageUrl = block.querySelector(".q-image").value.trim();
    const qText = block.querySelector(".q-text-input").value.trim();
    const points = parseInt(block.querySelector(".q-points").value);

    let qData = {
        text: qText,
        type: type,
        imageUrl: imageUrl || null,
        points: points
    };

    if (type === 'mcq') {
        const opt1 = block.querySelector(".q-opt1").value.trim();
        const opt2 = block.querySelector(".q-opt2").value.trim();
        const opt3 = block.querySelector(".q-opt3").value.trim();
        const opt4 = block.querySelector(".q-opt4").value.trim();
        const correct = parseInt(block.querySelector(".q-correct").value);

        if (!qText || !opt1 || !opt2 || !opt3 || !opt4) { isValid = false; return; }
        
        qData.options = [opt1, opt2, opt3, opt4];
        qData.correct = correct;
    } else {
        // لو مقالي، نتأكد بس إن فيه نص للسؤال
        if (!qText) { isValid = false; return; }
        qData.options = []; // مفيش اختيارات
        qData.correct = null;
    }

    totalMarks += points;
    questions.push(qData);
  });

  if (!isValid) {
    Swal.fire({ icon: 'error', title: 'خطأ', text: 'تأكد من ملء جميع بيانات الأسئلة المطلوبة', background: '#12121f', color: '#fff' });
    return;
  }

  const btn = document.getElementById("save-exam-btn");
  btn.disabled = true; btn.textContent = "جاري الحفظ...";

  try {
    await addDoc(collection(db, "exams"), {
      gradeLevel: grade,
      system: system,
      track: track,
      subject: subject,
      title: title,
      duration: duration,
      totalMarks: totalMarks,
      questions: questions,
      createdAt: serverTimestamp()
    });

    Swal.fire({ 
      icon: 'success', title: 'تم بنجاح!', text: 'تم حفظ الامتحان وربطه بالسنة الدراسية.', 
      background: '#12121f', color: '#fff' 
    }).then(() => { window.location.reload(); });

  } catch (error) {
    console.error(error);
    Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدثت مشكلة أثناء الحفظ.', background: '#12121f', color: '#fff' });
  } finally {
    btn.disabled = false; btn.textContent = "حفظ الامتحان في قاعدة البيانات";
  }
});
