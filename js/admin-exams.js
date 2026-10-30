import { auth, db } from "../firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { collection, addDoc, serverTimestamp, getDocs, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

let allExams = [];
let allResults = [];
let currentFilter = "all";

onAuthStateChanged(auth, (user) => {
  if (user) { 
    document.getElementById("admin-name").textContent = user.displayName || "الأدمن"; 
    loadData(); 
  } else { 
    window.location.href = "../index.html"; 
  }
});

// تحميل البيانات من الفايربيز
async function loadData() {
  try {
    const examsSnap = await getDocs(collection(db, "exams"));
    const resultsSnap = await getDocs(collection(db, "results"));

    allExams = examsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    allResults = resultsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    renderExams(currentFilter);
  } catch (error) {
    console.error("Error loading data:", error);
    document.getElementById("exams-container").innerHTML = `<p style="color:red; text-align:center; grid-column:1/-1;">حدث خطأ في تحميل البيانات</p>`;
  }
}

// دالة عرض الامتحانات
function renderExams(gradeFilter) {
  const container = document.getElementById("exams-container");
  container.innerHTML = "";

  const filtered = gradeFilter === "all" ? allExams : allExams.filter(e => e.gradeLevel === gradeFilter);

  if (filtered.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted); text-align:center; grid-column:1/-1;">لا توجد امتحانات في هذا الصف.</p>`;
    return;
  }

  const gradeNames = { "1-prep": "أولى إعدادي", "2-prep": "تانية إعدادي", "3-prep": "تالتة إعدادي", "1-sec": "أولى ثانوي", "2-sec": "تانية ثانوي" };

  filtered.forEach(exam => {
    // حساب عدد الطلاب اللي امتحنوا
    const examResults = allResults.filter(r => r.examId === exam.id);
    const studentsCount = examResults.length;

    const card = document.createElement("div");
    card.className = "exam-manage-card";
    card.innerHTML = `
      <h3>${exam.title}</h3>
      <div class="meta">
        <span class="badge">${exam.subject}</span>
        <span class="badge" style="background:rgba(245,158,11,0.1); color:#f59e0b;">${gradeNames[exam.gradeLevel] || exam.gradeLevel}</span>
        <span class="badge students">${studentsCount} طالب امتحن</span>
      </div>
      <div class="card-actions">
        <button class="btn-manage" onclick="manageExam('${exam.id}')">إدارة الامتحان</button>
        <button class="btn-delete-exam" onclick="deleteExam('${exam.id}', '${exam.title}')">مسح</button>
      </div>
    `;
    container.appendChild(card);
  });
}

// دالة إدارة الامتحان (عرض الترتيب)
window.manageExam = (examId) => {
  const exam = allExams.find(e => e.id === examId);
  const examResults = allResults.filter(r => r.examId === examId);

  if (examResults.length === 0) {
    Swal.fire({ icon: 'info', title: 'لا يوجد طلاب', text: 'لم يقم أي طالب بأداء هذا الامتحان بعد.', background: '#12121f', color: '#fff' });
    return;
  }

  // ترتيب الطلاب: الدرجة الأعلى أولاً، ثم الوقت الأقل أولاً
  examResults.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score; // الأولوية للدرجة
    return (a.timeTaken || 0) - (b.timeTaken || 0); // لو الدرجة متساوية، الأسرع وقت يكسب
  });

  let tableHTML = `
    <div style="text-align:center; margin-bottom:15px;">
        <h3 style="color:#fff;">${exam.title}</h3>
        <p style="color:var(--text-muted); font-size:0.9rem;">${exam.subject} - ${examResults.length} طالب</p>
    </div>
    <table class="leaderboard-table">
      <thead>
        <tr>
          <th>الترتيب</th>
          <th>الطالب</th>
          <th>الدرجة</th>
          <th>الوقت</th>
        </tr>
      </thead>
      <tbody>
  `;

  examResults.forEach((res, index) => {
    // تنسيق الوقت
    let timeTakenStr = "غير محدد";
    if (res.timeTaken) {
        const mins = Math.floor(res.timeTaken / 60);
        const secs = res.timeTaken % 60;
        timeTakenStr = `${mins} دقيقة و ${secs} ثانية`;
    }

    tableHTML += `
        <tr>
          <td class="rank">#${index + 1}</td>
          <td>${res.studentName}</td>
          <td class="score">${res.score} / ${res.totalMarks}</td>
          <td class="time">${timeTakenStr}</td>
        </tr>
    `;
  });

  tableHTML += `</tbody></table>`;

  Swal.fire({
    html: tableHTML,
    width: 600,
    background: '#12121f',
    showCloseButton: true,
    confirmButtonText: 'إغلاق',
    confirmButtonColor: '#7c3aed'
  });
};

// دالة مسح الامتحان
window.deleteExam = (id, title) => {
  Swal.fire({
    title: 'تأكيد المسح', text: `هل أنت متأكد من مسح (${title})؟`, icon: 'warning',
    showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'نعم، امسح', cancelButtonText: 'إلغاء', background: '#12121f', color: '#fff'
  }).then(async (result) => {
    if (result.isConfirmed) {
      await deleteDoc(doc(db, "exams", id));
      Swal.fire({ icon: 'success', title: 'تم المسح', background: '#12121f', color: '#fff', timer: 1500, showConfirmButton: false });
      loadData(); // تحديث القائمة
    }
  });
};

// التابات (Filter)
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentFilter = e.target.dataset.grade;
    renderExams(currentFilter);
  });
});

// ==========================================
// الجزء الخاص بإضافة امتحان جديد (الفورم)
// ==========================================
const gradeSelect = document.getElementById('exam-grade');
const systemGroup = document.getElementById('system-group');
const systemSelect = document.getElementById('exam-system');
const trackGroup = document.getElementById('track-group');
const trackSelect = document.getElementById('exam-track');

gradeSelect.addEventListener('change', (e) => {
  if (e.target.value === '2-sec') { systemGroup.classList.remove('hidden-field'); } 
  else { systemGroup.classList.add('hidden-field'); trackGroup.classList.add('hidden-field'); }
});
systemSelect.addEventListener('change', (e) => {
  if (e.target.value === 'baccalaureate') { trackGroup.classList.remove('hidden-field'); } 
  else { trackGroup.classList.add('hidden-field'); }
});

let questionCount = 0;
const container = document.getElementById("questions-container");

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
        <input type="url" class="q-image" placeholder="الصق رابط الصورة هنا">
      </div>
    </div>
    <div class="input-group" style="margin-bottom: 15px;">
      <label>نص السؤال</label>
      <input type="text" class="q-text-input" placeholder="اكتب السؤال هنا..." required>
    </div>
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

window.toggleQuestionType = (selectEl) => {
    const block = selectEl.closest('.question-block');
    const mcqSection = block.querySelector('.mcq-section');
    if (selectEl.value === 'essay') {
        mcqSection.style.display = 'none';
        block.querySelectorAll('.q-opt1, .q-opt2, .q-opt3, .q-opt4').forEach(input => input.required = false);
    } else {
        mcqSection.style.display = 'block';
        block.querySelectorAll('.q-opt1, .q-opt2, .q-opt3, .q-opt4').forEach(input => input.required = true);
    }
};

window.deleteQuestion = (id) => { const el = document.getElementById(id); if (el) el.remove(); };
addQuestionBlock();
document.getElementById("add-question-btn").addEventListener("click", addQuestionBlock);

document.getElementById("save-exam-btn").addEventListener("click", async () => {
  const grade = gradeSelect.value;
  const system = grade === '2-sec' ? systemSelect.value : null;
  const track = (grade === '2-sec' && system === 'baccalaureate') ? trackSelect.value : null;
  const subject = document.getElementById("exam-subject").value.trim();
  const title = document.getElementById("exam-title").value.trim();
  const duration = parseInt(document.getElementById("exam-duration").value);

  if (!grade || !subject || !title) {
    Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'اختر السنة، المادة، والعنوان', background: '#12121f', color: '#fff' });
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

    let qData = { text: qText, type: type, imageUrl: imageUrl || null, points: points };

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
        if (!qText) { isValid = false; return; }
        qData.options = [];
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
      gradeLevel: grade, system: system, track: track, subject: subject, title: title, duration: duration, totalMarks: totalMarks, questions: questions, createdAt: serverTimestamp()
    });
    Swal.fire({ icon: 'success', title: 'تم الحفظ!', text: 'الامتحان متاح للطلاب الآن.', background: '#12121f', color: '#fff' });
    
    // تفريغ الفورم وتحديث الصفحة
    document.getElementById("exam-subject").value = "";
    document.getElementById("exam-title").value = "";
    container.innerHTML = "";
    questionCount = 0;
    addQuestionBlock();
    loadData(); // تحديث الكروت

  } catch (error) {
    console.error(error);
    Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدثت مشكلة أثناء الحفظ.', background: '#12121f', color: '#fff' });
  } finally {
    btn.disabled = false; btn.textContent = "حفظ الامتحان في قاعدة البيانات";
  }
});
